<?php

namespace App\Services;

use App\Models\Discount;
use App\Models\InventoryLot;
use App\Models\Product;
use App\Models\PurchaseOrderItem;
use App\Models\Setting;
use App\Models\StockReceived;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InventoryLotService
{
    /**
     * @return array{
     *     inventory_lot_id: int,
     *     qty: int,
     *     unit_price: float,
     *     unit_cost: float,
     *     listing_status: string,
     * }[]
     */
    public function consumeForSale(
        Product $product,
        ?string $size,
        ?string $color,
        int $qty,
        ?int $preferredLotId = null,
    ): array {
        $qty = max(1, $qty);
        $allocations = [];

        if ($preferredLotId) {
            $lot = InventoryLot::query()
                ->where('id', $preferredLotId)
                ->where('product_id', $product->id)
                ->lockForUpdate()
                ->first();

            if ($lot && $lot->isAvailableForSale() && $this->variantMatches($lot, $size, $color)) {
                $take = min($qty, (int) $lot->quantity_on_hand);
                if ($take > 0) {
                    $this->decrementLot($lot, $take);
                    $allocations[] = $this->allocationRow($lot, $take);

                    return $allocations;
                }
            }
        }

        $remaining = $qty;
        foreach ($this->orderedSellableLots($product->id, $size, $color) as $candidate) {
            if ($remaining <= 0) {
                break;
            }
            $lot = InventoryLot::query()->where('id', $candidate->id)->lockForUpdate()->first();
            if (! $lot || ! $lot->isAvailableForSale() || ! $this->variantMatches($lot, $size, $color)) {
                continue;
            }
            $available = (int) $lot->quantity_on_hand;
            if ($available <= 0) {
                continue;
            }
            $take = min($remaining, $available);
            $this->decrementLot($lot, $take);
            $allocations[] = $this->allocationRow($lot, $take);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            $available = $qty - $remaining;
            $message = $available > 0
                ? "Only {$available} available in inventory lots."
                : 'No sellable inventory lots match this item.';

            throw ValidationException::withMessages([
                'qty' => [$message],
            ]);
        }

        return $allocations;
    }

    public function findByBarcode(string $code): ?InventoryLot
    {
        $code = trim($code);
        if ($code === '') {
            return null;
        }

        return InventoryLot::query()
            ->where(function ($q) use ($code) {
                $q->whereRaw('LOWER(barcode) = LOWER(?)', [$code])
                    ->orWhereRaw('LOWER(lot_number) = LOWER(?)', [$code]);
            })
            ->where('is_sellable', true)
            ->where('quantity_on_hand', '>', 0)
            ->whereNotIn('listing_status', [
                InventoryLot::LISTING_ON_HOLD,
                InventoryLot::LISTING_DISCONTINUED,
            ])
            ->first();
    }

    public function sellOldFirst(): bool
    {
        $row = Setting::query()->where('key', 'inventory_sell_old_first')->first();
        if ($row !== null) {
            return (bool) $row->value;
        }

        return (bool) config('inventory.sell_old_first', true);
    }

    public function resolveStorefrontUnitPrice(Product $product, ?string $size = null, ?string $color = null): float
    {
        $lot = $this->firstSellableLot($product, $size, $color);
        if ($lot) {
            return $this->resolveUnitPrice($lot, $product);
        }

        return (float) ($product->final_price ?? $product->price ?? 0);
    }

    /** Lot/list price with active admin promotional discount applied (website + cart). */
    public function resolveStorefrontCustomerPrice(Product $product, ?string $size = null, ?string $color = null): float
    {
        $base = $this->resolveStorefrontUnitPrice($product, $size, $color);
        $discount = $this->resolveActiveStorefrontDiscount($product);
        if (! $discount) {
            return round($base, 2);
        }

        return round($this->applyDiscountToUnitPrice($base, $discount), 2);
    }

    private function resolveActiveStorefrontDiscount(Product $product): ?Discount
    {
        if ($product->relationLoaded('activeDiscount')) {
            $discount = $product->getRelation('activeDiscount');

            return $discount instanceof Discount ? $discount : null;
        }

        return $product->activeDiscount()->first();
    }

    public function applyDiscountToUnitPrice(float $base, Discount $discount): float
    {
        if ($discount->discount_type === 'percentage') {
            return max(0, $base * (1 - ((float) $discount->discount_value / 100)));
        }

        return max(0, $base - (float) $discount->discount_value);
    }

    public function firstSellableLot(Product $product, ?string $size = null, ?string $color = null): ?InventoryLot
    {
        return $this->orderedSellableLots($product->id, $size, $color)->first();
    }

    public function hasSellableLots(int $productId): bool
    {
        return InventoryLot::query()
            ->where('product_id', $productId)
            ->where('is_sellable', true)
            ->where('quantity_on_hand', '>', 0)
            ->whereNotIn('listing_status', [
                InventoryLot::LISTING_ON_HOLD,
                InventoryLot::LISTING_DISCONTINUED,
            ])
            ->exists();
    }

    /** Product has inventory lots with physical qty (sellable or on hold). */
    public function hasLotStockOnHand(int $productId): bool
    {
        return InventoryLot::query()
            ->where('product_id', $productId)
            ->where('quantity_on_hand', '>', 0)
            ->exists();
    }

    public function totalSellableQty(int $productId, ?string $size = null, ?string $color = null): int
    {
        return (int) $this->orderedSellableLots($productId, $size, $color)
            ->sum(fn (InventoryLot $lot) => (int) $lot->quantity_on_hand);
    }

    /** Sellable units across all variants (inventory lots when present). */
    public function productSellableStock(Product $product): int
    {
        $product->refresh();
        $matrix = ProductVariantInventory::matrixRows($product);

        if ($matrix !== []) {
            $total = 0;
            foreach ($matrix as $row) {
                $total += $this->totalSellableQty(
                    $product->id,
                    (string) ($row['size'] ?? ''),
                    (string) ($row['color'] ?? ''),
                );
            }

            if ($total > 0) {
                return $total;
            }

            return max(0, (int) array_sum(array_column($matrix, 'qty')));
        }

        $fromLots = $this->totalSellableQty($product->id, null, null);
        if ($fromLots > 0) {
            return $fromLots;
        }

        return max(0, (int) ($product->stock ?? 0));
    }

    public function syncLotTiersForVariant(int $productId, ?string $size, ?string $color): void
    {
        $lots = $this->variantLotsQuery($productId, $size, $color)
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();

        if ($lots->isEmpty()) {
            return;
        }

        if ($lots->count() === 1) {
            $only = $lots->first();
            if ($only && $only->lot_tier !== InventoryLot::TIER_NEWER) {
                $only->lot_tier = InventoryLot::TIER_NEWER;
                $only->save();
            }

            return;
        }

        $maxReceived = $lots->filter(fn (InventoryLot $lot) => $lot->received_at !== null)
            ->max('received_at');

        foreach ($lots as $lot) {
            $tier = InventoryLot::TIER_OLDER;
            if ($maxReceived !== null && $lot->received_at !== null && $lot->received_at->equalTo($maxReceived)) {
                $tier = InventoryLot::TIER_NEWER;
            }

            if ($lot->lot_tier !== $tier) {
                $lot->lot_tier = $tier;
                $lot->save();
            }
        }
    }

    public function resolveUnitPrice(InventoryLot $lot, ?Product $product = null): float
    {
        $product ??= $lot->product;
        $standard = round((float) ($product?->price ?? 0), 2);

        return match ($lot->price_rule) {
            InventoryLot::PRICE_FOLLOW_STANDARD => $standard,
            InventoryLot::PRICE_PERCENT_OF_STANDARD => round(
                $standard * ((float) ($lot->price_percent ?? 100) / 100),
                2
            ),
            InventoryLot::PRICE_PERCENT_OFF_LOT => round(
                (float) ($lot->unit_price ?? 0) * ((float) ($lot->price_percent ?? 100) / 100),
                2
            ),
            default => round((float) ($lot->unit_price ?? $standard), 2),
        };
    }

    /**
     * @return array{percent_off: float, compare_price: float, sale_price: float, source: string}|null
     */
    public function lotDiscountMeta(InventoryLot $lot): ?array
    {
        $lot->loadMissing('product');

        if (! in_array($lot->price_rule, [
            InventoryLot::PRICE_PERCENT_OFF_LOT,
            InventoryLot::PRICE_PERCENT_OF_STANDARD,
        ], true) || $lot->price_percent === null) {
            return null;
        }

        $percentOff = round(100 - (float) $lot->price_percent, 2);
        if ($percentOff <= 0) {
            return null;
        }

        $compare = $lot->price_rule === InventoryLot::PRICE_PERCENT_OFF_LOT
            ? round((float) $lot->unit_price, 2)
            : round((float) ($lot->product?->price ?? 0), 2);
        $sale = round($this->resolveUnitPrice($lot), 2);

        if ($compare <= $sale) {
            return null;
        }

        return [
            'percent_off' => $percentOff,
            'compare_price' => $compare,
            'sale_price' => $sale,
            'source' => $lot->price_rule === InventoryLot::PRICE_PERCENT_OFF_LOT ? 'lot' : 'standard',
        ];
    }

    /**
     * @return array{percent_off: float, compare_price: float, sale_price: float, source: string}|null
     */
    public function storefrontLotDiscountMeta(Product $product, ?string $size = null, ?string $color = null): ?array
    {
        $lot = $this->firstSellableLot($product, $size, $color);

        return $lot ? $this->lotDiscountMeta($lot) : null;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createLot(array $data): InventoryLot
    {
        $product = Product::query()->findOrFail((int) $data['product_id']);
        $listingStatus = $this->normalizeListingStatus($data['listing_status'] ?? InventoryLot::LISTING_ACTIVE);
        $priceRule = $this->normalizePriceRule($data['price_rule'] ?? InventoryLot::PRICE_FIXED);
        $qty = max(0, (int) ($data['quantity_on_hand'] ?? $data['quantity_received'] ?? 0));

        $lotNumber = trim((string) ($data['lot_number'] ?? ''));
        if ($lotNumber === '') {
            $lotNumber = $this->generateLotNumber($product);
        }

        $barcode = trim((string) ($data['barcode'] ?? ''));
        if ($barcode === '') {
            $barcode = $this->generateBarcode(
                $product,
                $listingStatus,
                $data['size'] ?? null,
                $data['color'] ?? null,
            );
        }

        $unitPrice = array_key_exists('unit_price', $data) && $data['unit_price'] !== null
            ? round((float) $data['unit_price'], 2)
            : round((float) ($product->price ?? 0), 2);

        $lot = InventoryLot::create([
            'product_id' => $product->id,
            'sku' => $data['sku'] ?? $product->sku,
            'size' => $data['size'] ?? null,
            'color' => $data['color'] ?? null,
            'lot_number' => $lotNumber,
            'season' => $data['season'] ?? null,
            'collection_code' => $data['collection_code'] ?? null,
            'listing_status' => $listingStatus,
            'lot_tier' => InventoryLot::TIER_NEWER,
            'quantity_on_hand' => $qty,
            'quantity_received' => max($qty, (int) ($data['quantity_received'] ?? $qty)),
            'unit_cost' => round((float) ($data['unit_cost'] ?? $product->cost_price ?? 0), 2),
            'unit_price' => $unitPrice,
            'price_rule' => $priceRule,
            'price_percent' => $data['price_percent'] ?? null,
            'barcode' => $barcode,
            'is_sellable' => (bool) ($data['is_sellable'] ?? true),
            'purchase_order_item_id' => $data['purchase_order_item_id'] ?? null,
            'stock_received_id' => $data['stock_received_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'received_at' => $data['received_at'] ?? now(),
        ]);

        $this->syncLotTiersForVariant($product->id, $lot->size, $lot->color);
        $this->afterLotMutation($lot);

        return $lot->fresh();
    }

    public function createFromPurchaseReceive(
        Product $product,
        PurchaseOrderItem $item,
        int $qty,
        float $unitCost,
        ?int $stockReceivedId = null,
        string $listingStatus = InventoryLot::LISTING_ACTIVE,
    ): InventoryLot {
        $sellPrice = $item->sell_price !== null
            ? round((float) $item->sell_price, 2)
            : round((float) ($product->price ?? 0), 2);

        return $this->createLot([
            'product_id' => $product->id,
            'size' => $item->size,
            'color' => $item->color,
            'listing_status' => $listingStatus,
            'quantity_on_hand' => $qty,
            'quantity_received' => $qty,
            'unit_cost' => $unitCost,
            'unit_price' => $sellPrice,
            'price_rule' => InventoryLot::PRICE_FIXED,
            'purchase_order_item_id' => $item->id,
            'stock_received_id' => $stockReceivedId,
            'received_at' => now(),
            'notes' => 'Created from purchase order receive.',
        ]);
    }

    /**
     * @return Collection<int, InventoryLot>
     */
    public function listForVariant(int $productId, ?string $size, ?string $color): Collection
    {
        return InventoryLot::query()
            ->where('product_id', $productId)
            ->when($size !== null && $size !== '', fn ($q) => $q->where('size', $size))
            ->when($color !== null && $color !== '', fn ($q) => $q->where('color', $color))
            ->with([
                'latestPriceEvent.user:id,name,email',
                'latestDetailEvent.user:id,name,email',
            ])
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * @return array<string, int>
     */
    public function summaryForVariant(int $productId, ?string $size, ?string $color): array
    {
        $lots = $this->listForVariant($productId, $size, $color);
        $summary = [
            'total_on_hand' => 0,
            'active' => 0,
            'clearance' => 0,
            'on_hold' => 0,
            'discontinued' => 0,
            'older' => 0,
            'newer' => 0,
        ];

        foreach ($lots as $lot) {
            $qty = max(0, (int) $lot->quantity_on_hand);
            $summary['total_on_hand'] += $qty;
            $key = $lot->listing_status;
            if (isset($summary[$key])) {
                $summary[$key] += $qty;
            }
            $tier = (string) ($lot->lot_tier ?? InventoryLot::TIER_NEWER);
            if (isset($summary[$tier])) {
                $summary[$tier] += $qty;
            }
        }

        return $summary;
    }

    /**
     * On-hand qty and stock value for a variant — inventory lots are authoritative when present.
     * `on_hand` = sellable units (matches Active lots in the lots table).
     *
     * @return array{on_hand: int, total_on_hand: int, stock_value: float, uses_lots: bool}
     */
    public function variantStockFigures(
        int $productId,
        ?string $size,
        ?string $color,
        int $matrixQty,
        float $fallbackUnitCost,
    ): array {
        $lots = $this->listForVariant($productId, $size, $color);
        if ($lots->isEmpty()) {
            $onHand = max(0, $matrixQty);

            return [
                'on_hand' => $onHand,
                'total_on_hand' => $onHand,
                'stock_value' => round($fallbackUnitCost * $onHand, 2),
                'uses_lots' => false,
            ];
        }

        $totalOnHand = 0;
        $stockValue = 0.0;
        foreach ($lots as $lot) {
            $qty = max(0, (int) $lot->quantity_on_hand);
            $totalOnHand += $qty;
            $stockValue += round((float) ($lot->unit_cost ?? 0), 2) * $qty;
        }

        $sellable = $this->totalSellableQty($productId, $size, $color);

        return [
            'on_hand' => $sellable,
            'total_on_hand' => $totalOnHand,
            'stock_value' => round($stockValue, 2),
            'uses_lots' => true,
        ];
    }

    public function syncVariantMatrixQtyFromLots(Product $product, ?string $size, ?string $color): void
    {
        if (! ProductVariantInventory::usesMatrix($product)) {
            return;
        }

        $size = trim((string) ($size ?? ''));
        $color = trim((string) ($color ?? ''));
        if ($size === '' || $color === '') {
            return;
        }

        $lots = $this->listForVariant($product->id, $size, $color);
        if ($lots->isEmpty()) {
            return;
        }

        $total = (int) $lots->sum(fn (InventoryLot $lot) => max(0, (int) $lot->quantity_on_hand));

        $matrix = $product->variant_matrix;
        if (! is_array($matrix)) {
            return;
        }

        $updated = false;
        foreach ($matrix as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            $rc = trim((string) ($row['color'] ?? ''));
            $rs = trim((string) ($row['size'] ?? ''));
            if (strcasecmp($rc, $color) === 0 && strcasecmp($rs, $size) === 0) {
                if ((int) ($row['qty'] ?? 0) !== $total) {
                    $matrix[$i]['qty'] = $total;
                    $updated = true;
                }
                break;
            }
        }

        if (! $updated) {
            return;
        }

        $product->variant_matrix = $matrix;
        $product->stock = ProductVariantInventory::totalMatrixQty($product);
        $product->save();
    }

    public function markClearance(InventoryLot $lot, ?float $unitPrice = null, ?float $pricePercent = null): InventoryLot
    {
        $lot->loadMissing('product');
        $wasClearance = $lot->listing_status === InventoryLot::LISTING_CLEARANCE;
        $lot->listing_status = InventoryLot::LISTING_CLEARANCE;
        $lot->is_sellable = true;
        if ((int) $lot->quantity_on_hand <= 0) {
            $lot->is_sellable = false;
        }
        if ($unitPrice !== null) {
            $lot->unit_price = round($unitPrice, 2);
            $lot->price_rule = InventoryLot::PRICE_FIXED;
            $lot->price_percent = null;
        } elseif ($pricePercent !== null) {
            $lot->price_percent = round($pricePercent, 2);
            $lot->price_rule = InventoryLot::PRICE_PERCENT_OF_STANDARD;
        }
        if (! $wasClearance) {
            $lot->barcode = $this->generateBarcode(
                $lot->product,
                InventoryLot::LISTING_CLEARANCE,
                $lot->size,
                $lot->color,
                $lot->id,
            );
        }
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    public function revertFromClearance(InventoryLot $lot): InventoryLot
    {
        if ($lot->listing_status !== InventoryLot::LISTING_CLEARANCE) {
            return $lot;
        }

        $lot->loadMissing('product');
        $lot->listing_status = InventoryLot::LISTING_ACTIVE;
        $lot->is_sellable = (int) $lot->quantity_on_hand > 0;
        $lot->barcode = $this->generateBarcode(
            $lot->product,
            InventoryLot::LISTING_ACTIVE,
            $lot->size,
            $lot->color,
            $lot->id,
        );
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    public function setOnHold(InventoryLot $lot): InventoryLot
    {
        $lot->loadMissing('product');

        if ($lot->listing_status !== InventoryLot::LISTING_ON_HOLD) {
            if (! in_array($lot->listing_status, [InventoryLot::LISTING_DISCONTINUED], true)) {
                $lot->notes = $this->stashHoldReturnStatus($lot->notes, (string) $lot->listing_status);
            }
            $lot->listing_status = InventoryLot::LISTING_ON_HOLD;
            $lot->barcode = $this->generateBarcode(
                $lot->product,
                InventoryLot::LISTING_ON_HOLD,
                $lot->size,
                $lot->color,
                $lot->id,
            );
        }

        $lot->is_sellable = false;
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    public function releaseFromHold(InventoryLot $lot): InventoryLot
    {
        $lot->loadMissing('product');

        if ($lot->listing_status === InventoryLot::LISTING_ON_HOLD) {
            [$notes, $restore] = $this->popHoldReturnStatus($lot->notes);
            $lot->notes = $notes;
            $restore = $restore ?? InventoryLot::LISTING_ACTIVE;
            if ($restore === 'new_arrival' || ! in_array($restore, InventoryLot::LISTING_STATUSES, true)) {
                $restore = InventoryLot::LISTING_ACTIVE;
            }
            $lot->listing_status = $restore;
            $lot->barcode = $this->generateBarcode(
                $lot->product,
                $restore,
                $lot->size,
                $lot->color,
                $lot->id,
            );
        }

        $lot->is_sellable = (int) $lot->quantity_on_hand > 0;
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    /**
     * Apply a % discount off this lot's own sell price (e.g. 20% off $100 → $80).
     */
    public function applyLotDiscount(InventoryLot $lot, float $discountPercentOff): InventoryLot
    {
        $lot->loadMissing('product');
        $discountPercentOff = max(0, min(100, round($discountPercentOff, 2)));

        $baseline = $lot->price_rule === InventoryLot::PRICE_PERCENT_OFF_LOT
            ? round((float) $lot->unit_price, 2)
            : round($this->resolveUnitPrice($lot), 2);

        $lot->unit_price = $baseline;
        $lot->price_rule = InventoryLot::PRICE_PERCENT_OFF_LOT;
        $lot->price_percent = round(100 - $discountPercentOff, 2);
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    public function clearLotDiscount(InventoryLot $lot): InventoryLot
    {
        if (! in_array($lot->price_rule, [
            InventoryLot::PRICE_PERCENT_OFF_LOT,
            InventoryLot::PRICE_PERCENT_OF_STANDARD,
        ], true)) {
            return $lot;
        }

        $lot->loadMissing('product');
        $resolved = $this->resolveUnitPrice($lot);
        $lot->price_rule = InventoryLot::PRICE_FIXED;
        $lot->price_percent = null;
        $lot->unit_price = $resolved;
        $lot->save();
        $this->afterLotMutation($lot->fresh());

        return $lot->fresh();
    }

    /**
     * @return array{rows: \Illuminate\Support\Collection, summary: array<string, array{on_hand: int, received: int, sold: int, lot_count: int}>}
     */
    public function catalog(
        ?string $listingStatus = null,
        ?string $search = null,
        int $perPage = 50,
        int $page = 1,
        bool $inStockOnly = false,
        ?string $fromDate = null,
        ?string $toDate = null,
        ?string $lotTier = null,
    ): array {
        $baseQuery = InventoryLot::query()->with('product');
        $this->applyCatalogSearch($baseQuery, $search);
        $this->applyCatalogReceivedDateRange($baseQuery, $fromDate, $toDate);
        $this->applyCatalogLotTier($baseQuery, $lotTier);

        $summary = $this->buildCatalogSummary((clone $baseQuery)->get());

        $rowsQuery = clone $baseQuery;
        $rowsQuery->orderByDesc('received_at')->orderByDesc('id');

        if ($listingStatus !== null && $listingStatus !== '' && $listingStatus !== 'all') {
            $rowsQuery->where('listing_status', $listingStatus);
        }

        if ($inStockOnly) {
            $rowsQuery->where('quantity_on_hand', '>', 0);
        }

        $paginator = $rowsQuery->paginate(max(1, min(200, $perPage)), ['*'], 'page', max(1, $page));
        $pageLots = $paginator->getCollection();
        $sellsNextIds = $this->sellsNextLotIdsForLots($pageLots);

        return [
            'rows' => $pageLots->map(function (InventoryLot $lot) use ($sellsNextIds) {
                $mapped = $this->mapCatalogLot($lot);
                $mapped['sells_next'] = isset($sellsNextIds[$lot->id]);
                $mapped['is_sold_out'] = (int) $lot->quantity_on_hand <= 0;

                return $mapped;
            }),
            'summary' => $summary,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'sell_old_first' => $this->sellOldFirst(),
        ];
    }

    private function applyCatalogReceivedDateRange($query, ?string $fromDate, ?string $toDate): void
    {
        $from = trim((string) ($fromDate ?? ''));
        $to = trim((string) ($toDate ?? ''));

        if ($from !== '') {
            $query->whereDate('received_at', '>=', $from);
        }

        if ($to !== '') {
            $query->whereDate('received_at', '<=', $to);
        }
    }

    private function applyCatalogLotTier($query, ?string $lotTier): void
    {
        $tier = trim((string) ($lotTier ?? ''));
        if ($tier === '' || $tier === 'all') {
            return;
        }

        if (in_array($tier, InventoryLot::LOT_TIERS, true)) {
            $query->where('lot_tier', $tier);
        }
    }

    private function applyCatalogSearch($query, ?string $search): void
    {
        $search = trim((string) ($search ?? ''));
        if ($search === '') {
            return;
        }

        $like = '%'.$search.'%';
        $query->where(function ($q) use ($like, $search) {
            $q->where('lot_number', 'like', $like)
                ->orWhere('barcode', 'like', $like)
                ->orWhere('season', 'like', $like)
                ->orWhere('sku', 'like', $like)
                ->orWhere('size', 'like', $like)
                ->orWhere('color', 'like', $like)
                ->orWhereHas('product', function ($pq) use ($like) {
                    $pq->where('name', 'like', $like)
                        ->orWhere('sku', 'like', $like);
                });
            if (ctype_digit($search)) {
                $q->orWhere('product_id', (int) $search);
            }
        });
    }

    /**
     * @param  \Illuminate\Support\Collection<int, InventoryLot>  $lots
     * @return array<string, array{on_hand: int, received: int, sold: int, lot_count: int}>
     */
    public function buildCatalogSummary($lots): array
    {
        $summary = [];
        foreach (InventoryLot::LISTING_STATUSES as $status) {
            $summary[$status] = [
                'on_hand' => 0,
                'received' => 0,
                'sold' => 0,
                'lot_count' => 0,
            ];
        }
        $summary['all'] = [
            'on_hand' => 0,
            'received' => 0,
            'sold' => 0,
            'lot_count' => 0,
        ];

        foreach ($lots as $lot) {
            $onHand = max(0, (int) $lot->quantity_on_hand);
            $received = max(0, (int) $lot->quantity_received);
            $sold = max(0, $received - $onHand);
            $status = (string) $lot->listing_status;

            if (! isset($summary[$status])) {
                $summary[$status] = [
                    'on_hand' => 0,
                    'received' => 0,
                    'sold' => 0,
                    'lot_count' => 0,
                ];
            }

            $summary[$status]['on_hand'] += $onHand;
            $summary[$status]['received'] += $received;
            $summary[$status]['sold'] += $sold;
            $summary[$status]['lot_count'] += 1;

            $summary['all']['on_hand'] += $onHand;
            $summary['all']['received'] += $received;
            $summary['all']['sold'] += $sold;
            $summary['all']['lot_count'] += 1;
        }

        return $summary;
    }

    public function mapCatalogLot(InventoryLot $lot): array
    {
        $lot->loadMissing('product');
        $received = max(0, (int) $lot->quantity_received);
        $onHand = max(0, (int) $lot->quantity_on_hand);
        $mapped = $this->mapLot($lot);

        return array_merge($mapped, [
            'product_name' => $lot->product?->name,
            'quantity_sold' => max(0, $received - $onHand),
            'is_available_for_sale' => $lot->isAvailableForSale(),
            'is_sold_out' => $onHand <= 0,
        ]);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, InventoryLot>  $lots
     * @return array<int, array{sells_next: bool, sell_order: int|null}>
     */
    public function sellOrderFlagsForLots(Collection $lots): array
    {
        $flags = [];
        $sellOldFirst = $this->sellOldFirst();
        $sorter = fn (InventoryLot $lot) => sprintf(
            '%012d-%012d',
            $lot->received_at?->getTimestamp() ?? 0,
            $lot->id,
        );

        $grouped = $lots->groupBy(fn (InventoryLot $lot) => $this->variantGroupKey(
            (int) $lot->product_id,
            $lot->size,
            $lot->color,
        ));

        foreach ($grouped as $variantLots) {
            $sellable = $variantLots->filter(fn (InventoryLot $lot) => $lot->isAvailableForSale());
            $ordered = $sellOldFirst
                ? $sellable->sortBy($sorter)->values()
                : $sellable->sortByDesc($sorter)->values();

            foreach ($ordered as $index => $lot) {
                $flags[$lot->id] = [
                    'sells_next' => $index === 0,
                    'sell_order' => $index + 1,
                ];
            }
        }

        return $flags;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, InventoryLot>  $lots
     * @return array<int, true>
     */
    public function sellsNextLotIdsForLots(Collection $lots): array
    {
        $ids = [];
        $seenVariants = [];

        foreach ($lots as $lot) {
            $key = $this->variantGroupKey((int) $lot->product_id, $lot->size, $lot->color);
            if (isset($seenVariants[$key])) {
                continue;
            }
            $seenVariants[$key] = true;
            $product = $lot->relationLoaded('product') ? $lot->product : Product::query()->find($lot->product_id);
            if (! $product) {
                continue;
            }
            $next = $this->firstSellableLot($product, $lot->size, $lot->color);
            if ($next) {
                $ids[$next->id] = true;
            }
        }

        return $ids;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function storefrontPreviewForVariant(int $productId, ?string $size, ?string $color): ?array
    {
        $product = Product::query()->find($productId);
        if (! $product) {
            return null;
        }

        $lot = $this->firstSellableLot($product, $size, $color);
        if (! $lot) {
            return [
                'has_stock' => false,
                'sell_old_first' => $this->sellOldFirst(),
            ];
        }

        return [
            'has_stock' => true,
            'unit_price' => $this->resolveUnitPrice($lot, $product),
            'lot_id' => (int) $lot->id,
            'lot_number' => (string) $lot->lot_number,
            'quantity_on_hand' => (int) $lot->quantity_on_hand,
            'lot_tier' => (string) ($lot->lot_tier ?? InventoryLot::TIER_NEWER),
            'listing_status' => (string) $lot->listing_status,
            'sell_old_first' => $this->sellOldFirst(),
        ];
    }

    /**
     * Product-catalog mirror: aggregate next sellable lot pricing across variants.
     *
     * @return array{
     *     cost_per_unit: float,
     *     sell_price: float,
     *     cost_min: float|null,
     *     cost_max: float|null,
     *     sell_min: float|null,
     *     sell_max: float|null,
     *     source: string,
     *     variant_label: string|null,
     *     varies_by_variant: bool,
     * }
     */
    public function catalogPricingFromLots(Product $product): array
    {
        $product->refresh();
        $matrix = ProductVariantInventory::matrixRows($product);
        $variants = [];

        if ($matrix !== []) {
            foreach ($matrix as $row) {
                $size = (string) ($row['size'] ?? '');
                $color = (string) ($row['color'] ?? '');
                if ($this->totalSellableQty($product->id, $size, $color) <= 0) {
                    continue;
                }
                $hints = $this->variantPricingHints($product, $size, $color);
                if ($hints['source'] !== 'inventory_lot') {
                    continue;
                }
                $variants[] = [
                    'size' => $size,
                    'color' => $color,
                    'cost' => $hints['cost_per_unit'],
                    'sell' => $hints['sell_price'],
                ];
            }
        }

        if ($variants === []) {
            $hints = $this->variantPricingHints($product, null, null);

            return [
                'cost_per_unit' => $hints['cost_per_unit'],
                'sell_price' => $hints['sell_price'],
                'cost_min' => null,
                'cost_max' => null,
                'sell_min' => null,
                'sell_max' => null,
                'source' => $hints['source'],
                'variant_label' => null,
                'varies_by_variant' => false,
            ];
        }

        $costs = array_column($variants, 'cost');
        $sells = array_column($variants, 'sell');
        $costMin = round((float) min($costs), 2);
        $costMax = round((float) max($costs), 2);
        $sellMin = round((float) min($sells), 2);
        $sellMax = round((float) max($sells), 2);
        $varies = count(array_unique($sells)) > 1 || count(array_unique($costs)) > 1;
        $first = $variants[0];

        return [
            'cost_per_unit' => $costMin,
            'sell_price' => $sellMin,
            'cost_min' => $costMin,
            'cost_max' => $costMax,
            'sell_min' => $sellMin,
            'sell_max' => $sellMax,
            'source' => 'inventory_lot',
            'variant_label' => $varies ? null : trim($first['size'].' · '.$first['color'], ' ·'),
            'varies_by_variant' => $varies,
        ];
    }

    /**
     * @return array{
     *     cost_per_unit: float,
     *     sell_price: float,
     *     source: string,
     * }
     */
    public function variantPricingHints(Product $product, ?string $size, ?string $color): array
    {
        $product->refresh();
        $lot = $this->firstSellableLot($product, $size, $color);
        if ($lot) {
            return [
                'cost_per_unit' => round((float) ($lot->unit_cost ?? 0), 2),
                'sell_price' => round($this->resolveUnitPrice($lot, $product), 2),
                'source' => 'inventory_lot',
            ];
        }

        return [
            'cost_per_unit' => round((float) ($product->cost_price ?? 0), 2),
            'sell_price' => round((float) ($product->price ?? 0), 2),
            'source' => 'catalog',
        ];
    }

    /** Mirror next sellable lot pricing onto product catalog (PO pre-fill, Products list). */
    public function syncProductCatalogFromVariantNextLot(Product $product, ?string $size, ?string $color): void
    {
        unset($size, $color);
        $this->syncProductCatalogFromLots($product);
    }

    public function syncProductCatalogFromLots(Product $product): void
    {
        $pricing = $this->catalogPricingFromLots($product);
        if ($pricing['source'] !== 'inventory_lot') {
            return;
        }

        $product->cost_price = $pricing['cost_per_unit'];
        $product->price = $pricing['sell_price'];
        $product->save();
    }

    public function afterLotMutation(InventoryLot $lot): void
    {
        $lot->loadMissing('product');
        $product = $lot->product;
        if (! $product instanceof Product) {
            return;
        }

        $this->syncProductCatalogFromLots($product);
        $this->syncVariantMatrixQtyFromLots($product, $lot->size, $lot->color);
    }

    private function variantGroupKey(int $productId, ?string $size, ?string $color): string
    {
        return implode('|', [
            $productId,
            trim((string) ($size ?? '')),
            trim((string) ($color ?? '')),
        ]);
    }

    public function mapLot(InventoryLot $lot): array
    {
        $lot->loadMissing('product');

        return [
            'id' => $lot->id,
            'product_id' => $lot->product_id,
            'sku' => $lot->sku,
            'size' => $lot->size,
            'color' => $lot->color,
            'lot_number' => $lot->lot_number,
            'season' => $lot->season,
            'collection_code' => $lot->collection_code,
            'listing_status' => $lot->listing_status,
            'lot_tier' => $lot->lot_tier ?? InventoryLot::TIER_NEWER,
            'quantity_on_hand' => (int) $lot->quantity_on_hand,
            'quantity_received' => (int) $lot->quantity_received,
            'unit_cost' => round((float) $lot->unit_cost, 2),
            'unit_price' => round((float) $lot->unit_price, 2),
            'resolved_unit_price' => $this->resolveUnitPrice($lot),
            'standard_unit_price' => round((float) ($lot->product?->price ?? 0), 2),
            'price_rule' => $lot->price_rule,
            'price_percent' => $lot->price_percent !== null ? round((float) $lot->price_percent, 2) : null,
            'discount_base_unit_price' => in_array($lot->price_rule, [
                InventoryLot::PRICE_PERCENT_OFF_LOT,
                InventoryLot::PRICE_PERCENT_OF_STANDARD,
            ], true)
                ? ($lot->price_rule === InventoryLot::PRICE_PERCENT_OFF_LOT
                    ? round((float) $lot->unit_price, 2)
                    : round((float) ($lot->product?->price ?? 0), 2))
                : null,
            'discount_percent_off' => in_array($lot->price_rule, [
                InventoryLot::PRICE_PERCENT_OFF_LOT,
                InventoryLot::PRICE_PERCENT_OF_STANDARD,
            ], true) && $lot->price_percent !== null
                ? round(100 - (float) $lot->price_percent, 2)
                : null,
            'barcode' => $lot->barcode,
            'is_sellable' => (bool) $lot->is_sellable,
            'received_at' => $lot->received_at?->toIso8601String(),
            'notes' => $lot->notes,
        ];
    }

    public function displayNameForLot(InventoryLot $lot): string
    {
        $lot->loadMissing('product');
        $name = (string) ($lot->product?->name ?? 'Item');
        $parts = array_filter([$lot->color, $lot->size]);
        if ($parts !== []) {
            $name .= ' · '.implode(' / ', $parts);
        }
        $statusLabel = match ($lot->listing_status) {
            InventoryLot::LISTING_CLEARANCE => 'Clearance',
            InventoryLot::LISTING_ON_HOLD => 'On Hold',
            InventoryLot::LISTING_DISCONTINUED => 'Discontinued',
            default => 'Active',
        };

        return $name.' ['.$statusLabel.']';
    }

    private function variantLotsQuery(int $productId, ?string $size, ?string $color): Builder
    {
        return InventoryLot::query()
            ->where('product_id', $productId)
            ->when(
                $size !== null && $size !== '',
                fn ($q) => $q->where('size', $size),
                fn ($q) => $q->where(function ($q2) {
                    $q2->whereNull('size')->orWhere('size', '');
                }),
            )
            ->when(
                $color !== null && $color !== '',
                fn ($q) => $q->where('color', $color),
                fn ($q) => $q->where(function ($q2) {
                    $q2->whereNull('color')->orWhere('color', '');
                }),
            );
    }

    /**
     * @return Collection<int, InventoryLot>
     */
    private function orderedSellableLots(int $productId, ?string $size, ?string $color): Collection
    {
        $lots = InventoryLot::query()
            ->where('product_id', $productId)
            ->where('is_sellable', true)
            ->where('quantity_on_hand', '>', 0)
            ->whereNotIn('listing_status', [
                InventoryLot::LISTING_ON_HOLD,
                InventoryLot::LISTING_DISCONTINUED,
            ])
            ->get()
            ->filter(fn (InventoryLot $lot) => $this->variantMatches($lot, $size, $color));

        $sorter = fn (InventoryLot $lot) => sprintf(
            '%012d-%012d',
            $lot->received_at?->getTimestamp() ?? 0,
            $lot->id,
        );

        return $this->sellOldFirst()
            ? $lots->sortBy($sorter)->values()
            : $lots->sortByDesc($sorter)->values();
    }

    /**
     * Receive a customer return into quarantine (on_hold, not sellable).
     */
    public function receiveCustomerReturn(
        Product $product,
        ?string $size,
        ?string $color,
        int $qty,
        ?int $sourceLotId = null,
        ?string $note = null,
    ): InventoryLot {
        $qty = max(1, $qty);

        $lot = InventoryLot::query()
            ->where('product_id', $product->id)
            ->where('listing_status', InventoryLot::LISTING_ON_HOLD)
            ->where('is_sellable', false)
            ->get()
            ->first(fn (InventoryLot $candidate) => $this->variantMatches($candidate, $size, $color));

        if (! $lot) {
            $sourceLot = $sourceLotId
                ? InventoryLot::query()->find($sourceLotId)
                : null;

            $lot = $this->createLot([
                'product_id' => $product->id,
                'size' => $size,
                'color' => $color,
                'sku' => $sourceLot?->sku ?? $product->sku,
                'listing_status' => InventoryLot::LISTING_ON_HOLD,
                'is_sellable' => false,
                'quantity_on_hand' => 0,
                'quantity_received' => 0,
                'unit_cost' => $sourceLot?->unit_cost ?? $product->cost_price ?? 0,
                'unit_price' => 0,
                'notes' => trim(($note ?: 'Customer return quarantine').($sourceLot?->lot_number ? " · from {$sourceLot->lot_number}" : '')),
            ]);
        }

        $lot->quantity_on_hand = (int) $lot->quantity_on_hand + $qty;
        $lot->quantity_received = (int) $lot->quantity_received + $qty;
        if ($note) {
            $lot->notes = trim((string) $lot->notes."\n".$note);
        }
        $lot->save();

        if ($product->stock !== null) {
            $product->update([
                'stock' => (int) $product->stock + $qty,
            ]);
        }

        ProductVariantInventory::incrementVariantMatrix(
            $product,
            $color,
            $size,
            $qty,
        );

        return $lot->fresh();
    }

    private function decrementLot(InventoryLot $lot, int $qty): void
    {
        $lot->quantity_on_hand = max(0, (int) $lot->quantity_on_hand - $qty);
        $lot->save();
    }

    /**
     * @return array{inventory_lot_id: int, qty: int, unit_price: float, unit_cost: float, listing_status: string}
     */
    private function allocationRow(InventoryLot $lot, int $qty): array
    {
        return [
            'inventory_lot_id' => (int) $lot->id,
            'qty' => $qty,
            'unit_price' => $this->resolveUnitPrice($lot),
            'unit_cost' => round((float) $lot->unit_cost, 2),
            'listing_status' => (string) $lot->listing_status,
            'lot_tier' => (string) ($lot->lot_tier ?? ''),
            'lot_number' => (string) ($lot->lot_number ?? ''),
        ];
    }

    private function variantMatches(InventoryLot $lot, ?string $size, ?string $color): bool
    {
        $wantSize = trim((string) ($size ?? ''));
        $wantColor = trim((string) ($color ?? ''));
        $haveSize = trim((string) ($lot->size ?? ''));
        $haveColor = trim((string) ($lot->color ?? ''));

        if ($wantSize !== '' && $haveSize !== '' && strcasecmp($haveSize, $wantSize) !== 0) {
            return false;
        }

        return $this->colorsMatch($wantColor, $haveColor);
    }

    private function colorsMatch(string $wantColor, string $haveColor): bool
    {
        if ($wantColor === '' || $haveColor === '') {
            return true;
        }
        if (strcasecmp($wantColor, $haveColor) === 0) {
            return true;
        }
        if (strlen($wantColor) === 1 && strcasecmp($wantColor, substr($haveColor, 0, 1)) === 0) {
            return true;
        }
        if (strlen($haveColor) === 1 && strcasecmp($haveColor, substr($wantColor, 0, 1)) === 0) {
            return true;
        }

        return false;
    }

    private function stashHoldReturnStatus(?string $notes, string $listingStatus): string
    {
        $clean = $this->stripHoldReturnFromNotes($notes);
        $status = strtolower(trim($listingStatus));
        if (! in_array($status, InventoryLot::LISTING_STATUSES, true) || $status === InventoryLot::LISTING_ON_HOLD) {
            $status = InventoryLot::LISTING_ACTIVE;
        }

        return trim($clean."\n[hold_return:{$status}]");
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    private function popHoldReturnStatus(?string $notes): array
    {
        $raw = (string) ($notes ?? '');
        if (! preg_match('/\[hold_return:([a-z_]+)\]/', $raw, $matches)) {
            return [$raw, null];
        }

        $status = $matches[1] ?? null;
        $clean = trim(preg_replace('/\s*\[hold_return:[a-z_]+\]\s*/', '', $raw) ?? $raw);

        return [$clean, $status];
    }

    private function stripHoldReturnFromNotes(?string $notes): string
    {
        return trim(preg_replace('/\s*\[hold_return:[a-z_]+\]\s*/', '', (string) ($notes ?? '')) ?? '');
    }

    private function generateLotNumber(Product $product): string
    {
        do {
            $candidate = 'LOT-'.$product->id.'-'.now()->format('ymdHis').'-'.strtoupper(Str::random(4));
        } while (InventoryLot::query()->where('lot_number', $candidate)->exists());

        return $candidate;
    }

    private function generateBarcode(
        Product $product,
        string $listingStatus,
        ?string $size,
        ?string $color,
        ?int $excludeLotId = null,
    ): string {
        $base = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($product->sku ?: 'P'.$product->id)) ?: 'P'.$product->id);
        $sizeCode = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', (string) ($size ?? '')) ?: 'OS', 0, 4));
        $colorCode = strtoupper(substr(preg_replace('/[^A-Z0-9]/', '', (string) ($color ?? '')) ?: 'XX', 0, 4));
        $suffix = match ($listingStatus) {
            InventoryLot::LISTING_CLEARANCE => 'CLR',
            InventoryLot::LISTING_ON_HOLD => 'HLD',
            default => 'ACT',
        };

        $candidate = 'BAR-'.$base.'-'.$sizeCode.'-'.$colorCode.'-'.$suffix;
        $i = 1;
        while (
            InventoryLot::query()
                ->when($excludeLotId, fn ($q) => $q->where('id', '!=', $excludeLotId))
                ->where('barcode', $candidate)
                ->exists()
        ) {
            $candidate = 'BAR-'.$base.'-'.$sizeCode.'-'.$colorCode.'-'.$suffix.'-'.$i;
            $i++;
        }

        return $candidate;
    }

    private function normalizeListingStatus(string $status): string
    {
        $status = strtolower(trim($status));
        if (! in_array($status, InventoryLot::LISTING_STATUSES, true)) {
            throw ValidationException::withMessages([
                'listing_status' => ['Invalid listing status.'],
            ]);
        }

        return $status;
    }

    private function normalizePriceRule(string $rule): string
    {
        $rule = strtolower(trim($rule));
        if (! in_array($rule, InventoryLot::PRICE_RULES, true)) {
            throw ValidationException::withMessages([
                'price_rule' => ['Invalid price rule.'],
            ]);
        }

        return $rule;
    }
}
