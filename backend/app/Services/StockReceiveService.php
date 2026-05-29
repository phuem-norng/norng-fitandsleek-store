<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReceiveService
{
    /** Units recorded on a receive batch (Stock Received log). */
    public function receivedQuantity(Category $category): int
    {
        if ($category->stock_received !== null) {
            return max(0, (int) $category->stock_received);
        }

        // Receive-batch rows: legacy data may only have `stock` (sellable stock is on the master;
        // batch `stock` is not decremented at checkout).
        if ($this->isReceiveBatch($category) && $category->stock !== null) {
            return max(0, (int) $category->stock);
        }

        return 0;
    }

    public function isInventoryMaster(Category $category): bool
    {
        return ! $category->parent_id
            && $category->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE;
    }

    public function isReceiveBatch(Category $category): bool
    {
        return (bool) $category->parent_id
            && $category->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE;
    }

    /**
     * Sum all Stock Received units for a master label (opening legacy receipt + batch rows).
     */
    public function totalReceivedQuantity(Category $inventory): int
    {
        if (! $this->isInventoryMaster($inventory)) {
            return 0;
        }

        $total = 0;

        if ($inventory->stock_received !== null) {
            $total += max(0, (int) $inventory->stock_received);
        }

        $batches = Category::query()
            ->where('parent_id', $inventory->id)
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->get();

        foreach ($batches as $batch) {
            $total += $this->receivedQuantity($batch);
        }

        return $total;
    }

    /**
     * Recompute master sellable stock from receive totals while preserving units already sold/issued.
     *
     * on-hand = sum(received) - sold, where sold = previous_sum(received) - previous_on_hand
     */
    public function recalculateInventoryStock(Category $inventory, ?int $previousTotalReceived = null, ?int $previousOnHand = null): void
    {
        if (! ($inventory->manage_stock ?? false) || ! $this->isInventoryMaster($inventory)) {
            return;
        }

        $inventory->refresh();

        $oldTotalReceived = $previousTotalReceived ?? $this->totalReceivedQuantity($inventory);
        $oldOnHand = $previousOnHand ?? max(0, (int) ($inventory->stock ?? 0));
        $sold = max(0, $oldTotalReceived - $oldOnHand);

        $newTotalReceived = $this->totalReceivedQuantity($inventory);
        $inventory->stock = max(0, $newTotalReceived - $sold);
        $inventory->save();
    }

    /**
     * Snapshot master totals before a receive-row change, then refresh on-hand from all receive rows.
     *
     * @return array{inventory: Category, previous_total_received: int, previous_on_hand: int}|null
     */
    public function inventoryRecalcSnapshotForReceiveChange(Category $receiveRow): ?array
    {
        $inventory = null;

        if ($this->isReceiveBatch($receiveRow)) {
            $inventory = Category::query()->find($receiveRow->parent_id);
        } elseif (
            $this->isInventoryMaster($receiveRow)
            && Category::query()
                ->where('parent_id', $receiveRow->id)
                ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
                ->exists()
        ) {
            $inventory = $receiveRow;
        }

        if (! $inventory || $inventory->type !== PaidOrderInventory::BARCODE_CATEGORY_TYPE) {
            return null;
        }

        return [
            'inventory' => $inventory,
            'previous_total_received' => $this->totalReceivedQuantity($inventory),
            'previous_on_hand' => max(0, (int) ($inventory->stock ?? 0)),
        ];
    }

    public function syncInventoryAfterReceiveChange(Category $receiveRow, ?array $snapshot): void
    {
        if (! $snapshot) {
            return;
        }

        $this->recalculateInventoryStock(
            $snapshot['inventory'],
            $snapshot['previous_total_received'],
            $snapshot['previous_on_hand'],
        );
    }

    /**
     * Add stock to the canonical inventory label and append a Stock Received batch row.
     *
     * @return array{inventory: Category, received: Category}
     */
    public function quickRestock(
        Category $source,
        int $quantity,
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

        $inventory = $source->parent_id
            ? Category::query()->find($source->parent_id)
            : $source;

        if (!$inventory || $inventory->type !== PaidOrderInventory::BARCODE_CATEGORY_TYPE) {
            throw ValidationException::withMessages([
                'category' => ['Inventory label not found for this item.'],
            ]);
        }

        $productCondition = in_array($inventory->product_condition, ['new', 'second_hand'], true)
            ? $inventory->product_condition
            : 'new';
        $secondHandSaleType = $productCondition === 'second_hand'
            ? ($inventory->second_hand_sale_type === 'average_bundle' ? 'average_bundle' : 'single')
            : null;

        return DB::transaction(function () use ($inventory, $quantity, $productCondition, $secondHandSaleType) {
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
                $preReceiveStock = max(0, (int) ($inventory->stock ?? 0));
                $inventory->stock = $preReceiveStock + $quantity;
                // Before any receive batches existed, Stock Received showed this master using `stock`
                // as a legacy row. Once Quick Restock adds children, the UI only keeps that row if
                // `stock_received` is set — persist the pre-receive on-hand as the opening receipt.
                if ($inventory->stock_received === null && $preReceiveStock > 0) {
                    $inventory->stock_received = $preReceiveStock;
                }
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
