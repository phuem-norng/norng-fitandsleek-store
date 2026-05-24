<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class OrderAdminFilters
{
    /** @return list<string> */
    public static function parseArrayParam(Request $request, string $key): array
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

    public static function applyListFilters(Builder $query, Request $request): void
    {
        $fromDate = trim((string) $request->input('from_date', ''));
        if ($fromDate !== '') {
            $query->where('orders.created_at', '>=', Carbon::parse($fromDate)->startOfDay());
        }

        $toDate = trim((string) $request->input('to_date', ''));
        if ($toDate !== '') {
            $query->where('orders.created_at', '<=', Carbon::parse($toDate)->endOfDay());
        }

        $search = trim((string) $request->input('search', ''));
        if ($search !== '') {
            $needle = '%'.addcslashes(mb_strtolower($search), '%_\\').'%';
            $query->where(function (Builder $q) use ($needle, $search) {
                $q->whereRaw('LOWER(CAST(orders.id AS TEXT)) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(orders.order_number) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(orders.status) LIKE ?', [$needle])
                    ->orWhereRaw('LOWER(orders.payment_status) LIKE ?', [$needle])
                    ->orWhereHas('user', function (Builder $uq) use ($needle) {
                        $uq->whereRaw('LOWER(name) LIKE ?', [$needle])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$needle]);
                    });

                if (ctype_digit($search)) {
                    $q->orWhere('orders.id', (int) $search);
                }
            });
        }

        self::applyStatusFilters($query, self::parseArrayParam($request, 'statuses'));
        self::applyPaymentFilters($query, self::parseArrayParam($request, 'payment'));
    }

    /** @param  list<string>  $statuses */
    public static function applyStatusFilters(Builder $query, array $statuses): void
    {
        if ($statuses === []) {
            return;
        }

        $query->where(function (Builder $outer) use ($statuses) {
            foreach ($statuses as $status) {
                $outer->orWhere(function (Builder $sub) use ($status) {
                    match ($status) {
                        'awaiting_payment' => $sub
                            ->where(function (Builder $inner) {
                                $inner->whereRaw("LOWER(COALESCE(orders.payment_status, '')) != 'paid'")
                                    ->where(function (Builder $s) {
                                        $s->whereIn('orders.status', ['pending', 'pending_payment'])
                                            ->orWhere('orders.status', '')
                                            ->orWhereNull('orders.status');
                                    });
                            }),
                        'processing' => $sub->whereIn('orders.status', ['processing', 'preparing', 'paid']),
                        'shipped' => $sub->where('orders.status', 'shipped'),
                        'completed' => $sub->whereIn('orders.status', ['completed', 'delivered']),
                        'cancelled' => $sub->where('orders.status', 'cancelled'),
                        default => null,
                    };
                });
            }
        });
    }

    /** @param  list<string>  $payments */
    public static function applyPaymentFilters(Builder $query, array $payments): void
    {
        if ($payments === []) {
            return;
        }

        $query->where(function (Builder $outer) use ($payments) {
            foreach ($payments as $payment) {
                $outer->orWhere(function (Builder $sub) use ($payment) {
                    if ($payment === 'paid') {
                        $sub->whereRaw("LOWER(COALESCE(orders.payment_status, '')) = 'paid'");
                    } elseif ($payment === 'unpaid') {
                        $sub->whereRaw("LOWER(COALESCE(orders.payment_status, '')) != 'paid'");
                    }
                });
            }
        });
    }

    /**
     * Revenue sum for the same filters as the list.
     * When no status filter is set, cancelled orders are excluded from revenue (matches Reports).
     *
     * @param  list<string>  $statuses
     */
    public static function applyRevenueScope(Builder $query, array $statuses): Builder
    {
        $revenueQuery = clone $query;

        if ($statuses === []) {
            $revenueQuery->where('orders.status', '!=', 'cancelled');
        }

        return $revenueQuery;
    }
}
