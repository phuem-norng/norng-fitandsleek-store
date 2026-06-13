<?php

namespace App\Services;

use App\Models\InventoryLot;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\PurchaseOrderItem;

class StockMovementDetailService
{
    /**
     * @return array{purchase: ?array<string, mixed>, sale: ?array<string, mixed>}
     */
    public function resolve(
        Product $product,
        ?string $size,
        ?string $color,
        ?string $purchaseRef,
        ?string $saleRef,
    ): array {
        return [
            'purchase' => $purchaseRef !== null && $purchaseRef !== ''
                ? $this->resolvePurchase($product, $size, $color, $purchaseRef)
                : null,
            'sale' => $saleRef !== null && $saleRef !== ''
                ? $this->resolveSale($product, $size, $color, $saleRef)
                : null,
        ];
    }

    /**
     * @return ?array<string, mixed>
     */
    private function resolvePurchase(
        Product $product,
        ?string $size,
        ?string $color,
        string $purchaseRef,
    ): ?array {
        $item = PurchaseOrderItem::query()
            ->with(['purchaseOrder.supplier'])
            ->where('product_id', $product->id)
            ->whereHas('purchaseOrder', fn ($q) => $q->where('po_number', $purchaseRef))
            ->get()
            ->first(fn (PurchaseOrderItem $row) => $this->variantMatches($row->size, $row->color, $size, $color));

        if (! $item) {
            return null;
        }

        $order = $item->purchaseOrder;
        $lot = InventoryLot::query()
            ->where('purchase_order_item_id', $item->id)
            ->first();

        return [
            'po_number' => $order?->po_number,
            'order_date' => $order?->order_date?->format('Y-m-d'),
            'received_at' => $order?->received_at?->toIso8601String(),
            'status' => $order?->status,
            'supplier' => $order?->supplier?->name,
            'purchaser' => $order?->purchaser,
            'notes' => $order?->notes,
            'qty' => (int) $item->qty,
            'cost_per_unit' => round((float) $item->cost_per_unit, 2),
            'sell_price' => $item->sell_price !== null ? round((float) $item->sell_price, 2) : null,
            'line_total_cost' => $item->line_total_cost !== null ? round((float) $item->line_total_cost, 2) : null,
            'size' => $item->size,
            'color' => $item->color,
            'stock_received' => $lot ? [
                'inventory_lot_id' => (int) $lot->id,
                'lot_number' => $lot->lot_number,
                'lot_tier' => $lot->lot_tier,
                'listing_status' => $lot->listing_status,
                'barcode' => $lot->barcode,
                'quantity_received' => (int) $lot->quantity_received,
                'quantity_on_hand' => (int) $lot->quantity_on_hand,
                'unit_cost' => round((float) $lot->unit_cost, 2),
                'unit_price' => $lot->unit_price !== null ? round((float) $lot->unit_price, 2) : null,
            ] : null,
        ];
    }

    /**
     * @return ?array<string, mixed>
     */
    private function resolveSale(
        Product $product,
        ?string $size,
        ?string $color,
        string $saleRef,
    ): ?array {
        $order = Order::query()
            ->with(['user:id,name,email'])
            ->where('order_number', $saleRef)
            ->first();

        if (! $order) {
            return null;
        }

        $items = OrderItem::query()
            ->with('inventoryLot:id,lot_number,lot_tier,listing_status,barcode')
            ->where('order_id', $order->id)
            ->where('product_id', $product->id)
            ->get()
            ->filter(fn (OrderItem $item) => $this->variantMatches($item->size, $item->color, $size, $color))
            ->values();

        if ($items->isEmpty()) {
            return null;
        }

        $qty = (int) $items->sum(fn (OrderItem $item) => (int) $item->qty);
        $lineTotal = round((float) $items->sum(fn (OrderItem $item) => (float) $item->line_total), 2);
        $unitPrice = $qty > 0
            ? round($lineTotal / $qty, 2)
            : round((float) ($items->first()->price ?? 0), 2);

        $channel = (string) ($order->sale_channel ?? 'website');
        $isPos = $channel === 'pos';

        return [
            'order_number' => $order->order_number,
            'channel' => $channel,
            'channel_label' => $isPos ? 'Point of Sale' : 'Website',
            'sold_at' => $order->created_at?->toIso8601String(),
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'seller' => $isPos && $order->user ? [
                'id' => (int) $order->user->id,
                'name' => (string) $order->user->name,
                'email' => (string) $order->user->email,
            ] : null,
            'customer' => ! $isPos && $order->user ? [
                'id' => (int) $order->user->id,
                'name' => (string) $order->user->name,
                'email' => (string) $order->user->email,
            ] : null,
            'qty' => $qty,
            'unit_price' => $unitPrice,
            'line_total' => $lineTotal,
            'receipt_no' => is_array($order->pos_meta) ? ($order->pos_meta['receipt_no'] ?? null) : null,
            'stock_deductions' => $items->map(fn (OrderItem $item) => [
                'order_item_id' => (int) $item->id,
                'qty' => (int) $item->qty,
                'unit_price' => round((float) $item->price, 2),
                'line_total' => round((float) $item->line_total, 2),
                'unit_cost_at_sale' => $item->unit_cost_at_sale !== null ? round((float) $item->unit_cost_at_sale, 2) : null,
                'inventory_lot_id' => $item->inventory_lot_id ? (int) $item->inventory_lot_id : null,
                'lot_number' => $item->lot_number_at_sale
                    ?? $item->inventoryLot?->lot_number,
                'lot_tier' => $item->lot_tier_at_sale
                    ?? $item->inventoryLot?->lot_tier,
                'listing_status_at_sale' => $item->listing_status_at_sale
                    ?? $item->inventoryLot?->listing_status,
                'barcode' => $item->inventoryLot?->barcode,
                'line_name' => $item->name,
            ])->values()->all(),
        ];
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
}
