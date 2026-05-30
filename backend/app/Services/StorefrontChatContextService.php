<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Discount;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Live storefront snapshot for the customer support chatbot.
 */
class StorefrontChatContextService
{
    private const CACHE_KEY = 'storefront_chat_context_v1';

    public function build(): array
    {
        return Cache::remember(self::CACHE_KEY, 120, fn () => $this->collect());
    }

    public function toPromptContext(string $message = '', ?User $user = null): string
    {
        $ctx = $this->build();
        $lines = [
            'ROLE: Fit & Sleek (FitandSleek) customer support AI — professional, warm, concise.',
            'RULES:',
            '- Answer ONLY from the live store facts below. Never invent products, prices, or policies.',
            '- Match the customer language (Khmer or English).',
            '- NEVER use markdown tables (| syntax). Product cards are shown in the UI automatically.',
            '- For product questions, mention names and prices from MATCHED PRODUCTS or catalog sections.',
            '- Direct customers to site pages when helpful (/discounts, /faq, /support, /track-order).',
            '',
            '=== STORE ===',
            'Name: Fit & Sleek — premium fashion (men, women, kids).',
            'Active products: ' . (int) ($ctx['stats']['products'] ?? 0),
            'Categories: ' . (int) ($ctx['stats']['categories'] ?? 0) . ' | Brands: ' . (int) ($ctx['stats']['brands'] ?? 0),
            'On sale now: ' . (int) ($ctx['stats']['discounted'] ?? 0) . ' products',
            '',
            '=== SHIPPING & DELIVERY ===',
            $ctx['policies']['shipping'] ?? '',
            '',
            '=== RETURNS ===',
            $ctx['policies']['returns'] ?? '',
            '',
            '=== PAYMENTS ===',
            $ctx['policies']['payments'] ?? '',
            '',
            '=== CONTACT ===',
            $ctx['contact']['text'] ?? 'See /support page.',
            '',
            '=== SITE NAVIGATION ===',
            collect($ctx['navigation'] ?? [])->map(fn ($n) => ($n['label'] ?? '') . ' → ' . ($n['url'] ?? ''))->implode("\n"),
            '',
            '=== SHOP BY CATEGORY ===',
            $this->formatCategoryList($ctx['categories'] ?? []),
            '',
            '=== BRANDS ===',
            $this->formatBrandList($ctx['brands'] ?? []),
            '',
            '=== ON SALE (sample) ===',
            $this->formatProductList($ctx['discounted_products'] ?? [], 'No active discounts.'),
            '',
            '=== NEW ARRIVALS (sample) ===',
            $this->formatProductList($ctx['new_arrivals'] ?? [], 'No new arrivals.'),
        ];

        $matched = $this->searchProductsForMessage($message);
        if ($matched !== []) {
            $lines[] = '';
            $lines[] = '=== MATCHED PRODUCTS (this question) ===';
            $lines[] = $this->formatProductList($matched, 'No matches.');
        }

        if ($user !== null) {
            $lines[] = '';
            $lines[] = '=== LOGGED-IN CUSTOMER ===';
            $lines[] = 'Name: ' . ($user->name ?? 'Customer') . ' | Email: ' . ($user->email ?? '');
            $orders = $this->buildUserRecentOrders($user);
            if ($orders !== []) {
                $lines[] = 'Recent orders:';
                foreach ($orders as $o) {
                    $lines[] = sprintf(
                        '  #%s status=%s total=$%s date=%s',
                        $o['order_number'] ?? $o['id'],
                        $o['status'] ?? '?',
                        number_format((float) ($o['total'] ?? 0), 2),
                        $o['created_at'] ?? '',
                    );
                }
                $lines[] = 'Track orders at /track-order';
            } else {
                $lines[] = 'No recent orders for this account.';
            }
        }

        return implode("\n", $lines);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function buildRichProductsForMessage(string $message): array
    {
        $ctx = $this->build();
        $hay = mb_strtolower($message);

        if ($this->messageAsksDiscounts($hay)) {
            return $ctx['discounted_products'] ?? [];
        }

        if ($this->messageAsksNewArrivals($hay)) {
            return $ctx['new_arrivals'] ?? [];
        }

        if ($this->messageAsksProducts($hay)) {
            $matched = $this->searchProductsForMessage($message, 8);
            if ($matched !== []) {
                return $matched;
            }

            return array_slice($ctx['discounted_products'] ?? $ctx['new_arrivals'] ?? [], 0, 6);
        }

        return [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function searchProductsForMessage(string $message, int $limit = 6): array
    {
        $terms = $this->extractSearchTerms($message);
        if ($terms === []) {
            return [];
        }

        $query = Product::query()
            ->with('activeDiscount')
            ->where('is_active', true)
            ->where('stock', '>', 0);

        $query->where(function ($q) use ($terms) {
            foreach ($terms as $term) {
                $q->orWhere('name', 'ilike', '%' . $term . '%')
                    ->orWhere('description', 'ilike', '%' . $term . '%');
            }
        });

        if ($this->messageMentionsGender($message, 'men')) {
            $query->where(function ($q) {
                $q->where('audience', 'ilike', '%men%')
                    ->orWhere('audience', 'ilike', '%male%');
            });
        } elseif ($this->messageMentionsGender($message, 'women')) {
            $query->where(function ($q) {
                $q->where('audience', 'ilike', '%women%')
                    ->orWhere('audience', 'ilike', '%female%');
            });
        }

        return $query
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (Product $p) => $this->serializeProduct($p))
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    private function extractSearchTerms(string $message): array
    {
        $hay = mb_strtolower($message);
        $stop = [
            'the', 'and', 'for', 'what', 'which', 'how', 'about', 'please', 'show', 'find',
            'product', 'products', 'item', 'items', 'any', 'have', 'you', 'your', 'store',
            'តើ', 'អ្វី', 'មាន', 'ទេ', 'ផលិតផល', 'អីវ៉ាន់', 'សួរ', 'ចង់', 'មើល',
        ];

        if (preg_match_all('/[\p{L}\p{N}]{3,}/u', $hay, $matches)) {
            $terms = array_values(array_unique(array_filter(
                $matches[0],
                fn ($w) => ! in_array($w, $stop, true) && mb_strlen($w) >= 3,
            )));

            return array_slice($terms, 0, 4);
        }

        return [];
    }

    private function messageAsksProducts(string $hay): bool
    {
        foreach ([
            'product', 'item', 'shirt', 'dress', 'shoe', 'belt', 'bag', 'jacket', 'size',
            'recommend', 'suggest', 'looking for', 'do you have', 'show me',
            'ផលិតផល', 'អីវ៉ាន់', 'ស្បែកជើង', 'អាវ', 'ណែនាំ', 'មាន', 'រក',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function messageAsksDiscounts(string $hay): bool
    {
        foreach ([
            'discount', 'sale', 'promo', 'promotion', 'off', 'deal', 'clearance',
            'បញ្ចុះ', 'បញ្ចុះតម្លៃ', 'ឡុប', 'សale',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function messageAsksNewArrivals(string $hay): bool
    {
        foreach ([
            'new arrival', 'new in', 'latest', 'just added', 'new product',
            'ថ្មី', 'ទើប', 'មកដល់',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function messageMentionsGender(string $message, string $gender): bool
    {
        $hay = mb_strtolower($message);

        return match ($gender) {
            'men' => str_contains($hay, 'men') || str_contains($hay, 'male') || str_contains($hay, 'ប្រុស'),
            'women' => str_contains($hay, 'women') || str_contains($hay, 'female') || str_contains($hay, 'ស្រី'),
            default => false,
        };
    }

    private function serializeProduct(Product $product): array
    {
        $product->loadMissing('activeDiscount');

        return [
            'id' => $product->id,
            'name' => $product->name,
            'slug' => $product->slug,
            'image_url' => $product->image_url,
            'price' => round((float) $product->price, 2),
            'final_price' => round((float) ($product->final_price ?? $product->price), 2),
            'has_discount' => (bool) $product->has_discount,
            'in_stock' => (int) $product->stock > 0,
            'url' => '/p/' . $product->slug,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function formatProductList(array $rows, string $empty = ''): string
    {
        if ($rows === []) {
            return $empty;
        }

        return collect($rows)
            ->map(fn (array $p) => sprintf(
                '%s — $%s%s | %s',
                $p['name'] ?? '?',
                number_format((float) ($p['final_price'] ?? $p['price'] ?? 0), 2),
                ($p['has_discount'] ?? false) ? ' (sale)' : '',
                $p['url'] ?? '',
            ))
            ->implode("\n");
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function formatCategoryList(array $rows): string
    {
        if ($rows === []) {
            return 'Browse at /search';
        }

        return collect($rows)
            ->map(fn ($c) => ($c['name'] ?? '?') . ' (' . ($c['count'] ?? 0) . ') → ' . ($c['url'] ?? ''))
            ->implode("\n");
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function formatBrandList(array $rows): string
    {
        if ($rows === []) {
            return 'See brands at /search';
        }

        return collect($rows)->pluck('name')->filter()->implode(', ');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildUserRecentOrders(User $user): array
    {
        return Order::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(3)
            ->get(['id', 'order_number', 'status', 'total', 'created_at'])
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'total' => (float) $o->total,
                'created_at' => $o->created_at?->format('Y-m-d') ?? '',
            ])
            ->all();
    }

    private function collect(): array
    {
        $homepage = Setting::query()->where('group', 'homepage')->get()->mapWithKeys(
            fn ($s) => [$s->key => $s->value],
        );

        $header = is_array($homepage['header'] ?? null) ? $homepage['header'] : [];
        $hero = is_array($homepage['hero'] ?? null) ? $homepage['hero'] : [];

        $freeDelivery = (string) ($header['free_delivery_text'] ?? $hero['message'] ?? 'Free delivery on orders above $40');
        $checkoutSettings = Setting::query()->where('group', 'commerce')->pluck('value', 'key');
        $freeShippingThreshold = (float) ($checkoutSettings['free_shipping_threshold'] ?? 40);

        $contactEmail = Setting::query()->where('key', 'footer_contact_email')->value('value');
        $contactPhone = Setting::query()->where('key', 'footer_contact_phone')->value('value');
        $contactAddress = Setting::query()->where('key', 'footer_contact_address')->value('value');

        $discountedIds = Discount::query()->where('is_active', true)->pluck('product_id');

        $discountedProducts = Product::query()
            ->with('activeDiscount')
            ->where('is_active', true)
            ->where('stock', '>', 0)
            ->whereIn('id', $discountedIds)
            ->orderByDesc('updated_at')
            ->limit(8)
            ->get()
            ->map(fn (Product $p) => $this->serializeProduct($p))
            ->values()
            ->all();

        $newArrivals = Product::query()
            ->with('activeDiscount')
            ->where('is_active', true)
            ->where('stock', '>', 0)
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn (Product $p) => $this->serializeProduct($p))
            ->values()
            ->all();

        $categories = Category::query()
            ->catalogOnly()
            ->where('is_active', true)
            ->withCount(['products as products_count' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('sort_order')
            ->limit(12)
            ->get()
            ->map(fn (Category $c) => [
                'name' => $c->name,
                'slug' => $c->slug,
                'count' => (int) $c->products_count,
                'url' => '/search?category=' . urlencode((string) $c->slug),
            ])
            ->values()
            ->all();

        $brands = Brand::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->limit(12)
            ->get(['name', 'slug'])
            ->map(fn (Brand $b) => [
                'name' => $b->name,
                'slug' => $b->slug,
                'url' => '/brands/' . $b->slug,
            ])
            ->values()
            ->all();

        return [
            'stats' => [
                'products' => Product::where('is_active', true)->count(),
                'categories' => Category::catalogOnly()->where('is_active', true)->count(),
                'brands' => Brand::where('is_active', true)->count(),
                'discounted' => Product::where('is_active', true)->whereIn('id', $discountedIds)->count(),
            ],
            'navigation' => [
                ['label' => 'NEW IN', 'url' => '/search?tab=new'],
                ['label' => 'Discounts', 'url' => '/discounts'],
                ['label' => 'Women', 'url' => '/search?gender=women'],
                ['label' => 'Men', 'url' => '/search?gender=men'],
                ['label' => 'Sale', 'url' => '/search?tab=sale'],
                ['label' => 'FAQ', 'url' => '/faq'],
                ['label' => 'Support', 'url' => '/support'],
                ['label' => 'Track order', 'url' => '/track-order'],
            ],
            'categories' => $categories,
            'brands' => $brands,
            'discounted_products' => $discountedProducts,
            'new_arrivals' => $newArrivals,
            'policies' => [
                'shipping' => $freeDelivery . '. Standard delivery 3–5 business days. Express 1–2 days (location dependent). Free shipping threshold: $'
                    . number_format($freeShippingThreshold, 2) . '.',
                'returns' => 'Returns within 30 days for unused items in original condition with tags/packaging. Start at /support or contact support.',
                'payments' => 'Secure checkout — card and local payment methods at checkout. See /faq for details.',
            ],
            'contact' => [
                'text' => trim(implode(' | ', array_filter([
                    $contactEmail ? 'Email: ' . $contactEmail : null,
                    $contactPhone ? 'Phone: ' . $contactPhone : null,
                    $contactAddress ? 'Address: ' . $contactAddress : null,
                    'Support page: /support',
                ]))),
            ],
        ];
    }
}
