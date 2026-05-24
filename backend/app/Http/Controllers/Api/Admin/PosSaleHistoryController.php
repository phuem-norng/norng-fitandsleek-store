<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class PosSaleHistoryController extends Controller
{
    public function index(Request $request)
    {
        $base = $this->completedPosSalesQuery();

        $summary = $this->buildSummary(clone $base);
        $filterFacets = $this->buildFilterFacets(clone $base, $summary);

        $query = (clone $base)
            ->with(['user:id,name,email', 'items:id,order_id,name,qty,price,line_total']);

        $sellerIds = $this->parseArrayParam($request, 'seller_ids');
        if ($sellerIds !== []) {
            $query->whereIn('orders.user_id', array_map('intval', $sellerIds));
        }

        $paymentMethods = $this->parseArrayParam($request, 'payment_methods');
        if ($paymentMethods !== []) {
            $query->whereIn('orders.payment_method', $paymentMethods);
        }

        $periods = $this->parseArrayParam($request, 'periods');
        $fromDate = trim((string) $request->input('from_date', ''));
        $toDate = trim((string) $request->input('to_date', ''));
        $this->applyTimeFilters($query, $periods, $fromDate, $toDate);

        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $this->applySearchFilter($query, $search);
        }

        $listTotals = $this->buildListTotals(clone $query);

        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);
        $paginator = $query->orderByDesc('orders.created_at')->orderByDesc('orders.id')->paginate($perPage);

        $paginator->getCollection()->transform(fn (Order $order) => $this->mapSale($order));

        return response()->json([
            'summary' => $summary,
            'filter_facets' => $filterFacets,
            'list_totals' => $listTotals,
            'data' => $paginator,
        ]);
    }

    /** @return list<string> */
    private function parseArrayParam(Request $request, string $key): array
    {
        $raw = $request->input($key, []);
        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($v) => trim((string) $v),
            $raw
        ), fn ($v) => $v !== ''));
    }

    private function buildFilterFacets(Builder $base, array $summary): array
    {
        $sellerRows = (clone $base)
            ->join('users', 'users.id', '=', 'orders.user_id')
            ->groupBy('users.id', 'users.name')
            ->selectRaw('users.id, users.name, COUNT(*) as sale_count')
            ->orderBy('users.name')
            ->get();

        $paymentRows = (clone $base)
            ->whereNotNull('orders.payment_method')
            ->where('orders.payment_method', '!=', '')
            ->groupBy('orders.payment_method')
            ->selectRaw('orders.payment_method as payment_method, COUNT(*) as sale_count')
            ->orderBy('orders.payment_method')
            ->get();

        $periodLabels = [
            'today' => 'Today',
            'yesterday' => 'Yesterday',
            'this_week' => 'This week',
            'this_month' => 'This month',
        ];

        $periodOpts = [];
        foreach ($periodLabels as $key => $label) {
            $count = (int) ($summary[$key]['count'] ?? 0);
            if ($count > 0) {
                $periodOpts[] = [
                    'value' => $key,
                    'label' => $label,
                    'count' => $count,
                ];
            }
        }

        return [
            'seller' => $sellerRows->map(fn ($row) => [
                'value' => (string) $row->id,
                'label' => (string) $row->name,
                'count' => (int) $row->sale_count,
            ])->values()->all(),
            'payment_method' => $paymentRows->map(fn ($row) => [
                'value' => (string) $row->payment_method,
                'label' => (string) $row->payment_method,
                'count' => (int) $row->sale_count,
            ])->values()->all(),
            'period' => $periodOpts,
        ];
    }

    /**
     * @param  list<string>  $periods
     */
    private function applyTimeFilters(Builder $query, array $periods, string $fromDate, string $toDate): void
    {
        $allowed = ['today', 'yesterday', 'this_week', 'this_month'];
        $periods = array_values(array_intersect($periods, $allowed));
        $hasPeriods = $periods !== [];
        $hasDates = $fromDate !== '' || $toDate !== '';

        if (! $hasPeriods && ! $hasDates) {
            return;
        }

        $now = Carbon::now();

        $query->where(function (Builder $outer) use ($periods, $hasPeriods, $fromDate, $toDate, $hasDates, $now) {
            if ($hasPeriods) {
                foreach ($periods as $period) {
                    $outer->orWhere(function (Builder $sub) use ($period, $now) {
                        match ($period) {
                            'today' => $sub->whereBetween('orders.created_at', [
                                $now->copy()->startOfDay(),
                                $now,
                            ]),
                            'yesterday' => $sub->whereBetween('orders.created_at', [
                                $now->copy()->subDay()->startOfDay(),
                                $now->copy()->subDay()->endOfDay(),
                            ]),
                            'this_week' => $sub->whereBetween('orders.created_at', [
                                $now->copy()->startOfWeek(),
                                $now,
                            ]),
                            'this_month' => $sub->whereBetween('orders.created_at', [
                                $now->copy()->startOfMonth(),
                                $now,
                            ]),
                            default => null,
                        };
                    });
                }
            }

            if ($hasDates) {
                $outer->orWhere(function (Builder $sub) use ($fromDate, $toDate) {
                    if ($fromDate !== '') {
                        $sub->where('orders.created_at', '>=', Carbon::parse($fromDate)->startOfDay());
                    }
                    if ($toDate !== '') {
                        $sub->where('orders.created_at', '<=', Carbon::parse($toDate)->endOfDay());
                    }
                });
            }
        });
    }

    private function completedPosSalesQuery(): Builder
    {
        return Order::query()
            ->where('orders.sale_channel', 'pos')
            ->where('orders.payment_status', 'paid')
            ->where('orders.status', 'completed');
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        $needle = '%'.addcslashes(mb_strtolower($search), '%_\\').'%';
        $driver = $query->getConnection()->getDriverName();

        $query->where(function (Builder $q) use ($needle, $driver) {
            $this->whereLikeInsensitive($q, 'orders.order_number', $needle, $driver);

            $q->orWhereHas('user', function (Builder $uq) use ($needle, $driver) {
                $this->whereLikeInsensitive($uq, 'name', $needle, $driver);
            });

            $q->orWhereHas('items', function (Builder $iq) use ($needle, $driver) {
                $iq->where(function (Builder $inner) use ($needle, $driver) {
                    $this->whereLikeInsensitive($inner, 'name', $needle, $driver);
                    $this->whereLikeInsensitive($inner, 'sku', $needle, $driver, true);
                });
            });

            if ($driver === 'pgsql') {
                $q->orWhereRaw("LOWER(orders.pos_meta->>'receipt_no') LIKE ?", [$needle]);
            } elseif ($driver === 'sqlite') {
                $q->orWhereRaw("LOWER(json_extract(orders.pos_meta, '$.receipt_no')) LIKE ?", [$needle]);
            } elseif ($driver === 'mysql') {
                $q->orWhereRaw("LOWER(JSON_UNQUOTE(JSON_EXTRACT(orders.pos_meta, '$.receipt_no'))) LIKE ?", [$needle]);
            }
        });
    }

    private function whereLikeInsensitive(
        Builder $query,
        string $column,
        string $needle,
        string $driver,
        bool $or = false
    ): void {
        if ($driver === 'pgsql') {
            $or ? $query->orWhere($column, 'ilike', $needle) : $query->where($column, 'ilike', $needle);

            return;
        }

        $sql = 'LOWER('.$query->getGrammar()->wrap($column).') LIKE ?';
        $or ? $query->orWhereRaw($sql, [$needle]) : $query->whereRaw($sql, [$needle]);
    }

    private function buildListTotals(Builder $query): array
    {
        $totalsQuery = clone $query;
        $totalsQuery->getQuery()->orders = [];
        $totalsQuery->getQuery()->unionOrders = [];
        $totalsQuery->getQuery()->limit = null;
        $totalsQuery->getQuery()->offset = null;

        $saleCount = (int) (clone $totalsQuery)->count('orders.id');
        $totalPrice = round((float) (clone $totalsQuery)->sum('orders.total'), 2);

        $orderIdsSub = (clone $totalsQuery)->select('orders.id');
        $totalItems = (int) \App\Models\OrderItem::query()
            ->whereIn('order_id', $orderIdsSub)
            ->count();

        return [
            'sale_count' => $saleCount,
            'total_items' => $totalItems,
            'total_price' => $totalPrice,
        ];
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
            ->whereBetween('orders.created_at', [$from, $to])
            ->selectRaw('COUNT(*) as sale_count, COALESCE(SUM(orders.total), 0) as sale_total')
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
