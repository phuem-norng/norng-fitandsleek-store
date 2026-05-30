<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\TelegramUser;
use App\Models\User;
use App\Services\TelegramBotPresenter;
use App\Services\TelegramProductSearchService;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    private const BOT_COMMANDS = [
        ['command' => 'start', 'description' => 'Home & welcome'],
        ['command' => 'link', 'description' => 'Link store account'],
        ['command' => 'profile', 'description' => 'Member profile'],
        ['command' => 'orders', 'description' => 'Order history'],
        ['command' => 'products', 'description' => 'Featured products'],
        ['command' => 'search', 'description' => 'Search products'],
        ['command' => 'help', 'description' => 'Help & support'],
        ['command' => 'menu', 'description' => 'Refresh menu'],
    ];

    public function __construct(
        private readonly TelegramBotPresenter $presenter,
        private readonly TelegramProductSearchService $productSearch
    ) {}

    public function handle(Request $request): JsonResponse
    {
        try {
            return $this->processWebhook($request);
        } catch (\Throwable $e) {
            Log::error('Telegram webhook exception.', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(['ok' => true]);
        }
    }

    private function processWebhook(Request $request): JsonResponse
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
            return response()->json(['ok' => false, 'message' => 'Telegram bot token is not configured.'], 500);
        }

        $this->ensureBotCommandsRegistered($token);

        if (isset($update['callback_query']) && is_array($update['callback_query'])) {
            $callbackQuery = $update['callback_query'];
            $this->acknowledgeCallbackQuery($token, $callbackQuery);

            dispatch(function () use ($token, $callbackQuery) {
                try {
                    app(self::class)->handleCallbackQuery($token, $callbackQuery);
                } catch (\Throwable $e) {
                    Log::error('Telegram deferred callback failed.', [
                        'data' => $callbackQuery['data'] ?? null,
                        'message' => $e->getMessage(),
                    ]);
                }
            })->afterResponse();

            return response()->json(['ok' => true]);
        }

        $message = $update['message'] ?? [];
        $chatId = $message['chat']['id'] ?? null;
        $text = trim((string) ($message['text'] ?? ''));
        $contact = $message['contact'] ?? null;
        $from = $message['from'] ?? [];
        $firstName = (string) ($from['first_name'] ?? 'there');
        $telegramUserId = $from['id'] ?? null;

        $telegramUser = $this->storeTelegramUser($telegramUserId, $chatId, $from, $text, $update);

        if (!$chatId) {
            return response()->json(['ok' => true, 'message' => 'No message payload found.']);
        }

        $chatIdInt = (int) $chatId;
        $this->syncChatMenuButton($token, $chatIdInt);

        if (is_array($contact) && $telegramUser instanceof TelegramUser) {
            $this->handleContactLink($token, $chatIdInt, $telegramUser, $contact, $telegramUserId);

            return response()->json(['ok' => true]);
        }

        $this->dispatchCommand($token, $chatIdInt, $text, $firstName, $telegramUser);

        return response()->json(['ok' => true]);
    }

    private function acknowledgeCallbackQuery(string $token, array $callbackQuery): void
    {
        $callbackId = $callbackQuery['id'] ?? null;
        $data = trim((string) ($callbackQuery['data'] ?? ''));

        if (!is_string($callbackId) || $callbackId === '') {
            return;
        }

        $toast = match (true) {
            str_starts_with($data, 'search_q:') => '🔍 Searching…',
            str_starts_with($data, 'search_cat:') => '📂 Loading category…',
            $data === 'cmd_orders' => '📦 Loading orders…',
            $data === 'cmd_products' => '🛍️ Loading products…',
            $data === 'cmd_search', $data === 'cmd_search_categories' => '🔍 Search',
            $data === 'cmd_profile' => '👤 Loading profile…',
            default => null,
        };

        $answer = ['callback_query_id' => $callbackId];
        if ($toast) {
            $answer['text'] = $toast;
        }

        $this->sendTelegramApi($token, 'answerCallbackQuery', $answer);
    }

    private function handleCallbackQuery(string $token, array $callbackQuery): void
    {
        $data = trim((string) ($callbackQuery['data'] ?? ''));
        $message = $callbackQuery['message'] ?? [];
        $chatId = $message['chat']['id'] ?? ($callbackQuery['from']['id'] ?? null);
        $from = $callbackQuery['from'] ?? [];
        $firstName = (string) ($from['first_name'] ?? 'there');
        $telegramUserId = $from['id'] ?? null;

        if (!is_numeric($chatId)) {
            return;
        }

        $telegramUser = $this->storeTelegramUser(
            $telegramUserId,
            $chatId,
            $from,
            $data,
            ['callback_query' => $callbackQuery]
        );

        $chatIdInt = (int) $chatId;

        if (str_starts_with($data, 'search_q:')) {
            $this->sendProductSearch($token, $chatIdInt, $this->decodeSearchCallbackTerm(substr($data, 9)), $telegramUser);

            return;
        }

        if (str_starts_with($data, 'search_cat:')) {
            $this->sendCategorySearch($token, $chatIdInt, $this->decodeSearchCallbackTerm(substr($data, 11)), $telegramUser);

            return;
        }

        if ($data === 'cmd_search_categories') {
            $this->sendCategoryBrowse($token, $chatIdInt, $telegramUser);

            return;
        }

        match ($data) {
            'cmd_link' => $this->sendLinkPrompt($token, $chatIdInt, $telegramUser),
            'cmd_profile' => $this->sendProfile($token, $chatIdInt, $telegramUser),
            'cmd_orders' => $this->sendOrderHistory($token, $chatIdInt, $telegramUser),
            'cmd_products' => $this->sendProductList($token, $chatIdInt, $telegramUser),
            'cmd_search' => $this->sendSearchPrompt($token, $chatIdInt, $telegramUser),
            'cmd_help' => $this->sendHelp($token, $chatIdInt, $telegramUser),
            'cmd_menu' => $this->sendMenuRefresh($token, $chatIdInt, $firstName, $telegramUser),
            'cmd_start' => $this->sendWelcome($token, $chatIdInt, $firstName, $telegramUser),
            default => $this->sendBotReply(
                $token,
                $chatIdInt,
                'Please use the buttons below or type /help.',
                $telegramUser,
                inlineKeyboard: $this->quickActionsInline($telegramUser)
            ),
        };
    }

    private function dispatchCommand(
        string $token,
        int $chatId,
        string $text,
        string $firstName,
        ?TelegramUser $telegramUser
    ): void {
        if ($this->consumeSearchQueryIfPending($token, $chatId, $text, $telegramUser)) {
            return;
        }

        if (preg_match('/^\/search(?:@\S+)?(?:\s+(.+))?$/iu', $text, $matches) === 1) {
            $query = trim((string) ($matches[1] ?? ''));
            if ($query !== '') {
                $this->sendProductSearch($token, $chatId, $query, $telegramUser);

                return;
            }
            $this->sendSearchPrompt($token, $chatId, $telegramUser);

            return;
        }

        $command = $this->resolveCommand($text);

        match ($command) {
            'start' => $this->sendWelcome($token, $chatId, $firstName, $telegramUser),
            'link' => $this->sendLinkPrompt($token, $chatId, $telegramUser),
            'profile' => $this->sendProfile($token, $chatId, $telegramUser),
            'orders' => $this->sendOrderHistory($token, $chatId, $telegramUser),
            'products' => $this->sendProductList($token, $chatId, $telegramUser),
            'search' => $this->sendSearchPrompt($token, $chatId, $telegramUser),
            'help' => $this->sendHelp($token, $chatId, $telegramUser),
            'menu' => $this->sendMenuRefresh($token, $chatId, $firstName, $telegramUser),
            'unlink' => $this->handleUnlink($token, $chatId, $telegramUser),
            '' => $this->sendBotReply(
                $token,
                $chatId,
                "Hi {$this->presenter->escape($firstName)}! Tap /menu or use the keyboard below.",
                $telegramUser,
                inlineKeyboard: $this->quickActionsInline($telegramUser)
            ),
            default => $this->sendBotReply(
                $token,
                $chatId,
                "I didn't recognize that.\n\nType /help or tap 🔍 Search.",
                $telegramUser,
                inlineKeyboard: $this->quickActionsInline($telegramUser)
            ),
        };
    }

    private function sendSearchPrompt(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        $this->setSearchPending($chatId);
        $this->sendBotReply(
            $token,
            $chatId,
            $this->presenter->searchPrompt(),
            $telegramUser,
            inlineKeyboard: $this->buildSearchMenuInline()
        );
    }

    private function sendProductSearch(string $token, int $chatId, string $query, ?TelegramUser $telegramUser): void
    {
        $this->clearSearchPending($chatId);
        $term = trim($query);

        if ($term === '' || mb_strlen($term) < 2) {
            $this->sendBotReply(
                $token,
                $chatId,
                'Please type at least <b>2 characters</b> to search.',
                $telegramUser
            );
            $this->sendSearchPrompt($token, $chatId, $telegramUser);

            return;
        }

        $this->sendBotReply(
            $token,
            $chatId,
            '🔍 Searching for <b>'.$this->presenter->escape($term).'</b>…',
            $telegramUser
        );

        $products = $this->productSearch->search($term);

        $this->deliverSearchResults($token, $chatId, $term, $products, $telegramUser);
    }

    private function decodeSearchCallbackTerm(string $payload): string
    {
        $decoded = trim(urldecode($payload));

        return $this->sanitizeSearchTerm($decoded);
    }

    private function sanitizeSearchTerm(string $term): string
    {
        $term = mb_strtolower(trim($term));
        $term = preg_replace('/[^a-z0-9\s]/u', ' ', $term) ?? $term;
        $term = trim(preg_replace('/\s+/u', ' ', $term) ?? $term);

        if ($term === '') {
            return '';
        }

        $words = explode(' ', $term);

        return $words[0] ?? $term;
    }

    private function sendCategorySearch(string $token, int $chatId, string $slug, ?TelegramUser $telegramUser): void
    {
        $this->clearSearchPending($chatId);
        $products = $this->productSearch->searchByCategorySlug($slug);
        $label = $products->first()?->category?->name ?: $slug;

        $this->deliverSearchResults($token, $chatId, $label, $products, $telegramUser, categorySlug: $slug);
    }

    private function sendCategoryBrowse(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        $categories = $this->productSearch->catalogCategories();
        if ($categories->isEmpty()) {
            $this->sendSearchPrompt($token, $chatId, $telegramUser);

            return;
        }

        $inline = [];
        $row = [];
        foreach ($categories as $category) {
            $label = mb_strlen($category->name) > 18
                ? mb_substr($category->name, 0, 16).'…'
                : $category->name;
            $row[] = [
                'text' => '📂 '.$label,
                'callback_data' => 'search_cat:'.rawurlencode((string) $category->slug),
            ];
            if (count($row) === 2) {
                $inline[] = $row;
                $row = [];
            }
        }
        if ($row !== []) {
            $inline[] = $row;
        }
        $inline[] = [
            ['text' => '🔍 Type keyword', 'callback_data' => 'cmd_search'],
            ['text' => '🏠 Home', 'callback_data' => 'cmd_start'],
        ];

        $this->sendBotReply(
            $token,
            $chatId,
            $this->presenter->categoryBrowseHeader(),
            $telegramUser,
            inlineKeyboard: $inline
        );
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Product>  $products
     */
    private function deliverSearchResults(
        string $token,
        int $chatId,
        string $label,
        $products,
        ?TelegramUser $telegramUser,
        ?string $categorySlug = null
    ): void {
        if ($products->isEmpty()) {
            $this->sendBotReply(
                $token,
                $chatId,
                $this->presenter->searchNoResults($label),
                $telegramUser,
                inlineKeyboard: $this->buildSearchMenuInline()
            );

            return;
        }

        $storeUrl = $this->publicStoreUrl();
        $header = $categorySlug !== null
            ? "📂 <b>{$this->presenter->escape($label)}</b>\n{$this->presenter->divider()}\nShowing {$products->count()} product(s):"
            : $this->presenter->searchResultsHeader($label, $products->count())."\n<i>Smart match · brand · category</i>";

        $this->sendBotReply($token, $chatId, $header, $telegramUser);

        foreach ($products as $product) {
            $this->sendProductCard($token, $chatId, $product, $storeUrl);
        }

        $searchUrl = '';
        if ($storeUrl !== '') {
            $searchUrl = $categorySlug !== null
                ? $storeUrl.'/products?category='.rawurlencode($categorySlug)
                : $storeUrl.'/products?q='.rawurlencode($label);
        }

        $inline = [];
        if ($searchUrl !== '' && $this->isTelegramSafeUrl($searchUrl)) {
            $inline[] = [['text' => '🌐 See all on website', 'url' => $searchUrl]];
        }
        $inline[] = [
            ['text' => '🔍 New search', 'callback_data' => 'cmd_search'],
            ['text' => '📂 Categories', 'callback_data' => 'cmd_search_categories'],
        ];
        $inline[] = [
            ['text' => '🛒 Featured', 'callback_data' => 'cmd_products'],
            ['text' => '🏠 Home', 'callback_data' => 'cmd_start'],
        ];

        $this->sendBotReply($token, $chatId, '⬇️ <b>Search options</b>', $telegramUser, inlineKeyboard: $inline);
    }

    /**
     * @return array<int, array<int, array<string, string>>>
     */
    private function buildSearchMenuInline(): array
    {
        $inline = [];
        $terms = array_slice($this->productSearch->popularTerms(), 0, 6);
        $row = [];

        foreach ($terms as $term) {
            $searchKey = $this->sanitizeSearchTerm($term);
            if ($searchKey === '' || strlen('search_q:'.$searchKey) > 64) {
                continue;
            }

            $label = ucfirst($term);
            if (mb_strlen($label) > 20) {
                $label = mb_substr($label, 0, 18).'…';
            }

            $row[] = [
                'text' => '🔍 '.$label,
                'callback_data' => 'search_q:'.$searchKey,
            ];
            if (count($row) === 3) {
                $inline[] = $row;
                $row = [];
            }
        }
        if ($row !== []) {
            $inline[] = $row;
        }

        $inline[] = [
            ['text' => '📂 Browse categories', 'callback_data' => 'cmd_search_categories'],
            ['text' => '🛒 Featured', 'callback_data' => 'cmd_products'],
        ];

        return $inline;
    }

    private function searchPendingCacheKey(int $chatId): string
    {
        return "telegram:search_pending:{$chatId}";
    }

    private function setSearchPending(int $chatId): void
    {
        Cache::put($this->searchPendingCacheKey($chatId), true, now()->addMinutes(15));
    }

    private function clearSearchPending(int $chatId): void
    {
        Cache::forget($this->searchPendingCacheKey($chatId));
    }

    private function isSearchPending(int $chatId): bool
    {
        return (bool) Cache::get($this->searchPendingCacheKey($chatId), false);
    }

    private function consumeSearchQueryIfPending(
        string $token,
        int $chatId,
        string $text,
        ?TelegramUser $telegramUser
    ): bool {
        if (!$this->isSearchPending($chatId)) {
            return false;
        }

        if ($text === '' || $this->resolveCommand($text) !== '') {
            $this->clearSearchPending($chatId);

            return false;
        }

        $this->sendProductSearch($token, $chatId, $text, $telegramUser);

        return true;
    }

    private function handleContactLink(
        string $token,
        int $chatId,
        TelegramUser $telegramUser,
        array $contact,
        mixed $telegramUserId
    ): void {
        $linkResult = $this->linkTelegramContactToUser($telegramUser, $contact, $telegramUserId);
        $reply = $this->buildContactReplyText($linkResult);

        $this->sendBotReply(
            $token,
            $chatId,
            $reply,
            $telegramUser,
            inlineKeyboard: $linkResult === 'linked' ? $this->quickActionsInline($telegramUser) : null,
            forceLinkKeyboard: $linkResult !== 'linked'
        );
    }

    private function handleUnlink(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        if (!$telegramUser || !$this->isLinked($telegramUser)) {
            $this->sendBotReply($token, $chatId, 'Your Telegram is not linked yet.', $telegramUser, forceLinkKeyboard: true);

            return;
        }

        $telegramUser->setAttribute('user_id', null);
        $telegramUser->save();

        $this->sendBotReply(
            $token,
            $chatId,
            "Account unlinked.\n\nTap <b>🔗 Link Account</b> when you want to connect again.",
            $telegramUser,
            inlineKeyboard: $this->quickActionsInline($telegramUser),
            forceLinkKeyboard: true
        );
    }

    private function sendWelcome(string $token, int $chatId, string $firstName, ?TelegramUser $telegramUser): void
    {
        $linked = $telegramUser && $this->isLinked($telegramUser);

        if ($linked) {
            $user = $telegramUser->user;
            $text = $this->presenter->welcomeLinked($user?->name ?: $firstName);
        } else {
            $text = $this->presenter->welcomeGuest($firstName);
        }

        $this->sendBotReply(
            $token,
            $chatId,
            $text,
            $telegramUser,
            inlineKeyboard: $this->quickActionsInline($telegramUser),
            forceLinkKeyboard: !$linked
        );
    }

    private function sendLinkPrompt(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        if ($telegramUser && $this->isLinked($telegramUser)) {
            $this->sendProfile($token, $chatId, $telegramUser);

            return;
        }

        $text = implode("\n", [
            '🔗 <b>Link your account</b>',
            '',
            $this->presenter->divider(),
            '1️⃣ Tap <b>🔗 Link Account</b> on the keyboard',
            '2️⃣ Share <b>your own</b> Telegram contact',
            '',
            'Your phone must match your '.TelegramBotPresenter::BRAND.' registration.',
            $this->presenter->divider(),
            '',
            'Or open the store, sign in, and linking happens automatically.',
        ]);

        $this->sendBotReply(
            $token,
            $chatId,
            $text,
            $telegramUser,
            inlineKeyboard: $this->quickActionsInline($telegramUser),
            forceLinkKeyboard: true
        );
    }

    private function sendProfile(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        if (!$telegramUser || !$this->isLinked($telegramUser)) {
            $this->sendBotReply(
                $token,
                $chatId,
                "👤 <b>Profile not linked</b>\n\nUse /link or tap 🔗 Link Account to connect.",
                $telegramUser,
                inlineKeyboard: $this->quickActionsInline($telegramUser),
                forceLinkKeyboard: true
            );

            return;
        }

        $user = User::query()->find($telegramUser->user_id);
        if (!$user) {
            $telegramUser->setAttribute('user_id', null);
            $telegramUser->save();
            $this->sendLinkPrompt($token, $chatId, $telegramUser);

            return;
        }

        $orderCount = Order::query()->where('user_id', $user->id)->count();
        $handle = $telegramUser->username ? '@'.$telegramUser->username : null;

        $text = $this->presenter->profileCard(
            $user->name,
            $user->email,
            $user->phone,
            $handle,
            $orderCount,
            (string) ($user->status ?: 'active')
        );

        $inline = $this->quickActionsInline($telegramUser);
        $linkUrl = $this->publicStoreUrl();
        if ($linkUrl !== '') {
            $inline[] = [
                ['text' => '🌐 Visit website', 'url' => $linkUrl],
            ];
        }

        $this->sendBotReply($token, $chatId, $text, $telegramUser, inlineKeyboard: $inline);
    }

    private function sendHelp(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        $text = $this->presenter->helpText(
            $this->publicStoreUrl(),
            $this->resolveMiniAppUrl() !== null
        );

        $this->sendBotReply(
            $token,
            $chatId,
            $text,
            $telegramUser,
            inlineKeyboard: $this->quickActionsInline($telegramUser)
        );
    }

    private function sendMenuRefresh(string $token, int $chatId, string $firstName, ?TelegramUser $telegramUser): void
    {
        $linked = $telegramUser && $this->isLinked($telegramUser);
        $status = $linked ? '✅ Linked' : '🔗 Not linked';

        $text = implode("\n", [
            '⌨️ <b>Menu refreshed</b>',
            '',
            "Hello {$this->presenter->escape($firstName)}!",
            "Account: <b>{$status}</b>",
            '',
            'Use the keyboard and buttons below.',
        ]);

        $this->sendBotReply(
            $token,
            $chatId,
            $text,
            $telegramUser,
            inlineKeyboard: $this->quickActionsInline($telegramUser),
            forceLinkKeyboard: !$linked
        );
    }

    private function sendProductList(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        $products = Product::query()
            ->with(['images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order')])
            ->where('is_active', true)
            ->orderByDesc('id')
            ->limit(5)
            ->get();

        if ($products->isEmpty()) {
            $this->sendBotReply(
                $token,
                $chatId,
                "🛍️ <b>Catalog</b>\n\n{$this->presenter->divider()}\nNo products available right now. Please check back soon.\n{$this->presenter->divider()}",
                $telegramUser,
                inlineKeyboard: $this->quickActionsInline($telegramUser)
            );

            return;
        }

        $storeUrl = $this->publicStoreUrl();
        $footerInline = $this->buildProductFooterInline($storeUrl);

        $this->sendBotReply($token, $chatId, $this->presenter->productsIntro(), $telegramUser);

        foreach ($products as $product) {
            $this->sendProductCard($token, $chatId, $product, $storeUrl);
        }

        $this->sendBotReply(
            $token,
            $chatId,
            '⬇️ <b>More options</b>',
            $telegramUser,
            inlineKeyboard: $footerInline
        );
    }

    private function sendProductCard(string $token, int $chatId, Product $product, string $storeUrl): void
    {
        $productUrl = $storeUrl !== '' ? "{$storeUrl}/products/{$product->slug}" : '';
        $caption = $this->presenter->productPhotoCaption(
            (string) $product->name,
            (float) $product->price,
            $productUrl
        );
        $inline = $this->productViewInlineRow($productUrl);

        $photo = $this->resolveProductPhotoDelivery($product);
        $sent = false;

        if ($photo !== null) {
            $sent = match ($photo['mode']) {
                'url' => $this->sendTelegramPhoto($token, $chatId, $photo['source'], $caption, $inline),
                'file' => $this->sendTelegramPhotoUpload($token, $chatId, $photo['source'], $caption, $inline),
                'bytes' => $this->sendTelegramPhotoBytes(
                    $token,
                    $chatId,
                    $photo['source'],
                    $photo['filename'] ?? 'product.jpg',
                    $caption,
                    $inline
                ),
                default => false,
            };

            if (!$sent && $photo['mode'] === 'url') {
                $bytes = Media::readBytes($photo['source']);
                if ($bytes) {
                    $sent = $this->sendTelegramPhotoBytes(
                        $token,
                        $chatId,
                        $bytes,
                        'product.jpg',
                        $caption,
                        $inline
                    );
                }
            }
        }

        if (!$sent) {
            $this->sendTelegramMessageWithInline($token, $chatId, $caption, $inline);
        }
    }

    /**
     * @return array<int, array<int, array<string, string>>>
     */
    private function productViewInlineRow(string $productUrl): array
    {
        if ($productUrl === '' || !$this->isTelegramSafeUrl($productUrl)) {
            return [];
        }

        return [[['text' => '🛒 View product', 'url' => $productUrl]]];
    }

    /**
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function buildProductFooterInline(string $storeUrl): array
    {
        $inline = [];
        $miniAppUrl = $this->resolveMiniAppUrl();
        $footerRow = [];

        if ($miniAppUrl) {
            $footerRow[] = ['text' => '🛍️ Open store app', 'web_app' => ['url' => $miniAppUrl]];
        }
        if ($storeUrl !== '') {
            $footerRow[] = ['text' => '🌐 All products', 'url' => "{$storeUrl}/products"];
        }
        if ($footerRow !== []) {
            $inline[] = $footerRow;
        }

        $inline[] = [
            ['text' => '📦 My orders', 'callback_data' => 'cmd_orders'],
            ['text' => '🏠 Home', 'callback_data' => 'cmd_start'],
        ];

        return $inline;
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function sendTelegramPhoto(
        string $token,
        int $chatId,
        string $photoUrl,
        string $caption,
        ?array $inlineKeyboard = null
    ): bool {
        $payload = [
            'chat_id' => $chatId,
            'photo' => $photoUrl,
            'caption' => $caption,
            'parse_mode' => 'HTML',
        ];
        $markup = $this->inlineMarkupArray($inlineKeyboard);
        if ($markup !== null) {
            $payload['reply_markup'] = $markup;
        }

        return $this->dispatchTelegramPhotoRequest($token, $payload);
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function sendTelegramPhotoUpload(
        string $token,
        int $chatId,
        string $filePath,
        string $caption,
        ?array $inlineKeyboard = null
    ): bool {
        if (!is_readable($filePath)) {
            return false;
        }

        $fields = array_filter([
            'chat_id' => $chatId,
            'caption' => $caption,
            'parse_mode' => 'HTML',
            'reply_markup' => $this->inlineMarkupJsonForMultipart($inlineKeyboard),
        ], fn ($v) => $v !== null && $v !== '');

        $response = Http::timeout(30)
            ->attach('photo', fopen($filePath, 'r'), basename($filePath))
            ->post($this->telegramApiUrl($token, 'sendPhoto'), $fields);

        if ($response->successful()) {
            return true;
        }

        Log::warning('Telegram sendPhoto (file upload) failed.', [
            'chat_id' => $chatId,
            'file' => $filePath,
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return false;
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function sendTelegramPhotoBytes(
        string $token,
        int $chatId,
        string $bytes,
        string $filename,
        string $caption,
        ?array $inlineKeyboard = null
    ): bool {
        $tmp = tempnam(sys_get_temp_dir(), 'tg_product_');
        if ($tmp === false) {
            return false;
        }

        $target = $tmp.'.jpg';
        @rename($tmp, $target);

        if (file_put_contents($target, $bytes) === false) {
            @unlink($target);

            return false;
        }

        $sent = $this->sendTelegramPhotoUpload($token, $chatId, $target, $caption, $inlineKeyboard);
        @unlink($target);

        return $sent;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function dispatchTelegramPhotoRequest(string $token, array $payload): bool
    {
        $response = $this->sendTelegramApi($token, 'sendPhoto', array_filter($payload, fn ($v) => $v !== null));

        if ($response->successful()) {
            return true;
        }

        Log::warning('Telegram sendPhoto failed.', [
            'chat_id' => $payload['chat_id'] ?? null,
            'photo' => $payload['photo'] ?? null,
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        $fallback = $payload;
        unset($fallback['parse_mode']);
        $plainCaption = strip_tags(html_entity_decode((string) ($payload['caption'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (preg_match('#https://[^\s<>"\']+#', (string) ($payload['caption'] ?? ''), $urlMatch)) {
            $plainCaption .= "\n\n🔗 ".$urlMatch[0];
        }
        $fallback['caption'] = $plainCaption;
        $retry = $this->sendTelegramApi($token, 'sendPhoto', array_filter($fallback, fn ($v) => $v !== null));

        return $retry->successful();
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function sendTelegramMessageWithInline(
        string $token,
        int $chatId,
        string $html,
        ?array $inlineKeyboard
    ): void {
        $payload = [
            'chat_id' => $chatId,
            'text' => $html,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => false,
            'reply_markup' => $this->inlineMarkupArray($inlineKeyboard),
        ];

        $response = $this->sendTelegramApi($token, 'sendMessage', array_filter($payload, fn ($v) => $v !== null));

        if ($response->successful()) {
            return;
        }

        unset($payload['parse_mode']);
        $payload['text'] = strip_tags(html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $this->sendTelegramApi($token, 'sendMessage', array_filter($payload, fn ($v) => $v !== null));
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     * @return array{inline_keyboard: array<int, array<int, array<string, mixed>>>}|null
     */
    private function inlineMarkupArray(?array $inlineKeyboard): ?array
    {
        if (!$inlineKeyboard) {
            return null;
        }

        $sanitized = $this->sanitizeInlineKeyboard($inlineKeyboard);

        return $sanitized === [] ? null : ['inline_keyboard' => $sanitized];
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function inlineMarkupJsonForMultipart(?array $inlineKeyboard): ?string
    {
        $markup = $this->inlineMarkupArray($inlineKeyboard);

        return $markup ? json_encode($markup, JSON_UNESCAPED_UNICODE) : null;
    }

    private function telegramApiUrl(string $token, string $method): string
    {
        return "https://api.telegram.org/bot{$token}/{$method}";
    }

    /**
     * @return array{mode: string, source: string, filename?: string}|null
     */
    private function resolveProductPhotoDelivery(Product $product): ?array
    {
        foreach ($this->productImageCandidates($product) as $candidate) {
            $trimmed = trim($candidate);
            if ($trimmed === '') {
                continue;
            }

            if (preg_match('#^https://#i', $trimmed) && $this->isTelegramSafeUrl($trimmed)) {
                return ['mode' => 'url', 'source' => $trimmed];
            }
        }

        foreach ($this->productImageCandidates($product) as $candidate) {
            $local = Media::resolveLocalPath($candidate);
            if ($local && is_readable($local)) {
                return ['mode' => 'file', 'source' => $local];
            }
        }

        foreach ($this->productImageCandidates($product) as $candidate) {
            if (str_starts_with(trim($candidate), 'data:image/')) {
                $bytes = Media::readBytes($candidate);
                if ($bytes) {
                    return ['mode' => 'bytes', 'source' => $bytes, 'filename' => 'product.jpg'];
                }
            }
        }

        foreach ($this->productImageCandidates($product) as $candidate) {
            $absolute = $this->resolveAbsoluteMediaUrl($candidate);
            if ($absolute) {
                return ['mode' => 'url', 'source' => $absolute];
            }
        }

        return ['mode' => 'url', 'source' => 'https://picsum.photos/seed/fitandsleek-product/800/800'];
    }

    /**
     * @return list<string>
     */
    private function productImageCandidates(Product $product): array
    {
        $candidates = [];

        if (!empty($product->image_url)) {
            $candidates[] = (string) $product->image_url;
        }

        if (is_array($product->gallery)) {
            foreach ($product->gallery as $item) {
                if (is_string($item) && $item !== '') {
                    $candidates[] = $item;
                } elseif (is_array($item)) {
                    foreach (['url', 'path', 'src'] as $key) {
                        if (!empty($item[$key]) && is_string($item[$key])) {
                            $candidates[] = $item[$key];
                        }
                    }
                }
            }
        }

        foreach ($product->images as $image) {
            if (!empty($image->path)) {
                $candidates[] = (string) $image->path;
            }
        }

        return $candidates;
    }

    private function apiPublicBaseUrl(): string
    {
        foreach ([
            rtrim((string) env('APP_URL', ''), '/'),
            $this->publicStoreUrl(),
            rtrim((string) config('app.url'), '/'),
        ] as $base) {
            if ($this->isTelegramSafeUrl($base)) {
                return $base;
            }
        }

        return '';
    }

    private function resolveAbsoluteMediaUrl(?string $path): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        if (preg_match('#^https://#i', $path)) {
            return $this->isTelegramSafeUrl($path) ? $path : null;
        }

        if (preg_match('#^http://#i', $path)) {
            $https = 'https://'.substr($path, 7);

            return $this->isTelegramSafeUrl($https) ? $https : null;
        }

        $resolved = Media::url($path);
        if (!$resolved) {
            return null;
        }

        if (preg_match('#^https://#i', $resolved) && $this->isTelegramSafeUrl($resolved)) {
            return $resolved;
        }

        $relative = str_starts_with($resolved, '/') ? $resolved : '/'.$resolved;
        $base = $this->apiPublicBaseUrl();
        if ($base === '') {
            return null;
        }

        $absolute = $base.$relative;

        return $this->isTelegramSafeUrl($absolute) ? $absolute : null;
    }

    private function sendOrderHistory(string $token, int $chatId, ?TelegramUser $telegramUser): void
    {
        if (!$this->isLinked($telegramUser)) {
            $this->sendBotReply(
                $token,
                $chatId,
                implode("\n", [
                    '📦 <b>Orders</b>',
                    '',
                    $this->presenter->divider(),
                    'Link your account to view order history.',
                    $this->presenter->divider(),
                ]),
                $telegramUser,
                inlineKeyboard: [
                    [['text' => '🔗 Link account', 'callback_data' => 'cmd_link']],
                ],
                forceLinkKeyboard: true
            );

            return;
        }

        $orders = Order::query()
            ->where('user_id', $telegramUser->user_id)
            ->latest()
            ->limit(5)
            ->get(['id', 'order_number', 'status', 'total', 'created_at']);

        if ($orders->isEmpty()) {
            $emptyInline = [
                [['text' => '🛒 Browse products', 'callback_data' => 'cmd_products']],
            ];
            $storeRow = $this->storeInlineRow();
            if ($storeRow !== []) {
                $emptyInline[] = $storeRow;
            }

            $this->sendBotReply(
                $token,
                $chatId,
                $this->presenter->emptyOrders(),
                $telegramUser,
                inlineKeyboard: $emptyInline
            );

            return;
        }

        $storeUrl = $this->publicStoreUrl();
        $orderLines = [];
        $inline = [];

        foreach ($orders as $order) {
            $status = (string) $order->status;
            $total = number_format((float) $order->total, 2);
            $orderDate = optional($order->created_at)->format('d M Y, H:i') ?: 'N/A';
            $badge = $this->presenter->orderStatusBadge($status);

            $orderLines[] = $this->presenter->orderLine(
                (string) $order->order_number,
                $orderDate,
                $total,
                $badge
            );

            if ($storeUrl !== '') {
                $inline[] = [
                    [
                        'text' => '🔍 #'.$order->order_number,
                        'url' => "{$storeUrl}/track-order?orderNumber={$order->order_number}",
                    ],
                ];
            }
        }

        if ($storeUrl === '' && $orders->isNotEmpty()) {
            $orderLines[] = '';
            $orderLines[] = 'Track orders on the website when your store URL is configured.';
        }

        $text = $this->presenter->ordersSummary($orders->count(), $orderLines);
        $inline[] = [
            ['text' => '🛒 Shop more', 'callback_data' => 'cmd_products'],
            ['text' => '👤 Profile', 'callback_data' => 'cmd_profile'],
        ];
        $storeRow = $this->storeInlineRow();
        if ($storeRow !== []) {
            $inline[] = $storeRow;
        }

        $this->sendBotReply($token, $chatId, $text, $telegramUser, inlineKeyboard: $inline);
    }

    /**
     * @param  array<int, array<int, array<string, mixed>>>|null  $inlineKeyboard
     */
    private function sendBotReply(
        string $token,
        int $chatId,
        string $html,
        ?TelegramUser $telegramUser,
        ?array $inlineKeyboard = null,
        bool $forceLinkKeyboard = false
    ): void {
        $sanitizedInline = $inlineKeyboard ? $this->sanitizeInlineKeyboard($inlineKeyboard) : null;
        $plainText = strip_tags(html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        $attempts = [
            ['text' => $html, 'parse_mode' => 'HTML', 'inline' => $sanitizedInline],
            ['text' => $plainText, 'parse_mode' => null, 'inline' => $sanitizedInline],
            ['text' => $plainText, 'parse_mode' => null, 'inline' => null],
        ];

        foreach ($attempts as $attempt) {
            $payload = [
                'chat_id' => $chatId,
                'text' => $attempt['text'],
                'disable_web_page_preview' => true,
                'reply_markup' => !empty($attempt['inline'])
                    ? ['inline_keyboard' => $attempt['inline']]
                    : $this->buildReplyKeyboard($telegramUser, $forceLinkKeyboard),
            ];

            if ($attempt['parse_mode']) {
                $payload['parse_mode'] = $attempt['parse_mode'];
            }

            $response = $this->sendTelegramApi($token, 'sendMessage', $payload);
            if ($response->successful()) {
                return;
            }
        }

        Log::error('Telegram sendMessage failed after retries.', [
            'chat_id' => $chatId,
        ]);
    }

    /**
     * @return array<int, array<int, array<string, string>>>
     */
    private function quickActionsInline(?TelegramUser $telegramUser): array
    {
        $linked = $this->isLinked($telegramUser);
        $rows = [];

        $storeRow = $this->storeInlineRow();
        if ($storeRow !== []) {
            $rows[] = $storeRow;
        }

        if ($linked) {
            $rows[] = [
                ['text' => '📦 Orders', 'callback_data' => 'cmd_orders'],
                ['text' => '👤 Profile', 'callback_data' => 'cmd_profile'],
            ];
        } else {
            $rows[] = [
                ['text' => '🔗 Link account', 'callback_data' => 'cmd_link'],
            ];
        }

        $rows[] = [
            ['text' => '🔍 Search', 'callback_data' => 'cmd_search'],
            ['text' => '🛒 Products', 'callback_data' => 'cmd_products'],
        ];
        $rows[] = [
            ['text' => '❓ Help', 'callback_data' => 'cmd_help'],
        ];

        return $rows;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function storeInlineRow(): array
    {
        $miniAppUrl = $this->resolveMiniAppUrl();
        if ($miniAppUrl) {
            return [['text' => '🛍️ Open store', 'web_app' => ['url' => $miniAppUrl]]];
        }

        $storeUrl = $this->publicStoreUrl();
        if ($storeUrl !== '') {
            return [['text' => '🌐 Open store', 'url' => $storeUrl]];
        }

        return [];
    }

    /**
     * Telegram rejects localhost and non-HTTPS URLs on inline buttons.
     *
     * @param  array<int, array<int, array<string, mixed>>>  $inline
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function sanitizeInlineKeyboard(array $inline): array
    {
        $result = [];

        foreach ($inline as $row) {
            $cleanRow = [];

            foreach ($row as $button) {
                if (isset($button['url']) && !$this->isTelegramSafeUrl((string) $button['url'])) {
                    continue;
                }

                $webAppUrl = $button['web_app']['url'] ?? null;
                if (is_string($webAppUrl) && !$this->isTelegramSafeUrl($webAppUrl)) {
                    continue;
                }

                $cleanRow[] = $button;
            }

            if ($cleanRow !== []) {
                $result[] = $cleanRow;
            }
        }

        return $result;
    }

    private function isTelegramSafeUrl(string $url): bool
    {
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        if (!str_starts_with(strtolower($url), 'https://')) {
            return false;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return false;
        }

        if (in_array($host, ['localhost', '127.0.0.1'], true)) {
            return false;
        }

        return !str_ends_with($host, '.localhost');
    }

    private function buildReplyKeyboard(?TelegramUser $telegramUser, bool $forceLinkKeyboard = false): array
    {
        $linked = $telegramUser && $this->isLinked($telegramUser);
        $miniAppUrl = $this->resolveMiniAppUrl();

        if ($forceLinkKeyboard || !$linked) {
            $keyboard = [
                [['text' => '🔗 Link Account', 'request_contact' => true]],
                [['text' => '🔍 Search'], ['text' => '🛒 View Products']],
                [['text' => '❓ Help']],
            ];

            if ($miniAppUrl) {
                $keyboard[] = [['text' => '🛍️ Open Store', 'web_app' => ['url' => $miniAppUrl]]];
            }

            return ['keyboard' => $keyboard, 'resize_keyboard' => true, 'one_time_keyboard' => false];
        }

        $storeButton = $miniAppUrl
            ? ['text' => '🛍️ Open Store', 'web_app' => ['url' => $miniAppUrl]]
            : ['text' => '🛒 View Products'];

        return [
            'keyboard' => [
                [$storeButton, ['text' => '📦 My Orders']],
                [['text' => '🔍 Search'], ['text' => '🛒 View Products']],
                [['text' => '👤 My Profile'], ['text' => '❓ Help']],
            ],
            'resize_keyboard' => true,
        ];
    }

    private function resolveCommand(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        if (str_starts_with($text, '/')) {
            $command = strtok(ltrim($text, '/'), " @\t\r\n");

            return strtolower((string) $command);
        }

        $normalized = $this->normalizeButtonText($text);

        return match ($normalized) {
            'link account', 'link my account' => 'link',
            'my profile', 'profile' => 'profile',
            'my orders', 'orders' => 'orders',
            'view products', 'products' => 'products',
            'search', 'search products' => 'search',
            'help' => 'help',
            'open store' => 'products',
            'unlink', 'unlink account' => 'unlink',
            default => '',
        };
    }

    private function normalizeButtonText(string $text): string
    {
        $text = mb_strtolower(trim($text));
        $text = preg_replace('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private function isLinked(?TelegramUser $telegramUser): bool
    {
        return $telegramUser !== null && !empty($telegramUser->user_id);
    }

    /**
     * Public HTTPS storefront for Telegram links (never localhost).
     * Uses FRONTEND_URL from .env, not FRONTEND_URL_LOCAL.
     */
    private function publicStoreUrl(): string
    {
        foreach ([
            rtrim((string) env('FRONTEND_URL', ''), '/'),
            rtrim((string) env('APP_STORE_URL', ''), '/'),
        ] as $url) {
            if ($this->isTelegramSafeUrl($url)) {
                return $url;
            }
        }

        return '';
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

    private function linkTelegramContactToUser(TelegramUser $telegramUser, array $contact, mixed $telegramUserId): string
    {
        $contactUserId = $contact['user_id'] ?? null;
        if (is_numeric($contactUserId) && is_numeric($telegramUserId) && (int) $contactUserId !== (int) $telegramUserId) {
            return 'invalid_contact_owner';
        }

        $phoneRaw = (string) ($contact['phone_number'] ?? '');
        $matchedUser = $this->findUserByPhone($phoneRaw);
        if (!$matchedUser) {
            return 'no_match';
        }

        TelegramUser::query()
            ->where('user_id', $matchedUser->id)
            ->where('telegram_user_id', '!=', $telegramUser->telegram_user_id)
            ->update(['user_id' => null]);

        $telegramUser->setAttribute('user_id', $matchedUser->id);
        $telegramUser->save();

        return 'linked';
    }

    private function findUserByPhone(string $phoneRaw): ?User
    {
        $normalizedPhone = $this->normalizePhone($phoneRaw);
        if ($normalizedPhone === '') {
            return null;
        }

        $digitsOnlyPhone = preg_replace('/\D+/', '', $normalizedPhone) ?? '';
        $variants = array_values(array_unique(array_filter([
            $phoneRaw,
            $normalizedPhone,
            $digitsOnlyPhone,
            $this->normalizeCambodiaPhone($digitsOnlyPhone),
        ])));

        return User::query()
            ->where(function ($query) use ($variants, $digitsOnlyPhone) {
                foreach ($variants as $variant) {
                    $query->orWhere('phone', $variant);
                }
                if ($digitsOnlyPhone !== '') {
                    $query->orWhereRaw("regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ?", [$digitsOnlyPhone]);
                    $kh = $this->normalizeCambodiaPhone($digitsOnlyPhone);
                    if ($kh !== '' && $kh !== $digitsOnlyPhone) {
                        $query->orWhereRaw("regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ?", [$kh]);
                    }
                }
            })
            ->first();
    }

    private function normalizeCambodiaPhone(string $digits): string
    {
        $digits = ltrim($digits, '0');
        if (str_starts_with($digits, '855')) {
            return substr($digits, 3);
        }

        return $digits;
    }

    private function buildContactReplyText(string $linkResult): string
    {
        return match ($linkResult) {
            'linked' => $this->presenter->linkSuccess(),
            'no_match' => implode("\n", [
                '⚠️ <b>No account found</b>',
                '',
                $this->presenter->divider(),
                'Register at '.TelegramBotPresenter::BRAND.' with the same phone number, then try again.',
                '',
                'Or sign in inside the Telegram store to link automatically.',
                $this->presenter->divider(),
            ]),
            'invalid_contact_owner' => '🔒 Please share <b>your own</b> contact using the Link Account button.',
            default => 'We could not process your contact. Please try again.',
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

    private function sendTelegramApi(string $token, string $method, array $payload)
    {
        return Http::asJson()
            ->timeout(10)
            ->post("https://api.telegram.org/bot{$token}/{$method}", $payload);
    }

    private function resolveMiniAppUrl(): ?string
    {
        $url = trim((string) (config('app.frontend_url') ?: env('FRONTEND_URL', '')));
        if ($url === '' || !str_starts_with($url, 'https://')) {
            return null;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return null;
        }

        if (in_array($host, ['localhost', '127.0.0.1'], true) || str_ends_with($host, '.localhost')) {
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
                'web_app' => ['url' => $miniAppUrl],
            ],
        ]);
    }

    private function ensureBotCommandsRegistered(string $token): void
    {
        Cache::remember('telegram:bot_commands_registered_v3', now()->addDay(), function () use ($token) {
            $this->sendTelegramApi($token, 'setMyCommands', [
                'commands' => self::BOT_COMMANDS,
                'scope' => ['type' => 'default'],
            ]);

            $description = TelegramBotPresenter::BRAND.' — shop, track orders, and manage your member account in Telegram.';
            $this->sendTelegramApi($token, 'setMyDescription', [
                'description' => $description,
            ]);
            $this->sendTelegramApi($token, 'setMyShortDescription', [
                'short_description' => 'Official '.TelegramBotPresenter::BRAND.' loyalty & shopping assistant.',
            ]);

            return true;
        });
    }
}
