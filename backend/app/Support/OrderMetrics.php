<?php

namespace App\Support;

use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

/**
 * Canonical store revenue: SUM(orders.total) on non-cancelled orders in a date range.
 * Used by Reports dashboard, Revenue charts (unfiltered), Plan, and Orders summary.
 */
class OrderMetrics
{
    public static function revenueOrdersQuery(?Carbon $from, ?Carbon $to): Builder
    {
        $query = Order::query()->where('orders.status', '!=', 'cancelled');

        if ($from !== null) {
            $query->where('orders.created_at', '>=', $from);
        }
        if ($to !== null) {
            $query->where('orders.created_at', '<=', $to);
        }

        return $query;
    }

    public static function sumRevenue(?Carbon $from, ?Carbon $to): float
    {
        return round((float) self::revenueOrdersQuery($from, $to)->sum('orders.total'), 2);
    }

    public static function sumItemQtyForOrders(Builder $ordersQuery): int
    {
        $idsSub = (clone $ordersQuery)->select('orders.id');

        return (int) OrderItem::query()
            ->whereIn('order_id', $idsSub)
            ->sum('qty');
    }
}
