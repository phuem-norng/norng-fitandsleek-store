<?php

namespace App\Services;

use App\Models\Category;
use App\Models\InventoryLot;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\ProductVariantInventory;

class PaidOrderInventory
{
    public const BARCODE_CATEGORY_TYPE = 'barcode_qr';

    /**
     * Barcode & QR labels are stored as categories with type barcode_qr; slug is the scannable code.
     */
    public static function findBarcodeBundleByCode(string $code): ?Category
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        $bySlugOrSku = Category::query()
            ->where('type', self::BARCODE_CATEGORY_TYPE)
            ->where(function ($q) use ($code) {
                $q->whereRaw('LOWER(slug) = LOWER(?)', [$code])
                    ->orWhere(function ($q2) use ($code) {
                        $q2->whereNotNull('sku')
                            ->where('sku', '!=', '')
                            ->whereRaw('LOWER(sku) = LOWER(?)', [$code]);
                    });
            })
            ->first();

        if ($bySlugOrSku) {
            return $bySlugOrSku;
        }

        if (ctype_digit($code)) {
            return Category::query()
                ->where('type', self::BARCODE_CATEGORY_TYPE)
                ->where('id', (int) $code)
                ->first();
        }

        return null;
    }

    /**
     * Max units sellable for this product row (numeric product stock only).
     */
    public static function effectiveProductStockCap(Product $product): int
    {
        if (! is_numeric($product->stock)) {
            return 0;
        }

        $productStock = (int) $product->stock;
        $pool = self::sellablePoolForProduct($product);

        if ($pool !== null) {
            return min($productStock, $pool);
        }

        return $productStock;
    }

    /**
     * After payment: reduce product stock (existing behaviour) and linked barcode bundle stock when applicable.
     */
    public static function applyPaidLineItem(OrderItem $item): void
    {
        $product = $item->product;
        if (! $product) {
            return;
        }

        $qty = (int) ($item->qty ?? $item->quantity ?? 0);
        if ($qty <= 0) {
            return;
        }

        if (empty($item->inventory_lot_id)) {
            $lotService = app(InventoryLotService::class);
            $hasLots = InventoryLot::query()
                ->where('product_id', $product->id)
                ->where('is_sellable', true)
                ->where('quantity_on_hand', '>', 0)
                ->exists();

            if ($hasLots) {
                try {
                    $allocations = $lotService->consumeForSale(
                        $product,
                        $item->size,
                        $item->color,
                        $qty,
                    );
                    if ($allocations !== []) {
                        OrderItemLotAllocation::splitPaidOrderItem($item, $allocations);
                    }
                } catch (\Illuminate\Validation\ValidationException) {
                    // Fall back to aggregate stock only when lots are unavailable.
                }
            }
        }

        if ($product->stock !== null) {
            $product->update([
                'stock' => max(0, (int) $product->stock - $qty),
            ]);
        }

        ProductVariantInventory::decrementVariantMatrix(
            $product,
            $item->color ?? null,
            $item->size ?? null,
            $qty
        );

        if (! empty($product->stock_label_id)) {
            self::decrementStockLabelPool($product, $qty);
        } else {
            self::decrementBarcodeBundleStock((string) ($product->barcode_code ?? ''), $qty);
        }
    }

    public static function applyForOrder(Order $order): void
    {
        $order->loadMissing('items.product');
        foreach ($order->items as $item) {
            self::applyPaidLineItem($item);
        }
    }

    /** Sellable units on the linked inventory master, if tracked. */
    public static function sellablePoolForProduct(Product $product): ?int
    {
        if (! empty($product->stock_label_id)) {
            $label = Category::query()
                ->where('id', (int) $product->stock_label_id)
                ->where('type', self::BARCODE_CATEGORY_TYPE)
                ->first();

            if ($label) {
                $master = self::resolveInventoryMaster($label);
                if (($master->manage_stock ?? false) && $master->stock !== null) {
                    return (int) $master->stock;
                }

                return null;
            }
        }

        $bundle = self::findBarcodeBundleByCode((string) ($product->barcode_code ?? ''));
        if (! $bundle) {
            return null;
        }

        $master = self::resolveInventoryMaster($bundle);
        if (! ($master->manage_stock ?? false) || $master->stock === null) {
            return null;
        }

        return (int) $master->stock;
    }

    /**
     * Inventory master for a barcode_qr row (never a Quick Restock receive-batch child).
     */
    public static function isAverageBundleCategory(Category $category): bool
    {
        return ($category->product_condition ?? 'new') === 'second_hand'
            && ($category->second_hand_sale_type ?? 'single') === 'average_bundle';
    }

    public static function averageBundleUnitPrice(Category $master): float
    {
        if ($master->price !== null && (float) $master->price > 0) {
            return round((float) $master->price, 2);
        }

        $cost = (float) ($master->bundle_total_cost ?? 0);
        $qty = (int) ($master->bundle_total_quantity ?? 0);
        if ($qty > 0 && $cost >= 0) {
            return round($cost / $qty, 2);
        }

        if ($master->price !== null && (float) $master->price >= 0) {
            return round((float) $master->price, 2);
        }

        return 0.0;
    }

    public static function resolveInventoryMaster(Category $label): Category
    {
        if ($label->parent_id) {
            $parent = Category::query()
                ->where('id', $label->parent_id)
                ->where('type', self::BARCODE_CATEGORY_TYPE)
                ->first();

            if ($parent) {
                return $parent;
            }
        }

        return $label;
    }

    /**
     * Reduce sellable pool on the inventory master only.
     * stock_received and receive-batch rows are never modified (Stock Received log stays fixed).
     */
    public static function decrementInventoryMasterStock(Category $label, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $master = self::resolveInventoryMaster($label);
        if (! ($master->manage_stock ?? false) || $master->stock === null) {
            return;
        }

        $current = (int) $master->stock;
        $master->update([
            'stock' => max(0, $current - $qty),
        ]);
    }

    public static function decrementStockLabelPool(Product $product, int $qty): void
    {
        if ($qty <= 0 || empty($product->stock_label_id)) {
            return;
        }

        $label = Category::query()
            ->where('id', (int) $product->stock_label_id)
            ->where('type', self::BARCODE_CATEGORY_TYPE)
            ->first();

        if (! $label) {
            return;
        }

        self::decrementInventoryMasterStock($label, $qty);
    }

    public static function decrementBarcodeBundleStock(string $barcodeCode, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $bundle = self::findBarcodeBundleByCode($barcodeCode);
        if (! $bundle) {
            return;
        }

        self::decrementInventoryMasterStock($bundle, $qty);
    }
}
