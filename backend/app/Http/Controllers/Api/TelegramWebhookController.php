<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\TelegramUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $update = $request->all();
        $token = (string) config('services.telegram.bot_token');
        $webhookSecret = (string) config('services.telegram.webhook_secret');

        if ($webhookSecret !== '') {
            $incomingSecret = (string) $request->header('X-Telegram-Bot-Api-Secret-Token', '');

            if (!hash_equals($webhookSecret, $incomingSecret)) {
                Log::warning('Rejected Telegram webhook due to invalid secret.', [
                    'update_id' => $update['update_id'] ?? null,
                    'ip' => $request->ip(),
                ]);

                return response()->json(['ok' => false, 'message' => 'Invalid webhook secret.'], 403);
            }
        }

        if ($token === '') {
            Log::warning('Telegram webhook hit without TELEGRAM_BOT_TOKEN configured.', [
                'update_id' => $update['update_id'] ?? null,
            ]);

            return response()->json(['ok' => false, 'message' => 'Telegram bot token is not configured.'], 500);
        }

        $message = $update['message'] ?? [];
        $chatId = $message['chat']['id'] ?? null;
        $text = trim((string) ($message['text'] ?? ''));
        $contact = $message['contact'] ?? null;
        $from = $message['from'] ?? [];
        $firstName = (string) ($from['first_name'] ?? 'friend');
        $telegramUserId = $from['id'] ?? null;

        $telegramUser = $this->storeTelegramUser($telegramUserId, $chatId, $from, $text, $update);

        if (!$chatId) {
            return response()->json(['ok' => true, 'message' => 'No message payload found.']);
        }

        $this->syncChatMenuButton($token, (int) $chatId);

        if ($this->isViewProductsCommand($text)) {
            $this->sendProductList($token, (int) $chatId);
            return response()->json(['ok' => true]);
        }

        if ($this->isMyOrdersCommand($text)) {
            $this->sendOrderHistory($token, (int) $chatId, $telegramUser);
            return response()->json(['ok' => true]);
        }

        $reply = $this->buildReplyText($text, $firstName, $contact);
        $payload = [
            'chat_id' => $chatId,
            'text' => $reply,
            'reply_markup' => $this->buildMainKeyboard($text, $contact, $telegramUser),
        ];

        if (is_array($contact) && $telegramUser instanceof TelegramUser) {
            $linkResult = $this->linkTelegramContactToUser($telegramUser, $contact, $telegramUserId);
            $payload['text'] = $this->buildContactReplyText($linkResult);
        }

        $response = $this->sendTelegramApi($token, 'sendMessage', $payload);

        if (!$response->successful()) {
            Log::error('Telegram sendMessage failed.', [
                'chat_id' => $chatId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    private function buildReplyText(string $text, string $firstName, mixed $contact): string
    {
        if (is_array($contact)) {
            return 'Thanks! Let me verify your contact and link your Fit & Sleek account.';
        }

        if ($text === '/start') {
            return "Hi {$firstName}! Welcome to Fit & Sleek. Your bot webhook is connected successfully. Tap \"Link My Account\" to connect your loyalty profile.";
        }

        if (strtolower($text) === 'link my account' || strtolower($text) === '/link') {
            return 'Please tap the button below to securely share your phone number and link your account.';
        }

        if ($text === '') {
            return "Hello {$firstName}! I received your update.";
        }

        return "Received: {$text}";
    }

    private function buildMainKeyboard(string $text, mixed $contact, ?TelegramUser $telegramUser): array
    {
        if ($this->shouldShowContactKeyboard($text, $contact, $telegramUser)) {
            return [
                'keyboard' => [
                    [
                        [
                            'text' => 'Link My Account',
                            'request_contact' => true,
                        ],
                    ],
                ],
                'resize_keyboard' => true,
                'one_time_keyboard' => true,
            ];
        }

        if ($telegramUser && !empty($telegramUser->getAttribute('user_id'))) {
            $miniAppUrl = $this->resolveMiniAppUrl();
            $productButton = ['text' => '🛒 View Products'];

            if ($miniAppUrl) {
                $productButton = [
                    'text' => '🛍️ Open Store',
                    'web_app' => ['url' => $miniAppUrl],
                ];
            }

            return [
                'keyboard' => [
                    [
                        $productButton,
                        ['text' => '📦 My Orders'],
                    ],
                ],
                'resize_keyboard' => true,
            ];
        }

        return ['remove_keyboard' => true];
    }

    private function storeTelegramUser(
        mixed $telegramUserId,
        mixed $chatId,
        array $from,
        string $text,
        array $update
    ): ?TelegramUser {
        if (!is_numeric($telegramUserId)) {
            return null;
        }

        try {
            return TelegramUser::updateOrCreate(
                ['telegram_user_id' => (int) $telegramUserId],
                [
                    'chat_id' => is_numeric($chatId) ? (int) $chatId : null,
                    'username' => $from['username'] ?? null,
                    'first_name' => $from['first_name'] ?? null,
                    'last_name' => $from['last_name'] ?? null,
                    'language_code' => $from['language_code'] ?? null,
                    'is_bot' => (bool) ($from['is_bot'] ?? false),
                    'last_message_text' => $text !== '' ? $text : null,
                    'last_interacted_at' => now(),
                    'raw_update' => $update,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Failed to store telegram user.', [
                'telegram_user_id' => $telegramUserId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function shouldShowContactKeyboard(string $text, mixed $contact, ?TelegramUser $telegramUser): bool
    {
        if (is_array($contact)) {
            return false;
        }

        if ($telegramUser && !empty($telegramUser->getAttribute('user_id'))) {
            return false;
        }

        if ($text === '/start' || strtolower($text) === 'link my account' || strtolower($text) === '/link') {
            return true;
        }

        return false;
    }

    private function linkTelegramContactToUser(TelegramUser $telegramUser, array $contact, mixed $telegramUserId): string
    {
        $contactUserId = $contact['user_id'] ?? null;
        if (is_numeric($contactUserId) && is_numeric($telegramUserId) && (int) $contactUserId !== (int) $telegramUserId) {
            return 'invalid_contact_owner';
        }

        $phoneRaw = (string) ($contact['phone_number'] ?? '');
        $normalizedPhone = $this->normalizePhone($phoneRaw);
        if ($normalizedPhone === '') {
            return 'invalid_phone';
        }

        $digitsOnlyPhone = preg_replace('/\D+/', '', $normalizedPhone) ?? '';

        $matchedUser = User::query()
            ->where('phone', $phoneRaw)
            ->orWhere('phone', $normalizedPhone)
            ->when($digitsOnlyPhone !== '', function ($query) use ($digitsOnlyPhone) {
                $query->orWhereRaw("regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ?", [$digitsOnlyPhone]);
            })
            ->first();

        if (!$matchedUser) {
            return 'no_match';
        }

        $telegramUser->setAttribute('user_id', $matchedUser->id);
        $telegramUser->save();

        return 'linked';
    }

    private function buildContactReplyText(string $linkResult): string
    {
        return match ($linkResult) {
            'linked' => 'Your account has been linked successfully. You can now receive loyalty updates and personalized promotions. Tap "🛒 View Products" to browse now.',
            'no_match' => 'We could not find an account with that phone number yet. Please register in Fit & Sleek first, then try linking again.',
            'invalid_contact_owner' => 'For security, please share your own Telegram contact using the button.',
            default => 'We could not process your contact right now. Please try again.',
        };
    }

    private function normalizePhone(string $phone): string
    {
        $normalized = preg_replace('/[^\d+]/', '', trim($phone)) ?? '';

        if (str_starts_with($normalized, '+')) {
            return $normalized;
        }

        return ltrim($normalized, '0');
    }

    private function isViewProductsCommand(string $text): bool
    {
        $normalized = mb_strtolower(trim($text));
        return $normalized === '🛒 view products' || $normalized === '/products' || $normalized === 'view products';
    }

    private function sendProductList(string $token, int $chatId): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->orderByDesc('id')
            ->limit(5)
            ->get(['id', 'name', 'slug', 'price']);

        if ($products->isEmpty()) {
            $this->sendTelegramApi($token, 'sendMessage', [
                'chat_id' => $chatId,
                'text' => 'No active products are available right now. Please check again soon.',
            ]);
            return;
        }

        $baseUrl = rtrim((string) (config('app.frontend_url') ?: env('FRONTEND_URL', config('app.url'))), '/');
        $miniAppUrl = $this->resolveMiniAppUrl();

        $lines = ["🛍️ Top Picks from Fit & Sleek:"];
        foreach ($products as $index => $product) {
            $price = number_format((float) $product->price, 2);
            $url = "{$baseUrl}/products/{$product->slug}";
            $num = $index + 1;
            $lines[] = "{$num}. {$product->name}";
            $lines[] = "   💰 \${$price}";
            $lines[] = "   🔗 {$url}";
        }

        if ($miniAppUrl) {
            $lines[] = "";
            $lines[] = "Tap the button below to open the store inside Telegram.";
        } else {
            $lines[] = "";
            $lines[] = "Mini App is not configured yet. Set FRONTEND_URL to your HTTPS public domain.";
        }

        $replyMarkup = null;
        if ($miniAppUrl) {
            $replyMarkup = [
                'inline_keyboard' => [
                    [
                        [
                            'text' => '🛍️ Open Fit & Sleek Store',
                            'web_app' => ['url' => $miniAppUrl],
                        ],
                    ],
                ],
            ];
        }

        $this->sendTelegramApi($token, 'sendMessage', [
            'chat_id' => $chatId,
            'text' => implode("\n", $lines),
            'disable_web_page_preview' => false,
            'reply_markup' => $replyMarkup,
        ]);
    }

    private function isMyOrdersCommand(string $text): bool
    {
        $normalized = mb_strtolower(trim($text));
        return $normalized === '📦 my orders' || $normalized === '/orders' || $normalized === 'my orders';
    }

    private function sendOrderHistory(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        $linkedUserId = $telegramUser?->getAttribute('user_id');
        if (!$linkedUserId) {
            $this->sendTelegramApi($token, 'sendMessage', [
                'chat_id' => $chatId,
                'text' => 'Please link your account first by tapping "Link My Account" and sharing your contact.',
            ]);
            return;
        }

        $orders = Order::query()
            ->where('user_id', $linkedUserId)
            ->latest()
            ->limit(5)
            ->get(['id', 'order_number', 'status', 'total', 'created_at']);

        if ($orders->isEmpty()) {
            $this->sendTelegramApi($token, 'sendMessage', [
                'chat_id' => $chatId,
                'text' => 'You do not have any orders yet. Browse products with "🛒 View Products".',
            ]);
            return;
        }

        $baseUrl = rtrim((string) (config('app.frontend_url') ?: env('FRONTEND_URL', config('app.url'))), '/');

        foreach ($orders as $order) {
            $status = strtoupper((string) $order->status);
            $total = number_format((float) $order->total, 2);
            $orderDate = optional($order->created_at)->format('d M Y H:i') ?: 'N/A';
            $trackUrl = "{$baseUrl}/track-order?orderNumber={$order->order_number}";

            $text = "🆔 Order: #{$order->order_number}\n";
            $text .= "📅 Date: {$orderDate}\n";
            $text .= "💰 Total: \${$total}\n";
            $text .= "🚚 Status: {$status}";

            $this->sendTelegramApi($token, 'sendMessage', [
                'chat_id' => $chatId,
                'text' => $text,
                'reply_markup' => [
                    'inline_keyboard' => [
                        [
                            [
                                'text' => '🔍 Track on Website',
                                'url' => $trackUrl,
                            ],
                        ],
                    ],
                ],
            ]);
        }
    }

    private function sendTelegramApi(string $token, string $method, array $payload)
    {
        return Http::asJson()
            ->timeout(10)
            ->post("https://api.telegram.org/bot{$token}/{$method}", $payload);
    }

    private function resolveMiniAppUrl(): ?string
    {
        $url = trim((string) (config('app.frontend_url') ?: env('FRONTEND_URL', '')));
        if ($url === '') {
            return null;
        }

        if (!str_starts_with($url, 'https://')) {
            return null;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return null;
        }

        if ($host === 'localhost' || str_ends_with($host, '.localhost') || $host === '127.0.0.1') {
            return null;
        }

        return rtrim($url, '/');
    }

    private function syncChatMenuButton(string $token, int $chatId): void
    {
        $miniAppUrl = $this->resolveMiniAppUrl();
        if (!$miniAppUrl) {
            return;
        }

        $this->sendTelegramApi($token, 'setChatMenuButton', [
            'chat_id' => $chatId,
            'menu_button' => [
                'type' => 'web_app',
                'text' => '🛍️ Shop Now',
                'web_app' => [
                    'url' => $miniAppUrl,
                ],
            ],
        ]);
    }
}
