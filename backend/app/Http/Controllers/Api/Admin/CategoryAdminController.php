<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\PaidOrderInventory;
use App\Services\StockReceiveService;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CategoryAdminController extends Controller
{
    /** @return list<int> */
    private function normalizeCategoryIds(?array $categoryIds, ?int $categoryId, ?Category $existing = null): array
    {
        if (is_array($categoryIds) && $categoryIds !== []) {
            $ids = array_values(array_unique(array_map('intval', $categoryIds)));
            return array_values(array_filter($ids, fn(int $id) => $id > 0));
        }

        if ($categoryId !== null) {
            return [(int) $categoryId];
        }

        if ($existing) {
            if (is_array($existing->label_category_ids) && $existing->label_category_ids !== []) {
                return array_values(array_map('intval', $existing->label_category_ids));
            }
            if ($existing->label_category_id) {
                return [(int) $existing->label_category_id];
            }
        }

        return [];
    }

    private function mapCategory(Category $c): array
    {
        $categoryIds = is_array($c->label_category_ids) && $c->label_category_ids !== []
            ? array_values(array_map('intval', $c->label_category_ids))
            : ($c->label_category_id ? [(int) $c->label_category_id] : []);

        return [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'name' => $c->name,
            'slug' => $c->slug,
            'type' => $c->type,
            'sort_order' => (int) ($c->sort_order ?? 0),
            'is_active' => (bool) $c->is_active,
            'image_url' => $c->image_url ?: Media::url($c->image_path),
            'image_path' => $c->image_path,
            'description' => $c->description,
            'details' => $c->details,
            'price' => $c->price,
            'compare_at_price' => $c->compare_at_price,
            'label_color' => $c->label_color,
            'gallery' => $c->gallery,
            'sku' => $c->sku,
            'cost' => $c->cost,
            'unit' => $c->unit,
            'origin' => $c->origin,
            'brand_id' => $c->brand_id,
            'category_id' => $categoryIds[0] ?? $c->label_category_id,
            'category_ids' => $categoryIds,
            'manage_stock' => (bool) ($c->manage_stock ?? false),
            'stock' => $c->stock,
            'stock_received' => $c->stock_received,
            'min_stock' => $c->min_stock,
            'date_in' => $c->date_in?->format('Y-m-d'),
            'product_condition' => $c->product_condition ?? 'new',
            'second_hand_sale_type' => $c->second_hand_sale_type,
            'bundle_total_cost' => $c->bundle_total_cost,
            'bundle_total_quantity' => $c->bundle_total_quantity,
            'created_at' => $c->created_at?->toIso8601String(),
            'has_variation' => (bool) ($c->has_variation ?? false),
            'variation_product_type' => $c->variation_product_type,
            'variation_colors' => $c->variation_colors,
            'variation_sizes' => $c->variation_sizes ?? [],
        ];
    }

    public function index(Request $request)
    {
        $query = Category::query()
            ->orderBy('sort_order')
            ->orderBy('name');

        // Stock & Inventory uses barcode_qr rows; keep them out of the Categories admin list unless requested.
        if (! $request->boolean('include_stock_labels')) {
            $query->catalogOnly();
        }

        $items = $query->get()->map(fn ($c) => $this->mapCategory($c));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:categories,slug'],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:5120'],
            'description' => ['nullable', 'string'],
            'details' => ['nullable', 'string'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'label_color' => ['nullable', 'string', 'max:30'],
            'image_url' => ['nullable', 'string'],
            'gallery' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:100'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'origin' => ['nullable', 'string', 'max:80'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'manage_stock' => ['nullable', 'boolean'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'stock_received' => ['nullable', 'integer', 'min:0'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'date_in' => ['nullable', 'date'],
            'product_condition' => ['nullable', 'in:new,second_hand'],
            'second_hand_sale_type' => ['nullable', 'in:single,average_bundle'],
            'bundle_total_cost' => ['nullable', 'numeric', 'min:0'],
            'bundle_total_quantity' => ['nullable', 'integer', 'min:0'],
            'has_variation' => ['nullable', 'boolean'],
            'variation_product_type' => ['nullable', 'string', 'max:50'],
            'variation_colors' => ['nullable', 'string'],
            'variation_sizes' => ['nullable', 'array'],
            'variation_sizes.*' => ['string', 'max:50'],
        ]);

        $categoryIds = $this->normalizeCategoryIds(
            $validated['category_ids'] ?? null,
            $validated['category_id'] ?? null,
        );

        $slug = $validated['slug'] ?? Str::slug($validated['name']);
        $base = $slug;
        $i = 1;
        while (Category::where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        $path = null;
        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('categories', 'public');
        }

        $c = Category::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'type' => $validated['type'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
            'image_path' => $path,
            'description' => $validated['description'] ?? null,
            'details' => $validated['details'] ?? null,
            'price' => $validated['price'] ?? null,
            'compare_at_price' => $validated['compare_at_price'] ?? null,
            'label_color' => $validated['label_color'] ?? null,
            'image_url' => $validated['image_url'] ?? null,
            'gallery' => $validated['gallery'] ?? null,
            'sku' => $validated['sku'] ?? null,
            'cost' => $validated['cost'] ?? null,
            'unit' => $validated['unit'] ?? null,
            'origin' => $validated['origin'] ?? null,
            'brand_id' => $validated['brand_id'] ?? null,
            'label_category_id' => $categoryIds[0] ?? null,
            'label_category_ids' => $categoryIds !== [] ? $categoryIds : null,
            'manage_stock' => (bool) ($validated['manage_stock'] ?? false),
            'stock' => $validated['stock'] ?? null,
            'stock_received' => $validated['stock_received'] ?? null,
            'min_stock' => $validated['min_stock'] ?? null,
            'date_in' => $validated['date_in'] ?? now()->toDateString(),
            'product_condition' => $validated['product_condition'] ?? 'new',
            'second_hand_sale_type' => $validated['second_hand_sale_type'] ?? null,
            'bundle_total_cost' => $validated['bundle_total_cost'] ?? null,
            'bundle_total_quantity' => $validated['bundle_total_quantity'] ?? null,
            'has_variation' => (bool) ($validated['has_variation'] ?? false),
            'variation_product_type' => $validated['variation_product_type'] ?? null,
            'variation_colors' => $validated['variation_colors'] ?? null,
            'variation_sizes' => $validated['variation_sizes'] ?? null,
        ]);

        return response()->json(['data' => $this->mapCategory($c)], 201);
    }

    public function show(Category $category)
    {
        return response()->json(['data' => $this->mapCategory($category)]);
    }

    public function update(Request $request, Category $category, StockReceiveService $stockReceive)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:categories,slug,' . $category->id],
            'type' => ['nullable', 'string', 'max:50'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:5120'],
            'description' => ['nullable', 'string'],
            'details' => ['nullable', 'string'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'label_color' => ['nullable', 'string', 'max:30'],
            'image_url' => ['nullable', 'string'],
            'gallery' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:100'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'origin' => ['nullable', 'string', 'max:80'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'manage_stock' => ['nullable', 'boolean'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'stock_received' => ['nullable', 'integer', 'min:0'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'date_in' => ['nullable', 'date'],
            'product_condition' => ['nullable', 'in:new,second_hand'],
            'second_hand_sale_type' => ['nullable', 'in:single,average_bundle'],
            'bundle_total_cost' => ['nullable', 'numeric', 'min:0'],
            'bundle_total_quantity' => ['nullable', 'integer', 'min:0'],
            'has_variation' => ['nullable', 'boolean'],
            'variation_product_type' => ['nullable', 'string', 'max:50'],
            'variation_colors' => ['nullable', 'string'],
            'variation_sizes' => ['nullable', 'array'],
            'variation_sizes.*' => ['string', 'max:50'],
        ]);

        $categoryIds = null;
        if (array_key_exists('category_ids', $validated) || array_key_exists('category_id', $validated)) {
            $categoryIds = $this->normalizeCategoryIds(
                $validated['category_ids'] ?? null,
                $validated['category_id'] ?? null,
                $category,
            );
        }

        $slug = $validated['slug'] ?? Str::slug($validated['name']);

        $isReceiveBatch = $category->parent_id
            && $category->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE;
        $previousReceivedQty = $isReceiveBatch
            ? $stockReceive->receivedQuantity($category)
            : null;

        if ($request->hasFile('image')) {
            if ($category->image_path)
                Storage::disk('public')->delete($category->image_path);
            $category->image_path = $request->file('image')->store('categories', 'public');
        }

        $category->fill([
            'name' => $validated['name'],
            'slug' => $slug,
            'type' => $validated['type'] ?? $category->type,
            'sort_order' => $validated['sort_order'] ?? ($category->sort_order ?? 0),
            'is_active' => $validated['is_active'] ?? $category->is_active,
            'description' => array_key_exists('description', $validated) ? $validated['description'] : $category->description,
            'details' => array_key_exists('details', $validated) ? $validated['details'] : $category->details,
            'price' => array_key_exists('price', $validated) ? $validated['price'] : $category->price,
            'compare_at_price' => array_key_exists('compare_at_price', $validated) ? $validated['compare_at_price'] : $category->compare_at_price,
            'label_color' => array_key_exists('label_color', $validated) ? $validated['label_color'] : $category->label_color,
            'image_url' => array_key_exists('image_url', $validated) ? $validated['image_url'] : $category->image_url,
            'gallery' => array_key_exists('gallery', $validated) ? $validated['gallery'] : $category->gallery,
            'sku' => array_key_exists('sku', $validated) ? $validated['sku'] : $category->sku,
            'cost' => array_key_exists('cost', $validated) ? $validated['cost'] : $category->cost,
            'unit' => array_key_exists('unit', $validated) ? $validated['unit'] : $category->unit,
            'origin' => array_key_exists('origin', $validated) ? $validated['origin'] : $category->origin,
            'brand_id' => array_key_exists('brand_id', $validated) ? $validated['brand_id'] : $category->brand_id,
            'label_category_id' => $categoryIds !== null
                ? ($categoryIds[0] ?? null)
                : $category->label_category_id,
            'label_category_ids' => $categoryIds !== null
                ? ($categoryIds !== [] ? $categoryIds : null)
                : $category->label_category_ids,
            'manage_stock' => array_key_exists('manage_stock', $validated) ? (bool) $validated['manage_stock'] : $category->manage_stock,
            'stock' => array_key_exists('stock', $validated) ? $validated['stock'] : $category->stock,
            'stock_received' => array_key_exists('stock_received', $validated) ? $validated['stock_received'] : $category->stock_received,
            'min_stock' => array_key_exists('min_stock', $validated) ? $validated['min_stock'] : $category->min_stock,
            'date_in' => array_key_exists('date_in', $validated) ? $validated['date_in'] : $category->date_in,
            'product_condition' => array_key_exists('product_condition', $validated) ? $validated['product_condition'] : ($category->product_condition ?? 'new'),
            'second_hand_sale_type' => array_key_exists('second_hand_sale_type', $validated) ? $validated['second_hand_sale_type'] : $category->second_hand_sale_type,
            'bundle_total_cost' => array_key_exists('bundle_total_cost', $validated) ? $validated['bundle_total_cost'] : $category->bundle_total_cost,
            'bundle_total_quantity' => array_key_exists('bundle_total_quantity', $validated) ? $validated['bundle_total_quantity'] : $category->bundle_total_quantity,
            'has_variation' => array_key_exists('has_variation', $validated) ? (bool) $validated['has_variation'] : $category->has_variation,
            'variation_product_type' => array_key_exists('variation_product_type', $validated) ? $validated['variation_product_type'] : $category->variation_product_type,
            'variation_colors' => array_key_exists('variation_colors', $validated) ? $validated['variation_colors'] : $category->variation_colors,
            'variation_sizes' => array_key_exists('variation_sizes', $validated) ? $validated['variation_sizes'] : $category->variation_sizes,
        ]);

        DB::transaction(function () use ($category, $stockReceive, $previousReceivedQty) {
            $category->save();

            if ($previousReceivedQty !== null) {
                $stockReceive->syncInventoryAfterReceiveBatchUpdate(
                    $category->fresh(),
                    $previousReceivedQty,
                    $stockReceive->receivedQuantity($category),
                );
            }
        });

        return response()->json(['data' => $this->mapCategory($category->fresh())]);
    }

    public function destroy(Category $category, StockReceiveService $stockReceive)
    {
        DB::transaction(function () use ($category, $stockReceive) {
            $stockReceive->syncInventoryAfterReceiveBatchDelete($category);

            if ($category->image_path) {
                Storage::disk('public')->delete($category->image_path);
            }

            $category->delete();
        });

        return response()->json(['ok' => true]);
    }

    public function quickRestock(Request $request, Category $category, StockReceiveService $stockReceive)
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
            'product_condition' => ['nullable', 'in:new,second_hand'],
            'second_hand_sale_type' => ['nullable', 'in:single,average_bundle'],
        ]);

        $result = $stockReceive->quickRestock(
            $category,
            (int) $validated['quantity'],
            $validated['product_condition'] ?? 'new',
            $validated['second_hand_sale_type'] ?? null,
        );

        return response()->json([
            'data' => [
                'inventory' => $this->mapCategory($result['inventory']),
                'received' => $this->mapCategory($result['received']),
            ],
        ]);
    }
}
