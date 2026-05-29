<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\OrderAdminFilters;
use App\Support\OrderMetrics;
use Illuminate\Http\Request;

class OrderAdminController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 1000);
        $compact = $request->boolean('compact');
        $statuses = OrderAdminFilters::parseArrayParam($request, 'statuses');

        $query = Order::query();

        if ($compact) {
            $query->select([
                'orders.id',
                'orders.user_id',
                'orders.order_number',
                'orders.status',
                'orders.payment_status',
                'orders.payment_method',
                'orders.total',
                'orders.created_at',
            ])->with(['user:id,name,email'])
                ->withCount('items');
        } else {
            $query->with(['user', 'items.product']);
        }

        OrderAdminFilters::applyListFilters($query, $request);

        $includeSummary = $request->boolean('include_summary', ! $compact);

        $summary = [
            'order_count' => 0,
            'total_items' => 0,
            'total_revenue' => 0.0,
        ];

        if ($includeSummary) {
            $summaryQuery = clone $query;
            $revenueQuery = OrderAdminFilters::applyRevenueScope(clone $summaryQuery, $statuses);

            $summary = [
                'order_count' => (int) (clone $summaryQuery)->count('orders.id'),
                'total_items' => OrderMetrics::sumItemQtyForOrders(clone $summaryQuery),
                'total_revenue' => round((float) (clone $revenueQuery)->sum('orders.total'), 2),
            ];
        }

        $paginator = (clone $query)->orderByDesc('orders.id')->paginate($perPage);

        return response()->json(array_merge($paginator->toArray(), [
            'summary' => $summary,
        ]));
    }

    public function show(Order $order)
    {
        return $order->load(['user', 'items.product.category']);
    }

    public function update(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'max:50'],
        ]);

        $order->update(['status' => $data['status']]);

        return $order->fresh()->load(['user', 'items.product.category']);
    }

    public function destroy(Order $order)
    {
        $order->items()->delete();
        $order->payments()->delete();
        if ($order->shipment) {
            $order->shipment()->delete();
        }
        $order->replacementCases()->delete();
        $order->delete();

        return response()->json(['message' => 'Order deleted']);
    }
}
