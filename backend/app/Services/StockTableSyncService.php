<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockInventory;
use App\Models\StockReceived;
use Illuminate\Support\Facades\Schema;

class StockTableSyncService
{
    public function tablesReady(): bool
    {
        return Schema::hasTable('stock_inventory') && Schema::hasTable('stock_received');
    }

    public function syncMasterFromCategory(Category $category): ?StockInventory
    {
        if (! $this->tablesReady() || ! $this->isInventoryMaster($category)) {
            return null;
        }

        return StockInventory::query()->updateOrCreate(
            ['category_id' => $category->id],
            $this->masterAttributes($category),
        );
    }

    public function syncReceiveFromCategory(Category $batch, ?int $productId = null, array $overrides = []): ?StockReceived
    {
        if (! $this->tablesReady() || ! $this->isReceiveBatch($batch)) {
            return null;
        }

        $master = Category::query()->find($batch->parent_id);
        $inventory = $master ? $this->syncMasterFromCategory($master) : null;

        if ($productId === null) {
            $productId = Product::query()
                ->where('stock_label_id', $batch->id)
                ->value('id');
            $productId = $productId ? (int) $productId : null;
        }

        if ($productId === null && $inventory) {
            $productId = Product::query()
                ->where('stock_label_id', $inventory->category_id)
                ->value('id');
            $productId = $productId ? (int) $productId : null;
        }

        $quantity = $this->receivedQuantityFromCategory($batch);
        $unitCost = round((float) ($overrides['unit_cost'] ?? $batch->cost ?? 0), 2);
        $receivedAt = $batch->created_at ?? ($batch->date_in ? $batch->date_in->startOfDay() : now());

        $supplierName = $overrides['supplier_name'] ?? ($batch->origin ? 'Supplier '.strtoupper((string) $batch->origin) : null);
        $invoiceNumber = $overrides['invoice_number'] ?? ($batch->slug ? 'INV-'.$batch->slug : null);
        $notes = $overrides['notes'] ?? $batch->description;

        return StockReceived::query()->updateOrCreate(
            ['category_id' => $batch->id],
            [
                'stock_inventory_id' => $inventory?->id,
                'product_id' => $productId,
                'created_by' => $overrides['created_by'] ?? null,
                'corrects_stock_received_id' => null,
                'entry_type' => 'receive',
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'total_cost' => round($unitCost * $quantity, 2),
                'supplier_name' => $supplierName,
                'invoice_number' => $invoiceNumber,
                'date_in' => $batch->date_in,
                'received_at' => $receivedAt,
                'notes' => $notes,
            ],
        );
    }

    public function deleteForCategory(Category $category): void
    {
        if (! $this->tablesReady()) {
            return;
        }

        if ($this->isReceiveBatch($category)) {
            StockReceived::query()->where('category_id', $category->id)->delete();

            return;
        }

        if ($this->isInventoryMaster($category)) {
            $inventory = StockInventory::query()->where('category_id', $category->id)->first();
            if ($inventory) {
                StockReceived::query()->where('stock_inventory_id', $inventory->id)->delete();
                $inventory->delete();
            }
        }
    }

    /** @return array<string, mixed> */
    private function masterAttributes(Category $category): array
    {
        return [
            'name' => $category->name,
            'slug' => $category->slug,
            'sku' => $category->sku,
            'stock' => $category->stock,
            'stock_received' => $category->stock_received,
            'min_stock' => $category->min_stock,
            'manage_stock' => (bool) ($category->manage_stock ?? false),
            'cost' => $category->cost,
            'price' => $category->price,
            'unit' => $category->unit,
            'origin' => $category->origin,
            'brand_id' => $category->brand_id,
            'product_condition' => in_array($category->product_condition, ['new', 'second_hand'], true)
                ? $category->product_condition
                : 'new',
            'is_active' => (bool) ($category->is_active ?? true),
        ];
    }

    private function receivedQuantityFromCategory(Category $batch): int
    {
        if ($batch->stock_received !== null) {
            return max(0, (int) $batch->stock_received);
        }

        if ($batch->stock !== null) {
            return max(0, (int) $batch->stock);
        }

        return 0;
    }

    private function isInventoryMaster(Category $category): bool
    {
        return ! $category->parent_id
            && $category->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE;
    }

    private function isReceiveBatch(Category $category): bool
    {
        return (bool) $category->parent_id
            && $category->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE;
    }
}
