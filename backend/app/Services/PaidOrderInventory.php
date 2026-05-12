<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;

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
        $bundle = self::findBarcodeBundleByCode((string) ($product->barcode_code ?? ''));

        if ($bundle && ($bundle->manage_stock ?? false) && $bundle->stock !== null) {
            return min($productStock, (int) $bundle->stock);
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

        if ($product->stock !== null) {
            $product->update([
                'stock' => max(0, (int) $product->stock - $qty),
            ]);
        }

        self::decrementBarcodeBundleStock((string) ($product->barcode_code ?? ''), $qty);
    }

    public static function applyForOrder(Order $order): void
    {
        $order->loadMissing('items.product');
        foreach ($order->items as $item) {
            self::applyPaidLineItem($item);
        }
    }

    public static function decrementBarcodeBundleStock(string $barcodeCode, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $bundle = self::findBarcodeBundleByCode($barcodeCode);
        if (! $bundle || ! ($bundle->manage_stock ?? false) || $bundle->stock === null) {
            return;
        }

        $current = (int) $bundle->stock;
        $bundle->update([
            'stock' => max(0, $current - $qty),
        ]);
    }
}
