<?php

namespace App\Services;

use App\Models\Category;
use App\Models\InventoryLot;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BarcodeScanStockService
{
    /**
     * Build ordered unique strings to try (raw scan, URL path segments, /category/x, query params, etc.).
     *
     * @return list<string>
     */
    public static function collectScanCandidates(string $raw): array
    {
        $raw = trim($raw);
        $seen = [];
        $ordered = [];

        $add = function (string $s) use (&$seen, &$ordered): void {
            $s = trim($s);
            if ($s === '') {
                return;
            }
            $key = strtolower($s);
            if (isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $ordered[] = $s;
        };

        $add($raw);

        if (preg_match('~/category/([^/?#]+)~i', $raw, $m)) {
            $add(rawurldecode($m[1]));
        }

        if (preg_match('~/p/([^/?#]+)~i', $raw, $m)) {
            $add(rawurldecode($m[1]));
        }

        if (str_contains($raw, '://') || str_starts_with($raw, '//')) {
            $parsed = parse_url(str_starts_with($raw, '//') ? 'https:' . $raw : $raw);
            $path = isset($parsed['path']) ? trim((string) $parsed['path'], '/') : '';
            if ($path !== '') {
                $segments = array_values(array_filter(explode('/', $path), fn ($x) => $x !== ''));
                foreach ($segments as $seg) {
                    $add(rawurldecode($seg));
                }
            }
            if (! empty($parsed['query'])) {
                parse_str((string) $parsed['query'], $q);
                foreach (['code', 'slug', 'sku', 'id'] as $k) {
                    if (! empty($q[$k])) {
                        $add((string) $q[$k]);
                    }
                }
            }
        }

        if (str_contains($raw, '/') && ! str_contains($raw, '://')) {
            $add(rawurldecode(basename(rtrim($raw, '/'))));
        }

        return $ordered;
    }

    public static function findBundleByScanCode(string $raw): ?Category
    {
        return self::findBundleAmongCandidates(self::collectScanCandidates($raw));
    }

    /**
     * First matching barcode_qr category by slug, sku, or numeric id.
     */
    public static function findBundleAmongCandidates(array $candidates): ?Category
    {
        foreach ($candidates as $code) {
            $code = trim((string) $code);
            if ($code === '') {
                continue;
            }

            $bySlugOrSku = Category::query()
                ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
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
                $byId = Category::query()
                    ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
                    ->where('id', (int) $code)
                    ->first();
                if ($byId) {
                    return $byId;
                }
            }
        }

        return null;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Product>
     */
    public static function findLinkedProducts(string $canonicalSlug)
    {
        $canonicalSlug = trim((string) $canonicalSlug);
        if ($canonicalSlug === '') {
            return Product::query()->whereRaw('1 = 0')->get();
        }

        return Product::query()
            ->where(function ($q) use ($canonicalSlug) {
                $q->where(function ($q2) use ($canonicalSlug) {
                    $q2->whereNotNull('barcode_code')
                        ->where('barcode_code', '!=', '')
                        ->whereRaw('LOWER(barcode_code) = LOWER(?)', [$canonicalSlug]);
                })->orWhere(function ($q2) use ($canonicalSlug) {
                    $q2->whereNotNull('sku')
                        ->where('sku', '!=', '')
                        ->whereRaw('LOWER(sku) = LOWER(?)', [$canonicalSlug]);
                });
            })
            ->get();
    }

    /**
     * POS products linked to a Stock & Inventory label (stock_label_id + legacy barcode match).
     *
     * @return Collection<int, Product>
     */
    public static function findProductsForInventoryLabel(Category $label): Collection
    {
        $master = PaidOrderInventory::resolveInventoryMaster($label);
        $labelIds = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->where(function ($q) use ($master) {
                $q->where('id', $master->id)
                    ->orWhere('parent_id', $master->id);
            })
            ->pluck('id')
            ->all();

        $slug = trim((string) ($master->slug ?? ''));
        $bySlug = $slug !== '' ? self::findLinkedProducts($slug) : collect();

        $byLabelId = $labelIds === []
            ? collect()
            : Product::query()->whereIn('stock_label_id', $labelIds)->get();

        $byId = [];
        $merged = collect();
        foreach ($bySlug->concat($byLabelId) as $p) {
            if (! isset($byId[$p->id])) {
                $byId[$p->id] = true;
                $merged->push($p);
            }
        }

        return $merged;
    }

    /** True when the scan resolves directly to the inventory master slug (label barcode). */
    public static function scanMatchesInventoryLabelSlug(array $candidates, Category $master): bool
    {
        $slug = strtolower(trim((string) ($master->slug ?? '')));
        if ($slug === '') {
            return false;
        }

        foreach ($candidates as $c) {
            if (strtolower(trim((string) $c)) === $slug) {
                return true;
            }
        }

        return false;
    }

    /**
     * Products linked to any candidate slug/code (deduped by id).
     */
    public static function findLinkedProductsAmongCandidates(array $candidates, ?Category $bundle = null): Collection
    {
        $byId = [];
        $list = collect();
        foreach ($candidates as $c) {
            foreach (self::findLinkedProducts((string) $c) as $p) {
                if (! isset($byId[$p->id])) {
                    $byId[$p->id] = true;
                    $list->push($p);
                }
            }
        }

        if ($bundle) {
            foreach (self::findProductsForInventoryLabel($bundle) as $p) {
                if (! isset($byId[$p->id])) {
                    $byId[$p->id] = true;
                    $list->push($p);
                }
            }
        }

        return $list;
    }

    /** Sum of numeric stock on POS products linked to a label (Total price units in admin). */
    public static function catalogUnitsForInventoryLabel(Category $bundle): int
    {
        $units = 0;
        foreach (self::findProductsForInventoryLabel($bundle) as $p) {
            if ($p->stock !== null && is_numeric($p->stock)) {
                $units += max(0, (int) $p->stock);
            }
        }

        return $units;
    }

    /**
     * Average-bundle label scan: reduce linked product stock so admin Total price / units drop too.
     */
    public static function decrementAverageBundleCatalogStock(Collection $products, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $remaining = $qty;
        foreach ($products->sortBy('id')->values() as $p) {
            if ($remaining <= 0) {
                break;
            }
            if ($p->stock === null || ! is_numeric($p->stock)) {
                continue;
            }
            $p->refresh();
            $available = max(0, (int) $p->stock);
            if ($available <= 0) {
                continue;
            }
            $take = min($remaining, $available);
            $p->update(['stock' => $available - $take]);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw ValidationException::withMessages([
                'code' => ['Not enough catalog stock on linked products for this label (Total price units).'],
            ]);
        }
    }

    /**
     * Maximum units sellable in one scan (same rules as {@see applyScanDeduction}).
     * Null means no numeric stock caps (unlimited).
     */
    public static function maxSellableQty(?Category $bundle, Collection $products, bool $labelOnlyScan = false): ?int
    {
        $mins = [];
        if ($bundle) {
            $master = PaidOrderInventory::resolveInventoryMaster($bundle);
            if (($master->manage_stock ?? false) && $master->stock !== null) {
                $mins[] = (int) $master->stock;
            }
            if ($labelOnlyScan && PaidOrderInventory::isAverageBundleCategory($master)) {
                $catalogUnits = self::catalogUnitsForInventoryLabel($bundle);
                if ($catalogUnits > 0) {
                    $mins[] = $catalogUnits;
                }
            }
        }
        if ($labelOnlyScan) {
            return $mins === [] ? null : min($mins);
        }
        foreach ($products as $p) {
            if ($p->stock !== null && is_numeric($p->stock)) {
                $mins[] = PaidOrderInventory::effectiveProductStockCap($p);
            }
            if (ProductVariantInventory::usesMatrix($p)) {
                $fallbackVariant = ProductVariantInventory::firstAvailableVariant($p);
                $mins[] = $fallbackVariant ? ProductVariantInventory::effectiveCapForCartLine($p, $fallbackVariant['color'], $fallbackVariant['size']) : 0;
            }
        }

        if ($mins === []) {
            return null;
        }

        return min($mins);
    }

    /**
     * Resolve scan for POS display (no stock change).
     *
     * @return array{code: string, name: string, price: float, image_url: ?string, has_label: bool, label_stock: mixed, manage_label_stock: bool, max_sellable_qty: int|null}|null
     */
    public static function lookupDisplay(string $raw): ?array
    {
        $lotService = app(InventoryLotService::class);
        foreach (self::collectScanCandidates($raw) as $candidate) {
            $lot = $lotService->findByBarcode((string) $candidate);
            if ($lot) {
                return self::lookupDisplayForLot($lot, $lotService);
            }
        }

        $candidates = self::collectScanCandidates($raw);
        $bundle = self::findBundleAmongCandidates($candidates);
        $master = $bundle ? PaidOrderInventory::resolveInventoryMaster($bundle) : null;
        $labelOnlyScan = $master && self::scanMatchesInventoryLabelSlug($candidates, $master);
        $canonical = $master?->slug ?? $bundle?->slug ?? ($candidates[0] ?? null);
        if ($canonical === null || trim((string) $canonical) === '') {
            $canonical = trim($raw);
        }
        $products = self::findLinkedProductsAmongCandidates($candidates, $bundle);
        $variantMatch = ProductVariantInventory::findBySkuBarcodeCandidates($candidates);

        if (! $bundle && $products->isEmpty() && ! $variantMatch) {
            return null;
        }

        $variantProduct = $variantMatch['product'] ?? null;
        $variant = $variantMatch['variant'] ?? null;
        $variantName = $variantProduct && $variant
            ? $variantProduct->name.' - '.$variant['color'].' / '.$variant['size']
            : null;
        $name = (string) ($variantName ?? $master?->name ?? $bundle?->name ?? $products->first()?->name ?? 'Item');

        $price = 0.0;
        $pricingLot = null;
        if ($variantProduct) {
            $variantProduct->loadMissing('activeDiscount');
            $firstLot = $lotService->firstSellableLot(
                $variantProduct,
                $variant['size'] ?? null,
                $variant['color'] ?? null,
            );
            if ($firstLot) {
                $price = $lotService->resolveUnitPrice($firstLot, $variantProduct);
                $pricingLot = $firstLot;
            } else {
                $price = $lotService->resolveStorefrontUnitPrice(
                    $variantProduct,
                    $variant['size'] ?? null,
                    $variant['color'] ?? null,
                );
            }
        } elseif ($master && PaidOrderInventory::isAverageBundleCategory($master)) {
            if ($products->isNotEmpty() && ! $labelOnlyScan) {
                $p = $products->first();
                $p->loadMissing('activeDiscount');
                $price = (float) ($p->final_price ?? $p->price ?? 0);
            } else {
                $price = PaidOrderInventory::averageBundleUnitPrice($master);
                if ($price <= 0 && $products->isNotEmpty()) {
                    $p = $products->first();
                    $p->loadMissing('activeDiscount');
                    $price = (float) ($p->final_price ?? $p->price ?? 0);
                }
            }
        } elseif ($master && $master->price !== null && (float) $master->price > 0) {
            $price = (float) $master->price;
        } elseif ($bundle && $bundle->price !== null && (float) $bundle->price > 0) {
            $price = (float) $bundle->price;
        } elseif ($products->isNotEmpty()) {
            $p = $products->first();
            $p->loadMissing('activeDiscount');
            $firstLot = $lotService->firstSellableLot($p);
            if ($firstLot) {
                $price = $lotService->resolveUnitPrice($firstLot, $p);
                $pricingLot = $firstLot;
            } else {
                $price = $lotService->resolveStorefrontUnitPrice($p);
            }
        }

        $linkedBundle = $master ?? $bundle;
        if (! $linkedBundle && $variantProduct) {
            $linkedBundle = PaidOrderInventory::findBarcodeBundleByCode((string) ($variantProduct->barcode_code ?? ''));
            $linkedBundle = $linkedBundle ? PaidOrderInventory::resolveInventoryMaster($linkedBundle) : null;
        }
        if (! $linkedBundle && $products->isNotEmpty()) {
            $first = $products->first();
            if (! empty($first->stock_label_id)) {
                $lbl = Category::query()->find((int) $first->stock_label_id);
                $linkedBundle = $lbl ? PaidOrderInventory::resolveInventoryMaster($lbl) : null;
            }
            if (! $linkedBundle) {
                $found = PaidOrderInventory::findBarcodeBundleByCode((string) ($first->barcode_code ?? ''));
                $linkedBundle = $found ? PaidOrderInventory::resolveInventoryMaster($found) : null;
            }
        }

        $imageUrl = $variantProduct?->image_url ?? $master?->image_url ?? $bundle?->image_url ?? ($products->isNotEmpty() ? $products->first()->image_url : null);
        $maxSellable = $variantProduct && $variant
            ? ProductVariantInventory::effectiveCapForCartLine($variantProduct, $variant['color'], $variant['size'])
            : self::maxSellableQty($bundle, $products, $labelOnlyScan);

        $payload = [
            'code' => (string) ($variant['sku_barcode'] ?? $master?->slug ?? $bundle?->slug ?? $canonical),
            'name' => $name,
            'price' => round($price, 2),
            'image_url' => $imageUrl ? (string) $imageUrl : null,
            'has_label' => (bool) $linkedBundle,
            'label_stock' => $linkedBundle?->stock,
            'manage_label_stock' => (bool) ($linkedBundle?->manage_stock ?? false),
            'max_sellable_qty' => $maxSellable,
        ];
        if ($pricingLot !== null) {
            return self::enrichInventoryLotLookup($payload, $pricingLot, $lotService);
        }

        return $payload;
    }

    /**
     * POS-style scan: reduce label bundle stock (if tracked) and all linked product stocks.
     *
     * @return array{slug: string, qty: int, label: ?array, products: array<int, array<string, mixed>>}
     */
    public static function applyScanDeduction(string $rawCode, int $qty): array
    {
        $qty = max(1, min(9999, $qty));
        $trimmed = trim($rawCode);
        if ($trimmed === '') {
            throw ValidationException::withMessages([
                'code' => ['Scan or enter a code.'],
            ]);
        }

        $lotService = app(InventoryLotService::class);
        foreach (self::collectScanCandidates($rawCode) as $candidate) {
            $lot = $lotService->findByBarcode((string) $candidate);
            if ($lot) {
                return self::applyLotScanDeduction($lot, $qty, $lotService);
            }
        }

        $candidates = self::collectScanCandidates($rawCode);
        $bundle = self::findBundleAmongCandidates($candidates);
        $master = $bundle ? PaidOrderInventory::resolveInventoryMaster($bundle) : null;
        $labelOnlyScan = $master && self::scanMatchesInventoryLabelSlug($candidates, $master);
        $averageLabelScan = $labelOnlyScan && $master && PaidOrderInventory::isAverageBundleCategory($master);
        $canonical = $master?->slug ?? $bundle?->slug ?? ($candidates[0] ?? $trimmed);
        $products = self::findLinkedProductsAmongCandidates($candidates, $bundle);
        $variantMatch = ProductVariantInventory::findBySkuBarcodeCandidates($candidates);
        $variantProduct = $variantMatch['product'] ?? null;
        $variant = $variantMatch['variant'] ?? null;
        $productsToDeduct = $variantProduct
            ? $products->reject(fn (Product $p) => (int) $p->id === (int) $variantProduct->id)->values()
            : $products;
        $catalogProducts = ($averageLabelScan && $bundle)
            ? self::findProductsForInventoryLabel($bundle)
            : collect();

        if ($averageLabelScan) {
            $productsToDeduct = collect();
        }

        if (! $bundle && $products->isEmpty() && ! $variantMatch) {
            throw ValidationException::withMessages([
                'code' => ['No Barcode & QR label or linked product matches this code. Use the label slug, store URL from the QR (/category/…), or a product barcode code.'],
            ]);
        }

        self::assertQtyWithinSellableCap($rawCode, $qty);

        $lotAllocations = [];

        DB::transaction(function () use ($bundle, $productsToDeduct, $qty, $variantProduct, $variant, $averageLabelScan, $catalogProducts, $lotService, &$lotAllocations) {
            // Decrement master sellable pool only; Stock Received rows / stock_received are never touched.
            if ($bundle) {
                PaidOrderInventory::decrementInventoryMasterStock($bundle, $qty);
            }

            if ($averageLabelScan && $catalogProducts->isNotEmpty()) {
                self::decrementAverageBundleCatalogStock($catalogProducts, $qty);
            }

            foreach ($productsToDeduct as $p) {
                if ($p->stock !== null && is_numeric($p->stock)) {
                    $p->refresh();
                    $p->update([
                        'stock' => max(0, (int) $p->stock - $qty),
                    ]);
                }
                if (ProductVariantInventory::usesMatrix($p)) {
                    $fallbackVariant = ProductVariantInventory::firstAvailableVariant($p);
                    if ($fallbackVariant) {
                        ProductVariantInventory::decrementVariantMatrix($p, $fallbackVariant['color'], $fallbackVariant['size'], $qty);
                    }
                }
                if (! $bundle) {
                    PaidOrderInventory::decrementBarcodeBundleStock((string) ($p->barcode_code ?? ''), $qty);
                }
            }

            if ($variantProduct && $variant) {
                $variantProduct->refresh();
                if ($variantProduct->stock !== null && is_numeric($variantProduct->stock)) {
                    $variantProduct->update([
                        'stock' => max(0, (int) $variantProduct->stock - $qty),
                    ]);
                }
                ProductVariantInventory::decrementVariantMatrix($variantProduct, $variant['color'], $variant['size'], $qty);
                PaidOrderInventory::decrementBarcodeBundleStock((string) ($variantProduct->barcode_code ?? ''), $qty);
                $lotAllocations = self::consumeInventoryLotsIfPresent(
                    $lotService,
                    $variantProduct,
                    $variant['size'] ?? null,
                    $variant['color'] ?? null,
                    $qty,
                );
            } elseif ($productsToDeduct->isNotEmpty()) {
                $primary = $productsToDeduct->first();
                $lotAllocations = self::consumeInventoryLotsIfPresent($lotService, $primary, null, null, $qty);
            }
        });

        $freshBundle = ($master ?? $bundle)?->fresh();
        $slugOut = (string) ($variant['sku_barcode'] ?? $freshBundle?->slug ?? $canonical);

        $freshProducts = self::findLinkedProductsAmongCandidates(
            array_values(array_unique(array_merge([$slugOut], $candidates))),
            $bundle
        );
        if ($variantProduct) {
            $freshVariantProduct = $variantProduct->fresh();
            if ($freshVariantProduct) {
                $freshProducts->push($freshVariantProduct);
            }
        }

        return [
            'slug' => $slugOut,
            'qty' => $qty,
            'label' => $freshBundle ? [
                'id' => $freshBundle->id,
                'name' => $freshBundle->name,
                'slug' => $freshBundle->slug,
                'manage_stock' => (bool) ($freshBundle->manage_stock ?? false),
                'stock' => $freshBundle->stock,
            ] : null,
            'products' => $freshProducts->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'stock' => $p->stock,
            ])->values()->all(),
            'inventory_lot_allocations' => $lotAllocations,
        ];
    }

    /**
     * @return array{code: string, name: string, price: float, image_url: ?string, has_label: bool, label_stock: mixed, manage_label_stock: bool, max_sellable_qty: int|null, inventory_lot_id: int, listing_status: string}
     */
    private static function lookupDisplayForLot(InventoryLot $lot, InventoryLotService $lotService): array
    {
        $lot->loadMissing('product');
        $product = $lot->product;
        $price = $lotService->resolveUnitPrice($lot, $product);
        $name = $lotService->displayNameForLot($lot);

        return self::enrichInventoryLotLookup([
            'code' => (string) ($lot->barcode ?? $lot->lot_number),
            'name' => $name,
            'price' => round($price, 2),
            'image_url' => $product?->image_url ? (string) $product->image_url : null,
            'has_label' => false,
            'label_stock' => null,
            'manage_label_stock' => false,
            'max_sellable_qty' => (int) $lot->quantity_on_hand,
        ], $lot, $lotService);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private static function enrichInventoryLotLookup(array $payload, InventoryLot $lot, InventoryLotService $lotService): array
    {
        $payload['inventory_lot_id'] = (int) $lot->id;
        $payload['listing_status'] = (string) $lot->listing_status;
        $payload['price_source'] = 'inventory_lot';

        $meta = $lotService->lotDiscountMeta($lot);
        if ($meta) {
            $payload['compare_price'] = $meta['compare_price'];
            $payload['discount_percent_off'] = $meta['percent_off'];
            $payload['lot_discount_source'] = $meta['source'];
        }

        return $payload;
    }

    /**
     * @return array{slug: string, qty: int, label: null, products: array<int, array<string, mixed>>, inventory_lot_allocations: array<int, array<string, mixed>>}
     */
    private static function applyLotScanDeduction(InventoryLot $lot, int $qty, InventoryLotService $lotService): array
    {
        if ($qty > (int) $lot->quantity_on_hand) {
            throw ValidationException::withMessages([
                'code' => ['Not enough quantity in this inventory lot.'],
            ]);
        }

        $lot->loadMissing('product');
        $product = $lot->product;
        if (! $product) {
            throw ValidationException::withMessages([
                'code' => ['Inventory lot is not linked to a product.'],
            ]);
        }

        $allocations = [];

        DB::transaction(function () use ($lot, $qty, $product, $lotService, &$allocations) {
            $allocations = $lotService->consumeForSale(
                $product,
                $lot->size,
                $lot->color,
                $qty,
                (int) $lot->id,
            );

            if ($product->stock !== null && is_numeric($product->stock)) {
                $product->refresh();
                $product->update([
                    'stock' => max(0, (int) $product->stock - $qty),
                ]);
            }

            ProductVariantInventory::decrementVariantMatrix(
                $product,
                $lot->color,
                $lot->size,
                $qty,
            );

            if (! empty($product->stock_label_id)) {
                PaidOrderInventory::decrementStockLabelPool($product, $qty);
            } else {
                PaidOrderInventory::decrementBarcodeBundleStock((string) ($product->barcode_code ?? ''), $qty);
            }
        });

        return [
            'slug' => (string) ($lot->barcode ?? $lot->lot_number),
            'qty' => $qty,
            'label' => null,
            'products' => [[
                'id' => $product->id,
                'name' => $product->name,
                'stock' => $product->fresh()->stock,
            ]],
            'inventory_lot_allocations' => $allocations,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function consumeInventoryLotsIfPresent(
        InventoryLotService $lotService,
        Product $product,
        ?string $size,
        ?string $color,
        int $qty,
    ): array {
        $hasLots = InventoryLot::query()
            ->where('product_id', $product->id)
            ->where('is_sellable', true)
            ->where('quantity_on_hand', '>', 0)
            ->exists();

        if (! $hasLots) {
            return [];
        }

        return $lotService->consumeForSale($product, $size, $color, $qty);
    }

    private static function assertQtyWithinSellableCap(string $rawCode, int $qty): void
    {
        $row = self::lookupDisplay($rawCode);
        if ($row === null) {
            return;
        }

        $max = $row['max_sellable_qty'] ?? null;
        if ($max === null) {
            return;
        }

        $cap = max(0, (int) $max);
        if ($qty > $cap) {
            throw ValidationException::withMessages([
                'qty' => [$cap > 0
                    ? "Only {$cap} available in stock."
                    : 'This item is out of stock.'],
            ]);
        }
    }
}
