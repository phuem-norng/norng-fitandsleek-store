<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ReplacementCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReplacementCaseService
{
    /**
     * @param  array<int, array{order_item_id:int, quantity?:int, requested_size?:string|null, requested_color?:string|null, note?:string|null}>  $items
     */
    public function createCase(Order $order, string $reason, ?string $notes, array $items): ReplacementCase
    {
        $this->validateItemsBelongToOrder($order, $items);

        return DB::transaction(function () use ($order, $reason, $notes, $items) {
            $case = ReplacementCase::create([
                'order_id' => $order->id,
                'reason' => $reason,
                'notes' => $notes,
                'status' => 'pending',
            ]);

            foreach ($items as $item) {
                $orderItem = OrderItem::findOrFail((int) $item['order_item_id']);
                $maxQty = (int) ($orderItem->qty ?? 1);
                $qty = isset($item['quantity']) ? (int) $item['quantity'] : $maxQty;

                if ($qty < 1 || $qty > $maxQty) {
                    throw ValidationException::withMessages([
                        'items' => ["Invalid quantity for item: {$orderItem->name}."],
                    ]);
                }

                $case->items()->create([
                    'order_item_id' => $orderItem->id,
                    'quantity' => $qty,
                    'requested_size' => $item['requested_size'] ?? null,
                    'requested_color' => $item['requested_color'] ?? null,
                    'note' => $item['note'] ?? null,
                ]);
            }

            return $case->load(['items.orderItem.product', 'order.user']);
        });
    }

    /**
     * @param  array<int, array{order_item_id:int}>  $items
     */
    private function validateItemsBelongToOrder(Order $order, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages([
                'items' => ['Select at least one product to replace.'],
            ]);
        }

        $orderItemIds = $order->items()->pluck('id')->all();
        foreach ($items as $item) {
            $orderItemId = (int) ($item['order_item_id'] ?? 0);
            if (! in_array($orderItemId, $orderItemIds, true)) {
                throw ValidationException::withMessages([
                    'items' => ['One or more selected items do not belong to this order.'],
                ]);
            }
        }
    }

    public static function defaultEagerLoad(): array
    {
        return [
            'order:id,user_id,order_number,total,status,created_at',
            'order.user:id,name,email',
            'items.orderItem.product:id,name,image_url,slug',
            'handledBy:id,name',
        ];
    }
}
