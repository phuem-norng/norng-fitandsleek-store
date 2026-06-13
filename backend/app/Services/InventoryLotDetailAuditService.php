<?php

namespace App\Services;

use App\Models\InventoryLot;
use App\Models\InventoryLotDetailEvent;

class InventoryLotDetailAuditService
{
    /** @var list<string> */
    private const DETAIL_FIELDS = [
        'season',
        'collection_code',
        'listing_status',
        'lot_tier',
        'quantity_on_hand',
        'barcode',
        'is_sellable',
        'notes',
        'unit_cost',
    ];

    /**
     * @return array<string, mixed>
     */
    public function snapshot(InventoryLot $lot): array
    {
        return [
            'season' => $lot->season,
            'collection_code' => $lot->collection_code,
            'listing_status' => (string) $lot->listing_status,
            'lot_tier' => (string) ($lot->lot_tier ?? InventoryLot::TIER_NEWER),
            'quantity_on_hand' => (int) $lot->quantity_on_hand,
            'barcode' => $lot->barcode,
            'is_sellable' => (bool) $lot->is_sellable,
            'notes' => $lot->notes,
            'unit_cost' => $lot->unit_cost !== null ? round((float) $lot->unit_cost, 2) : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return list<array{field: string, label: string, before: mixed, after: mixed}>
     */
    public function diff(array $before, array $after): array
    {
        $changes = [];

        foreach (self::DETAIL_FIELDS as $field) {
            $prev = $before[$field] ?? null;
            $next = $after[$field] ?? null;

            if ($this->valuesEqual($prev, $next)) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => $this->fieldLabel($field),
                'before' => $prev,
                'after' => $next,
            ];
        }

        return $changes;
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
    ): ?InventoryLotDetailEvent {
        $changes = $this->diff($before, $after);

        if ($changes === [] && ! in_array($action, [
            InventoryLotDetailEvent::ACTION_CREATE,
            InventoryLotDetailEvent::ACTION_RECEIVE_PO,
        ], true)) {
            return null;
        }

        if (in_array($action, [
            InventoryLotDetailEvent::ACTION_CREATE,
            InventoryLotDetailEvent::ACTION_RECEIVE_PO,
        ], true)) {
            $changes = array_map(
                fn (string $field) => [
                    'field' => $field,
                    'label' => $this->fieldLabel($field),
                    'before' => null,
                    'after' => $after[$field] ?? null,
                ],
                self::DETAIL_FIELDS,
            );
            $changes = array_values(array_filter(
                $changes,
                fn (array $row) => $row['after'] !== null && $row['after'] !== '' && $row['after'] !== false,
            ));
        }

        return InventoryLotDetailEvent::create([
            'inventory_lot_id' => $lot->id,
            'user_id' => $userId,
            'action' => $action,
            'changes' => $changes !== [] ? $changes : null,
            'metadata' => $metadata !== [] ? $metadata : null,
        ]);
    }

    public function formatEvent(InventoryLotDetailEvent $event): array
    {
        $event->loadMissing(['user:id,name,email', 'lot:id,lot_number']);

        return [
            'id' => $event->id,
            'inventory_lot_id' => $event->inventory_lot_id,
            'lot_number' => $event->lot?->lot_number,
            'action' => $event->action,
            'action_label' => $this->actionLabel($event->action),
            'changes' => $event->changes ?? [],
            'metadata' => $event->metadata ?? [],
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
            InventoryLotDetailEvent::ACTION_CREATE => 'Lot created',
            InventoryLotDetailEvent::ACTION_RECEIVE_PO => 'Received from purchase order',
            InventoryLotDetailEvent::ACTION_UPDATE => 'Details updated',
            InventoryLotDetailEvent::ACTION_SET_ON_HOLD => 'Set on hold',
            InventoryLotDetailEvent::ACTION_SET_SELLABLE => 'Set sellable',
            InventoryLotDetailEvent::ACTION_MARK_CLEARANCE => 'Marked as clearance',
            InventoryLotDetailEvent::ACTION_REVERT_CLEARANCE => 'Reverted to active',
            default => ucfirst(str_replace('_', ' ', $action)),
        };
    }

    public function fieldLabel(string $field): string
    {
        return match ($field) {
            'season' => 'Season',
            'collection_code' => 'Collection',
            'listing_status' => 'Listing status',
            'lot_tier' => 'Lot tier',
            'quantity_on_hand' => 'Qty on hand',
            'barcode' => 'Barcode',
            'is_sellable' => 'Sellable',
            'notes' => 'Notes',
            'unit_cost' => 'Unit cost',
            default => ucfirst(str_replace('_', ' ', $field)),
        };
    }

    public function resolveUpdateAction(array $changes): string
    {
        if (count($changes) === 1 && ($changes[0]['field'] ?? '') === 'is_sellable') {
            return ($changes[0]['after'] ?? false)
                ? InventoryLotDetailEvent::ACTION_SET_SELLABLE
                : InventoryLotDetailEvent::ACTION_SET_ON_HOLD;
        }

        return InventoryLotDetailEvent::ACTION_UPDATE;
    }

    private function valuesEqual(mixed $prev, mixed $next): bool
    {
        if (is_bool($prev) || is_bool($next)) {
            return (bool) $prev === (bool) $next;
        }

        if (is_numeric($prev) || is_numeric($next)) {
            return round((float) $prev, 2) === round((float) $next, 2);
        }

        return (string) ($prev ?? '') === (string) ($next ?? '');
    }
}
