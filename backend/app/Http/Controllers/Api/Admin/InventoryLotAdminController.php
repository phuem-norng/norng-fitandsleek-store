<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\InventoryLot;
use App\Models\InventoryLotDetailEvent;
use App\Models\InventoryLotPriceEvent;
use App\Services\InventoryLotDetailAuditService;
use App\Services\InventoryLotPriceAuditService;
use App\Services\InventoryLotService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryLotAdminController extends BaseAdminController
{
    public function __construct(
        private readonly InventoryLotService $lots,
        private readonly InventoryLotPriceAuditService $priceAudit,
        private readonly InventoryLotDetailAuditService $detailAudit,
    ) {
    }

    public function catalog(Request $request)
    {
        $validated = $request->validate([
            'listing_status' => ['nullable', Rule::in(array_merge(['all'], InventoryLot::LISTING_STATUSES))],
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'in_stock_only' => ['nullable', 'boolean'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
            'lot_tier' => ['nullable', Rule::in(array_merge(['all'], InventoryLot::LOT_TIERS))],
        ]);

        $result = $this->lots->catalog(
            $validated['listing_status'] ?? 'all',
            $validated['search'] ?? null,
            (int) ($validated['per_page'] ?? 50),
            (int) ($validated['page'] ?? 1),
            filter_var($validated['in_stock_only'] ?? false, FILTER_VALIDATE_BOOLEAN),
            $validated['from_date'] ?? null,
            $validated['to_date'] ?? null,
            $validated['lot_tier'] ?? null,
        );

        return response()->json([
            'data' => $result['rows']->values(),
            'meta' => [
                'summary' => $result['summary'],
                'pagination' => $result['pagination'],
                'sell_old_first' => $result['sell_old_first'],
            ],
        ]);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'size' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:80'],
        ]);

        $productId = (int) $validated['product_id'];
        $size = $validated['size'] ?? null;
        $color = $validated['color'] ?? null;

        $collection = $this->lots->listForVariant($productId, $size, $color);
        $sellFlags = $this->lots->sellOrderFlagsForLots($collection);

        $rows = $collection
            ->map(function (InventoryLot $lot) use ($sellFlags) {
                $mapped = $this->mapLotWithAudit($lot);
                $flags = $sellFlags[$lot->id] ?? ['sells_next' => false, 'sell_order' => null];
                $mapped['sells_next'] = $flags['sells_next'];
                $mapped['sell_order'] = $flags['sell_order'];
                $mapped['is_sold_out'] = (int) $lot->quantity_on_hand <= 0;

                return $mapped;
            })
            ->sortBy(function (array $row) {
                if ($row['is_sold_out']) {
                    return [1, 0, -(int) ($row['id'] ?? 0)];
                }

                return [0, (int) ($row['sell_order'] ?? 999), -(int) ($row['id'] ?? 0)];
            })
            ->values();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'summary' => $this->lots->summaryForVariant($productId, $size, $color),
                'storefront' => $this->lots->storefrontPreviewForVariant($productId, $size, $color),
                'sell_old_first' => $this->lots->sellOldFirst(),
            ],
        ]);
    }

    public function priceEvents(Request $request, InventoryLot $inventoryLot)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
        ]);

        $query = $inventoryLot->priceEvents()
            ->with(['user:id,name,email', 'lot:id,lot_number'])
            ->orderByDesc('created_at');

        $search = trim((string) ($validated['search'] ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like) {
                $q->where('action', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        if (! empty($validated['from_date'])) {
            $query->whereDate('created_at', '>=', $validated['from_date']);
        }

        if (! empty($validated['to_date'])) {
            $query->whereDate('created_at', '<=', $validated['to_date']);
        }

        $events = $query
            ->limit(100)
            ->get()
            ->map(fn (InventoryLotPriceEvent $event) => $this->priceAudit->formatEvent($event))
            ->values();

        return response()->json(['data' => $events]);
    }

    public function detailEvents(Request $request, InventoryLot $inventoryLot)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
        ]);

        $query = $inventoryLot->detailEvents()
            ->with(['user:id,name,email', 'lot:id,lot_number'])
            ->orderByDesc('created_at');

        $search = trim((string) ($validated['search'] ?? ''));
        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like) {
                $q->where('action', 'like', $like)
                    ->orWhere('changes', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        if (! empty($validated['from_date'])) {
            $query->whereDate('created_at', '>=', $validated['from_date']);
        }

        if (! empty($validated['to_date'])) {
            $query->whereDate('created_at', '<=', $validated['to_date']);
        }

        $events = $query
            ->limit(100)
            ->get()
            ->map(fn (InventoryLotDetailEvent $event) => $this->detailAudit->formatEvent($event))
            ->values();

        return response()->json(['data' => $events]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'size' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:80'],
            'season' => ['nullable', 'string', 'max:40'],
            'collection_code' => ['nullable', 'string', 'max:64'],
            'listing_status' => ['nullable', Rule::in(InventoryLot::LISTING_STATUSES)],
            'quantity_on_hand' => ['required', 'integer', 'min:0', 'max:999999'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'price_rule' => ['nullable', Rule::in(InventoryLot::PRICE_RULES)],
            'price_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'barcode' => ['nullable', 'string', 'max:120', 'unique:inventory_lots,barcode'],
            'is_sellable' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $lot = $this->lots->createLot($validated);

        $this->detailAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotDetailEvent::ACTION_CREATE,
            [],
            $this->detailAudit->snapshot($lot),
        );

        return response()->json([
            'message' => 'Inventory lot created.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email', 'latestDetailEvent.user:id,name,email'])),
        ], 201);
    }

    public function update(Request $request, InventoryLot $inventoryLot)
    {
        $validated = $request->validate([
            'season' => ['nullable', 'string', 'max:40'],
            'collection_code' => ['nullable', 'string', 'max:64'],
            'listing_status' => ['nullable', Rule::in(InventoryLot::LISTING_STATUSES)],
            'quantity_on_hand' => ['nullable', 'integer', 'min:0', 'max:999999'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'price_rule' => ['nullable', Rule::in(InventoryLot::PRICE_RULES)],
            'price_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'barcode' => ['nullable', 'string', 'max:120', Rule::unique('inventory_lots', 'barcode')->ignore($inventoryLot->id)],
            'is_sellable' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = $this->detailAudit->snapshot($inventoryLot);
        $inventoryLot->fill($validated);
        $inventoryLot->save();
        $lot = $inventoryLot->fresh(['latestPriceEvent.user:id,name,email', 'latestDetailEvent.user:id,name,email']);
        $after = $this->detailAudit->snapshot($lot);
        $changes = $this->detailAudit->diff($before, $after);

        if ($changes !== []) {
            $this->detailAudit->record(
                $lot,
                (int) $request->user()->id,
                $this->detailAudit->resolveUpdateAction($changes),
                $before,
                $after,
            );
        }

        $this->lots->afterLotMutation($lot);

        return response()->json([
            'message' => 'Inventory lot updated.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email', 'latestDetailEvent.user:id,name,email'])),
        ]);
    }

    public function markClearance(Request $request, InventoryLot $inventoryLot)
    {
        $validated = $request->validate([
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'price_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
        ]);

        $wasClearance = $inventoryLot->listing_status === InventoryLot::LISTING_CLEARANCE;
        $priceBefore = $this->priceAudit->snapshot($inventoryLot);
        $detailBefore = $this->detailAudit->snapshot($inventoryLot);

        $lot = $this->lots->markClearance(
            $inventoryLot,
            isset($validated['unit_price']) ? (float) $validated['unit_price'] : null,
            isset($validated['price_percent']) ? (float) $validated['price_percent'] : null,
        );

        $this->priceAudit->record(
            $lot,
            (int) $request->user()->id,
            $wasClearance
                ? InventoryLotPriceEvent::ACTION_UPDATE_CLEARANCE
                : InventoryLotPriceEvent::ACTION_MARK_CLEARANCE,
            $priceBefore,
            $this->priceAudit->snapshot($lot),
        );

        $this->detailAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotDetailEvent::ACTION_MARK_CLEARANCE,
            $detailBefore,
            $this->detailAudit->snapshot($lot),
        );

        $message = $wasClearance
            ? 'Clearance price updated.'
            : 'Inventory lot marked as clearance.';

        return response()->json([
            'message' => $message,
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email'])),
        ]);
    }

    public function revertFromClearance(Request $request, InventoryLot $inventoryLot)
    {
        $priceBefore = $this->priceAudit->snapshot($inventoryLot);
        $detailBefore = $this->detailAudit->snapshot($inventoryLot);

        $lot = $this->lots->revertFromClearance($inventoryLot);

        $this->priceAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotPriceEvent::ACTION_REVERT_CLEARANCE,
            $priceBefore,
            $this->priceAudit->snapshot($lot),
        );

        $this->detailAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotDetailEvent::ACTION_REVERT_CLEARANCE,
            $detailBefore,
            $this->detailAudit->snapshot($lot),
        );

        return response()->json([
            'message' => 'Inventory lot reverted to active.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email'])),
        ]);
    }

    public function setOnHold(Request $request, InventoryLot $inventoryLot)
    {
        $before = $this->detailAudit->snapshot($inventoryLot);
        $lot = $this->lots->setOnHold($inventoryLot);
        $after = $this->detailAudit->snapshot($lot);

        $this->detailAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotDetailEvent::ACTION_SET_ON_HOLD,
            $before,
            $after,
        );

        return response()->json([
            'message' => 'Inventory lot set on hold.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email', 'latestDetailEvent.user:id,name,email'])),
        ]);
    }

    public function releaseFromHold(Request $request, InventoryLot $inventoryLot)
    {
        $before = $this->detailAudit->snapshot($inventoryLot);
        $lot = $this->lots->releaseFromHold($inventoryLot);
        $after = $this->detailAudit->snapshot($lot);

        $this->detailAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotDetailEvent::ACTION_SET_SELLABLE,
            $before,
            $after,
        );

        return response()->json([
            'message' => 'Inventory lot released from hold.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email', 'latestDetailEvent.user:id,name,email'])),
        ]);
    }

    public function applyLotDiscount(Request $request, InventoryLot $inventoryLot)
    {
        $validated = $request->validate([
            'discount_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $before = $this->priceAudit->snapshot($inventoryLot);
        $hadDiscount = ($before['discount_percent_off'] ?? 0) > 0;

        $lot = $this->lots->applyLotDiscount(
            $inventoryLot,
            (float) $validated['discount_percent'],
        );

        $this->priceAudit->record(
            $lot,
            (int) $request->user()->id,
            $hadDiscount
                ? InventoryLotPriceEvent::ACTION_UPDATE_LOT_DISCOUNT
                : InventoryLotPriceEvent::ACTION_APPLY_LOT_DISCOUNT,
            $before,
            $this->priceAudit->snapshot($lot),
            ['discount_percent' => (float) $validated['discount_percent']],
        );

        return response()->json([
            'message' => 'Lot discount applied.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email'])),
        ]);
    }

    public function clearLotDiscount(Request $request, InventoryLot $inventoryLot)
    {
        $before = $this->priceAudit->snapshot($inventoryLot);

        $lot = $this->lots->clearLotDiscount($inventoryLot);

        $this->priceAudit->record(
            $lot,
            (int) $request->user()->id,
            InventoryLotPriceEvent::ACTION_REMOVE_LOT_DISCOUNT,
            $before,
            $this->priceAudit->snapshot($lot),
        );

        return response()->json([
            'message' => 'Lot discount removed.',
            'data' => $this->mapLotWithAudit($lot->fresh(['latestPriceEvent.user:id,name,email'])),
        ]);
    }

    private function mapLotWithAudit(InventoryLot $lot): array
    {
        $mapped = $this->lots->mapLot($lot);

        if ($lot->relationLoaded('latestPriceEvent') && $lot->latestPriceEvent) {
            $mapped['latest_price_event'] = $this->priceAudit->formatEvent($lot->latestPriceEvent);
        }

        if ($lot->relationLoaded('latestDetailEvent') && $lot->latestDetailEvent) {
            $mapped['latest_detail_event'] = $this->detailAudit->formatEvent($lot->latestDetailEvent);
        }

        return $mapped;
    }
}
