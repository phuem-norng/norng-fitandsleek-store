<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Message;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReplacementCase;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Builds a compact JSON snapshot of live admin-console metrics for Dify `inputs`.
 */
class AdminDashboardContextService
{
    private const PENDING_ORDER_STATUSES = ['pending', 'pending_payment', 'processing'];

    private const CACHE_KEY = 'admin_ai_dashboard_context_v2';

    public function build(): array
    {
        return Cache::remember(self::CACHE_KEY, 60, function () {
            return $this->collect();
        });
    }

    /**
     * Flat string inputs for Dify prompt variables (must match names in your Chatflow).
     * e.g. {{total_users}}, {{orders_7d}}, {{revenue_7d}} in the LLM USER prompt.
     */
    public function toDifyInputs(): array
    {
        $ctx = $this->build();

        return [
            'dashboard_context' => json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'total_users' => (string) (int) ($ctx['users']['total'] ?? 0),
            'customers_count' => (string) (int) ($ctx['users']['customers'] ?? 0),
            'admins_count' => (string) (int) ($ctx['users']['admins'] ?? 0),
            'orders_7d' => (string) (int) ($ctx['orders']['last_7_days_count'] ?? 0),
            'orders_today' => (string) (int) ($ctx['orders']['today_count'] ?? 0),
            'pending_orders' => (string) (int) ($ctx['orders']['pending'] ?? 0),
            'revenue_7d' => (string) (float) ($ctx['revenue']['last_7_days'] ?? 0),
            'revenue_today' => (string) (float) ($ctx['revenue']['today'] ?? 0),
            'revenue_month' => (string) (float) ($ctx['revenue']['month'] ?? 0),
            'failed_payments' => (string) (int) ($ctx['payments']['failed'] ?? 0),
            'low_stock_products' => (string) (int) ($ctx['products']['low_stock'] ?? 0),
            'metrics_summary' => sprintf(
                'users.total=%d, users.customers=%d, orders.last_7_days=%d, orders.pending=%d, revenue.today=%s, revenue.last_7_days=%s',
                (int) ($ctx['users']['total'] ?? 0),
                (int) ($ctx['users']['customers'] ?? 0),
                (int) ($ctx['orders']['last_7_days_count'] ?? 0),
                (int) ($ctx['orders']['pending'] ?? 0),
                (string) ($ctx['revenue']['today'] ?? 0),
                (string) ($ctx['revenue']['last_7_days'] ?? 0),
            ),
        ];
    }

    public function toPromptBlock(): string
    {
        $ctx = $this->build();
        $lines = [
            'Fit & Sleek Admin Console — live database snapshot (' . ($ctx['generated_at'] ?? now()->toIso8601String()) . '):',
            'Users — total: ' . (int) ($ctx['users']['total'] ?? 0)
                . ', customers: ' . (int) ($ctx['users']['customers'] ?? 0)
                . ', admins: ' . (int) ($ctx['users']['admins'] ?? 0)
                . ', drivers: ' . (int) ($ctx['users']['drivers'] ?? 0)
                . ', new customers today: ' . (int) ($ctx['users']['new_customers_today'] ?? 0) . '.',
            'Revenue — today: $' . number_format((float) ($ctx['revenue']['today'] ?? 0), 2)
                . ', last 7 days: $' . number_format((float) ($ctx['revenue']['last_7_days'] ?? 0), 2)
                . ', this month: $' . number_format((float) ($ctx['revenue']['month'] ?? 0), 2) . '.',
            'Orders — today: ' . (int) ($ctx['orders']['today_count'] ?? 0)
                . ', last 7 days: ' . (int) ($ctx['orders']['last_7_days_count'] ?? 0)
                . ', pending (all time): ' . (int) ($ctx['orders']['pending'] ?? 0) . '.',
            'Products — total: ' . (int) ($ctx['products']['total'] ?? 0)
                . ', active: ' . (int) ($ctx['products']['active'] ?? 0)
                . ', low stock (<10): ' . (int) ($ctx['products']['low_stock'] ?? 0) . '.',
            'Payments — pending: ' . (int) ($ctx['payments']['pending'] ?? 0)
                . ', failed: ' . (int) ($ctx['payments']['failed'] ?? 0) . '.',
            'Open replacement cases: ' . (int) ($ctx['replacements']['open'] ?? 0) . '.',
            'Unread contacts: ' . (int) ($ctx['contacts']['unread'] ?? 0) . '.',
            'Active storefront messages: ' . (int) ($ctx['messages']['active'] ?? 0) . '.',
            'System: ' . ($ctx['system']['status'] ?? 'unknown') . '.',
        ];

        if (! empty($ctx['orders']['by_status_today'])) {
            $statusBits = collect($ctx['orders']['by_status_today'])
                ->map(fn ($row) => ($row['status'] ?? '?') . '=' . ($row['count'] ?? 0))
                ->implode(', ');
            $lines[] = 'Orders by status (today): ' . $statusBits . '.';
        }

        if (! empty($ctx['alerts'])) {
            $lines[] = 'Alerts: ' . implode(' ', $ctx['alerts']);
        }

        return implode("\n", $lines);
    }

    private function collect(): array
    {
        $today = now()->startOfDay();
        $thisMonth = now()->startOfMonth();
        $last7DaysStart = now()->subDays(6)->startOfDay();

        $todayOrdersQuery = Order::query()->where('created_at', '>=', $today);
        $last7OrdersQuery = Order::query()->where('created_at', '>=', $last7DaysStart);

        $todayRevenue = (clone $todayOrdersQuery)
            ->where('status', '!=', 'cancelled')
            ->sum('total');

        $last7Revenue = (clone $last7OrdersQuery)
            ->where('status', '!=', 'cancelled')
            ->sum('total');

        $todayOrderCount = (clone $todayOrdersQuery)->count();
        $last7OrderCount = (clone $last7OrdersQuery)->count();

        $pendingOrders = Order::query()
            ->whereIn('status', self::PENDING_ORDER_STATUSES)
            ->count();

        $ordersByStatusToday = $this->ordersGroupedByStatus($today);
        $ordersByStatusLast7 = $this->ordersGroupedByStatus($last7DaysStart);

        $monthRevenue = Order::query()
            ->where('created_at', '>=', $thisMonth)
            ->where('status', '!=', 'cancelled')
            ->sum('total');

        $totalProducts = Product::query()->count();
        $lowStock = Product::query()->where('stock', '<', 10)->count();
        $activeProducts = Product::query()->where('is_active', true)->count();

        $failedPayments = Payment::query()->where('status', 'failed')->count();
        $pendingPayments = Payment::query()->where('status', 'pending')->count();

        $openReplacements = ReplacementCase::query()
            ->whereIn('status', ['pending', 'approved'])
            ->count();

        $unreadContacts = Contact::query()->where('status', 'new')->count();
        $activeMessages = Message::query()->where('is_active', true)->count();

        $totalUsers = User::query()->count();
        $customerCount = User::query()->where('role', 'customer')->count();
        $adminCount = User::query()->whereIn('role', ['admin', 'superadmin'])->count();
        $driverCount = User::query()->where('role', 'driver')->count();
        $newCustomersToday = User::query()
            ->where('role', 'customer')
            ->where('created_at', '>=', $today)
            ->count();
        $newCustomersLast7 = User::query()
            ->where('role', 'customer')
            ->where('created_at', '>=', $last7DaysStart)
            ->count();

        $alerts = [];
        if ($pendingOrders > 0) {
            $alerts[] = "{$pendingOrders} order(s) awaiting fulfillment.";
        }
        if ($lowStock > 0) {
            $alerts[] = "{$lowStock} product(s) below stock threshold.";
        }
        if ($failedPayments > 0) {
            $alerts[] = "{$failedPayments} failed payment(s).";
        }
        if ($openReplacements > 0) {
            $alerts[] = "{$openReplacements} open replacement case(s).";
        }
        if ($unreadContacts > 0) {
            $alerts[] = "{$unreadContacts} unread contact submission(s).";
        }

        return [
            'generated_at' => now()->toIso8601String(),
            'store' => config('app.name', 'Fit & Sleek'),
            'periods' => [
                'today_from' => $today->toIso8601String(),
                'last_7_days_from' => $last7DaysStart->toDateString(),
                'last_7_days_to' => now()->toDateString(),
                'month_from' => $thisMonth->toDateString(),
            ],
            'users' => [
                'total' => $totalUsers,
                'customers' => $customerCount,
                'admins' => $adminCount,
                'drivers' => $driverCount,
                'new_customers_today' => $newCustomersToday,
                'new_customers_last_7_days' => $newCustomersLast7,
            ],
            'revenue' => [
                'today' => round((float) $todayRevenue, 2),
                'last_7_days' => round((float) $last7Revenue, 2),
                'month' => round((float) $monthRevenue, 2),
                'currency' => 'USD',
            ],
            'orders' => [
                'today_count' => $todayOrderCount,
                'last_7_days_count' => $last7OrderCount,
                'pending' => $pendingOrders,
                'by_status_today' => $ordersByStatusToday,
                'by_status_last_7_days' => $ordersByStatusLast7,
            ],
            'products' => [
                'total' => $totalProducts,
                'active' => $activeProducts,
                'low_stock' => $lowStock,
            ],
            'payments' => [
                'pending' => $pendingPayments,
                'failed' => $failedPayments,
            ],
            'replacements' => [
                'open' => $openReplacements,
            ],
            'contacts' => [
                'unread' => $unreadContacts,
            ],
            'messages' => [
                'active' => $activeMessages,
            ],
            'alerts' => $alerts,
            'system' => [
                'status' => empty($alerts) ? 'healthy' : 'attention_needed',
                'laravel' => 'ok',
                'timezone' => config('app.timezone'),
            ],
            'note' => 'All figures are live counts from the store database. Use users.* for user questions, revenue.last_7_days for 7-day revenue.',
        ];
    }

    /**
     * @return list<array{status: string, count: int}>
     */
    private function ordersGroupedByStatus(\DateTimeInterface $from): array
    {
        return Order::query()
            ->where('created_at', '>=', $from)
            ->select('status', DB::raw('COUNT(*) as cnt'))
            ->groupBy('status')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get()
            ->map(fn ($row) => [
                'status' => (string) $row->status,
                'count' => (int) $row->cnt,
            ])
            ->values()
            ->all();
    }
}
