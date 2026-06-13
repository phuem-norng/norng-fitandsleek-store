<?php

namespace App\Services;

use App\Models\InventoryLot;
use App\Models\InventoryLotPriceEvent;

class InventoryLotPriceAuditService
{
    public function __construct(
        private readonly InventoryLotService $lots,
    ) {
    }

    /**
     * @return array{
     *     resolved_unit_price: float,
     *     listing_status: string,
     *     price_rule: string,
     *     discount_percent_off: float|null,
     * }
     */
    public function snapshot(InventoryLot $lot): array
    {
        $lot->loadMissing('product');

        $discountOff = null;
        if (in_array($lot->price_rule, [
            InventoryLot::PRICE_PERCENT_OFF_LOT,
            InventoryLot::PRICE_PERCENT_OF_STANDARD,
        ], true) && $lot->price_percent !== null) {
            $discountOff = round(100 - (float) $lot->price_percent, 2);
        }

        return [
            'resolved_unit_price' => $this->lots->resolveUnitPrice($lot),
            'listing_status' => (string) $lot->listing_status,
            'price_rule' => (string) $lot->price_rule,
            'discount_percent_off' => $discountOff,
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        InventoryLot $lot,
        ?int $userId,
        string $action,
        array $before,
        array $after,
        array $metadata = [],
    ): InventoryLotPriceEvent {
        $discountOff = $after['discount_percent_off'] ?? $before['discount_percent_off'] ?? null;
        if (in_array($action, [
            InventoryLotPriceEvent::ACTION_REMOVE_LOT_DISCOUNT,
            InventoryLotPriceEvent::ACTION_REVERT_CLEARANCE,
        ], true)) {
            $discountOff = null;
        }

        return InventoryLotPriceEvent::create([
            'inventory_lot_id' => $lot->id,
            'user_id' => $userId,
            'action' => $action,
            'unit_price_before' => $before['resolved_unit_price'] ?? null,
            'unit_price_after' => $after['resolved_unit_price'] ?? null,
            'listing_status_before' => $before['listing_status'] ?? null,
            'listing_status_after' => $after['listing_status'] ?? null,
            'price_rule_before' => $before['price_rule'] ?? null,
            'price_rule_after' => $after['price_rule'] ?? null,
            'discount_percent_off' => $discountOff,
            'metadata' => $metadata !== [] ? $metadata : null,
        ]);
    }

    public function formatEvent(InventoryLotPriceEvent $event): array
    {
        $event->loadMissing(['user:id,name,email', 'lot:id,lot_number']);

        return [
            'id' => $event->id,
            'inventory_lot_id' => $event->inventory_lot_id,
            'lot_number' => $event->lot?->lot_number,
            'action' => $event->action,
            'action_label' => $this->actionLabel($event->action),
            'unit_price_before' => $event->unit_price_before !== null ? round((float) $event->unit_price_before, 2) : null,
            'unit_price_after' => $event->unit_price_after !== null ? round((float) $event->unit_price_after, 2) : null,
            'listing_status_before' => $event->listing_status_before,
            'listing_status_after' => $event->listing_status_after,
            'discount_percent_off' => $event->discount_percent_off !== null ? round((float) $event->discount_percent_off, 2) : null,
            'admin' => $event->user ? [
                'id' => (int) $event->user->id,
                'name' => (string) $event->user->name,
                'email' => (string) $event->user->email,
            ] : null,
            'created_at' => $event->created_at?->toIso8601String(),
        ];
    }

    public function actionLabel(string $action): string
    {
        return match ($action) {
            InventoryLotPriceEvent::ACTION_MARK_CLEARANCE => 'Marked as clearance',
            InventoryLotPriceEvent::ACTION_UPDATE_CLEARANCE => 'Updated clearance price',
            InventoryLotPriceEvent::ACTION_REVERT_CLEARANCE => 'Reverted to active',
            InventoryLotPriceEvent::ACTION_APPLY_LOT_DISCOUNT => 'Applied lot discount',
            InventoryLotPriceEvent::ACTION_UPDATE_LOT_DISCOUNT => 'Updated lot discount',
            InventoryLotPriceEvent::ACTION_REMOVE_LOT_DISCOUNT => 'Removed lot discount',
            InventoryLotPriceEvent::ACTION_UPDATE_SKU_PRICING => 'Updated from SKU pricing',
            default => ucfirst(str_replace('_', ' ', $action)),
        };
    }
}
