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
        $listing = PaidOrderInventory::effectiveProductStockCap($product);

        if (! self::usesMatrix($product)) {
            return $listing;
        }

        $v = self::qtyForVariant($product, $color, $size);
        if ($v === null) {
            return 0;
        }

        return min($listing, max(0, $v));
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
                if ($barcode === '') {
                    continue;
                }
                $key = strtolower($barcode);
                if (isset($codes[$key])) {
                    return [
                        'product' => $product,
                        'variant' => $row,
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
}

