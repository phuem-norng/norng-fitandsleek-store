<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReceiveService
{
    /**
     * Add stock to the canonical inventory label and append a Stock Received batch row.
     *
     * @return array{inventory: Category, received: Category}
     */
    public function quickRestock(
        Category $source,
        int $quantity,
        string $productCondition = 'new',
        ?string $secondHandSaleType = null,
    ): array {
        if ($source->type !== PaidOrderInventory::BARCODE_CATEGORY_TYPE) {
            throw ValidationException::withMessages([
                'category' => ['This item is not a Stock & Inventory label.'],
            ]);
        }

        if ($quantity < 1) {
            throw ValidationException::withMessages([
                'quantity' => ['Enter at least 1 unit to receive.'],
            ]);
        }

        if (! in_array($productCondition, ['new', 'second_hand'], true)) {
            throw ValidationException::withMessages([
                'product_condition' => ['Invalid product condition.'],
            ]);
        }

        $inventory = $source->parent_id
            ? Category::query()->find($source->parent_id)
            : $source;

        if (! $inventory || $inventory->type !== PaidOrderInventory::BARCODE_CATEGORY_TYPE) {
            throw ValidationException::withMessages([
                'category' => ['Inventory label not found for this item.'],
            ]);
        }

        $secondHandSaleType = $productCondition === 'second_hand'
            ? ($secondHandSaleType === 'average_bundle' ? 'average_bundle' : 'single')
            : null;

        return DB::transaction(function () use (
            $inventory,
            $quantity,
            $productCondition,
            $secondHandSaleType,
        ) {
            $batchSlug = $this->uniqueReceiveSlug((string) $inventory->slug);

            $received = Category::create([
                'parent_id' => $inventory->id,
                'name' => $inventory->name,
                'slug' => $batchSlug,
                'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
                'sort_order' => (int) ($inventory->sort_order ?? 0),
                'is_active' => (bool) ($inventory->is_active ?? true),
                'description' => $inventory->description,
                'details' => $inventory->details,
                'price' => $inventory->price,
                'compare_at_price' => $inventory->compare_at_price,
                'label_color' => $inventory->label_color,
                'image_url' => $inventory->image_url,
                'image_path' => $inventory->image_path,
                'gallery' => $inventory->gallery,
                'sku' => $inventory->sku ?: $inventory->slug,
                'cost' => $inventory->cost,
                'unit' => $inventory->unit,
                'origin' => $inventory->origin,
                'brand_id' => $inventory->brand_id,
                'label_category_id' => $inventory->label_category_id,
                'label_category_ids' => $inventory->label_category_ids,
                'manage_stock' => true,
                'stock_received' => $quantity,
                'stock' => $quantity,
                'min_stock' => $inventory->min_stock,
                'date_in' => now()->toDateString(),
                'product_condition' => $productCondition,
                'second_hand_sale_type' => $secondHandSaleType,
                'bundle_total_cost' => $productCondition === 'second_hand' && $secondHandSaleType === 'average_bundle'
                    ? $inventory->bundle_total_cost
                    : null,
                'bundle_total_quantity' => $productCondition === 'second_hand' && $secondHandSaleType === 'average_bundle'
                    ? $inventory->bundle_total_quantity
                    : null,
                'has_variation' => (bool) ($inventory->has_variation ?? false),
                'variation_product_type' => $inventory->variation_product_type,
                'variation_colors' => $inventory->variation_colors,
                'variation_sizes' => $inventory->variation_sizes,
            ]);

            if ($inventory->manage_stock) {
                $current = max(0, (int) ($inventory->stock ?? 0));
                $inventory->stock = $current + $quantity;
                $inventory->save();
            }

            return [
                'inventory' => $inventory->fresh(),
                'received' => $received,
            ];
        });
    }

    private function uniqueReceiveSlug(string $baseSlug): string
    {
        $base = Str::upper(preg_replace('/[^A-Z0-9\-]/', '', $baseSlug) ?: 'ITEM');
        $suffix = now()->format('ymdHis');
        $candidate = $base . '-R' . $suffix;
        $i = 0;
        while (Category::where('slug', $candidate)->exists()) {
            $i++;
            $candidate = $base . '-R' . $suffix . '-' . $i;
        }

        return $candidate;
    }
}
