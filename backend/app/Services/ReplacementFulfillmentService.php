<?php

namespace App\Services;

use App\Models\InventoryLot;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReplacementCase;
use App\Models\ReplacementCaseItem;
use App\Models\Shipment;
use App\Models\ShipmentTrackingEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReplacementFulfillmentService
{
    public function __construct(
        private InventoryLotService $inventoryLots,
    ) {
    }

    /**
     * @param  array<int>  $returnItemIds  replacement_case_item IDs where customer returns defective goods
     * @param  array<int, array{order_item_id:int, quantity?:int, requested_size?:string|null, requested_color?:string|null, customer_returning?:bool}>  $fulfillmentItems
     */
    public function completeCase(
        ReplacementCase $case,
        User $handler,
        ?string $notes = null,
        array $returnItemIds = [],
        array $fulfillmentItems = [],
    ): ReplacementCase {
        if ($case->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => ['Only approved replacement cases can be completed.'],
            ]);
        }

        if ($case->replacement_order_id) {
            throw ValidationException::withMessages([
                'replacement_order_id' => ['This case already has a replacement order.'],
            ]);
        }

        $case->loadMissing([
            'order.user',
            'order.items.product',
            'items.orderItem.product',
        ]);

        $this->attachLegacyItemsIfNeeded($case, $fulfillmentItems);

        if ($case->items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => ['Select at least one product from the order to fulfill.'],
            ]);
        }

        $returnItemIdSet = $this->resolveReturnItemIds($case, $returnItemIds, $fulfillmentItems);

        return DB::transaction(function () use ($case, $handler, $notes, $returnItemIdSet) {
            $originalOrder = $case->order;
            if (! $originalOrder) {
                throw ValidationException::withMessages([
                    'order' => ['Original order not found for this case.'],
                ]);
            }

            $replacementOrder = Order::create([
                'user_id' => $originalOrder->user_id,
                'parent_order_id' => $originalOrder->id,
                'replacement_case_id' => $case->id,
                'sale_channel' => 'replacement',
                'order_number' => $this->generateOrderNumber(),
                'status' => 'processing',
                'payment_status' => 'paid',
                'payment_method' => $originalOrder->payment_method,
                'subtotal' => 0,
                'shipping' => 0,
                'discount' => 0,
                'total' => 0,
                'shipping_address' => $originalOrder->shipping_address,
                'billing_address' => $originalOrder->billing_address,
                'pos_meta' => [
                    'replacement_case_id' => $case->id,
                    'original_order_id' => $originalOrder->id,
                    'original_order_number' => $originalOrder->order_number,
                ],
            ]);

            foreach ($case->items as $caseItem) {
                $this->fulfillCaseItem(
                    $caseItem,
                    $replacementOrder,
                    isset($returnItemIdSet[(int) $caseItem->id]),
                    $case->id,
                );
            }

            Payment::create([
                'order_id' => $replacementOrder->id,
                'provider' => 'replacement',
                'amount' => 0,
                'currency' => config('services.bakong.currency', 'USD'),
                'method' => 'replacement',
                'status' => 'paid',
            ]);

            $replacementOrder->load('items.product');
            foreach ($replacementOrder->items as $orderItem) {
                PaidOrderInventory::applyPaidLineItem($orderItem);
            }

            $this->createShipment($replacementOrder);

            $case->update([
                'status' => 'completed',
                'replacement_order_id' => $replacementOrder->id,
                'completed_at' => now(),
                'completed_by' => $handler->id,
                'handled_by' => $handler->id,
                'notes' => $notes ?? $case->notes,
            ]);

            return $case->fresh()->load(ReplacementCaseService::defaultEagerLoad());
        });
    }

    private function fulfillCaseItem(
        ReplacementCaseItem $caseItem,
        Order $replacementOrder,
        bool $customerReturning,
        int $caseId,
    ): void {
        $orderItem = $caseItem->orderItem;
        $product = $orderItem?->product;
        if (! $orderItem || ! $product) {
            throw ValidationException::withMessages([
                'items' => ['Replacement item is missing product data.'],
            ]);
        }

        $qty = (int) $caseItem->quantity;
        $alreadyReplaced = $this->replacedQtyForOrderItem((int) $orderItem->id, $caseId);
        $maxQty = (int) ($orderItem->qty ?? 1) - $alreadyReplaced;

        if ($qty < 1 || $qty > $maxQty) {
            throw ValidationException::withMessages([
                'items' => ["Invalid replacement quantity for {$orderItem->name}. Max available: {$maxQty}."],
            ]);
        }

        $size = $caseItem->requested_size ?: $orderItem->size;
        $color = $caseItem->requested_color ?: $orderItem->color;

        $allocations = $this->inventoryLots->consumeForSale($product, $size, $color, $qty);

        $this->createReplacementOrderItems(
            $replacementOrder,
            $product,
            $size,
            $color,
            (string) ($orderItem->name ?? $product->name),
            (string) ($orderItem->sku ?? $product->sku ?? ''),
            $allocations,
        );

        $primaryLotId = (int) ($allocations[0]['inventory_lot_id'] ?? 0);

        $returnLotId = null;
        $returnedQty = null;
        if ($customerReturning) {
            $returnLot = $this->inventoryLots->receiveCustomerReturn(
                $product,
                $orderItem->size,
                $orderItem->color,
                $qty,
                $orderItem->inventory_lot_id ? (int) $orderItem->inventory_lot_id : null,
                "Replacement case #{$caseId} customer return",
            );
            $returnLotId = $returnLot->id;
            $returnedQty = $qty;
        }

        $caseItem->update([
            'fulfillment_lot_id' => $primaryLotId ?: null,
            'return_lot_id' => $returnLotId,
            'returned_qty' => $returnedQty,
        ]);
    }

    /**
     * @param  array<int, array{order_item_id:int, quantity?:int, requested_size?:string|null, requested_color?:string|null, customer_returning?:bool}>  $fulfillmentItems
     */
    private function attachLegacyItemsIfNeeded(ReplacementCase $case, array $fulfillmentItems): void
    {
        if ($case->items->isNotEmpty() || $fulfillmentItems === []) {
            return;
        }

        $order = $case->order;
        if (! $order) {
            throw ValidationException::withMessages([
                'order' => ['Original order not found for this case.'],
            ]);
        }

        $orderItemIds = $order->items->pluck('id')->map(fn ($id) => (int) $id)->all();

        foreach ($fulfillmentItems as $item) {
            $orderItemId = (int) ($item['order_item_id'] ?? 0);
            if (! in_array($orderItemId, $orderItemIds, true)) {
                throw ValidationException::withMessages([
                    'fulfillment_items' => ['One or more products do not belong to the original order.'],
                ]);
            }

            $orderItem = $order->items->firstWhere('id', $orderItemId);
            $maxQty = (int) ($orderItem->qty ?? 1);
            $qty = isset($item['quantity']) ? (int) $item['quantity'] : $maxQty;

            if ($qty < 1 || $qty > $maxQty) {
                throw ValidationException::withMessages([
                    'fulfillment_items' => ["Invalid quantity for {$orderItem->name}."],
                ]);
            }

            $case->items()->create([
                'order_item_id' => $orderItemId,
                'quantity' => $qty,
                'requested_size' => $item['requested_size'] ?? null,
                'requested_color' => $item['requested_color'] ?? null,
            ]);
        }

        $case->load('items.orderItem.product');
    }

    /**
     * @param  array<int>  $returnItemIds
     * @param  array<int, array{order_item_id:int, customer_returning?:bool}>  $fulfillmentItems
     * @return array<int, true>
     */
    private function resolveReturnItemIds(ReplacementCase $case, array $returnItemIds, array $fulfillmentItems): array
    {
        if ($returnItemIds !== []) {
            return array_fill_keys(array_map('intval', $returnItemIds), true);
        }

        $returnByOrderItem = [];
        foreach ($fulfillmentItems as $item) {
            if (! empty($item['customer_returning'])) {
                $returnByOrderItem[(int) $item['order_item_id']] = true;
            }
        }

        if ($returnByOrderItem === []) {
            return [];
        }

        $resolved = [];
        foreach ($case->items as $caseItem) {
            $orderItemId = (int) ($caseItem->order_item_id ?? 0);
            if (isset($returnByOrderItem[$orderItemId])) {
                $resolved[(int) $caseItem->id] = true;
            }
        }

        return $resolved;
    }

    /**
     * @param  array<int, array<string, mixed>>  $allocations
     */
    private function createReplacementOrderItems(
        Order $order,
        Product $product,
        ?string $size,
        ?string $color,
        string $baseName,
        string $sku,
        array $allocations,
    ): void {
        foreach ($allocations as $alloc) {
            $lineQty = (int) ($alloc['qty'] ?? 0);
            if ($lineQty <= 0) {
                continue;
            }

            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'inventory_lot_id' => $alloc['inventory_lot_id'] ?? null,
                'size' => $size,
                'color' => $color,
                'name' => OrderItemLotAllocation::lineName($baseName, $alloc),
                'sku' => $sku,
                'price' => 0,
                'unit_cost_at_sale' => $alloc['unit_cost'] ?? null,
                'listing_status_at_sale' => $alloc['listing_status'] ?? null,
                'lot_tier_at_sale' => $alloc['lot_tier'] ?? null,
                'lot_number_at_sale' => $alloc['lot_number'] ?? null,
                'qty' => $lineQty,
                'line_total' => 0,
            ]);
        }
    }

    private function createShipment(Order $order): void
    {
        if ($order->shipment) {
            return;
        }

        $trackingCode = 'TRK-'.strtoupper(Str::random(10));

        $shipment = Shipment::create([
            'order_id' => $order->id,
            'provider' => 'Internal',
            'tracking_code' => $trackingCode,
            'status' => 'pending',
        ]);

        ShipmentTrackingEvent::create([
            'shipment_id' => $shipment->id,
            'status' => 'pending',
            'note' => 'Replacement order confirmed. Preparing for shipment.',
            'event_time' => now(),
        ]);
    }

    private function replacedQtyForOrderItem(int $orderItemId, int $excludeCaseId): int
    {
        return (int) ReplacementCaseItem::query()
            ->where('order_item_id', $orderItemId)
            ->whereHas('replacementCase', function ($query) use ($excludeCaseId) {
                $query->where('status', 'completed')
                    ->where('id', '!=', $excludeCaseId);
            })
            ->sum('quantity');
    }

    private function generateOrderNumber(): string
    {
        return 'ORD-'.now()->format('Y').'-'.strtoupper(Str::random(6));
    }
}
