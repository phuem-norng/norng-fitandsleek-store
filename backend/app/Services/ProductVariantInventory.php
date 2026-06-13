<?php

namespace App\Services;

use App\Models\Product;

class ProductVariantInventory
{
    /**
     * @return list<array{color: string, size: string, qty: int, sku_barcode: ?string}>
     */
    public static function matrixRows(Product $product): array
    {
        $m = $product->variant_matrix;
        if (! is_array($m) || $m === []) {
            return [];
        }
        $out = [];
        foreach ($m as $row) {
            if (! is_array($row)) {
                continue;
            }
            $c = trim((string) ($row['color'] ?? ''));
            $s = trim((string) ($row['size'] ?? ''));
            if ($c === '' || $s === '') {
                continue;
            }
            $q = (int) ($row['qty'] ?? 0);
            $skuBarcode = trim((string) ($row['sku_barcode'] ?? $row['skuBarcode'] ?? $row['barcode'] ?? ''));
            $out[] = [
                'color' => $c,
                'size' => $s,
                'qty' => max(0, $q),
                'sku_barcode' => $skuBarcode !== '' ? $skuBarcode : null,
            ];
        }

        return $out;
    }

    /**
     * Human-readable SKU shown on Stock Inventory (matches variant barcode when set).
     */
    public static function displaySkuForVariant(Product $product, string $size, string $color, ?string $skuBarcode = null): string
    {
        $barcode = trim((string) ($skuBarcode ?? ''));
        if ($barcode !== '') {
            return $barcode;
        }

        $base = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($product->sku ?: 'P'.$product->id)) ?: 'P'.$product->id);
        $sizeCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $size) ?: 'OS');
        if (strlen($sizeCode) > 4) {
            $sizeCode = substr($sizeCode, 0, 4);
        }

        $color = trim($color);
        $colorCode = 'XX';
        if ($color !== '') {
            $parts = preg_split('/\s+/', $color) ?: [];
            if (count($parts) >= 2) {
                $colorCode = strtoupper(substr($parts[0], 0, 1).substr($parts[1], 0, 1));
            } else {
                $colorCode = strtoupper(substr($color, 0, 2));
            }
        }

        return $base.'-'.$sizeCode.'-'.$colorCode;
    }

    public static function usesMatrix(Product $product): bool
    {
        return count(self::matrixRows($product)) > 0;
    }

    /**
     * Quantity on hand for this exact color × size, or null if product does not use variant matrix.
     */
    public static function qtyForVariant(Product $product, ?string $color, ?string $size): ?int
    {
        if (! self::usesMatrix($product)) {
            return null;
        }
        $color = trim((string) ($color ?? ''));
        $size = trim((string) ($size ?? ''));
        foreach (self::matrixRows($product) as $row) {
            if (strcasecmp($row['color'], $color) === 0 && strcasecmp($row['size'], $size) === 0) {
                return $row['qty'];
            }
        }

        return 0;
    }

    /**
     * Max units sellable for one cart/order line (variant row × product/label cap).
     */
    public static function effectiveCapForCartLine(Product $product, ?string $color, ?string $size): int
    {
        if (! self::usesMatrix($product)) {
            return self::capWithInventoryLots(
                $product,
                PaidOrderInventory::effectiveProductStockCap($product),
                $color,
                $size,
            );
        }

        $variantQty = self::qtyForVariant($product, $color, $size);
        if ($variantQty === null) {
            return 0;
        }

        $cap = max(0, $variantQty);

        // Variant row qty is authoritative; product.stock is an optional total listing cap when > 0.
        if (is_numeric($product->stock)) {
            $productStock = (int) $product->stock;
            if ($productStock > 0) {
                $cap = min($cap, $productStock);
            }
        }

        return self::capWithInventoryLots($product, $cap, $color, $size);
    }

    private static function capWithInventoryLots(Product $product, int $cap, ?string $color, ?string $size): int
    {
        $lotService = app(InventoryLotService::class);
        $productId = (int) $product->id;

        if ($lotService->hasLotStockOnHand($productId) && ! $lotService->hasSellableLots($productId)) {
            return 0;
        }

        if (! $lotService->hasSellableLots($productId)) {
            return $cap;
        }

        return min($cap, $lotService->totalSellableQty($productId, $size, $color));
    }

    public static function totalMatrixQty(Product $product): int
    {
        $sum = 0;
        foreach (self::matrixRows($product) as $row) {
            $sum += (int) ($row['qty'] ?? 0);
        }

        return $sum;
    }

    /**
     * Fallback for product-level scans when the cashier did not scan an exact variant barcode.
     *
     * @return array{color: string, size: string, qty: int, sku_barcode: ?string}|null
     */
    public static function firstAvailableVariant(Product $product): ?array
    {
        foreach (self::matrixRows($product) as $row) {
            if ((int) ($row['qty'] ?? 0) > 0) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Find a product variant row by its scannable variant barcode.
     *
     * @return array{product: Product, variant: array{color: string, size: string, qty: int, sku_barcode: ?string}, code: string}|null
     */
    public static function findBySkuBarcodeCandidates(array $candidates): ?array
    {
        $codes = [];
        foreach ($candidates as $candidate) {
            $code = trim((string) $candidate);
            if ($code !== '') {
                $codes[strtolower($code)] = $code;
            }
        }

        if ($codes === []) {
            return null;
        }

        $products = Product::query()
            ->whereNotNull('variant_matrix')
            ->get();

        foreach ($products as $product) {
            if (! $product instanceof Product) {
                continue;
            }
            foreach (self::matrixRows($product) as $row) {
                $barcode = trim((string) ($row['sku_barcode'] ?? ''));
                if ($barcode !== '') {
                    $key = strtolower($barcode);
                    if (isset($codes[$key])) {
                        return [
                            'product' => $product,
                            'variant' => $row,
                            'code' => $codes[$key],
                        ];
                    }
                }

                $displaySku = self::displaySkuForVariant(
                    $product,
                    (string) ($row['size'] ?? ''),
                    (string) ($row['color'] ?? ''),
                    null,
                );
                $displayKey = strtolower($displaySku);
                if (isset($codes[$displayKey])) {
                    return [
                        'product' => $product,
                        'variant' => $row,
                        'code' => $codes[$displayKey],
                    ];
                }
            }

            $productSku = trim((string) ($product->sku ?? ''));
            if ($productSku !== '') {
                $key = strtolower($productSku);
                if (isset($codes[$key]) && ! self::usesMatrix($product)) {
                    return [
                        'product' => $product,
                        'variant' => self::firstAvailableVariant($product) ?? [
                            'color' => '',
                            'size' => '',
                            'qty' => max(0, (int) ($product->stock ?? 0)),
                            'sku_barcode' => null,
                        ],
                        'code' => $codes[$key],
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Reduce variant_matrix qty after a paid line ships (same time as product stock decrement).
     */
    public static function decrementVariantMatrix(Product $product, ?string $color, ?string $size, int $qty): void
    {
        if ($qty <= 0 || ! self::usesMatrix($product)) {
            return;
        }

        $matrix = $product->variant_matrix;
        if (! is_array($matrix)) {
            return;
        }

        $color = trim((string) ($color ?? ''));
        $size = trim((string) ($size ?? ''));

        foreach ($matrix as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            $rc = trim((string) ($row['color'] ?? ''));
            $rs = trim((string) ($row['size'] ?? ''));
            if (strcasecmp($rc, $color) === 0 && strcasecmp($rs, $size) === 0) {
                $current = (int) ($row['qty'] ?? 0);
                $matrix[$i]['qty'] = max(0, $current - $qty);
                $product->variant_matrix = $matrix;
                $product->save();

                return;
            }
        }
    }

    /**
     * Increase variant_matrix qty when stock is received (purchase order, manual receive).
     */
    public static function incrementVariantMatrix(Product $product, ?string $color, ?string $size, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $color = trim((string) ($color ?? ''));
        $size = trim((string) ($size ?? ''));

        if ($color === '' || $size === '') {
            return;
        }

        $matrix = $product->variant_matrix;
        if (! is_array($matrix)) {
            $matrix = [];
        }

        foreach ($matrix as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            $rc = trim((string) ($row['color'] ?? ''));
            $rs = trim((string) ($row['size'] ?? ''));
            if (strcasecmp($rc, $color) === 0 && strcasecmp($rs, $size) === 0) {
                $current = (int) ($row['qty'] ?? 0);
                $matrix[$i]['qty'] = max(0, $current + $qty);
                $product->variant_matrix = $matrix;
                $product->save();

                return;
            }
        }

        $matrix[] = [
            'color' => $color,
            'size' => $size,
            'qty' => $qty,
            'sku_barcode' => null,
        ];
        $product->variant_matrix = $matrix;
        $product->save();
    }
}

