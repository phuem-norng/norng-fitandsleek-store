<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\PurchaseOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;

class StockReceivedAdminController extends BaseAdminController
{
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

    private function receiveStatus(PurchaseOrder $order): string
    {
        return $order->status ?? PurchaseOrder::STATUS_DRAFT;
    }

    private function serializeRow(PurchaseOrder $order): array
    {
        $order->loadMissing(['supplier', 'items.product']);

        $productNames = $order->items
            ->map(fn ($item) => $item->product?->name)
            ->filter()
            ->unique()
            ->values();

        $totalQty = (int) $order->items->sum('qty');
        $totalCost = round((float) $order->items->sum('line_total_cost'), 2);
        $estRevenue = round((float) $order->items->sum('line_subtotal_sell'), 2);

        return [
            'id' => $order->id,
            'purchase_order_id' => $order->id,
            'po_number' => $order->po_number,
            'date_received' => $order->order_date?->format('Y-m-d'),
            'date_received_at' => $order->created_at,
            'supplier_name' => $order->supplier?->name,
            'supplier_code' => $order->supplier?->supplier_code,
            'products' => $productNames->all(),
            'products_label' => $productNames->isNotEmpty()
                ? $productNames->take(3)->implode(', ').($productNames->count() > 3 ? '…' : '')
                : null,
            'total_qty' => $totalQty,
            'total_cost' => $totalCost,
            'est_revenue' => $estRevenue,
            'status' => $this->receiveStatus($order),
            'received_by' => $order->purchaser,
        ];
    }

    public function index(Request $request)
    {
        $perPage = min(max((int) $request->input('per_page', 100), 1), 500);
        $search = trim((string) $request->input('search', ''));
        $fromDate = $this->parseDateOnly($request->input('from_date'));
        $toDate = $this->parseDateOnly($request->input('to_date'));

        $query = PurchaseOrder::query()
            ->with(['supplier', 'items.product'])
            ->orderByDesc('order_date')
            ->orderByDesc('id');

        if ($fromDate !== null) {
            $query->whereDate('order_date', '>=', $fromDate);
        }
        if ($toDate !== null) {
            $query->whereDate('order_date', '<=', $toDate);
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like, $search) {
                $q->where('po_number', 'like', $like)
                    ->orWhere('purchaser', 'like', $like)
                    ->orWhere('notes', 'like', $like)
                    ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', $like))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', $like));
            });
        }

        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => collect($paginator->items())->map(fn (PurchaseOrder $o) => $this->serializeRow($o))->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
