<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    public function __construct(private TelegramService $telegram)
    {
    }

    public function handle(Request $request, string $secret): JsonResponse
    {
        $expected = (string) config('services.telegram.webhook_secret');
        if ($expected === '' || ! hash_equals($expected, $secret)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! $this->telegram->isEnabled()) {
            return response()->json(['ok' => true]);
        }

        $update = $request->all();
        $message = $update['message'] ?? null;

        if (! is_array($message)) {
            return response()->json(['ok' => true]);
        }

        $chat = $message['chat'] ?? null;
        $from = $message['from'] ?? null;
        $text = trim((string) ($message['text'] ?? ''));

        if (! is_array($chat) || ! is_array($from) || $text === '') {
            return response()->json(['ok' => true]);
        }

        try {
            $telegramUser = $this->telegram->upsertTelegramUser($from, (int) $chat['id']);

            if (str_starts_with($text, '/start')) {
                $this->handleStart($telegramUser, $text, (int) $chat['id']);
            } elseif (str_starts_with($text, '/track')) {
                $this->handleTrack($telegramUser, $text, (int) $chat['id']);
            } elseif (str_starts_with($text, '/orders')) {
                $this->handleOrders($telegramUser, (int) $chat['id']);
            } elseif (str_starts_with($text, '/help')) {
                $this->sendHelp((int) $chat['id']);
            }
        } catch (\Throwable $e) {
            Log::error('Telegram webhook handler failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    private function handleStart($telegramUser, string $text, int $chatId): void
    {
        $parts = preg_split('/\s+/', $text, 2);
        $payload = isset($parts[1]) ? trim($parts[1]) : '';

        if ($payload === '') {
            $this->sendWelcome($chatId);

            return;
        }

        if (str_starts_with($payload, 'order_')) {
            $orderKey = substr($payload, 6);
            $order = Order::findByPublicKey($orderKey)?->load('shipment');

            if (! $order) {
                $this->telegram->sendMessage((string) $chatId, "❌ Order `{$orderKey}` was not found.");

                return;
            }

            $this->telegram->subscribeChatToOrder($telegramUser, $order);
            $label = $order->order_number ?: '#'.$order->id;
            $this->telegram->sendMessage(
                (string) $chatId,
                "✅ You are now subscribed to order `{$label}`.\n\nWe will notify you when it ships and delivers."
            );
            $this->telegram->sendOrderStatusReply($chatId, $order);

            return;
        }

        if (str_starts_with($payload, 'link_')) {
            $segments = explode('_', $payload);
            if (count($segments) !== 3) {
                $this->telegram->sendMessage((string) $chatId, '❌ Invalid account link. Please open a fresh link from your profile or order page.');

                return;
            }

            $userId = (int) $segments[1];
            $signature = $segments[2];

            if (! $this->telegram->verifyAccountLinkSignature($userId, $signature)) {
                $this->telegram->sendMessage((string) $chatId, '❌ This account link has expired or is invalid.');

                return;
            }

            $this->telegram->linkTelegramToUser($telegramUser, $userId);
            $this->telegram->sendMessage(
                (string) $chatId,
                "✅ Your Telegram is now linked to your Fitandsleek account.\n\nYou will receive order updates here automatically."
            );

            return;
        }

        $this->sendWelcome($chatId);
    }

    private function handleTrack($telegramUser, string $text, int $chatId): void
    {
        $parts = preg_split('/\s+/', $text, 2);
        $orderKey = isset($parts[1]) ? trim($parts[1]) : '';

        if ($orderKey === '') {
            $this->telegram->sendMessage(
                (string) $chatId,
                "Usage: `/track FS-123456`\n\nOr open the tracking link from your order confirmation."
            );

            return;
        }

        $order = Order::findByPublicKey($orderKey)?->load('shipment');

        if (! $order) {
            $this->telegram->sendMessage((string) $chatId, "❌ Order `{$orderKey}` was not found.");

            return;
        }

        if ($telegramUser->user_id && (int) $telegramUser->user_id !== (int) $order->user_id) {
            $this->telegram->sendMessage((string) $chatId, '❌ This order does not belong to your linked account.');

            return;
        }

        $this->telegram->subscribeChatToOrder($telegramUser, $order);
        $this->telegram->sendOrderStatusReply($chatId, $order);
    }

    private function handleOrders($telegramUser, int $chatId): void
    {
        if (! $telegramUser->user_id) {
            $this->telegram->sendMessage(
                (string) $chatId,
                "Link your account first using the *Connect Telegram* button in Fitandsleek profile or order page."
            );

            return;
        }

        $orders = Order::with('shipment')
            ->where('user_id', $telegramUser->user_id)
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        if ($orders->isEmpty()) {
            $this->telegram->sendMessage((string) $chatId, 'You have no orders yet.');

            return;
        }

        $lines = ["📋 *Your recent orders*", ''];
        foreach ($orders as $order) {
            $label = $order->order_number ?: '#'.$order->id;
            $status = ucfirst(str_replace('_', ' ', (string) $order->status));
            $lines[] = "• `{$label}` — {$status}";
        }
        $lines[] = '';
        $lines[] = 'Use `/track ORDER_NUMBER` for details.';

        $this->telegram->sendMessage((string) $chatId, implode("\n", $lines));
    }

    private function sendWelcome(int $chatId): void
    {
        $this->telegram->sendMessage(
            (string) $chatId,
            "👋 Welcome to *Fitandsleek* order updates.\n\n"
            ."• Open a tracking link from your order page to subscribe\n"
            ."• `/track ORDER_NUMBER` — check order status\n"
            ."• `/orders` — recent orders (linked account)\n"
            ."• `/help` — show commands"
        );
    }

    private function sendHelp(int $chatId): void
    {
        $this->telegram->sendMessage(
            (string) $chatId,
            "*Commands*\n\n"
            ."/track ORDER\\_NUMBER — order status\n"
            ."/orders — your recent orders\n"
            ."/help — this message\n\n"
            ."Tip: tap *Get updates on Telegram* after checkout to subscribe instantly."
        );
    }
}
