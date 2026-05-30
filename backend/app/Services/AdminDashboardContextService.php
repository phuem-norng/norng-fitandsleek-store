<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Contact;
use App\Models\Discount;
use App\Models\Message;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReplacementCase;
use App\Models\User;
use App\Models\UserDeviceSession;
use App\Support\OrderMetrics;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Builds a compact JSON snapshot of live admin-console metrics for Dify `inputs`.
 */
class AdminDashboardContextService
{
    private const PENDING_ORDER_STATUSES = ['pending', 'pending_payment', 'processing'];

    private const CACHE_KEY = 'admin_ai_dashboard_context_v6';

    private const DASHBOARD_PERIOD_DAYS = 30;

    public function build(): array
    {
        return Cache::remember(self::CACHE_KEY, 60, function () {
            return $this->collect();
        });
    }

    /**
     * Flat string inputs for Dify prompt variables (must match names in your Chatflow).
     */
    public function toDifyInputs(): array
    {
        $ctx = $this->build();
        $dash = $ctx['dashboard'] ?? [];

        return [
            'dashboard_context' => json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'total_users' => (string) (int) ($ctx['users']['total'] ?? 0),
            'customers_count' => (string) (int) ($ctx['users']['customers'] ?? 0),
            'admins_count' => (string) (int) ($ctx['users']['admins'] ?? 0),
            'orders_7d' => (string) (int) ($ctx['orders']['last_7_days_count'] ?? 0),
            'orders_30d' => (string) (int) ($dash['orders']['total'] ?? 0),
            'orders_today' => (string) (int) ($ctx['orders']['today_count'] ?? 0),
            'pending_orders' => (string) (int) ($ctx['orders']['pending'] ?? 0),
            'revenue_7d' => (string) (float) ($ctx['revenue']['last_7_days'] ?? 0),
            'revenue_30d' => (string) (float) ($dash['revenue']['total'] ?? 0),
            'revenue_today' => (string) (float) ($ctx['revenue']['today'] ?? 0),
            'revenue_month' => (string) (float) ($ctx['revenue']['month'] ?? 0),
            'failed_payments' => (string) (int) ($ctx['payments']['failed'] ?? 0),
            'low_stock_products' => (string) (int) ($ctx['products']['low_stock'] ?? 0),
            'users_directory' => $this->formatUsersDirectory($ctx['users']['directory'] ?? []),
            'admins_directory' => $this->formatAdminsDirectory($ctx['users']['directory'] ?? []),
            'top_products_30d' => $this->formatTopProducts($ctx['sales']['top_products_30d'] ?? []),
            'recent_orders' => $this->formatRecentOrders($ctx['recent_orders'] ?? []),
            'metrics_summary' => sprintf(
                'users.total=%d, users.customers=%d, orders.30d=%d, orders.pending=%d, revenue.today=%s, revenue.30d=%s, revenue.month=%s',
                (int) ($ctx['users']['total'] ?? 0),
                (int) ($ctx['users']['customers'] ?? 0),
                (int) ($dash['orders']['total'] ?? 0),
                (int) ($ctx['orders']['pending'] ?? 0),
                (string) ($ctx['revenue']['today'] ?? 0),
                (string) ($dash['revenue']['total'] ?? 0),
                (string) ($ctx['revenue']['month'] ?? 0),
            ),
        ];
    }

    public function toPromptBlock(): string
    {
        return $this->toCompactQueryContext();
    }

    /**
     * Extra inputs when the admin mentions a specific email, order, or product in their question.
     *
     * @return array<string, string>
     */
    public function enrichInputsForMessage(string $message): array
    {
        $extra = [];

        $lookup = $this->lookupUsersByEmail($message);
        if ($lookup !== []) {
            $extra['user_lookup'] = json_encode($lookup, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $extra['user_lookup_text'] = $this->formatUserLookupText($lookup);
        }

        $orderLookup = $this->lookupOrdersInMessage($message);
        if ($orderLookup !== []) {
            $extra['order_lookup'] = json_encode($orderLookup, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $extra['order_lookup_text'] = $this->formatOrderLookupText($orderLookup);
        }

        $productLookup = $this->lookupProductsInMessage($message);
        if ($productLookup !== []) {
            $extra['product_lookup'] = json_encode($productLookup, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $extra['product_lookup_text'] = $this->formatProductLookupText($productLookup);
        }

        return $extra;
    }

    /**
     * Structured tables (products with image + links) for rich chat UI.
     *
     * @return list<array<string, mixed>>
     */
    public function buildRichTablesForMessage(string $message): array
    {
        $ctx = $this->build();
        $tables = [];

        if ($this->messageAsksExplicitLowStock($message) || $this->messageAsksLowStock($message)) {
            $tables[] = $this->formatCatalogSummaryTable($ctx);
            $products = $ctx['low_stock_products'] ?? [];
            if ($products !== []) {
                $tables[] = $this->formatLowStockTable($products);
            }

            return $tables;
        }

        if ($this->messageAsksProductOverview($message)) {
            $tables[] = $this->formatCatalogSummaryTable($ctx);
            $products = $ctx['low_stock_products'] ?? [];
            if ($products !== []) {
                $tables[] = $this->formatLowStockTable($products);
            }

            return $tables;
        }

        if ($this->messageAsksDiscountRecommendation($message)) {
            $recs = $ctx['discount_recommendations'] ?? [];
            if ($recs !== []) {
                $tables[] = $this->formatDiscountRecommendationsTable($recs);
            }

            return $tables;
        }

        if ($this->messageAsksTopProducts($message)) {
            $period = $this->detectSalesPeriod($message);
            $key = match ($period) {
                'today' => 'top_products_today',
                '7d' => 'top_products_7d',
                default => 'top_products_30d',
            };
            $products = $ctx['sales'][$key] ?? [];
            if ($products !== []) {
                $tables[] = $this->formatProductSalesTable($products, $period);
            }

            return $tables;
        }

        return $tables;
    }

    private function messageAsksDiscountRecommendation(string $message): bool
    {
        $hay = mb_strtolower($message);

        foreach ([
            'discount', 'promotion', 'promo', 'markdown', 'reduce price', 'on sale',
            'should we discount', 'slow mover', 'clearance', 'put on sale',
            'បញ្ចុះតម្លៃ', 'បញ្ចុះ', 'ឡុប', 'ប្រូម៉ូ',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return str_contains($hay, 'គួរបញ្ចុះ');
    }

    /**
     * @param  list<array<string, mixed>>  $products
     * @return array<string, mixed>
     */
    private function formatDiscountRecommendationsTable(array $products): array
    {
        return [
            'type' => 'products',
            'variant' => 'discount',
            'title' => 'Recommended for discount (slow movers, 30d)',
            'title_km' => 'ផលិតផលគួរពិចារណាបញ្ចុះតម្លៃ (លក់យឺត)',
            'rows' => array_values(array_map(fn (array $p) => [
                'id' => (int) ($p['id'] ?? 0),
                'name' => (string) ($p['name'] ?? 'Unknown'),
                'image_url' => $p['image_url'] ?? null,
                'slug' => $p['slug'] ?? null,
                'admin_url' => $p['admin_url'] ?? null,
                'storefront_url' => $p['storefront_url'] ?? null,
                'admin_discount_url' => '/admin/discounts',
                'stock' => (int) ($p['stock'] ?? 0),
                'sold_30d' => (int) ($p['sold_30d'] ?? 0),
                'price' => round((float) ($p['price'] ?? 0), 2),
                'suggested_discount_pct' => (int) ($p['suggested_discount_pct'] ?? 0),
                'reason' => (string) ($p['reason'] ?? ''),
                'reason_km' => (string) ($p['reason_km'] ?? ''),
            ], $products)),
        ];
    }

    private function messageAsksProductOverview(string $message): bool
    {
        $hay = mb_strtolower($message);

        foreach ([
            'product overview', 'catalog summary', 'inventory summary', 'all products',
            'product status', 'product list', 'តារាង', 'ទំនិញ', 'សង្ខេប', 'ប្រព័ន្ធ',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $ctx
     * @return array<string, mixed>
     */
    private function formatCatalogSummaryTable(array $ctx): array
    {
        return [
            'type' => 'stats',
            'variant' => 'summary',
            'title' => 'Product overview',
            'title_km' => 'សង្ខេបផលិតផល',
            'rows' => [
                [
                    'label' => 'Total products',
                    'label_km' => 'ផលិតផលសរុប',
                    'value' => (string) (int) ($ctx['products']['total'] ?? 0),
                ],
                [
                    'label' => 'Active',
                    'label_km' => 'សកម្ម',
                    'value' => (string) (int) ($ctx['products']['active'] ?? 0),
                ],
                [
                    'label' => 'Low stock (<10)',
                    'label_km' => 'ស្តុកទាប (<10)',
                    'value' => (string) (int) ($ctx['products']['low_stock'] ?? 0),
                ],
                [
                    'label' => 'Categories',
                    'label_km' => 'ប្រភេទ',
                    'value' => (string) (int) ($ctx['catalog']['categories'] ?? 0),
                ],
                [
                    'label' => 'Brands',
                    'label_km' => 'ម៉ាក',
                    'value' => (string) (int) ($ctx['catalog']['brands'] ?? 0),
                ],
                [
                    'label' => 'Active discounts',
                    'label_km' => 'បញ្ចុះតម្លៃ',
                    'value' => (string) (int) ($ctx['catalog']['active_discounts'] ?? 0),
                ],
            ],
        ];
    }

    private function messageAsksExplicitLowStock(string $message): bool
    {
        $hay = mb_strtolower($message);

        foreach ([
            'low stock', 'low on stock', 'out of stock', 'stock low', 'below stock',
            'ស្តុកទាប', 'អស់ស្តុក',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function messageAsksTopProducts(string $message): bool
    {
        $hay = mb_strtolower($message);

        foreach ([
            'top product', 'best sell', 'best-sell', 'sold product', 'selling product',
            'products sold', 'top sell', 'bestseller', 'best selling',
            'លក់បាន', 'លក់ដាច់', 'ផលិតផលអ្វី', 'លក់អ្វី',
        ] as $needle) {
            if (str_contains($hay, $needle)) {
                return true;
            }
        }

        if (str_contains($hay, 'លក់') && str_contains($hay, 'ផលិតផល')) {
            return true;
        }

        return preg_match('/\b(what|which)\s+products?\s+(sold|sell|selling|best)\b/', $hay) === 1;
    }

    private function messageAsksLowStock(string $message): bool
    {
        $hay = mb_strtolower($message);

        return str_contains($hay, 'inventory')
            || str_contains($hay, 'stock')
            || str_contains($hay, 'ស្តុក');
    }

    private function detectSalesPeriod(string $message): string
    {
        $hay = mb_strtolower($message);

        if (preg_match('/\b(today|ថ្ងៃនេ|ថ្ងៃនី)\b/u', $hay)) {
            return 'today';
        }

        if (preg_match('/\b(7\s*d|7\s*day|week|៧\s*ថ្ងៃ|មួយ\s*សប្តាហ)\b/u', $hay)) {
            return '7d';
        }

        return '30d';
    }

    /**
     * @param  list<array<string, mixed>>  $products
     * @return array<string, mixed>
     */
    private function formatProductSalesTable(array $products, string $period): array
    {
        $titles = [
            'today' => [
                'en' => 'Top selling products (today)',
                'km' => 'ផលិតផលលក់ដាច់ (ថ្ងៃនេះ)',
            ],
            '7d' => [
                'en' => 'Top selling products (7 days)',
                'km' => 'ផលិតផលលក់ដាច់ (៧ ថ្ងៃ)',
            ],
            '30d' => [
                'en' => 'Top selling products (30 days)',
                'km' => 'ផលិតផលលក់ដាច់ (៣០ ថ្ងៃ)',
            ],
        ];

        $label = $titles[$period] ?? $titles['30d'];

        return [
            'type' => 'products',
            'variant' => 'sales',
            'title' => $label['en'],
            'title_km' => $label['km'],
            'period' => $period,
            'rows' => array_values(array_map(fn (array $p) => [
                'id' => (int) ($p['product_id'] ?? $p['id'] ?? 0),
                'name' => (string) ($p['name'] ?? 'Unknown'),
                'image_url' => $p['image_url'] ?? null,
                'slug' => $p['slug'] ?? null,
                'admin_url' => $p['admin_url'] ?? null,
                'storefront_url' => $p['storefront_url'] ?? null,
                'qty_sold' => (int) ($p['qty_sold'] ?? 0),
                'revenue' => round((float) ($p['revenue'] ?? 0), 2),
            ], $products)),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $products
     * @return array<string, mixed>
     */
    private function formatLowStockTable(array $products): array
    {
        return [
            'type' => 'products',
            'variant' => 'stock',
            'title' => 'Low stock products (< 10 units)',
            'title_km' => 'ផលិតផលស្តុកទាប (< ១០)',
            'rows' => array_values(array_map(fn (array $p) => [
                'id' => (int) ($p['id'] ?? 0),
                'name' => (string) ($p['name'] ?? 'Unknown'),
                'image_url' => $p['image_url'] ?? null,
                'slug' => $p['slug'] ?? null,
                'admin_url' => $p['admin_url'] ?? null,
                'storefront_url' => $p['storefront_url'] ?? null,
                'stock' => (int) ($p['stock'] ?? 0),
                'price' => round((float) ($p['price'] ?? 0), 2),
                'is_active' => (bool) ($p['is_active'] ?? false),
            ], $products)),
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function attachProductLinks(array $row): array
    {
        $id = (int) ($row['product_id'] ?? $row['id'] ?? 0);
        $slug = isset($row['slug']) ? trim((string) $row['slug']) : '';

        $row['admin_url'] = $id > 0 ? '/admin/products?edit=' . $id : null;
        $row['storefront_url'] = $slug !== '' ? '/products/' . $slug : null;

        return $row;
    }

    /**
     * Compact facts appended to every Dify query so the LLM always sees live DB data.
     */
    public function toCompactQueryContext(string $message = ''): string
    {
        $ctx = $this->build();
        $dash = $ctx['dashboard'] ?? [];
        $lines = [
            'ROLE: You are Fit & Sleek Admin AI — a professional store operations assistant.',
            'RULES:',
            '- Answer ONLY from the live database facts below. Never invent numbers, names, emails, or dates.',
            '- Match the admin\'s language (Khmer or English). Be concise, clear, and professional.',
            '- Format money as USD ($X.XX). Use bullet lists for multiple items.',
            '- If the answer is truly absent from these facts, say politely that the data is not available.',
            '',
            '=== KPI SUMMARY (matches admin Dashboard, last ' . self::DASHBOARD_PERIOD_DAYS . ' days) ===',
            sprintf(
                'Revenue (%dd): $%s | Today: $%s | Month-to-date: $%s',
                self::DASHBOARD_PERIOD_DAYS,
                number_format((float) ($dash['revenue']['total'] ?? 0), 2),
                number_format((float) ($ctx['revenue']['today'] ?? 0), 2),
                number_format((float) ($ctx['revenue']['month'] ?? 0), 2),
            ),
            sprintf(
                'Orders (%dd): %d total | %d pending | %d processing | %d completed',
                self::DASHBOARD_PERIOD_DAYS,
                (int) ($dash['orders']['total'] ?? 0),
                (int) ($dash['orders']['pending'] ?? 0),
                (int) ($dash['orders']['processing'] ?? 0),
                (int) ($dash['orders']['completed'] ?? 0),
            ),
            sprintf(
                'Customers: %d total | %d new in last %dd',
                (int) ($dash['customers']['total'] ?? 0),
                (int) ($dash['customers']['new_in_period'] ?? 0),
                self::DASHBOARD_PERIOD_DAYS,
            ),
            sprintf(
                'Products: %d total | %d active | %d low stock (<10)',
                (int) ($ctx['products']['total'] ?? 0),
                (int) ($ctx['products']['active'] ?? 0),
                (int) ($ctx['products']['low_stock'] ?? 0),
            ),
            sprintf(
                'Users: %d total | %d customers | %d admins | %d drivers',
                (int) ($ctx['users']['total'] ?? 0),
                (int) ($ctx['users']['customers'] ?? 0),
                (int) ($ctx['users']['admins'] ?? 0),
                (int) ($ctx['users']['drivers'] ?? 0),
            ),
            sprintf(
                'Payments: %d pending | %d failed | Open replacements: %d | Unread contacts: %d',
                (int) ($ctx['payments']['pending'] ?? 0),
                (int) ($ctx['payments']['failed'] ?? 0),
                (int) ($ctx['replacements']['open'] ?? 0),
                (int) ($ctx['contacts']['unread'] ?? 0),
            ),
            sprintf(
                'Catalog: %d categories | %d brands | %d active discounts',
                (int) ($ctx['catalog']['categories'] ?? 0),
                (int) ($ctx['catalog']['brands'] ?? 0),
                (int) ($ctx['catalog']['active_discounts'] ?? 0),
            ),
        ];

        if (! empty($dash['orders_by_status'])) {
            $statusBits = collect($dash['orders_by_status'])
                ->map(fn ($row) => ($row['status'] ?? '?') . '=' . ($row['count'] ?? 0))
                ->implode(', ');
            $lines[] = 'Orders by status (' . self::DASHBOARD_PERIOD_DAYS . 'd): ' . $statusBits;
        }

        if (! empty($ctx['alerts'])) {
            $lines[] = 'Alerts: ' . implode(' | ', $ctx['alerts']);
        }

        $lines[] = '';
        $lines[] = '=== TOP SELLING PRODUCTS ===';
        $lines[] = 'Today:';
        $lines[] = $this->formatTopProducts($ctx['sales']['top_products_today'] ?? [], '  No sales today.');
        $lines[] = 'Last 7 days:';
        $lines[] = $this->formatTopProducts($ctx['sales']['top_products_7d'] ?? [], '  No sales in last 7 days.');
        $lines[] = 'Last 30 days:';
        $lines[] = $this->formatTopProducts($ctx['sales']['top_products_30d'] ?? [], '  No sales in last 30 days.');

        $lines[] = '';
        $lines[] = '=== RECENT ORDERS (newest first) ===';
        $lines[] = $this->formatRecentOrders($ctx['recent_orders'] ?? []);

        if (! empty($ctx['pending_orders'])) {
            $lines[] = '';
            $lines[] = '=== PENDING / PROCESSING ORDERS ===';
            $lines[] = $this->formatRecentOrders($ctx['pending_orders']);
        }

        if (! empty($ctx['low_stock_products'])) {
            $lines[] = '';
            $lines[] = '=== LOW STOCK PRODUCTS (stock < 10) ===';
            $lines[] = $this->formatLowStockProducts($ctx['low_stock_products']);
        }

        if (! empty($ctx['discount_recommendations'])) {
            $lines[] = '';
            $lines[] = '=== DISCOUNT RECOMMENDATIONS (slow movers — no active discount yet) ===';
            $lines[] = $this->formatDiscountRecommendations($ctx['discount_recommendations']);
            $lines[] = 'Use this section when admin asks which products to discount. Explain reason and suggested % from facts below.';
        }

        if (! empty($dash['daily_revenue'])) {
            $lines[] = '';
            $lines[] = '=== DAILY REVENUE TREND (last ' . self::DASHBOARD_PERIOD_DAYS . ' days) ===';
            $lines[] = $this->formatDailyRevenue($dash['daily_revenue']);
        }

        $lines[] = '';
        $lines[] = '=== ADMIN ACCOUNTS ===';
        $lines[] = $this->formatAdminsDirectory($ctx['users']['directory'] ?? []);

        $lookup = $this->lookupUsersByEmail($message);
        if ($lookup !== []) {
            $lines[] = '';
            $lines[] = '=== MATCHED USERS (this question) ===';
            $lines[] = $this->formatUserLookupText($lookup);
        }

        $orderLookup = $this->lookupOrdersInMessage($message);
        if ($orderLookup !== []) {
            $lines[] = '';
            $lines[] = '=== MATCHED ORDERS (this question) ===';
            $lines[] = $this->formatOrderLookupText($orderLookup);
        }

        $productLookup = $this->lookupProductsInMessage($message);
        if ($productLookup !== []) {
            $lines[] = '';
            $lines[] = '=== MATCHED PRODUCTS (this question) ===';
            $lines[] = $this->formatProductLookupText($productLookup);
        }

        $lines[] = '';
        $lines[] = 'Generated at: ' . ($ctx['generated_at'] ?? now()->toIso8601String());

        return implode("\n", $lines);
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function formatTopProducts(array $rows, string $empty = 'No sales data.'): string
    {
        if ($rows === []) {
            return $empty;
        }

        return collect($rows)
            ->map(fn (array $p, int $i) => sprintf(
                '  %d. %s — qty=%d, revenue=$%s',
                $i + 1,
                $p['name'] ?? 'Unknown',
                (int) ($p['qty_sold'] ?? 0),
                number_format((float) ($p['revenue'] ?? 0), 2),
            ))
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function formatRecentOrders(array $rows): string
    {
        if ($rows === []) {
            return 'No orders.';
        }

        return collect($rows)
            ->map(fn (array $o) => sprintf(
                '#%s | customer=%s | $%s | status=%s | %s',
                $o['order_number'] ?? $o['id'] ?? '?',
                $o['customer'] ?? 'Guest',
                number_format((float) ($o['total'] ?? 0), 2),
                $o['status'] ?? '?',
                $o['created_at'] ?? '',
            ))
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function formatLowStockProducts(array $rows): string
    {
        return collect($rows)
            ->map(fn (array $p) => sprintf(
                '%s (id=%s) — stock=%d, price=$%s, active=%s',
                $p['name'] ?? '?',
                $p['id'] ?? '?',
                (int) ($p['stock'] ?? 0),
                number_format((float) ($p['price'] ?? 0), 2),
                ($p['is_active'] ?? false) ? 'yes' : 'no',
            ))
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function formatDailyRevenue(array $rows): string
    {
        $nonZero = collect($rows)->filter(fn ($r) => ((float) ($r['revenue'] ?? 0)) > 0);

        if ($nonZero->isEmpty()) {
            return 'No revenue recorded in this period.';
        }

        return $nonZero
            ->map(fn ($r) => sprintf(
                '%s: $%s (%d orders)',
                $r['date'] ?? '?',
                number_format((float) ($r['revenue'] ?? 0), 2),
                (int) ($r['orders'] ?? 0),
            ))
            ->implode("\n");
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
     * @param list<array<string, mixed>> $lookup
     */
    private function formatOrderLookupText(array $lookup): string
    {
        return collect($lookup)
            ->map(function (array $row) {
                if (! ($row['found'] ?? false)) {
                    return 'order=' . ($row['query'] ?? '?') . ' → NOT FOUND';
                }

                $items = collect($row['items'] ?? [])
                    ->map(fn ($i) => ($i['name'] ?? '?') . ' x' . ($i['qty'] ?? 0))
                    ->implode(', ');

                return sprintf(
                    '#%s | customer=%s (%s) | $%s | status=%s | items: %s | %s',
                    $row['order_number'] ?? '?',
                    $row['customer'] ?? 'Guest',
                    $row['customer_email'] ?? '',
                    number_format((float) ($row['total'] ?? 0), 2),
                    $row['status'] ?? '?',
                    $items !== '' ? $items : 'none',
                    $row['created_at'] ?? '',
                );
            })
            ->implode("\n");
    }

    /**
     * @param list<array<string, mixed>> $lookup
     */
    private function formatProductLookupText(array $lookup): string
    {
        return collect($lookup)
            ->map(fn (array $row) => sprintf(
                'id=%s name=%s | stock=%d | price=$%s | active=%s | sold_30d=%d units ($%s)',
                $row['id'] ?? '?',
                $row['name'] ?? '?',
                (int) ($row['stock'] ?? 0),
                number_format((float) ($row['price'] ?? 0), 2),
                ($row['is_active'] ?? false) ? 'yes' : 'no',
                (int) ($row['sold_30d'] ?? 0),
                number_format((float) ($row['revenue_30d'] ?? 0), 2),
            ))
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

            $result[] = [
                'found' => true,
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'role' => $user->role,
                'status' => $user->status ?? 'active',
                'created_at' => $user->created_at?->toIso8601String() ?? 'unknown',
                'last_active_at' => $this->resolveLastActiveAt($user),
            ];
        }

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lookupOrdersInMessage(string $message): array
    {
        $queries = [];

        if (preg_match_all('/#(\d{3,})/', $message, $matches)) {
            foreach ($matches[1] as $num) {
                $queries[] = $num;
            }
        }

        if (preg_match_all('/\b(ORD[-\s]?\d+)\b/i', $message, $matches)) {
            foreach ($matches[1] as $num) {
                $queries[] = strtoupper(str_replace(' ', '-', $num));
            }
        }

        $queries = array_unique($queries);
        if ($queries === []) {
            return [];
        }

        $result = [];
        foreach ($queries as $query) {
            $order = Order::query()
                ->with(['user:id,name,email', 'items:id,order_id,name,qty,line_total'])
                ->where(function ($q) use ($query) {
                    $q->where('order_number', 'like', '%' . $query . '%')
                        ->orWhere('id', is_numeric($query) ? (int) $query : 0);
                })
                ->first();

            if (! $order) {
                $result[] = ['query' => $query, 'found' => false];

                continue;
            }

            $result[] = [
                'found' => true,
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => $order->user->name ?? 'Guest',
                'customer_email' => $order->user->email ?? '',
                'total' => (float) $order->total,
                'status' => $order->status,
                'created_at' => $order->created_at?->format('Y-m-d H:i') ?? '',
                'items' => $order->items->map(fn ($i) => [
                    'name' => $i->name,
                    'qty' => (int) $i->qty,
                    'line_total' => (float) $i->line_total,
                ])->all(),
            ];
        }

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function lookupProductsInMessage(string $message): array
    {
        $terms = [];

        if (preg_match_all('/"([^"]{2,80})"/', $message, $quoted)) {
            $terms = array_merge($terms, $quoted[1]);
        }

        if (preg_match('/\b(?:product|item)\s+["\']?([a-z0-9][a-z0-9\s\-]{2,40})/i', $message, $m)) {
            $terms[] = trim($m[1]);
        }

        $terms = array_values(array_unique(array_filter(array_map('trim', $terms))));
        if ($terms === []) {
            return [];
        }

        $from30 = now()->subDays(self::DASHBOARD_PERIOD_DAYS - 1)->startOfDay();
        $result = [];

        foreach ($terms as $term) {
            $products = Product::query()
                ->select(['id', 'name', 'stock', 'price', 'is_active'])
                ->where('name', 'ilike', '%' . $term . '%')
                ->orderByDesc('is_active')
                ->limit(5)
                ->get();

            foreach ($products as $product) {
                $sales = OrderItem::query()
                    ->where('product_id', $product->id)
                    ->whereHas('order', fn ($q) => $q
                        ->where('created_at', '>=', $from30)
                        ->where('status', '!=', 'cancelled'))
                    ->selectRaw('COALESCE(SUM(qty), 0) as sold, COALESCE(SUM(line_total), 0) as revenue')
                    ->first();

                $result[] = [
                    'id' => $product->id,
                    'name' => $product->name,
                    'stock' => (int) $product->stock,
                    'price' => (float) $product->price,
                    'is_active' => (bool) $product->is_active,
                    'sold_30d' => (int) ($sales->sold ?? 0),
                    'revenue_30d' => (float) ($sales->revenue ?? 0),
                ];
            }
        }

        return collect($result)->unique('id')->values()->all();
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

    /**
     * @return list<array{name: string, qty_sold: int, revenue: float, product_id: int}>
     */
    private function buildTopProducts(Carbon $from, int $limit = 10): array
    {
        return OrderItem::query()
            ->select(
                'product_id',
                DB::raw('COALESCE(MAX(order_items.name), MAX(products.name)) as product_name'),
                DB::raw('MAX(products.image_url) as image_url'),
                DB::raw('MAX(products.slug) as slug'),
                DB::raw('SUM(order_items.qty) as qty_sold'),
                DB::raw('SUM(order_items.line_total) as revenue'),
            )
            ->leftJoin('products', 'order_items.product_id', '=', 'products.id')
            ->whereHas('order', fn ($q) => $q
                ->where('created_at', '>=', $from)
                ->where('status', '!=', 'cancelled'))
            ->groupBy('product_id')
            ->orderByDesc(DB::raw('SUM(order_items.qty)'))
            ->limit($limit)
            ->get()
            ->map(fn ($row) => $this->attachProductLinks([
                'product_id' => (int) $row->product_id,
                'name' => (string) ($row->product_name ?: 'Unknown product'),
                'image_url' => $row->image_url,
                'slug' => $row->slug,
                'qty_sold' => (int) $row->qty_sold,
                'revenue' => round((float) $row->revenue, 2),
            ]))
            ->values()
            ->all();
    }

    /**
     * Products worth discounting: slow movers / overstock without an active discount.
     *
     * @return list<array<string, mixed>>
     */
    private function buildDiscountRecommendations(int $limit = 12): array
    {
        $from30 = now()->subDays(self::DASHBOARD_PERIOD_DAYS - 1)->startOfDay();

        $discountedProductIds = Discount::query()
            ->where('is_active', true)
            ->pluck('product_id')
            ->filter()
            ->values()
            ->all();

        $soldByProduct = OrderItem::query()
            ->select('product_id', DB::raw('SUM(qty) as sold'))
            ->whereHas('order', fn ($q) => $q
                ->where('created_at', '>=', $from30)
                ->where('status', '!=', 'cancelled'))
            ->groupBy('product_id')
            ->pluck('sold', 'product_id');

        $query = Product::query()
            ->select(['id', 'name', 'slug', 'image_url', 'stock', 'price'])
            ->where('is_active', true)
            ->where('stock', '>', 0);

        if ($discountedProductIds !== []) {
            $query->whereNotIn('id', $discountedProductIds);
        }

        $candidates = [];
        foreach ($query->get() as $product) {
            $stock = (int) $product->stock;
            $sold30 = (int) ($soldByProduct->get($product->id, 0));
            $scored = $this->scoreDiscountCandidate($stock, $sold30);

            if ($scored === null) {
                continue;
            }

            [$reason, $reasonKm, $priority, $suggestedPct] = $scored;

            $candidates[] = [
                'row' => $this->attachProductLinks([
                    'id' => $product->id,
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'image_url' => $product->image_url,
                    'stock' => $stock,
                    'price' => (float) $product->price,
                    'sold_30d' => $sold30,
                    'reason' => $reason,
                    'reason_km' => $reasonKm,
                    'suggested_discount_pct' => $suggestedPct,
                ]),
                'priority' => $priority,
            ];
        }

        usort($candidates, fn (array $a, array $b) => $b['priority'] <=> $a['priority']);

        return array_values(array_map(
            fn (array $item) => $item['row'],
            array_slice($candidates, 0, $limit),
        ));
    }

    /**
     * @return array{0: string, 1: string, 2: int, 3: int}|null
     */
    private function scoreDiscountCandidate(int $stock, int $sold30): ?array
    {
        if ($sold30 === 0 && $stock >= 5) {
            $pct = min(30, 15 + (int) floor($stock / 10));

            return [
                'No sales in 30 days, stock=' . $stock,
                'មិនមានលក់ ៣០ថ្ងៃ — ស្តុក ' . $stock,
                100 + $stock,
                $pct,
            ];
        }

        if ($stock >= 10 && $sold30 <= 2) {
            $pct = min(25, 10 + ($stock - $sold30));

            return [
                'Slow mover: ' . $sold30 . ' sold vs ' . $stock . ' in stock (30d)',
                'លក់យឺត — ' . $sold30 . ' / ៣០ថ្ងៃ, ស្តុក ' . $stock,
                60 + $stock - $sold30,
                $pct,
            ];
        }

        if ($sold30 > 0 && ($stock / $sold30) >= 5) {
            $pct = min(20, 10 + (int) floor($stock / $sold30));

            return [
                'Overstock: ' . $stock . ' in stock vs ' . $sold30 . ' sold (30d)',
                'ស្តុកច្រើន — ' . $stock . ' ធៀប ' . $sold30 . ' លក់/៣០ថ្ងៃ',
                40 + (int) ($stock / max($sold30, 1)),
                $pct,
            ];
        }

        return null;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function formatDiscountRecommendations(array $rows): string
    {
        if ($rows === []) {
            return 'No slow-moving products need a discount right now (or all candidates already have active discounts).';
        }

        return collect($rows)
            ->map(fn (array $p, int $i) => sprintf(
                '  %d. %s — stock=%d, sold_30d=%d, suggest=%d%%, reason=%s',
                $i + 1,
                $p['name'] ?? '?',
                (int) ($p['stock'] ?? 0),
                (int) ($p['sold_30d'] ?? 0),
                (int) ($p['suggested_discount_pct'] ?? 0),
                $p['reason'] ?? '?',
            ))
            ->implode("\n");
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildRecentOrders(int $limit = 10): array
    {
        return Order::query()
            ->with('user:id,name')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => $order->user->name ?? 'Guest',
                'total' => (float) $order->total,
                'status' => $order->status,
                'created_at' => $order->created_at?->format('Y-m-d H:i') ?? '',
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildPendingOrders(int $limit = 10): array
    {
        return Order::query()
            ->with('user:id,name')
            ->whereIn('status', self::PENDING_ORDER_STATUSES)
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => $order->user->name ?? 'Guest',
                'total' => (float) $order->total,
                'status' => $order->status,
                'created_at' => $order->created_at?->format('Y-m-d H:i') ?? '',
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildLowStockProducts(int $limit = 15): array
    {
        return Product::query()
            ->select(['id', 'name', 'slug', 'image_url', 'stock', 'price', 'is_active'])
            ->where('stock', '<', 10)
            ->orderBy('stock')
            ->limit($limit)
            ->get()
            ->map(fn (Product $p) => $this->attachProductLinks([
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'image_url' => $p->image_url,
                'stock' => (int) $p->stock,
                'price' => (float) $p->price,
                'is_active' => (bool) $p->is_active,
            ]))
            ->all();
    }

    /**
     * @return list<array{date: string, revenue: float, orders: int}>
     */
    private function buildDailyRevenue(Carbon $from, Carbon $to): array
    {
        return Order::query()
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as orders'),
                DB::raw('SUM(total) as revenue'),
            )
            ->whereBetween('created_at', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => [
                'date' => (string) $row->date,
                'revenue' => round((float) $row->revenue, 2),
                'orders' => (int) $row->orders,
            ])
            ->all();
    }

    /**
     * @return list<array{status: string, count: int}>
     */
    private function ordersGroupedByStatus(Carbon $from, ?Carbon $to = null): array
    {
        $query = Order::query()->where('created_at', '>=', $from);
        if ($to !== null) {
            $query->where('created_at', '<=', $to);
        }

        return $query
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

    private function collect(): array
    {
        $today = now()->startOfDay();
        $thisMonth = now()->startOfMonth();
        $last7DaysStart = now()->subDays(6)->startOfDay();
        $last30DaysStart = now()->subDays(self::DASHBOARD_PERIOD_DAYS - 1)->startOfDay();
        $endOfToday = now()->endOfDay();

        $todayRevenue = OrderMetrics::sumRevenue($today, null);
        $last7Revenue = OrderMetrics::sumRevenue($last7DaysStart, $endOfToday);
        $last30Revenue = OrderMetrics::sumRevenue($last30DaysStart, $endOfToday);
        $monthRevenue = OrderMetrics::sumRevenue($thisMonth, null);

        $todayOrderCount = Order::query()->where('created_at', '>=', $today)->count();
        $last7OrderCount = Order::query()->where('created_at', '>=', $last7DaysStart)->count();

        $pendingOrders = Order::query()
            ->whereIn('status', self::PENDING_ORDER_STATUSES)
            ->count();

        $ordersByStatusToday = $this->ordersGroupedByStatus($today);
        $ordersByStatusLast7 = $this->ordersGroupedByStatus($last7DaysStart);
        $ordersByStatus30d = $this->ordersGroupedByStatus($last30DaysStart, $endOfToday);

        $statusCounts30d = collect($ordersByStatus30d)->pluck('count', 'status');
        $totalOrders30d = (int) $statusCounts30d->sum();
        $pendingOrders30d = (int) ($statusCounts30d->get('pending', 0) + $statusCounts30d->get('pending_payment', 0));
        $processingOrders30d = (int) $statusCounts30d->get('processing', 0);
        $completedOrders30d = (int) ($statusCounts30d->get('completed', 0) + $statusCounts30d->get('delivered', 0));

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
        $newCustomers30d = User::query()
            ->where('role', 'customer')
            ->whereBetween('created_at', [$last30DaysStart, $endOfToday])
            ->count();

        $categoryCount = Category::query()->count();
        $brandCount = Brand::query()->count();
        $activeDiscounts = Discount::query()->where('is_active', true)->count();

        $alerts = [];
        if ($pendingOrders > 0) {
            $alerts[] = "{$pendingOrders} order(s) awaiting fulfillment";
        }
        if ($lowStock > 0) {
            $alerts[] = "{$lowStock} product(s) below stock threshold";
        }
        if ($failedPayments > 0) {
            $alerts[] = "{$failedPayments} failed payment(s)";
        }
        if ($openReplacements > 0) {
            $alerts[] = "{$openReplacements} open replacement case(s)";
        }
        if ($unreadContacts > 0) {
            $alerts[] = "{$unreadContacts} unread contact submission(s)";
        }

        return [
            'generated_at' => now()->toIso8601String(),
            'store' => config('app.name', 'Fit & Sleek'),
            'periods' => [
                'today_from' => $today->toIso8601String(),
                'last_7_days_from' => $last7DaysStart->toDateString(),
                'last_7_days_to' => now()->toDateString(),
                'last_30_days_from' => $last30DaysStart->toDateString(),
                'last_30_days_to' => now()->toDateString(),
                'month_from' => $thisMonth->toDateString(),
            ],
            'dashboard' => [
                'period_days' => self::DASHBOARD_PERIOD_DAYS,
                'revenue' => [
                    'total' => $last30Revenue,
                    'today' => $todayRevenue,
                    'month' => $monthRevenue,
                ],
                'orders' => [
                    'total' => $totalOrders30d,
                    'pending' => $pendingOrders30d,
                    'processing' => $processingOrders30d,
                    'completed' => $completedOrders30d,
                ],
                'orders_by_status' => $ordersByStatus30d,
                'customers' => [
                    'total' => $customerCount,
                    'new_in_period' => $newCustomers30d,
                ],
                'products' => [
                    'total' => $totalProducts,
                    'active' => $activeProducts,
                    'low_stock' => $lowStock,
                ],
                'daily_revenue' => $this->buildDailyRevenue($last30DaysStart, $endOfToday),
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
                'today' => $todayRevenue,
                'last_7_days' => $last7Revenue,
                'last_30_days' => $last30Revenue,
                'month' => $monthRevenue,
                'currency' => 'USD',
            ],
            'orders' => [
                'today_count' => $todayOrderCount,
                'last_7_days_count' => $last7OrderCount,
                'last_30_days_count' => $totalOrders30d,
                'pending' => $pendingOrders,
                'by_status_today' => $ordersByStatusToday,
                'by_status_last_7_days' => $ordersByStatusLast7,
                'by_status_last_30_days' => $ordersByStatus30d,
            ],
            'sales' => [
                'top_products_today' => $this->buildTopProducts($today),
                'top_products_7d' => $this->buildTopProducts($last7DaysStart),
                'top_products_30d' => $this->buildTopProducts($last30DaysStart),
            ],
            'recent_orders' => $this->buildRecentOrders(10),
            'pending_orders' => $this->buildPendingOrders(10),
            'low_stock_products' => $this->buildLowStockProducts(15),
            'discount_recommendations' => $this->buildDiscountRecommendations(12),
            'products' => [
                'total' => $totalProducts,
                'active' => $activeProducts,
                'low_stock' => $lowStock,
            ],
            'catalog' => [
                'categories' => $categoryCount,
                'brands' => $brandCount,
                'active_discounts' => $activeDiscounts,
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
            'note' => 'All figures are live from the store database. Use top_products, recent_orders, and low_stock_products for detailed answers.',
        ];
    }
}
