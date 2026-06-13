<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderProductLimit;
use App\Services\PurchaseOrderReceiveService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseOrderAdminController extends BaseAdminController
{
    public function __construct(
        private readonly PurchaseOrderReceiveService $purchaseOrderReceive,
    ) {
    }

    private function nextPoNumber(): string
    {
        $prefix = 'PO-'.now()->format('Ym').'-';

        $latest = PurchaseOrder::query()
            ->where('po_number', 'like', $prefix.'%')
            ->orderByDesc('po_number')
            ->value('po_number');

        $seq = 1;
        if ($latest && preg_match('/-(\d+)$/', $latest, $m)) {
            $seq = ((int) $m[1]) + 1;
        }

        do {
            $candidate = $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
            $seq++;
        } while (PurchaseOrder::where('po_number', $candidate)->exists() && $seq < 100000);

        return $candidate;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array<string, mixed>>|null  $productLimits
     */
    private function validateProductQtyLimits(array $items, ?array $productLimits): void
    {
        $limitsByProduct = [];
        foreach ($productLimits ?? [] as $limit) {
            $productId = (int) ($limit['product_id'] ?? 0);
            $maxQty = (int) ($limit['max_qty'] ?? 0);
            if ($productId > 0 && $maxQty > 0) {
                $limitsByProduct[$productId] = $maxQty;
            }
        }

        $totalsByProduct = [];
        foreach ($items as $row) {
            $productId = (int) ($row['product_id'] ?? 0);
            if ($productId <= 0) {
                continue;
            }
            $totalsByProduct[$productId] = ($totalsByProduct[$productId] ?? 0) + max(1, (int) ($row['qty'] ?? 0));
        }

        foreach ($totalsByProduct as $productId => $totalQty) {
            if (! isset($limitsByProduct[$productId])) {
                throw ValidationException::withMessages([
                    'product_limits' => ["Set a total quantity limit for product #{$productId}."],
                ]);
            }
            if ($totalQty > $limitsByProduct[$productId]) {
                throw ValidationException::withMessages([
                    'items' => [
                        "Total quantity for product #{$productId} ({$totalQty}) exceeds the limit ({$limitsByProduct[$productId]}).",
                    ],
                ]);
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>|null  $productLimits
     */
    private function syncProductLimits(PurchaseOrder $order, ?array $productLimits): void
    {
        $order->productLimits()->delete();

        foreach ($productLimits ?? [] as $limit) {
            $productId = (int) ($limit['product_id'] ?? 0);
            $maxQty = (int) ($limit['max_qty'] ?? 0);
            if ($productId <= 0 || $maxQty <= 0) {
                continue;
            }

            PurchaseOrderProductLimit::create([
                'purchase_order_id' => $order->id,
                'product_id' => $productId,
                'max_qty' => $maxQty,
            ]);
        }
    }

    private function serialize(PurchaseOrder $order): array
    {
        $order->loadMissing(['supplier', 'items.product', 'productLimits']);

        $items = $order->items->map(fn (PurchaseOrderItem $item) => [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'product_name' => $item->product?->name
                ?? ($item->product_id ? 'Product #'.$item->product_id : null),
            'product_sku' => $item->product?->sku,
            'size' => $item->size,
            'color' => $item->color,
            'qty' => (int) $item->qty,
            'cost_per_unit' => (float) $item->cost_per_unit,
            'sell_price' => (float) $item->sell_price,
            'line_total_cost' => (float) $item->line_total_cost,
            'line_subtotal_sell' => (float) $item->line_subtotal_sell,
        ])->values();

        $totalCost = $items->sum('line_total_cost');
        $totalSell = $items->sum('line_subtotal_sell');

        $productLimits = $order->productLimits->map(fn (PurchaseOrderProductLimit $limit) => [
            'product_id' => $limit->product_id,
            'max_qty' => (int) $limit->max_qty,
        ])->values();

        $stockReceived = $order->getAttribute('stock_received_summary');

        return [
            'id' => $order->id,
            'supplier_id' => $order->supplier_id,
            'po_number' => $order->po_number,
            'status' => $order->status ?? PurchaseOrder::STATUS_DRAFT,
            'order_date' => $order->order_date?->format('Y-m-d'),
            'expected_delivery' => $order->expected_delivery?->format('Y-m-d'),
            'notes' => $order->notes,
            'purchaser' => $order->purchaser,
            'received_at' => $order->received_at,
            'created_at' => $order->created_at,
            'updated_at' => $order->updated_at,
            'supplier' => $order->supplier ? [
                'id' => $order->supplier->id,
                'supplier_code' => $order->supplier->supplier_code,
                'name' => $order->supplier->name,
                'contact_person' => $order->supplier->contact_person,
                'phone' => $order->supplier->phone,
                'email' => $order->supplier->email,
                'address' => $order->supplier->address,
                'city' => $order->supplier->city,
                'country' => $order->supplier->country,
            ] : null,
            'items' => $items,
            'product_limits' => $productLimits,
            'total_cost' => round($totalCost, 2),
            'total_sell' => round($totalSell, 2),
            'item_count' => $items->count(),
            'stock_received' => $stockReceived,
            'can_edit' => ($order->status ?? PurchaseOrder::STATUS_DRAFT) === PurchaseOrder::STATUS_DRAFT,
            'can_delete' => ($order->status ?? PurchaseOrder::STATUS_DRAFT) === PurchaseOrder::STATUS_DRAFT,
            'can_mark_pending' => ($order->status ?? PurchaseOrder::STATUS_DRAFT) === PurchaseOrder::STATUS_DRAFT,
            'can_mark_received' => ($order->status ?? PurchaseOrder::STATUS_DRAFT) === PurchaseOrder::STATUS_PENDING,
        ];
    }

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->input('per_page', 50), 1), 500);

        $paginator = PurchaseOrder::query()
            ->with(['supplier', 'items'])
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PurchaseOrder $o) => $this->serialize($o))->values(),
            'next_po_number' => $this->nextPoNumber(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'po_number' => ['nullable', 'string', 'max:40', Rule::unique('purchase_orders', 'po_number')],
            'order_date' => ['required', 'date'],
            'expected_delivery' => ['nullable', 'date', 'after_or_equal:order_date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'purchaser' => ['nullable', 'string', 'max:120'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.size' => ['nullable', 'string', 'max:60'],
            'items.*.color' => ['nullable', 'string', 'max:120'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.cost_per_unit' => ['nullable', 'numeric', 'min:0'],
            'items.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'product_limits' => ['required', 'array'],
            'product_limits.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'product_limits.*.max_qty' => ['required', 'integer', 'min:1'],
        ]);

        $this->validateProductQtyLimits($validated['items'], $validated['product_limits']);

        $poNumber = trim((string) ($validated['po_number'] ?? ''));
        if ($poNumber === '') {
            $poNumber = $this->nextPoNumber();
        }

        $purchaser = trim((string) ($validated['purchaser'] ?? ''));
        if ($purchaser === '') {
            $purchaser = trim((string) ($request->user()?->name ?? '')) ?: null;
        }

        $order = DB::transaction(function () use ($validated, $poNumber, $purchaser) {
            $order = PurchaseOrder::create([
                'supplier_id' => (int) $validated['supplier_id'],
                'po_number' => $poNumber,
                'status' => PurchaseOrder::STATUS_DRAFT,
                'order_date' => $validated['order_date'],
                'expected_delivery' => $validated['expected_delivery'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'purchaser' => $purchaser,
            ]);

            foreach ($validated['items'] as $row) {
                $qty = max(1, (int) $row['qty']);
                $cost = round((float) ($row['cost_per_unit'] ?? 0), 2);
                $sell = round((float) ($row['sell_price'] ?? 0), 2);

                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'product_id' => (int) $row['product_id'],
                    'size' => isset($row['size']) ? trim((string) $row['size']) ?: null : null,
                    'color' => isset($row['color']) ? trim((string) $row['color']) ?: null : null,
                    'qty' => $qty,
                    'cost_per_unit' => $cost,
                    'sell_price' => $sell,
                    'line_total_cost' => round($cost * $qty, 2),
                    'line_subtotal_sell' => round($sell * $qty, 2),
                ]);
            }

            $this->syncProductLimits($order, $validated['product_limits']);

            return $order->fresh(['supplier', 'items.product', 'productLimits']);
        });

        return response()->json(['data' => $this->serialize($order)], 201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return response()->json(['data' => $this->serialize($purchaseOrder)]);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        if (($purchaseOrder->status ?? PurchaseOrder::STATUS_DRAFT) !== PurchaseOrder::STATUS_DRAFT) {
            return response()->json([
                'message' => 'Only draft purchase orders can be updated.',
            ], 422);
        }

        $validated = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'po_number' => [
                'nullable',
                'string',
                'max:40',
                Rule::unique('purchase_orders', 'po_number')->ignore($purchaseOrder->id),
            ],
            'order_date' => ['required', 'date'],
            'expected_delivery' => ['nullable', 'date', 'after_or_equal:order_date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'purchaser' => ['nullable', 'string', 'max:120'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.size' => ['nullable', 'string', 'max:60'],
            'items.*.color' => ['nullable', 'string', 'max:120'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.cost_per_unit' => ['nullable', 'numeric', 'min:0'],
            'items.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'product_limits' => ['required', 'array'],
            'product_limits.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'product_limits.*.max_qty' => ['required', 'integer', 'min:1'],
        ]);

        $this->validateProductQtyLimits($validated['items'], $validated['product_limits']);

        $poNumber = trim((string) ($validated['po_number'] ?? ''));
        if ($poNumber === '') {
            $poNumber = $purchaseOrder->po_number;
        }

        $purchaser = trim((string) ($validated['purchaser'] ?? ''));
        if ($purchaser === '') {
            $purchaser = $purchaseOrder->purchaser;
        }

        $order = DB::transaction(function () use ($validated, $purchaseOrder, $poNumber, $purchaser) {
            $purchaseOrder->update([
                'supplier_id' => (int) $validated['supplier_id'],
                'po_number' => $poNumber,
                'order_date' => $validated['order_date'],
                'expected_delivery' => $validated['expected_delivery'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'purchaser' => $purchaser,
            ]);

            $purchaseOrder->items()->delete();

            foreach ($validated['items'] as $row) {
                $qty = max(1, (int) $row['qty']);
                $cost = round((float) ($row['cost_per_unit'] ?? 0), 2);
                $sell = round((float) ($row['sell_price'] ?? 0), 2);

                PurchaseOrderItem::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'product_id' => (int) $row['product_id'],
                    'size' => isset($row['size']) ? trim((string) $row['size']) ?: null : null,
                    'color' => isset($row['color']) ? trim((string) $row['color']) ?: null : null,
                    'qty' => $qty,
                    'cost_per_unit' => $cost,
                    'sell_price' => $sell,
                    'line_total_cost' => round($cost * $qty, 2),
                    'line_subtotal_sell' => round($sell * $qty, 2),
                ]);
            }

            $this->syncProductLimits($purchaseOrder, $validated['product_limits']);

            return $purchaseOrder->fresh(['supplier', 'items.product', 'productLimits']);
        });

        return response()->json(['data' => $this->serialize($order)]);
    }

    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([PurchaseOrder::STATUS_PENDING, PurchaseOrder::STATUS_RECEIVED])],
        ]);

        $target = $validated['status'];
        $current = $purchaseOrder->status ?? PurchaseOrder::STATUS_DRAFT;

        if ($target === PurchaseOrder::STATUS_PENDING && $current !== PurchaseOrder::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'status' => ['Only draft purchase orders can be marked as pending.'],
            ]);
        }

        if ($target === PurchaseOrder::STATUS_RECEIVED && $current !== PurchaseOrder::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'status' => ['Only pending purchase orders can be marked as received.'],
            ]);
        }

        $userId = (int) $request->user()->id;

        $order = DB::transaction(function () use ($purchaseOrder, $target, $userId) {
            if ($target === PurchaseOrder::STATUS_PENDING) {
                $purchaseOrder->status = PurchaseOrder::STATUS_PENDING;
                $purchaseOrder->save();

                return $purchaseOrder->fresh(['supplier', 'items.product']);
            }

            $purchaseOrder->status = PurchaseOrder::STATUS_RECEIVED;
            $purchaseOrder->received_at = now();
            $purchaseOrder->save();

            $fresh = $purchaseOrder->fresh(['supplier', 'items.product']);
            $stockReceived = $this->purchaseOrderReceive->receiveOrder($fresh, $userId);
            $fresh->stock_received_summary = $stockReceived;

            return $fresh;
        });

        return response()->json(['data' => $this->serialize($order)]);
    }

    public function destroy(PurchaseOrder $purchaseOrder)
    {
        if (($purchaseOrder->status ?? PurchaseOrder::STATUS_DRAFT) !== PurchaseOrder::STATUS_DRAFT) {
            return response()->json([
                'message' => 'Only draft purchase orders can be deleted.',
            ], 422);
        }

        $purchaseOrder->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
