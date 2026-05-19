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
        $q = Product::query()->with(['category', 'brand', 'activeSale']);

        // Filter by specific product IDs (used by wishlist)
        if ($request->filled('ids')) {
            $ids = array_filter(array_map('intval', explode(',', $request->input('ids'))));
            if (!empty($ids)) {
                $q->whereIn('id', $ids);
            }
        }

        $this->applyParentCategoryFilter($q, $request);
        $tabOrdered = $this->applyTabFilter($q, $request);

        if ($request->filled('category')) {
            $categorySlug = (string) $request->input('category');
            $q->whereHas('category', function ($categoryQuery) use ($categorySlug) {
                $categoryQuery->where('slug', $categorySlug);
            });
        }

        if ($request->filled('category_id')) {
            $q->where('category_id', (int) $request->input('category_id'));
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

        if ($request->filled('gender')) {
            $gender = strtolower($request->string('gender')->toString());
            $allowedGenders = ['men', 'women', 'boys', 'girls'];

            if (in_array($gender, $allowedGenders, true)) {
                $q->whereHas('category', function ($categoryQuery) use ($gender) {
                    $this->applyCategoryAudienceFilter($categoryQuery, $gender);
                });
            }
        }

        if ($request->filled('brand_id')) {
            $q->where('brand_id', (int) $request->input('brand_id'));
        }

        if ($request->filled('brand_slug')) {
            $q->whereHas('brand', function ($b) use ($request) {
                $b->where('slug', $request->string('brand_slug'));
            });
        }

        $perPage = min((int) $request->get('per_page', 12), 200);
        if (!$tabOrdered) {
            $q->orderByDesc('products.id');
        }
        $products = $q->paginate($perPage);

        return response()->json($products);
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
                    ->whereHas('activeSale')
                    ->orderByDesc('products.id');
                return true;
            default:
                return false;
        }
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
        $product = Product::with(['category', 'activeSale'])->where('slug', $slug)->firstOrFail();
        if ($product->activeSale) {
            $product->discount = [
                'type' => $product->activeSale->discount_type,
                'value' => $product->activeSale->discount_value,
                'original_price' => (float) $product->price,
                'sale_price' => (float) $product->activeSale->sale_price,
                'discount_percentage' => $this->calculateDiscountPercentage($product),
                'end_date' => $product->activeSale->end_date,
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
            ->with(['category', 'activeSale'])
            ->whereHas('activeSale')
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
            $query->whereHas('activeSale', function ($q) use ($request) {
                $q->where('sale_price', '>=', (float) $request->input('min_price'));
            });
        }
        if ($request->filled('max_price')) {
            $query->whereHas('activeSale', function ($q) use ($request) {
                $q->where('sale_price', '<=', (float) $request->input('max_price'));
            });
        }

        // Sort options
        $sort = $request->get('sort', 'newest');
        switch ($sort) {
            case 'price_low':
                $query->join('sales', 'products.id', '=', 'sales.product_id')
                    ->where('sales.is_active', 1)
                    ->orderBy('sales.sale_price', 'asc')
                    ->select('products.*');
                break;
            case 'price_high':
                $query->join('sales', 'products.id', '=', 'sales.product_id')
                    ->where('sales.is_active', 1)
                    ->orderBy('sales.sale_price', 'desc')
                    ->select('products.*');
                break;
            case 'discount':
                // Sort by highest discount
                $query->orderByRaw('(
                    SELECT 
                        CASE 
                            WHEN sales.discount_type = "percentage" THEN sales.discount_value
                            ELSE (sales.discount_value / products.price * 100)
                        END
                    FROM sales
                    WHERE sales.product_id = products.id
                    AND sales.is_active = 1
                    AND sales.start_date <= NOW()
                    AND sales.end_date >= NOW()
                ) DESC');
                break;
            case 'newest':
            default:
                $query->orderByDesc('products.id');
        }

        $products = $query->paginate($request->get('per_page', 12));

        // Format response with discount info
        $products->getCollection()->transform(function ($product) {
            if ($product->activeSale) {
                $product->discount = [
                    'type' => $product->activeSale->discount_type,
                    'value' => $product->activeSale->discount_value,
                    'original_price' => (float) $product->price,
                    'sale_price' => (float) $product->activeSale->sale_price,
                    'discount_percentage' => $this->calculateDiscountPercentage($product),
                    'end_date' => $product->activeSale->end_date,
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
        if (!$product->activeSale) {
            return 0;
        }

        if ($product->activeSale->discount_type === 'percentage') {
            return (int) $product->activeSale->discount_value;
        }

        return round(($product->activeSale->discount_value / $product->price) * 100);
    }
}
