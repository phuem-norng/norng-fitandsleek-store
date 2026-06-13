<?php

namespace App\Services;

use App\Models\InventoryLot;
use App\Models\Order;
use App\Models\OrderItem;

class OrderItemLotAllocation
{
    /**
     * Expand one scanned / cart line into order rows — one row per inventory lot consumed.
     *
     * @param  array<string, mixed>  $lookupRow
     * @param  array<int, array<string, mixed>>  $allocations
     * @return array<int, array<string, mixed>>
     */
    public static function expandSnapshotLine(array $lookupRow, int $qty, array $allocations): array
    {
        $baseName = (string) ($lookupRow['name'] ?? 'Item');
        $code = (string) ($lookupRow['code'] ?? '');

        if ($allocations === []) {
            return [[
                'code' => $code,
                'name' => $baseName,
                'qty' => $qty,
                'unit_price' => round((float) ($lookupRow['price'] ?? 0), 2),
                'inventory_lot_id' => $lookupRow['inventory_lot_id'] ?? null,
                'unit_cost_at_sale' => null,
                'listing_status_at_sale' => $lookupRow['listing_status'] ?? null,
                'lot_tier_at_sale' => null,
                'lot_number_at_sale' => null,
            ]];
        }

        $lines = [];
        foreach ($allocations as $alloc) {
            $lines[] = [
                'code' => $code,
                'name' => self::lineName($baseName, $alloc),
                'qty' => (int) ($alloc['qty'] ?? 0),
                'unit_price' => round((float) ($alloc['unit_price'] ?? 0), 2),
                'inventory_lot_id' => $alloc['inventory_lot_id'] ?? null,
                'unit_cost_at_sale' => $alloc['unit_cost'] ?? null,
                'listing_status_at_sale' => $alloc['listing_status'] ?? null,
                'lot_tier_at_sale' => $alloc['lot_tier'] ?? null,
                'lot_number_at_sale' => $alloc['lot_number'] ?? null,
            ];
        }

        return $lines;
    }

    /**
     * After payment: persist one order_item row per lot allocation (keeps stock tiers visible on the order).
     *
     * @param  array<int, array<string, mixed>>  $allocations
     */
    public static function splitPaidOrderItem(OrderItem $item, array $allocations): void
    {
        if ($allocations === []) {
            return;
        }

        $baseName = self::stripLotSuffix((string) ($item->name ?? 'Item'));
        $first = array_shift($allocations);
        self::applyAllocationToItem($item, $first, $baseName);

        foreach ($allocations as $alloc) {
            $qty = (int) ($alloc['qty'] ?? 0);
            $price = round((float) ($alloc['unit_price'] ?? 0), 2);

            OrderItem::create([
                'order_id' => $item->order_id,
                'product_id' => $item->product_id,
                'inventory_lot_id' => $alloc['inventory_lot_id'] ?? null,
                'size' => $item->size,
                'color' => $item->color,
                'name' => self::lineName($baseName, $alloc),
                'sku' => $item->sku,
                'price' => $price,
                'unit_cost_at_sale' => $alloc['unit_cost'] ?? null,
                'listing_status_at_sale' => $alloc['listing_status'] ?? null,
                'lot_tier_at_sale' => $alloc['lot_tier'] ?? null,
                'lot_number_at_sale' => $alloc['lot_number'] ?? null,
                'qty' => $qty,
                'line_total' => round($price * $qty, 2),
            ]);
        }

        self::recalculateOrderTotals((int) $item->order_id);
    }

    public static function recalculateOrderTotals(int $orderId): void
    {
        $order = Order::query()->with('items')->find($orderId);
        if (! $order) {
            return;
        }

        $subtotal = round((float) $order->items->sum(fn (OrderItem $row) => (float) $row->line_total), 2);
        $discount = round((float) ($order->discount ?? 0), 2);
        $shipping = round((float) ($order->shipping ?? 0), 2);

        $order->update([
            'subtotal' => $subtotal,
            'total' => max(round($subtotal - $discount + $shipping, 2), 0),
        ]);
    }

    /**
     * @param  array<string, mixed>  $alloc
     */
    public static function lineName(string $baseName, array $alloc): string
    {
        $tier = trim((string) ($alloc['lot_tier'] ?? ''));
        $tierLabel = match ($tier) {
            InventoryLot::TIER_OLDER => 'Older stock',
            InventoryLot::TIER_NEWER => 'Newer stock',
            default => null,
        };

        if ($tierLabel !== null) {
            return "{$baseName} · {$tierLabel}";
        }

         $lotNumber = trim((string) ($alloc['lot_number'] ?? ''));
        if ($lotNumber !== '') {
            return "{$baseName} · {$lotNumber}";
        }

        return $baseName;
    }

    /**
     * @param  array<string, mixed>  $alloc
     */
    private static function applyAllocationToItem(OrderItem $item, array $alloc, string $baseName): void
    {
        $qty = (int) ($alloc['qty'] ?? 0);
        $price = round((float) ($alloc['unit_price'] ?? 0), 2);

        $item->update([
            'qty' => $qty,
            'price' => $price,
            'line_total' => round($price * $qty, 2),
            'name' => self::lineName($baseName, $alloc),
            'inventory_lot_id' => $alloc['inventory_lot_id'] ?? null,
            'unit_cost_at_sale' => $alloc['unit_cost'] ?? null,
            'listing_status_at_sale' => $alloc['listing_status'] ?? null,
            'lot_tier_at_sale' => $alloc['lot_tier'] ?? null,
            'lot_number_at_sale' => $alloc['lot_number'] ?? null,
        ]);
    }

    private static function stripLotSuffix(string $name): string
    {
        return trim((string) preg_replace('/\s·\s(Older stock|Newer stock|LOT-[^\s·]+)\s*$/u', '', $name));
    }
}
