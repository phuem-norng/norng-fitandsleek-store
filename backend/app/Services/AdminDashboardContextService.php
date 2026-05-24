<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Message;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReplacementCase;
use App\Models\User;
use App\Models\UserDeviceSession;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Builds a compact JSON snapshot of live admin-console metrics for Dify `inputs`.
 */
class AdminDashboardContextService
{
    private const PENDING_ORDER_STATUSES = ['pending', 'pending_payment', 'processing'];

    private const CACHE_KEY = 'admin_ai_dashboard_context_v3';

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
            'users_directory' => $this->formatUsersDirectory($ctx['users']['directory'] ?? []),
            'admins_directory' => $this->formatAdminsDirectory($ctx['users']['directory'] ?? []),
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

    /**
     * Extra inputs when the admin mentions a specific email in their question.
     *
     * @return array<string, string>
     */
    public function enrichInputsForMessage(string $message): array
    {
        $lookup = $this->lookupUsersByEmail($message);
        if ($lookup === []) {
            return [];
        }

        return [
            'user_lookup' => json_encode($lookup, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'user_lookup_text' => $this->formatUserLookupText($lookup),
        ];
    }

    /**
     * Compact facts appended to every Dify query so the LLM always sees live DB data
     * (works even if Dify workflow variables are not wired into the LLM node).
     */
    public function toCompactQueryContext(string $message = ''): string
    {
        $ctx = $this->build();
        $lines = [
            'RULES: Answer ONLY from the facts below. Never invent counts, names, emails, or dates. '
            . 'If the answer is not in these facts, reply: "មិនមានក្នុង database" (not in database).',
            sprintf(
                'Metrics: users.total=%d, users.customers=%d, users.admins=%d, orders.last_7_days=%d, orders.pending=%d, revenue.today=%s, revenue.last_7_days=%s',
                (int) ($ctx['users']['total'] ?? 0),
                (int) ($ctx['users']['customers'] ?? 0),
                (int) ($ctx['users']['admins'] ?? 0),
                (int) ($ctx['orders']['last_7_days_count'] ?? 0),
                (int) ($ctx['orders']['pending'] ?? 0),
                (string) ($ctx['revenue']['today'] ?? 0),
                (string) ($ctx['revenue']['last_7_days'] ?? 0),
            ),
            'Admins:',
            $this->formatAdminsDirectory($ctx['users']['directory'] ?? []),
        ];

        $lookup = $this->lookupUsersByEmail($message);
        if ($lookup !== []) {
            $lines[] = 'Matched users for this question:';
            $lines[] = $this->formatUserLookupText($lookup);
        }

        return implode("\n", $lines);
    }

    /**
     * @param list<array<string, mixed>> $directory
     */
    private function formatUsersDirectory(array $directory): string
    {
        if ($directory === []) {
            return 'No users in database.';
        }

        return collect($directory)
            ->map(fn (array $u) => sprintf(
                'id=%s email=%s name=%s role=%s created=%s last_active=%s status=%s',
                $u['id'] ?? '?',
                $u['email'] ?? '?',
                $u['name'] ?? '?',
                $u['role'] ?? '?',
                $u['created_at'] ?? 'unknown',
                $u['last_active_at'] ?? 'unknown',
                $u['status'] ?? 'unknown',
            ))
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $directory
     */
    private function formatAdminsDirectory(array $directory): string
    {
        $admins = collect($directory)
            ->filter(fn (array $u) => in_array($u['role'] ?? '', ['admin', 'superadmin'], true))
            ->values();

        if ($admins->isEmpty()) {
            return 'No admin accounts in database.';
        }

        return $admins
            ->map(fn (array $u) => sprintf(
                'id=%s email=%s name=%s role=%s created=%s last_active=%s',
                $u['id'] ?? '?',
                $u['email'] ?? '?',
                $u['name'] ?? '?',
                $u['role'] ?? '?',
                $u['created_at'] ?? 'unknown',
                $u['last_active_at'] ?? 'unknown',
            ))
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $lookup
     */
    private function formatUserLookupText(array $lookup): string
    {
        return collect($lookup)
            ->map(function (array $row) {
                if (! ($row['found'] ?? false)) {
                    return 'email=' . ($row['email'] ?? '?') . ' → NOT FOUND in database';
                }

                return sprintf(
                    'id=%s email=%s name=%s role=%s created=%s last_active=%s status=%s',
                    $row['id'] ?? '?',
                    $row['email'] ?? '?',
                    $row['name'] ?? '?',
                    $row['role'] ?? '?',
                    $row['created_at'] ?? 'unknown',
                    $row['last_active_at'] ?? 'unknown',
                    $row['status'] ?? 'unknown',
                );
            })
            ->implode("\n");
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lookupUsersByEmail(string $message): array
    {
        if (! preg_match_all('/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/', $message, $matches)) {
            return [];
        }

        $emails = array_unique(array_map('strtolower', $matches[0]));
        $result = [];

        foreach ($emails as $email) {
            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
            if (! $user) {
                $result[] = ['email' => $email, 'found' => false];

                continue;
            }

            $lastActive = $this->resolveLastActiveAt($user);
            $result[] = [
                'found' => true,
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'role' => $user->role,
                'status' => $user->status ?? 'active',
                'created_at' => $user->created_at?->toIso8601String() ?? 'unknown',
                'last_active_at' => $lastActive,
            ];
        }

        return $result;
    }

    private function resolveLastActiveAt(User $user): string
    {
        $lastLogin = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->max('last_login_at');

        if ($lastLogin) {
            return (string) $lastLogin;
        }

        $lastUsed = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->max('last_used_at');

        if ($lastUsed) {
            return (string) $lastUsed;
        }

        return $user->updated_at?->toIso8601String() ?? 'unknown';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildUserDirectory(): array
    {
        $lastLoginByUser = UserDeviceSession::query()
            ->select('user_id', DB::raw('MAX(COALESCE(last_login_at, last_used_at)) as last_seen'))
            ->groupBy('user_id')
            ->pluck('last_seen', 'user_id');

        return User::query()
            ->select(['id', 'name', 'email', 'role', 'status', 'created_at', 'updated_at'])
            ->orderBy('id')
            ->get()
            ->map(function (User $user) use ($lastLoginByUser) {
                $lastSeen = $lastLoginByUser->get($user->id);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status ?? 'active',
                    'created_at' => $user->created_at?->toIso8601String(),
                    'updated_at' => $user->updated_at?->toIso8601String(),
                    'last_active_at' => $lastSeen
                        ? (string) $lastSeen
                        : ($user->updated_at?->toIso8601String() ?? null),
                ];
            })
            ->values()
            ->all();
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
                'directory' => $this->buildUserDirectory(),
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
            'note' => 'All figures are live counts from the store database. Use users.directory or admins_directory for account details. Never guess emails or dates.',
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
