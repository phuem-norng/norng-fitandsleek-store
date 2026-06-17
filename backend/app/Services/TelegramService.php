<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\TelegramOrderSubscription;
use App\Models\TelegramUser;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    public function isEnabled(): bool
    {
        return filled(config('services.telegram.bot_token'));
    }

    public function botUsername(): ?string
    {
        $name = trim((string) config('services.telegram.bot_name', ''));

        return $name !== '' ? ltrim($name, '@') : null;
    }

    public function buildBotDeepLink(string $startPayload): ?string
    {
        $username = $this->botUsername();
        if (! $username) {
            return null;
        }

        return 'https://t.me/'.$username.'?start='.rawurlencode($startPayload);
    }

    public function buildOrderConnectLink(Order $order): ?string
    {
        $key = $order->order_number ?: (string) $order->id;

        return $this->buildBotDeepLink('order_'.$key);
    }

    public function buildAccountConnectLink(int $userId): ?string
    {
        $signature = substr(hash_hmac('sha256', (string) $userId, (string) config('app.key')), 0, 16);

        return $this->buildBotDeepLink('link_'.$userId.'_'.$signature);
    }

    public function verifyAccountLinkSignature(int $userId, string $signature): bool
    {
        $expected = substr(hash_hmac('sha256', (string) $userId, (string) config('app.key')), 0, 16);

        return hash_equals($expected, $signature);
    }

    public function notifyOrderPaid(Order $order): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $order->loadMissing(['user', 'items', 'shipment']);

        $this->notifyAdminOfNewOrder($order);
        $this->createInAppNotification(
            $order,
            'order_paid',
            'Order confirmed',
            'Your payment was received. We are preparing your order.'
        );

        $link = $this->buildOrderConnectLink($order);
        $label = $order->order_number ?: '#'.$order->id;
        $total = number_format((float) $order->total, 2);

        $message = "✅ *Order confirmed*\n\n"
            ."Order: `{$label}`\n"
            ."Total: \${$total}\n"
            ."Status: Preparing for shipment\n\n"
            ."You will receive updates when your order ships.";

        $replyMarkup = $link ? [
            'inline_keyboard' => [[
                ['text' => '📦 Track this order on Telegram', 'url' => $link],
            ]],
        ] : null;

        $this->notifyOrderRecipients($order, $message, $replyMarkup);
    }

    public function notifyOrderShipped(Shipment $shipment): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $shipment->loadMissing('order.user');
        $order = $shipment->order;
        if (! $order) {
            return;
        }

        $label = $order->order_number ?: '#'.$order->id;
        $provider = $shipment->provider ?: 'Courier';
        $trackingCode = $shipment->tracking_code ?: '—';

        $message = "📦 *Order shipped*\n\n"
            ."Order: `{$label}`\n"
            ."Courier: {$provider}\n"
            ."Tracking: `{$trackingCode}`";

        $buttons = [];
        if (filled($shipment->external_tracking_url)) {
            $buttons[] = [
                ['text' => "Track on {$provider}", 'url' => $shipment->external_tracking_url],
            ];
        }

        $replyMarkup = $buttons !== [] ? ['inline_keyboard' => $buttons] : null;

        $this->createInAppNotification(
            $order,
            'order_shipped',
            'Order shipped',
            "Your order was handed to {$provider}. Tracking: {$trackingCode}"
        );

        $this->notifyOrderRecipients($order, $message, $replyMarkup);
    }

    public function notifyOrderDelivered(Shipment $shipment): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $shipment->loadMissing('order.user');
        $order = $shipment->order;
        if (! $order) {
            return;
        }

        $label = $order->order_number ?: '#'.$order->id;

        $message = "🎉 *Order delivered*\n\n"
            ."Order: `{$label}`\n"
            ."Thank you for shopping with Fitandsleek!";

        $this->createInAppNotification(
            $order,
            'order_delivered',
            'Order delivered',
            'Your order has been delivered. Thank you for shopping with us!'
        );

        $this->notifyOrderRecipients($order, $message);
    }

    public function notifyAdminOfNewOrder(Order $order): void
    {
        $chatId = config('services.telegram.admin_chat_id');
        if (! filled($chatId)) {
            return;
        }

        $order->loadMissing(['user', 'items']);
        $label = $order->order_number ?: '#'.$order->id;
        $customer = $order->user?->name ?: 'Guest';
        $phone = $this->resolveOrderPhone($order);
        $itemCount = $order->items->count();
        $total = number_format((float) $order->total, 2);
        $address = $this->formatAddress($order);

        $message = "🔔 *New paid order*\n\n"
            ."Order: `{$label}`\n"
            ."Customer: {$customer}\n"
            ."Phone: {$phone}\n"
            ."Items: {$itemCount}\n"
            ."Total: \${$total}\n"
            ."Address: {$address}";

        $this->sendMessage((string) $chatId, $message);
    }

    public function upsertTelegramUser(array $from, int $chatId): TelegramUser
    {
        return TelegramUser::updateOrCreate(
            ['telegram_user_id' => (int) $from['id']],
            [
                'chat_id' => $chatId,
                'username' => $from['username'] ?? null,
                'first_name' => $from['first_name'] ?? null,
                'last_name' => $from['last_name'] ?? null,
                'language_code' => $from['language_code'] ?? null,
                'last_interacted_at' => now(),
            ]
        );
    }

    public function linkTelegramToUser(TelegramUser $telegramUser, int $userId): void
    {
        $telegramUser->update(['user_id' => $userId]);
    }

    public function subscribeChatToOrder(TelegramUser $telegramUser, Order $order): void
    {
        TelegramOrderSubscription::firstOrCreate(
            [
                'order_id' => $order->id,
                'chat_id' => $telegramUser->chat_id,
            ],
            ['telegram_user_id' => $telegramUser->id]
        );
    }

    public function isUserConnected(int $userId): bool
    {
        return TelegramUser::where('user_id', $userId)->exists();
    }

    public function sendOrderStatusReply(int $chatId, Order $order): void
    {
        $order->loadMissing('shipment');
        $label = $order->order_number ?: '#'.$order->id;
        $status = ucfirst(str_replace('_', ' ', (string) $order->status));
        $shipment = $order->shipment;

        $lines = [
            "📋 *Order status*",
            '',
            "Order: `{$label}`",
            "Status: {$status}",
        ];

        if ($shipment) {
            $lines[] = 'Shipment: '.ucfirst(str_replace('_', ' ', (string) $shipment->status));
            if ($shipment->tracking_code) {
                $lines[] = "Tracking: `{$shipment->tracking_code}`";
            }
        }

        $replyMarkup = null;
        if ($shipment && filled($shipment->external_tracking_url)) {
            $provider = $shipment->provider ?: 'Courier';
            $replyMarkup = [
                'inline_keyboard' => [[
                    ['text' => "Track on {$provider}", 'url' => $shipment->external_tracking_url],
                ]],
            ];
        }

        $this->sendMessage((string) $chatId, implode("\n", $lines), $replyMarkup);
    }

    public function sendMessage(string $chatId, string $text, ?array $replyMarkup = null): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'Markdown',
            'disable_web_page_preview' => true,
        ];

        if ($replyMarkup !== null) {
            $payload['reply_markup'] = json_encode($replyMarkup);
        }

        try {
            $response = Http::timeout(10)->post(
                'https://api.telegram.org/bot'.config('services.telegram.bot_token').'/sendMessage',
                $payload
            );

            if (! $response->successful()) {
                Log::warning('Telegram sendMessage failed', [
                    'chat_id' => $chatId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('Telegram sendMessage exception', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * @return Collection<int, int>
     */
    private function resolveOrderChatIds(Order $order): Collection
    {
        $chatIds = collect();

        if ($order->user_id) {
            $chatIds = $chatIds->merge(
                TelegramUser::where('user_id', $order->user_id)->pluck('chat_id')
            );
        }

        $chatIds = $chatIds->merge(
            TelegramOrderSubscription::where('order_id', $order->id)->pluck('chat_id')
        );

        return $chatIds->filter()->unique()->values();
    }

    private function notifyOrderRecipients(Order $order, string $message, ?array $replyMarkup = null): void
    {
        foreach ($this->resolveOrderChatIds($order) as $chatId) {
            $this->sendMessage((string) $chatId, $message, $replyMarkup);
        }
    }

    private function createInAppNotification(Order $order, string $type, string $title, string $message): void
    {
        if (! $order->user_id) {
            return;
        }

        Notification::create([
            'user_id' => $order->user_id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
            'is_read' => false,
        ]);
    }

    private function resolveOrderPhone(Order $order): string
    {
        $address = $order->shipping_address;
        if (is_array($address)) {
            $phone = trim((string) ($address['phone'] ?? $address['receiver_phone'] ?? ''));

            return $phone !== '' ? $phone : '—';
        }

        return $order->user?->phone ?: '—';
    }

    private function formatAddress(Order $order): string
    {
        $address = $order->shipping_address;
        if (! is_array($address)) {
            return '—';
        }

        $parts = array_filter([
            $address['line1'] ?? $address['address'] ?? null,
            $address['district'] ?? null,
            $address['city'] ?? $address['province'] ?? null,
        ], fn ($part) => filled($part));

        return $parts !== [] ? implode(', ', $parts) : '—';
    }
}
