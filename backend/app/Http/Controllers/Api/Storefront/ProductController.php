<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\InventoryLotService;
use App\Services\ProductRecommendationService;
use App\Services\StorefrontEventService;
use App\Services\ProductVariantInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class ProductController extends Controller
{
    public function __construct(
        private ProductRecommendationService $recommendationService,
        private StorefrontEventService $eventService,
        private InventoryLotService $inventoryLots,
    ) {
    }

    public function index(Request $request)
    {
        $q = Product::query()
            ->with(['category', 'brand', 'activeDiscount'])
            ->where('products.is_active', true);

        $this->applyStorefrontListingFilters($q, $request);

        $perPage = min((int) $request->get('per_page', 12), 200);
        $sort = strtolower(trim((string) $request->input('sort', 'recommend')));

        if ($sort !== 'recommend') {
            $this->applySortFilter($q, $request);
        } elseif (!$this->applyTabFilter($q, $request)) {
            $q->orderByDesc('products.id');
        }
        $products = $q->paginate($perPage);
        $products->getCollection()->transform(function (Product $product) {
            return $this->enrichStorefrontPricing($product->toArray(), $product);
        });

        return response()->json($products);
    }

    /**
     * Brand counts and totals for PLP toolbar (same filters as /products, brand facet excludes brand_id).
     */
    public function filterFacets(Request $request)
    {
        $q = Product::query()->where('products.is_active', true);
        $this->applyStorefrontListingFilters($q, $request, excludeBrandFilter: true);

        $brandRows = (clone $q)
            ->join('brands', 'products.brand_id', '=', 'brands.id')
            ->where('brands.is_active', true)
            ->whereNotNull('products.brand_id')
            ->selectRaw('brands.id, brands.name, brands.slug, COUNT(products.id) as product_count')
            ->groupBy('brands.id', 'brands.name', 'brands.slug')
            ->orderByDesc('product_count')
            ->orderBy('brands.name')
            ->limit(60)
            ->get();

        return response()->json([
            'brands' => $brandRows->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'slug' => $row->slug,
                'count' => (int) $row->product_count,
            ])->values()->all(),
        ]);
    }

    /**
     * Distinct filter option values for storefront attribute filters.
     */
    public function filterOptions()
    {
        $rows = Product::query()
            ->where('is_active', true)
            ->get(['colors', 'sizes', 'price']);

        $colors = [];
        $sizes = [];
        foreach ($rows as $row) {
            $this->collectFilterTokens((array) ($row->colors ?? []), $colors);
            $this->collectFilterTokens((array) ($row->sizes ?? []), $sizes);
        }

        $priceBounds = Product::query()
            ->where('is_active', true)
            ->selectRaw('MIN(price) as price_min, MAX(price) as price_max')
            ->first();

        return response()->json([
            'colors' => collect(array_keys($colors))->sort()->values()->all(),
            'sizes' => $this->sortSizeList(array_keys($sizes)),
            'price_min' => $priceBounds?->price_min !== null ? (float) $priceBounds->price_min : null,
            'price_max' => $priceBounds?->price_max !== null ? (float) $priceBounds->price_max : null,
        ]);
    }

    /**
     * @param  array<int, mixed>  $items
     * @param  array<string, true>  $set
     */
    private function collectFilterTokens(array $items, array &$set): void
    {
        foreach ($items as $item) {
            $token = $this->normalizeFilterToken($item);
            if ($token !== null) {
                $set[$token] = true;
            }
        }
    }

    private function normalizeFilterToken(mixed $value): ?string
    {
        if (is_string($value) || is_numeric($value)) {
            $normalized = trim((string) $value);

            return $normalized !== '' ? $normalized : null;
        }

        if (! is_array($value)) {
            return null;
        }

        foreach (['name', 'label', 'value', 'title', 'size'] as $key) {
            if (! array_key_exists($key, $value)) {
                continue;
            }
            $field = $value[$key];
            if (is_string($field) || is_numeric($field)) {
                $normalized = trim((string) $field);
                if ($normalized !== '') {
                    return $normalized;
                }
            }
        }

        foreach ($value as $nested) {
            $normalized = $this->normalizeFilterToken($nested);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return null;
    }

    private function sortSizeList(array $sizes): array
    {
        usort($sizes, function ($a, $b) {
            $na = is_numeric($a) ? (float) $a : null;
            $nb = is_numeric($b) ? (float) $b : null;
            if ($na !== null && $nb !== null) {
                return $na <=> $nb;
            }
            if ($na !== null) {
                return -1;
            }
            if ($nb !== null) {
                return 1;
            }

            return strcasecmp((string) $a, (string) $b);
        });

        return array_values($sizes);
    }

    /**
     * Shared listing filters for index() and filterFacets().
     */
    private function applyStorefrontListingFilters($query, Request $request, bool $excludeBrandFilter = false): void
    {
        if ($request->filled('ids')) {
            $ids = array_filter(array_map('intval', explode(',', $request->input('ids'))));
            if (!empty($ids)) {
                $query->whereIn('products.id', $ids);
            }
        }

        $this->applyParentCategoryFilter($query, $request);
        $this->applyMinMaxPriceFilter($query, $request);
        $this->applyPriceFilter($query, $request);

        if ($request->filled('category')) {
            $categorySlug = (string) $request->input('category');
            $query->whereHas('category', function ($categoryQuery) use ($categorySlug) {
                $categoryQuery->where('slug', $categorySlug);
            });
        }

        if ($request->filled('q')) {
            $term = $request->string('q')->toString();
            $query->where(function ($w) use ($term) {
                $w->where('products.name', 'LIKE', "%{$term}%")
                    ->orWhere('products.description', 'LIKE', "%{$term}%");

                if (strlen($term) >= 4) {
                    foreach (str_split(strtolower($term)) as $i => $char) {
                        if ($i < strlen($term) - 1) {
                            $pattern = substr($term, 0, $i) . substr($term, $i + 1);
                            $w->orWhere('products.name', 'LIKE', "%{$pattern}%");
                        }
                    }
                }
            });
        }

        $this->applyGenderFilter($query, $request);
        $this->applySectionFilter($query, $request);
        $this->applyColorFilter($query, $request);
        $this->applySizeFilter($query, $request);

        if ($request->filled('category_id') && str_contains((string) $request->input('category_id'), ',')) {
            $ids = $this->parseCommaList($request->input('category_id'));
            if (!empty($ids)) {
                $query->whereIn('category_id', $ids);
            }
        } elseif ($request->filled('category_id')) {
            $query->where('category_id', (int) $request->input('category_id'));
        }

        if (!$excludeBrandFilter) {
            if ($request->filled('brand_id') && str_contains((string) $request->input('brand_id'), ',')) {
                $ids = $this->parseCommaList($request->input('brand_id'));
                if (!empty($ids)) {
                    $query->whereIn('brand_id', $ids);
                }
            } elseif ($request->filled('brand_id')) {
                $query->where('brand_id', (int) $request->input('brand_id'));
            }

            if ($request->filled('brand_slug')) {
                $query->whereHas('brand', function ($b) use ($request) {
                    $b->where('slug', $request->string('brand_slug'));
                });
            }
        }

        if ($request->filled('tab') && strtolower(trim((string) $request->input('tab'))) === 'sale') {
            $query->whereHas('activeDiscount');
        }
    }

    private function applySortFilter($query, Request $request): void
    {
        $sort = strtolower(trim((string) $request->input('sort', 'recommend')));

        switch ($sort) {
            case 'new':
                $query->orderByDesc('products.created_at')->orderByDesc('products.id');
                break;
            case 'price_high':
                $query->orderByDesc('products.price')->orderByDesc('products.id');
                break;
            case 'price_low':
                $query->orderBy('products.price')->orderByDesc('products.id');
                break;
            case 'discount_high':
                $this->applyDiscountSort($query, 'desc');
                break;
            case 'discount_low':
                $this->applyDiscountSort($query, 'asc');
                break;
            case 'recommend':
            default:
                $query->orderByDesc('products.id');
                break;
        }
    }

    private function applyDiscountSort($query, string $direction): void
    {
        $dir = strtolower($direction) === 'asc' ? 'ASC' : 'DESC';

        $query->leftJoin('discounts', function ($join) {
            $join->on('products.id', '=', 'discounts.product_id')
                ->where('discounts.is_active', true)
                ->where('discounts.start_date', '<=', now())
                ->where('discounts.end_date', '>=', now());
        })
            ->select('products.*')
            ->orderByRaw(
                "CASE
                    WHEN discounts.discount_type = 'percentage' THEN discounts.discount_value
                    WHEN products.price > 0 THEN (discounts.discount_value / products.price * 100)
                    ELSE 0
                END {$dir} NULLS LAST"
            )
            ->orderByDesc('products.id');
    }

    private function applyMinMaxPriceFilter($query, Request $request): void
    {
        if ($request->filled('min_price')) {
            $query->where('products.price', '>=', (float) $request->input('min_price'));
        }
        if ($request->filled('max_price')) {
            $query->where('products.price', '<=', (float) $request->input('max_price'));
        }
    }

    /**
     * Browse tabs from header / homepage (new, trending, this-week, sale).
     */
    private function applyTabFilter($query, Request $request): bool
    {
        if (!$request->filled('tab')) {
            return false;
        }

        $tab = strtolower(trim((string) $request->input('tab')));
        if ($tab === '' || $tab === 'wishlist') {
            return false;
        }

        switch ($tab) {
            case 'new':
                $query->orderByDesc('products.created_at')->orderByDesc('products.id');
                return true;
            case 'this-week':
                $query->where('products.created_at', '>=', Carbon::now()->startOfWeek())
                    ->orderByDesc('products.created_at')
                    ->orderByDesc('products.id');
                return true;
            case 'trending':
                $query->orderByDesc('products.updated_at')->orderByDesc('products.id');
                return true;
            case 'sale':
                $query->where('products.is_active', true)
                    ->whereHas('activeDiscount')
                    ->orderByDesc('products.id');
                return true;
            default:
                return false;
        }
    }

    private function parseCommaList(mixed $raw): array
    {
        return array_values(array_filter(array_map('intval', explode(',', (string) $raw))));
    }

    private function parseStringList(mixed $raw): array
    {
        return array_values(array_filter(array_map(
            fn ($v) => trim((string) $v),
            explode(',', (string) $raw)
        )));
    }

    private function applyGenderFilter($query, Request $request): void
    {
        if (!$request->filled('gender')) {
            return;
        }

        $genders = array_values(array_filter(array_map(
            fn ($g) => strtolower(trim((string) $g)),
            $this->parseStringList($request->input('gender'))
        )));
        $allowed = ['men', 'women', 'boys', 'girls'];
        $genders = array_values(array_intersect($genders, $allowed));
        if ($genders === []) {
            return;
        }

        $query->whereHas('category', function ($categoryQuery) use ($genders) {
            $categoryQuery->where(function ($inner) use ($genders) {
                foreach ($genders as $gender) {
                    $inner->orWhere(function ($scoped) use ($gender) {
                        $this->applyCategoryAudienceFilter($scoped, $gender);
                    });
                }
            });
        });
    }

    private function applySectionFilter($query, Request $request): void
    {
        if (!$request->filled('section')) {
            return;
        }

        $sections = $this->parseStringList($request->input('section'));
        if ($sections === []) {
            return;
        }

        $query->whereHas('category', function ($categoryQuery) use ($sections) {
            $categoryQuery->where(function ($inner) use ($sections) {
                foreach ($sections as $key) {
                    $token = strtolower($key);
                    $inner->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', ['%' . $token . '%'])
                        ->orWhereRaw('LOWER(COALESCE(slug, \'\')) LIKE ?', ['%' . $token . '%']);
                }
            });
        });
    }

    private function applyPriceFilter($query, Request $request): void
    {
        if (!$request->filled('price')) {
            return;
        }

        $buckets = $this->parseStringList($request->input('price'));
        if ($buckets === []) {
            return;
        }

        $query->where(function ($outer) use ($buckets) {
            foreach ($buckets as $bucket) {
                $outer->orWhere(function ($inner) use ($bucket) {
                    if ($bucket === 'under_25') {
                        $inner->where('products.price', '<', 25);
                    } elseif ($bucket === '25_100') {
                        $inner->whereBetween('products.price', [25, 100]);
                    } elseif ($bucket === 'over_100') {
                        $inner->where('products.price', '>', 100);
                    }
                });
            }
        });
    }

    private function applyColorFilter($query, Request $request): void
    {
        if (!$request->filled('color')) {
            return;
        }

        $colors = $this->parseStringList($request->input('color'));
        if ($colors === []) {
            return;
        }

        $query->where(function ($outer) use ($colors) {
            foreach ($colors as $color) {
                $outer->orWhereJsonContains('colors', $color);
            }
        });
    }

    private function applySizeFilter($query, Request $request): void
    {
        if (!$request->filled('size')) {
            return;
        }

        $sizes = $this->parseStringList($request->input('size'));
        if ($sizes === []) {
            return;
        }

        $query->where(function ($outer) use ($sizes) {
            foreach ($sizes as $size) {
                $outer->orWhereJsonContains('sizes', $size);
            }
        });
    }

    private function applyParentCategoryFilter($query, Request $request): void
    {
        if (!$request->filled('parent_category')) {
            return;
        }

        $rawParent = trim((string) $request->input('parent_category'));
        if ($rawParent === '') {
            return;
        }

        $parent = strtolower($rawParent);
        if (!in_array($parent, ['men', 'women', 'boys', 'girls'], true)) {
            return;
        }

        $query->whereHas('category', function ($categoryQuery) use ($parent) {
            $this->applyCategoryAudienceFilter($categoryQuery, $parent);
        });
    }

    /**
     * Match categories for Men/Women/Boys/Girls across gender column and names like "Women - Dresses".
     */
    private function applyCategoryAudienceFilter($categoryQuery, string $audience): void
    {
        $audience = strtolower(trim($audience));
        $labels = [
            'men' => ['Men', 'Man', 'MEN', 'MAN'],
            'women' => ['Women', 'Woman', 'WOMEN', 'WOMAN'],
            'boys' => ['Boy', 'Boys', 'BOY', 'BOYS'],
            'girls' => ['Girl', 'Girls', 'GIRL', 'GIRLS'],
        ];

        if (!isset($labels[$audience])) {
            return;
        }

        $display = $labels[$audience][0];

        $categoryQuery->where(function ($inner) use ($audience, $labels, $display) {
            foreach ($labels[$audience] as $variant) {
                $lower = strtolower($variant);
                $inner->orWhereRaw('LOWER(COALESCE(gender, \'\')) = ?', [$lower])
                    ->orWhereRaw('UPPER(COALESCE(gender, \'\')) = ?', [strtoupper($variant)]);
            }

            $prefix = strtolower($display);
            $inner->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$prefix . ' -%'])
                ->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$prefix . '-%'])
                ->orWhereRaw('LOWER(COALESCE(name, \'\')) LIKE ?', [$prefix . ' %'])
                ->orWhereRaw('LOWER(COALESCE(slug, \'\')) LIKE ?', [$prefix . '-%'])
                ->orWhereRaw('LOWER(COALESCE(slug, \'\')) LIKE ?', [$prefix . '%']);
        });
    }

    public function show(string $slug)
    {
        $product = Product::with(['category', 'brand', 'activeDiscount'])->where('slug', $slug)->firstOrFail();
        if ($product->activeDiscount) {
            $product->discount = $this->formatStorefrontDiscount($product);
        }

        if (ProductVariantInventory::usesMatrix($product)) {
            $matrixTotal = ProductVariantInventory::totalMatrixQty($product);
            if ($matrixTotal > 0 && (int) ($product->stock ?? 0) < $matrixTotal) {
                $product->stock = $matrixTotal;
            }
        }

        $user = Auth::guard('sanctum')->user();
        $sessionId = request()->header('X-Session-Id') ?: request()->query('session_id');
        $this->eventService->track(
            'product_view',
            $user?->id ? (int) $user->id : null,
            $sessionId ? (string) $sessionId : null,
            (int) $product->id
        );

        $payload = $this->enrichStorefrontPricing($product->toArray(), $product);
        if (ProductVariantInventory::usesMatrix($product)) {
            $payload['variant_lot_prices'] = array_map(
                function (array $row) use ($product) {
                    $size = $row['size'];
                    $color = $row['color'];
                    $lotPrice = $this->inventoryLots->resolveStorefrontUnitPrice($product, $size, $color);
                    $variantRow = [
                        'size' => $size,
                        'color' => $color,
                        'unit_price' => $lotPrice,
                        'customer_price' => $this->inventoryLots->resolveStorefrontCustomerPrice($product, $size, $color),
                        'sellable_qty' => $this->inventoryLots->hasLotStockOnHand((int) $product->id)
                            ? $this->inventoryLots->totalSellableQty((int) $product->id, $size, $color)
                            : null,
                    ];
                    $lotDiscount = $this->inventoryLots->storefrontLotDiscountMeta($product, $size, $color);
                    if ($lotDiscount) {
                        $variantRow['lot_discount'] = $lotDiscount;
                    }

                    return $variantRow;
                },
                ProductVariantInventory::matrixRows($product),
            );
        }

        return response()->json($payload);
    }

    public function recommendations(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        $sessionId = $request->header('X-Session-Id') ?: $request->query('session_id');
        $perPage = (int) $request->input('per_page', 8);
        $result = $this->recommendationService->recommendations(
            $user?->id ? (int) $user->id : null,
            $sessionId ? (string) $sessionId : null,
            $perPage
        );

        return response()->json($result);
    }

    /**
     * Get all products with active discounts
     */
    public function discounts(Request $request)
    {
        $query = Product::query()
            ->with(['category', 'activeDiscount'])
            ->whereHas('activeDiscount')
            ->where('is_active', true);

        // Filter by category
        if ($request->filled('category_id')) {
            $query->where('category_id', (int) $request->input('category_id'));
        }

        // Filter by category slug
        if ($request->filled('category_slug')) {
            $query->whereHas('category', function ($q) use ($request) {
                $q->where('slug', $request->string('category_slug'));
            });
        }

        // Search
        if ($request->filled('q')) {
            $term = $request->string('q')->toString();
            $query->where(function ($w) use ($term) {
                $w->where('products.name', 'LIKE', "%{$term}%")
                    ->orWhere('products.description', 'LIKE', "%{$term}%");

                if (strlen($term) >= 4) {
                    $chars = str_split(strtolower($term));
                    foreach ($chars as $i => $char) {
                        if ($i < strlen($term) - 1) {
                            $pattern = substr($term, 0, $i) . substr($term, $i + 1);
                            $w->orWhere('products.name', 'LIKE', "%{$pattern}%");
                        }
                    }
                }
            });
        }

        // Filter by price range
        if ($request->filled('min_price')) {
            $query->whereHas('activeDiscount', function ($q) use ($request) {
                $q->where('sale_price', '>=', (float) $request->input('min_price'));
            });
        }
        if ($request->filled('max_price')) {
            $query->whereHas('activeDiscount', function ($q) use ($request) {
                $q->where('sale_price', '<=', (float) $request->input('max_price'));
            });
        }

        // Sort options
        $sort = $request->get('sort', 'newest');
        switch ($sort) {
            case 'price_low':
                $query->join('discounts', 'products.id', '=', 'discounts.product_id')
                    ->where('discounts.is_active', 1)
                    ->orderBy('discounts.sale_price', 'asc')
                    ->select('products.*');
                break;
            case 'price_high':
                $query->join('discounts', 'products.id', '=', 'discounts.product_id')
                    ->where('discounts.is_active', 1)
                    ->orderBy('discounts.sale_price', 'desc')
                    ->select('products.*');
                break;
            case 'discount':
                // Sort by highest discount
                $query->orderByRaw('(
                    SELECT 
                        CASE 
                            WHEN discounts.discount_type = "percentage" THEN discounts.discount_value
                            ELSE (discounts.discount_value / products.price * 100)
                        END
                    FROM discounts
                    WHERE discounts.product_id = products.id
                    AND discounts.is_active = 1
                    AND discounts.start_date <= NOW()
                    AND discounts.end_date >= NOW()
                ) DESC');
                break;
            case 'newest':
            default:
                $query->orderByDesc('products.id');
        }

        $products = $query->paginate($request->get('per_page', 12));

        // Format response with discount info
        $products->getCollection()->transform(function ($product) {
            if ($product->activeDiscount) {
                $product->discount = $this->formatStorefrontDiscount($product);
            }

            return $product;
        });

        return response()->json($products);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function enrichStorefrontPricing(array $row, Product $product, ?string $size = null, ?string $color = null): array
    {
        $row['storefront_unit_price'] = $this->inventoryLots->resolveStorefrontUnitPrice($product, $size, $color);
        $row['storefront_customer_price'] = $this->inventoryLots->resolveStorefrontCustomerPrice($product, $size, $color);
        $lotDiscount = $this->inventoryLots->storefrontLotDiscountMeta($product, $size, $color);
        if ($lotDiscount) {
            $row['storefront_lot_discount'] = $lotDiscount;
        }
        if ($product->activeDiscount) {
            $row['discount'] = $this->formatStorefrontDiscount($product);
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatStorefrontDiscount(Product $product): array
    {
        $disc = $product->activeDiscount;

        return [
            'type' => $disc->discount_type,
            'value' => $disc->discount_value,
            'original_price' => (float) $product->price,
            'sale_price' => (float) $disc->sale_price,
            'quantity' => $disc->quantity,
            'discount_percentage' => $this->calculateDiscountPercentage($product),
            'end_date' => $disc->end_date,
        ];
    }

    /**
     * Calculate discount percentage
     */
    private function calculateDiscountPercentage($product)
    {
        if (!$product->activeDiscount) {
            return 0;
        }

        if ($product->activeDiscount->discount_type === 'percentage') {
            return (int) $product->activeDiscount->discount_value;
        }

        return round(($product->activeDiscount->discount_value / $product->price) * 100);
    }
}
