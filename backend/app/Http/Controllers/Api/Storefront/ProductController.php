<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $q = Product::query()
            ->with(['category', 'brand', 'activeDiscount'])
            ->where('products.is_active', true);

        // Filter by specific product IDs (used by wishlist)
        if ($request->filled('ids')) {
            $ids = array_filter(array_map('intval', explode(',', $request->input('ids'))));
            if (!empty($ids)) {
                $q->whereIn('id', $ids);
            }
        }

        $this->applyParentCategoryFilter($q, $request);
        $this->applyMinMaxPriceFilter($q, $request);
        $this->applyPriceFilter($q, $request);

        if ($request->filled('category')) {
            $categorySlug = (string) $request->input('category');
            $q->whereHas('category', function ($categoryQuery) use ($categorySlug) {
                $categoryQuery->where('slug', $categorySlug);
            });
        }

        if ($request->filled('q')) {
            $term = $request->string('q')->toString();
            $q->where(function ($w) use ($term) {
                // Case-insensitive search (works for "Nike" = "nike")
                $w->where('name', 'LIKE', "%{$term}%")
                    ->orWhere('description', 'LIKE', "%{$term}%");

                // Fuzzy search for typos (if 4+ chars)
                if (strlen($term) >= 4) {
                    // Search with missing/swapped characters
                    $chars = str_split(strtolower($term));
                    foreach ($chars as $i => $char) {
                        if ($i < strlen($term) - 1) {
                            // Try skipping one character (e.g., "nke" finds "Nike")
                            $pattern = substr($term, 0, $i) . substr($term, $i + 1);
                            $w->orWhere('name', 'LIKE', "%{$pattern}%");
                        }
                    }
                }
            });
        }

        $this->applyGenderFilter($q, $request);
        $this->applySectionFilter($q, $request);
        $this->applyColorFilter($q, $request);
        $this->applySizeFilter($q, $request);

        if ($request->filled('category_id') && str_contains((string) $request->input('category_id'), ',')) {
            $ids = $this->parseCommaList($request->input('category_id'));
            if (!empty($ids)) {
                $q->whereIn('category_id', $ids);
            }
        } elseif ($request->filled('category_id')) {
            $q->where('category_id', (int) $request->input('category_id'));
        }

        if ($request->filled('brand_id') && str_contains((string) $request->input('brand_id'), ',')) {
            $ids = $this->parseCommaList($request->input('brand_id'));
            if (!empty($ids)) {
                $q->whereIn('brand_id', $ids);
            }
        } elseif ($request->filled('brand_id')) {
            $q->where('brand_id', (int) $request->input('brand_id'));
        }

        if ($request->filled('brand_slug')) {
            $q->whereHas('brand', function ($b) use ($request) {
                $b->where('slug', $request->string('brand_slug'));
            });
        }

        $perPage = min((int) $request->get('per_page', 12), 200);
        $sort = strtolower(trim((string) $request->input('sort', '')));
        if ($sort !== '' && $sort !== 'recommend') {
            $this->applySortFilter($q, $request);
        } elseif (!$this->applyTabFilter($q, $request)) {
            $q->orderByDesc('products.id');
        }
        $products = $q->paginate($perPage);

        return response()->json($products);
    }

    /**
     * Distinct filter option values for storefront attribute filters.
     */
    public function filterOptions()
    {
        $payload = \Illuminate\Support\Facades\Cache::remember('storefront:product_filter_options:v1', 300, function () {
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

            return [
                'colors' => collect(array_keys($colors))->sort()->values()->all(),
                'sizes' => $this->sortSizeList(array_keys($sizes)),
                'price_min' => $priceBounds?->price_min !== null ? (float) $priceBounds->price_min : null,
                'price_max' => $priceBounds?->price_max !== null ? (float) $priceBounds->price_max : null,
            ];
        });

        return response()->json($payload);
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
        $product = Product::with(['category', 'activeDiscount'])->where('slug', $slug)->firstOrFail();
        if ($product->activeDiscount) {
            $product->discount = [
                'type' => $product->activeDiscount->discount_type,
                'value' => $product->activeDiscount->discount_value,
                'original_price' => (float) $product->price,
                'sale_price' => (float) $product->activeDiscount->sale_price,
                'discount_percentage' => $this->calculateDiscountPercentage($product),
                'end_date' => $product->activeDiscount->end_date,
            ];
        }
        return response()->json($product);
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
                // Case-insensitive search
                $w->where('name', 'LIKE', "%{$term}%")
                    ->orWhere('description', 'LIKE', "%{$term}%");

                // Fuzzy search for typos (if 4+ chars)
                if (strlen($term) >= 4) {
                    $chars = str_split(strtolower($term));
                    foreach ($chars as $i => $char) {
                        if ($i < strlen($term) - 1) {
                            $pattern = substr($term, 0, $i) . substr($term, $i + 1);
                            $w->orWhere('name', 'LIKE', "%{$pattern}%");
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
                $product->discount = [
                    'type' => $product->activeDiscount->discount_type,
                    'value' => $product->activeDiscount->discount_value,
                    'original_price' => (float) $product->price,
                    'sale_price' => (float) $product->activeDiscount->sale_price,
                    'discount_percentage' => $this->calculateDiscountPercentage($product),
                    'end_date' => $product->activeDiscount->end_date,
                ];
            }
            return $product;
        });

        return response()->json($products);
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
