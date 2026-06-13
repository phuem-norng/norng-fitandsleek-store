<?php

namespace App\Services;

use App\Models\Category;
use App\Models\InventoryLot;
use App\Models\InventoryLotDetailEvent;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockReceived;
use Illuminate\Support\Str;

class PurchaseOrderReceiveService
{
    public function __construct(
        private readonly StockReceiveService $stockReceive,
        private readonly StockTableSyncService $stockTables,
        private readonly InventoryLotService $inventoryLots,
        private readonly InventoryLotDetailAuditService $detailAudit,
    ) {
    }

    /**
     * Receive all PO line items into Stock Received and product inventory.
     *
     * @return array{
     *     received_lines: int,
     *     total_units: int,
     *     batches: list<array{product_id: int, product_name: ?string, qty: int, received_category_id: int}>,
     *     warnings: list<string>,
     * }
     */
    public function receiveOrder(PurchaseOrder $order, ?int $userId = null): array
    {
        $order->loadMissing(['supplier', 'items.product']);

        $receivedLines = 0;
        $totalUnits = 0;
        $batches = [];
        $warnings = [];

        foreach ($order->items as $item) {
            $result = $this->receiveLine($order, $item, $userId);
            if ($result['received']) {
                $receivedLines++;
                $totalUnits += (int) $item->qty;
                $batches[] = $result['batch'];
            }
            if ($result['warning']) {
                $warnings[] = $result['warning'];
            }
        }

        return [
            'received_lines' => $receivedLines,
            'total_units' => $totalUnits,
            'batches' => $batches,
            'warnings' => $warnings,
        ];
    }

    /**
     * @return array{received: bool, warning: ?string, batch: ?array{product_id: int, product_name: ?string, qty: int, received_category_id: int}}
     */
    private function receiveLine(PurchaseOrder $order, PurchaseOrderItem $item, ?int $userId = null): array
    {
        $product = $item->product;
        if (! $product instanceof Product) {
            return [
                'received' => false,
                'warning' => "Line item #{$item->id}: product not found.",
                'batch' => null,
            ];
        }

        $qty = max(1, (int) $item->qty);
        $inventory = $this->resolveInventoryMaster($product);

        if (! $inventory) {
            return [
                'received' => false,
                'warning' => "{$product->name}: could not create Stock & Inventory label.",
                'batch' => null,
            ];
        }

        $variantNote = $this->variantNote($item);
        $descriptionParts = array_filter([
            "Purchase order {$order->po_number}",
            $variantNote,
            $order->notes ? trim((string) $order->notes) : null,
        ]);
        $description = implode(' · ', $descriptionParts);

        $receiveMeta = [
            'unit_cost' => (float) $item->cost_per_unit,
            'date_in' => $order->order_date?->format('Y-m-d') ?? now()->toDateString(),
            'description' => $description,
            'supplier_name' => $order->supplier?->name,
            'invoice_number' => $order->po_number,
            'product_id' => (int) $product->id,
        ];

        $result = $this->stockReceive->receiveWithMetadata($inventory, $qty, $receiveMeta);

        $this->applyProductStock($product, $item, $qty);

        $stockReceivedId = StockReceived::query()
            ->where('category_id', (int) $result['received']->id)
            ->value('id');

        $lot = $this->inventoryLots->createFromPurchaseReceive(
            $product,
            $item,
            $qty,
            (float) $item->cost_per_unit,
            $stockReceivedId ? (int) $stockReceivedId : null,
            InventoryLot::LISTING_ACTIVE,
        );

        $this->detailAudit->record(
            $lot,
            $userId,
            InventoryLotDetailEvent::ACTION_RECEIVE_PO,
            [],
            $this->detailAudit->snapshot($lot),
            [
                'po_number' => $order->po_number,
                'purchase_order_id' => (int) $order->id,
                'qty' => $qty,
            ],
        );

        return [
            'received' => true,
            'warning' => null,
            'batch' => [
                'product_id' => (int) $product->id,
                'product_name' => $product->name,
                'qty' => $qty,
                'received_category_id' => (int) $result['received']->id,
                'inventory_lot_id' => (int) $lot->id,
            ],
        ];
    }

    private function applyProductStock(Product $product, PurchaseOrderItem $item, int $qty): void
    {
        $product->refresh();

        if ($item->size || $item->color) {
            ProductVariantInventory::incrementVariantMatrix(
                $product,
                $item->color,
                $item->size,
                $qty,
            );
        }

        $product->refresh();

        if (ProductVariantInventory::usesMatrix($product)) {
            $product->stock = ProductVariantInventory::totalMatrixQty($product);
            $product->save();

            return;
        }

        if (is_numeric($product->stock)) {
            $product->stock = max(0, (int) $product->stock) + $qty;
        } else {
            $product->stock = $qty;
        }
        $product->save();
    }

    private function variantNote(PurchaseOrderItem $item): ?string
    {
        $parts = array_filter([
            $item->color ? trim((string) $item->color) : null,
            $item->size ? trim((string) $item->size) : null,
        ]);

        if ($parts === []) {
            return null;
        }

        return implode(' / ', $parts);
    }

    private function resolveInventoryMaster(Product $product): ?Category
    {
        if (! empty($product->stock_label_id)) {
            $label = Category::query()->find((int) $product->stock_label_id);
            if ($label && $label->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE) {
                if ($label->parent_id) {
                    $master = Category::query()->find((int) $label->parent_id);
                    if ($master && $master->type === PaidOrderInventory::BARCODE_CATEGORY_TYPE && ! $master->parent_id) {
                        return $master;
                    }
                } elseif (! $label->parent_id) {
                    return $label;
                }
            }
        }

        return $this->ensureInventoryMasterForProduct($product);
    }

    private function ensureInventoryMasterForProduct(Product $product): ?Category
    {
        $baseSlug = Str::slug($product->sku ?: $product->name ?: 'product-'.$product->id);
        if ($baseSlug === '') {
            $baseSlug = 'product-'.$product->id;
        }

        $slug = strtoupper(substr($baseSlug, 0, 40));
        $candidate = $slug;
        $i = 1;
        while (Category::query()->where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$i;
            $i++;
        }

        $master = Category::create([
            'name' => $product->name ?: 'Product '.$product->id,
            'slug' => $candidate,
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'sort_order' => 0,
            'is_active' => true,
            'description' => 'Auto-created from purchase order receive.',
            'price' => $product->price,
            'cost' => $product->cost_price,
            'sku' => $product->sku,
            'brand_id' => $product->brand_id,
            'manage_stock' => true,
            'stock' => 0,
            'product_condition' => 'new',
        ]);

        $product->stock_label_id = $master->id;
        $product->save();

        $this->stockTables->syncMasterFromCategory($master);

        return $master;
    }
}
