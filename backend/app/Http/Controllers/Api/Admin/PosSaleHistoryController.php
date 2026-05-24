<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class PosSaleHistoryController extends Controller
{
    public function index(Request $request)
    {
        $base = $this->completedPosSalesQuery();

        $summary = $this->buildSummary(clone $base);

        $sellers = User::query()
            ->select(['users.id', 'users.name'])
            ->whereIn('users.id', (clone $base)->distinct()->pluck('user_id'))
            ->orderBy('users.name')
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
            ])
            ->values();

        $query = (clone $base)
            ->with(['user:id,name,email', 'items:id,order_id,name,qty,price,line_total']);

        $sellerId = $request->input('seller_id');
        if ($sellerId !== null && $sellerId !== '' && $sellerId !== 'all') {
            $query->where('user_id', (int) $sellerId);
        }

        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function (Builder $q) use ($like) {
                $q->where('order_number', 'like', $like)
                    ->orWhereHas('user', fn (Builder $uq) => $uq->where('name', 'like', $like))
                    ->orWhereHas('items', fn (Builder $iq) => $iq->where('name', 'like', $like)
                        ->orWhere('sku', 'like', $like));
            });
        }

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $paginator = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);

        $paginator->getCollection()->transform(fn (Order $order) => $this->mapSale($order));

        return response()->json([
            'summary' => $summary,
            'sellers' => $sellers,
            'data' => $paginator,
        ]);
    }

    private function completedPosSalesQuery(): Builder
    {
        return Order::query()
            ->where('sale_channel', 'pos')
            ->where('payment_status', 'paid')
            ->where('status', 'completed');
    }

    private function buildSummary(Builder $base): array
    {
        $now = Carbon::now();
        $todayStart = $now->copy()->startOfDay();
        $yesterdayStart = $now->copy()->subDay()->startOfDay();
        $yesterdayEnd = $now->copy()->subDay()->endOfDay();
        $weekStart = $now->copy()->startOfWeek();
        $monthStart = $now->copy()->startOfMonth();

        return [
            'today' => $this->periodTotals(clone $base, $todayStart, $now),
            'yesterday' => $this->periodTotals(clone $base, $yesterdayStart, $yesterdayEnd),
            'this_week' => $this->periodTotals(clone $base, $weekStart, $now),
            'this_month' => $this->periodTotals(clone $base, $monthStart, $now),
        ];
    }

    private function periodTotals(Builder $query, Carbon $from, Carbon $to): array
    {
        $row = $query
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('COUNT(*) as sale_count, COALESCE(SUM(total), 0) as sale_total')
            ->first();

        return [
            'count' => (int) ($row->sale_count ?? 0),
            'total' => round((float) ($row->sale_total ?? 0), 2),
        ];
    }

    private function mapSale(Order $order): array
    {
        $items = $order->items ?? collect();
        $productNames = $items->pluck('name')->filter()->unique()->values();

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'created_at' => $order->created_at?->toIso8601String(),
            'total' => round((float) $order->total, 2),
            'payment_method' => $order->payment_method,
            'items_count' => $items->count(),
            'products_label' => $productNames->take(3)->join(', ') ?: '—',
            'seller' => $order->user ? [
                'id' => $order->user->id,
                'name' => $order->user->name,
            ] : null,
        ];
    }
}
