<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\OrderItem;
use App\Models\Product;
use App\Models\PurchaseOrderItem;
use App\Services\InventoryLotService;
use App\Services\ProductVariantInventory;
use App\Services\StockMovementDetailService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StockInventoryAdminController extends BaseAdminController
{
    private const LOW_STOCK_THRESHOLD = 5;

    public function __construct(
        private readonly InventoryLotService $inventoryLots,
        private readonly StockMovementDetailService $movementDetail,
    ) {
    }

    private function colorCode(string $color): string
    {
        $color = trim($color);
        if ($color === '') {
            return 'XX';
        }
        $parts = preg_split('/\s+/', $color) ?: [];
        if (count($parts) >= 2) {
            return strtoupper(substr($parts[0], 0, 1).substr($parts[1], 0, 1));
        }

        return strtoupper(substr($color, 0, 2));
    }

    private function variantSku(Product $product, string $size, string $color, ?string $skuBarcode): string
    {
        if ($skuBarcode !== null && trim($skuBarcode) !== '') {
            return trim($skuBarcode);
        }

        $base = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($product->sku ?: 'P'.$product->id)) ?: 'P'.$product->id);
        $sizeCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $size) ?: 'OS');
        if (strlen($sizeCode) > 4) {
            $sizeCode = substr($sizeCode, 0, 4);
        }

        return $base.'-'.$sizeCode.'-'.$this->colorCode($color);
    }

    private function stockStatus(int $qty): string
    {
        if ($qty <= 0) {
            return 'Out of stock';
        }
        if ($qty <= self::LOW_STOCK_THRESHOLD) {
            return 'Low stock';
        }

        return 'In stock';
    }

    private function parseDateOnly(?string $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }
        try {
            return Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    private function eventInDateRange(string $eventDate, ?string $from, ?string $to): bool
    {
        if ($from !== null && $from !== '' && $eventDate < $from) {
            return false;
        }
        if ($to !== null && $to !== '' && $eventDate > $to) {
            return false;
        }

        return true;
    }

    private function variantMatches(?string $itemSize, ?string $itemColor, ?string $size, ?string $color): bool
    {
        $wantSize = trim((string) ($size ?? ''));
        $wantColor = trim((string) ($color ?? ''));
        $haveSize = trim((string) ($itemSize ?? ''));
        $haveColor = trim((string) ($itemColor ?? ''));

        if ($wantSize !== '' && strcasecmp($haveSize, $wantSize) !== 0) {
            return false;
        }
        if ($wantColor !== '' && strcasecmp($haveColor, $wantColor) !== 0) {
            return false;
        }

        return true;
    }

    private function variantActivityKey(int $productId, ?string $size, ?string $color): string
    {
        return $productId.'|'.strtolower(trim((string) ($size ?? ''))).'|'.strtolower(trim((string) ($color ?? '')));
    }

    /**
     * @return array<string, true>|null null = no date filter
     */
    private function activeVariantKeysInDateRange(?string $from, ?string $to): ?array
    {
        if ($from === null && $to === null) {
            return null;
        }

        $keys = [];

        $poItems = PurchaseOrderItem::query()
            ->whereNotNull('product_id')
            ->whereHas('purchaseOrder', function ($q) use ($from, $to) {
                if ($from !== null) {
                    $q->whereDate('order_date', '>=', $from);
                }
                if ($to !== null) {
                    $q->whereDate('order_date', '<=', $to);
                }
            })
            ->get(['product_id', 'size', 'color']);

        foreach ($poItems as $item) {
            $keys[$this->variantActivityKey((int) $item->product_id, $item->size, $item->color)] = true;
        }

        $orderItems = OrderItem::query()
            ->whereNotNull('product_id')
            ->whereHas('order', function ($q) use ($from, $to) {
                $q->where(function ($inner) {
                    $inner->where('payment_status', 'paid')
                        ->orWhereIn('status', ['paid', 'completed', 'delivered', 'processing']);
                });
                if ($from !== null) {
                    $q->whereDate('created_at', '>=', $from);
                }
                if ($to !== null) {
                    $q->whereDate('created_at', '<=', $to);
                }
            })
            ->get(['product_id', 'size', 'color']);

        foreach ($orderItems as $item) {
            $keys[$this->variantActivityKey((int) $item->product_id, $item->size, $item->color)] = true;
        }

        return $keys;
    }

    /**
     * Latest purchase or sale date per variant (optionally scoped to from/to).
     *
     * @return array<string, string> variant key => Y-m-d
     */
    private function lastActivityDatesByVariant(?string $from, ?string $to): array
    {
        $dates = [];

        $merge = function (int $productId, ?string $size, ?string $color, ?string $date) use (&$dates): void {
            if ($date === null || $date === '') {
                return;
            }
            $key = $this->variantActivityKey($productId, $size, $color);
            if (! isset($dates[$key]) || $date > $dates[$key]) {
                $dates[$key] = $date;
            }
        };

        $poItems = PurchaseOrderItem::query()
            ->with('purchaseOrder:id,order_date,created_at')
            ->whereNotNull('product_id')
            ->whereHas('purchaseOrder', function ($q) use ($from, $to) {
                if ($from !== null) {
                    $q->whereDate('order_date', '>=', $from);
                }
                if ($to !== null) {
                    $q->whereDate('order_date', '<=', $to);
                }
            })
            ->get(['product_id', 'size', 'color', 'purchase_order_id']);

        foreach ($poItems as $item) {
            $order = $item->purchaseOrder;
            $merge(
                (int) $item->product_id,
                $item->size,
                $item->color,
                $order?->order_date?->format('Y-m-d') ?? $order?->created_at?->format('Y-m-d'),
            );
        }

        $orderItems = OrderItem::query()
            ->with('order:id,created_at')
            ->whereNotNull('product_id')
            ->whereHas('order', function ($q) use ($from, $to) {
                $q->where(function ($inner) {
                    $inner->where('payment_status', 'paid')
                        ->orWhereIn('status', ['paid', 'completed', 'delivered', 'processing']);
                });
                if ($from !== null) {
                    $q->whereDate('created_at', '>=', $from);
                }
                if ($to !== null) {
                    $q->whereDate('created_at', '<=', $to);
                }
            })
            ->get(['product_id', 'size', 'color', 'order_id']);

        foreach ($orderItems as $item) {
            $merge(
                (int) $item->product_id,
                $item->size,
                $item->color,
                $item->order?->created_at?->format('Y-m-d'),
            );
        }

        return $dates;
    }

    public function movements(Request $request, Product $product)
    {
        $size = $request->input('size');
        $color = $request->input('color');
        $size = $size !== null && $size !== '' ? (string) $size : null;
        $color = $color !== null && $color !== '' ? (string) $color : null;

        $events = [];

        $poItems = PurchaseOrderItem::query()
            ->with('purchaseOrder')
            ->where('product_id', $product->id)
            ->get();

        foreach ($poItems as $item) {
            if (! $this->variantMatches($item->size, $item->color, $size, $color)) {
                continue;
            }
            $order = $item->purchaseOrder;
            $events[] = [
                'date' => $order?->order_date?->format('Y-m-d') ?? $order?->created_at?->format('Y-m-d'),
                'type' => 'Purchase',
                'qty_in' => (int) $item->qty,
                'qty_out' => null,
                'cost_per_unit' => round((float) $item->cost_per_unit, 2),
                'sell_per_unit' => round((float) $item->sell_price, 2) ?: null,
                'ref' => $order?->po_number,
            ];
        }

        $sales = OrderItem::query()
            ->with('order')
            ->where('product_id', $product->id)
            ->whereHas('order', function ($q) {
                $q->where(function ($inner) {
                    $inner->where('payment_status', 'paid')
                        ->orWhereIn('status', ['paid', 'completed', 'delivered', 'processing']);
                });
            })
            ->get();

        foreach ($sales as $item) {
            if (! $this->variantMatches($item->size, $item->color, $size, $color)) {
                continue;
            }
            $order = $item->order;
            $qty = (int) ($item->qty ?? 0);
            if ($qty <= 0) {
                continue;
            }
            $unitSell = round((float) ($item->price ?? 0), 2);
            $events[] = [
                'date' => $order?->created_at?->format('Y-m-d'),
                'type' => 'Sale',
                'qty_in' => null,
                'qty_out' => $qty,
                'cost_per_unit' => null,
                'sell_per_unit' => $unitSell > 0 ? $unitSell : null,
                'ref' => $order?->order_number ? (string) $order->order_number : ('SO-'.$order?->id),
            ];
        }

        $fromDate = $this->parseDateOnly($request->input('from_date'));
        $toDate = $this->parseDateOnly($request->input('to_date'));
        if ($fromDate !== null || $toDate !== null) {
            $events = array_values(array_filter(
                $events,
                fn (array $event) => $this->eventInDateRange(
                    (string) ($event['date'] ?? ''),
                    $fromDate,
                    $toDate,
                ),
            ));
        }

        usort($events, function ($a, $b) {
            $da = (string) ($a['date'] ?? '');
            $db = (string) ($b['date'] ?? '');
            if ($da === $db) {
                return strcmp((string) ($a['type'] ?? ''), (string) ($b['type'] ?? ''));
            }

            return strcmp($da, $db);
        });

        $balance = 0;
        foreach ($events as &$event) {
            $balance += (int) ($event['qty_in'] ?? 0);
            $balance -= (int) ($event['qty_out'] ?? 0);
            $event['balance'] = max(0, $balance);
        }
        unset($event);

        return response()->json(['data' => $events]);
    }

    public function movementDetail(Request $request, Product $product)
    {
        $validated = $request->validate([
            'size' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:80'],
            'purchase_ref' => ['nullable', 'string', 'max:64'],
            'sale_ref' => ['nullable', 'string', 'max:64'],
        ]);

        $size = $validated['size'] ?? null;
        $color = $validated['color'] ?? null;
        $size = $size !== null && $size !== '' ? (string) $size : null;
        $color = $color !== null && $color !== '' ? (string) $color : null;

        $purchaseRef = trim((string) ($validated['purchase_ref'] ?? ''));
        $saleRef = trim((string) ($validated['sale_ref'] ?? ''));

        if ($purchaseRef === '' && $saleRef === '') {
            return response()->json([
                'message' => 'Provide purchase_ref and/or sale_ref.',
            ], 422);
        }

        $detail = $this->movementDetail->resolve(
            $product,
            $size,
            $color,
            $purchaseRef !== '' ? $purchaseRef : null,
            $saleRef !== '' ? $saleRef : null,
        );

        if ($detail['purchase'] === null && $detail['sale'] === null) {
            return response()->json([
                'message' => 'No movement detail found for this SKU and reference.',
            ], 404);
        }

        return response()->json(['data' => $detail]);
    }

    /**
     * @return array{
     *     catalog_sell_price: float,
     *     next_sell_price: float|null,
     *     next_lot_cost: float|null,
     *     sell_price: float,
     *     sell_price_source: string,
     *     next_lot_tier: string|null,
     * }
     */
    private function sellPriceFields(Product $product, ?string $size, ?string $color): array
    {
        $catalogSellPrice = round((float) ($product->price ?? 0), 2);
        $catalogCost = round((float) ($product->cost_price ?? 0), 2);
        $sellableQty = $this->inventoryLots->totalSellableQty($product->id, $size, $color);
        $variantLotOnHand = (int) $this->inventoryLots
            ->listForVariant($product->id, $size, $color)
            ->sum(fn ($lot) => max(0, (int) $lot->quantity_on_hand));

        $firstLot = $sellableQty > 0
            ? $this->inventoryLots->firstSellableLot($product, $size, $color)
            : null;

        if ($firstLot) {
            $nextSellPrice = round($this->inventoryLots->resolveUnitPrice($firstLot, $product), 2);
            $nextLotCost = round((float) ($firstLot->unit_cost ?? $catalogCost), 2);

            return [
                'catalog_sell_price' => $catalogSellPrice,
                'next_sell_price' => $nextSellPrice,
                'next_lot_cost' => $nextLotCost,
                'sell_price' => $nextSellPrice,
                'sell_price_source' => 'inventory_lot',
                'next_lot_tier' => (string) ($firstLot->lot_tier ?? ''),
            ];
        }

        if ($variantLotOnHand > 0 && $sellableQty <= 0) {
            return [
                'catalog_sell_price' => $catalogSellPrice,
                'next_sell_price' => null,
                'next_lot_cost' => null,
                'sell_price' => $catalogSellPrice,
                'sell_price_source' => 'unsellable_lots',
                'next_lot_tier' => null,
            ];
        }

        return [
            'catalog_sell_price' => $catalogSellPrice,
            'next_sell_price' => null,
            'next_lot_cost' => null,
            'sell_price' => $catalogSellPrice,
            'sell_price_source' => 'catalog',
            'next_lot_tier' => null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function rowsForProduct(Product $product): array
    {
        $matrix = ProductVariantInventory::matrixRows($product);

        if ($matrix !== []) {
            $out = [];
            foreach ($matrix as $row) {
                $matrixQty = max(0, (int) ($row['qty'] ?? 0));
                $size = (string) ($row['size'] ?? '');
                $color = (string) ($row['color'] ?? '');
                $sku = $this->variantSku($product, $size, $color, $row['sku_barcode'] ?? null);

                $lotSummary = $this->inventoryLots->summaryForVariant($product->id, $size, $color);
                $sellFields = $this->sellPriceFields($product, $size, $color);
                $variantCost = round(
                    (float) ($sellFields['next_lot_cost'] ?? $product->cost_price ?? 0),
                    2,
                );
                $stockFigures = $this->inventoryLots->variantStockFigures(
                    $product->id,
                    $size,
                    $color,
                    $matrixQty,
                    $variantCost,
                );
                $qty = $stockFigures['on_hand'];
                if ($stockFigures['uses_lots'] && $matrixQty !== $stockFigures['total_on_hand']) {
                    $this->inventoryLots->syncVariantMatrixQtyFromLots($product, $size, $color);
                }

                $out[] = array_merge([
                    'id' => $product->id.'-'.md5(strtolower($color.'|'.$size)),
                    'product_id' => $product->id,
                    'sku' => $sku,
                    'product_name' => $product->name,
                    'size' => $size,
                    'color' => $color,
                    'in_stock' => $qty,
                    'matrix_qty' => $matrixQty,
                    'wac_cost' => $variantCost,
                    'stock_value' => $stockFigures['stock_value'],
                    'status' => $this->stockStatus($qty),
                    'lot_summary' => $lotSummary,
                ], $sellFields);
            }

            return $out;
        }

        $qty = max(0, (int) ($product->stock ?? 0));
        $baseSku = trim((string) ($product->sku ?? ''));
        if ($baseSku === '') {
            $baseSku = 'P-'.$product->id;
        }

        $lotSummary = $this->inventoryLots->summaryForVariant($product->id, null, null);
        $sellFields = $this->sellPriceFields($product, null, null);
        $variantCost = round(
            (float) ($sellFields['next_lot_cost'] ?? $product->cost_price ?? 0),
            2,
        );
        $stockFigures = $this->inventoryLots->variantStockFigures(
            $product->id,
            null,
            null,
            $qty,
            $variantCost,
        );
        $onHand = $stockFigures['on_hand'];

        return [array_merge([
            'id' => (string) $product->id,
            'product_id' => $product->id,
            'sku' => strtoupper($baseSku),
            'product_name' => $product->name,
            'size' => null,
            'color' => null,
            'in_stock' => $onHand,
            'matrix_qty' => $qty,
            'wac_cost' => $variantCost,
            'stock_value' => $stockFigures['stock_value'],
            'status' => $this->stockStatus($onHand),
            'lot_summary' => $lotSummary,
        ], $sellFields)];
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->input('search', ''));
        $fromDate = $this->parseDateOnly($request->input('from_date'));
        $toDate = $this->parseDateOnly($request->input('to_date'));
        $activeVariantKeys = $this->activeVariantKeysInDateRange($fromDate, $toDate);

        $query = Product::query()
            ->where('is_active', true)
            ->orderBy('name');

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                    ->orWhere('sku', 'like', $like)
                    ->orWhere('barcode_code', 'like', $like);
            });
        }

        $products = $query->get();
        $rows = [];
        $lastActivityDates = $this->lastActivityDatesByVariant($fromDate, $toDate);

        foreach ($products as $product) {
            foreach ($this->rowsForProduct($product) as $row) {
                $activityKey = $this->variantActivityKey(
                    (int) $product->id,
                    $row['size'],
                    $row['color'],
                );
                if ($activeVariantKeys !== null && ! isset($activeVariantKeys[$activityKey])) {
                    continue;
                }
                if ($search !== '') {
                    $hay = strtolower(implode(' ', [
                        $row['sku'],
                        $row['product_name'],
                        $row['size'],
                        $row['color'],
                    ]));
                    if (! str_contains($hay, strtolower($search))) {
                        continue;
                    }
                }
                $row['activity_date'] = $lastActivityDates[$activityKey] ?? null;
                $rows[] = $row;
            }
        }

        usort($rows, fn ($a, $b) => strcmp((string) $a['sku'], (string) $b['sku']));

        $totalUnits = array_sum(array_column($rows, 'in_stock'));
        $totalValue = round(array_sum(array_column($rows, 'stock_value')), 2);

        return response()->json([
            'data' => array_values($rows),
            'meta' => [
                'sku_count' => count($rows),
                'total_units' => $totalUnits,
                'total_stock_value' => $totalValue,
            ],
        ]);
    }
}
