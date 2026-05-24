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

    private function isInlineDataUrl(?string $value): bool
    {
        return str_starts_with(strtolower(trim((string) $value)), 'data:');
    }

    /** Save a camera/base64 upload to the public disk so list views can use a small URL. */
    private function persistInlineImageUrl(Category $category, string $dataUrl): ?string
    {
        if (! preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', trim($dataUrl), $matches)) {
            return null;
        }

        $ext = match (strtolower($matches[1])) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            default => 'jpg',
        };

        $content = base64_decode($matches[2], true);
        if ($content === false || $content === '') {
            return null;
        }

        $filename = 'categories/' . $category->id . '-' . Str::random(8) . '.' . $ext;
        Storage::disk('public')->put($filename, $content);

        return $filename;
    }

    /** Convert inline `image_url` to `image_path` when labels were saved as base64. */
    private function materializeInlineImage(Category $category): ?string
    {
        if ($category->image_path) {
            return Media::url($category->image_path);
        }

        $url = trim((string) ($category->image_url ?? ''));
        if ($url === '' || ! $this->isInlineDataUrl($url)) {
            return null;
        }

        $path = $this->persistInlineImageUrl($category, $url);
        if (! $path) {
            return null;
        }

        $category->image_path = $path;
        $category->image_url = Media::url($path);
        $category->saveQuietly();

        return Media::url($path);
    }

    private function normalizeCategoryImages(Category $category): void
    {
        if ($this->isInlineDataUrl($category->image_url)) {
            $this->materializeInlineImage($category);
        }
    }

    /** Avoid multi-megabyte list payloads when labels store camera uploads as base64. */
    private function publicImageUrlForList(Category $c): ?string
    {
        if ($c->image_path) {
            return Media::url($c->image_path);
        }

        $url = trim((string) ($c->image_url ?? ''));

        if ($url !== '' && ! $this->isInlineDataUrl($url)) {
            return $url;
        }

        $gallery = $this->galleryForList($c->gallery);
        if ($gallery !== null) {
            $first = trim(explode("\n", $gallery, 2)[0]);
            if ($first !== '') {
                return $first;
            }
        }

        return $this->materializeInlineImage($c);
    }

    private function galleryForList(?string $gallery): ?string
    {
        if ($gallery === null || trim($gallery) === '') {
            return null;
        }

        $kept = [];
        foreach (preg_split('/\r\n|\r|\n/', $gallery) ?: [] as $line) {
            $line = trim((string) $line);
            if ($line === '' || $this->isInlineDataUrl($line)) {
                continue;
            }
            $kept[] = $line;
        }

        return $kept === [] ? null : implode("\n", $kept);
    }

    private function mapCategory(Category $c, bool $forList = false): array
    {
        $categoryIds = is_array($c->label_category_ids) && $c->label_category_ids !== []
            ? array_values(array_map('intval', $c->label_category_ids))
            : ($c->label_category_id ? [(int) $c->label_category_id] : []);

        $imageUrl = $forList
            ? $this->publicImageUrlForList($c)
            : ($c->image_url ?: Media::url($c->image_path));
        $gallery = $forList ? $this->galleryForList($c->gallery) : $c->gallery;

        return [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'name' => $c->name,
            'slug' => $c->slug,
            'type' => $c->type,
            'sort_order' => (int) ($c->sort_order ?? 0),
            'is_active' => (bool) $c->is_active,
            'image_url' => $imageUrl,
            'image_path' => $c->image_path,
            'has_inline_image' => $forList && $imageUrl === null && (
                $this->isInlineDataUrl($c->image_url)
                || ($c->gallery !== null && $this->galleryForList($c->gallery) !== $c->gallery)
            ),
            'description' => $c->description,
            'details' => $c->details,
            'price' => $c->price,
            'compare_at_price' => $c->compare_at_price,
            'label_color' => $c->label_color,
            'gallery' => $gallery,
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

        $items = $query->get()->map(fn ($c) => $this->mapCategory($c, forList: true));

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

        $this->normalizeCategoryImages($c);
        $c->refresh();

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

        $isReceiveBatch = $stockReceive->isReceiveBatch($category);
        $recalcSnapshot = $stockReceive->inventoryRecalcSnapshotForReceiveChange($category);
        $isLegacyMasterReceiveEdit = $recalcSnapshot
            && (int) $recalcSnapshot['inventory']->id === (int) $category->id;

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
            'stock' => ($isLegacyMasterReceiveEdit && array_key_exists('stock', $validated))
                ? $category->stock
                : (array_key_exists('stock', $validated) ? $validated['stock'] : $category->stock),
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

        DB::transaction(function () use ($category, $stockReceive, $recalcSnapshot) {
            $category->save();

            $this->normalizeCategoryImages($category);

            $stockReceive->syncInventoryAfterReceiveChange($category->fresh(), $recalcSnapshot);
        });

        return response()->json(['data' => $this->mapCategory($category->fresh())]);
    }

    public function destroy(Category $category, StockReceiveService $stockReceive)
    {
        DB::transaction(function () use ($category, $stockReceive) {
            $recalcSnapshot = $stockReceive->inventoryRecalcSnapshotForReceiveChange($category);

            if ($category->image_path) {
                Storage::disk('public')->delete($category->image_path);
            }

            $category->delete();

            $stockReceive->syncInventoryAfterReceiveChange($category, $recalcSnapshot);
        });

        return response()->json(['ok' => true]);
    }

    public function quickRestock(Request $request, Category $category, StockReceiveService $stockReceive)
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        $result = $stockReceive->quickRestock(
            $category,
            (int) $validated['quantity'],
        );

        return response()->json([
            'data' => [
                'inventory' => $this->mapCategory($result['inventory']),
                'received' => $this->mapCategory($result['received']),
            ],
        ]);
    }
}
