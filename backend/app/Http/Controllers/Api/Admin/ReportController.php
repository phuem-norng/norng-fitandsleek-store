<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ShipmentTrackingEvent;
use App\Models\User;
use App\Models\Category;
use App\Models\Setting;
use App\Support\AdminSpreadsheetExport;
use App\Support\OrderMetrics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;

class ReportController extends Controller
{
    private function resolveLogoDataUri(): ?string
    {
        $setting = Setting::where('key', 'header')->where('group', 'homepage')->first();
        $value = $setting?->value;
        $logoUrl = is_array($value) ? ($value['logo_url'] ?? null) : null;

        if (!$logoUrl) return null;

        $content = null;
        $ext = 'png';

        if (str_starts_with($logoUrl, 'http')) {
            $content = @file_get_contents($logoUrl);
            $ext = pathinfo(parse_url($logoUrl, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION) ?: 'png';
        } else {
            $path = $logoUrl;
            if (str_starts_with($path, '/')) {
                $path = public_path($path);
            } else {
                $path = public_path('/' . ltrim($path, '/'));
            }
            if (is_file($path)) {
                $content = @file_get_contents($path);
                $ext = pathinfo($path, PATHINFO_EXTENSION) ?: 'png';
            }
        }

        if (!$content) return null;

        $ext = strtolower($ext);
        if ($ext === 'svg') {
            return null;
        }

        $mime = match ($ext) {
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'image/png',
        };

        return 'data:' . $mime . ';base64,' . base64_encode($content);
    }

    private function buildDashboardReport(Carbon $from, Carbon $to): array
    {
        $today = now()->startOfDay();
        $thisMonth = now()->startOfMonth();

        $fromRange = $from->copy()->startOfDay();
        $toRange = $to->copy()->endOfDay();

        $totalRevenue = OrderMetrics::sumRevenue($fromRange, $toRange);
        $monthRevenue = OrderMetrics::sumRevenue($thisMonth, null);
        $todayRevenue = OrderMetrics::sumRevenue($today, null);

        $ordersInRange = Order::whereBetween('created_at', [$fromRange, $toRange]);
        $totalOrders = (clone $ordersInRange)->count();
        $pendingOrders = (clone $ordersInRange)->where('status', 'pending')->count();
        $processingOrders = (clone $ordersInRange)->where('status', 'processing')->count();
        $completedOrders = (clone $ordersInRange)->where('status', 'completed')->count();

        $totalProducts = Product::count();
        $activeProducts = Product::where('is_active', true)->count();
        $lowStockProducts = Product::where('stock', '<', 10)->count();

        $totalCustomers = User::where('role', 'customer')->count();
        $newCustomersThisMonth = User::where('role', 'customer')
            ->whereBetween('created_at', [$fromRange, $toRange])
            ->count();

        return [
            'type' => 'dashboard',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'revenue' => [
                'total' => round($totalRevenue, 2),
                'month' => round($monthRevenue, 2),
                'today' => round($todayRevenue, 2),
            ],
            'orders' => [
                'total' => $totalOrders,
                'pending' => $pendingOrders,
                'processing' => $processingOrders,
                'completed' => $completedOrders,
            ],
            'products' => [
                'total' => $totalProducts,
                'active' => $activeProducts,
                'low_stock' => $lowStockProducts,
            ],
            'customers' => [
                'total' => $totalCustomers,
                'new_this_month' => $newCustomersThisMonth,
            ],
        ];
    }
    private function buildSalesReport(Carbon $from, Carbon $to): array
    {
        $sales = Order::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as orders'),
            DB::raw('SUM(total) as revenue')
        )
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->where('status', '!=', 'cancelled')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get();

        $totalOrders = (int) $sales->sum('orders');
        $totalRevenue = (float) $sales->sum('revenue');

        return [
            'type' => 'sales',
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'summary' => [
                'total_orders' => $totalOrders,
                'total_revenue' => round($totalRevenue, 2),
            ],
            'rows' => $sales,
        ];
    }

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:sales,dashboard'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        $from = Carbon::parse($validated['from']);
        $to = Carbon::parse($validated['to']);

        if ($from->gt($to)) {
            return response()->json(['message' => 'Date From must be before Date To.'], 422);
        }

        if ($validated['type'] === 'sales') {
            return response()->json([
                'data' => $this->buildSalesReport($from, $to),
            ]);
        }

        if ($validated['type'] === 'dashboard') {
            return response()->json([
                'data' => $this->buildDashboardReport($from, $to),
            ]);
        }

        return response()->json(['message' => 'Invalid report type'], 422);
    }

    public function downloadPdf(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:sales,dashboard'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        $from = Carbon::parse($validated['from']);
        $to = Carbon::parse($validated['to']);

        if ($from->gt($to)) {
            return response()->json(['message' => 'Date From must be before Date To.'], 422);
        }

        try {
            $logoDataUri = $this->resolveLogoDataUri();

            // Match the Stock & Inventory PDF: DomPDF must fetch the banner image
            // and Fontsource TTFs over HTTPS, and HTML5 mode is needed for the
            // <table>-based header layout.
            $pdfOptions = [
                'isRemoteEnabled' => true,
                'isHtml5ParserEnabled' => true,
                'defaultFont' => 'DejaVu Sans',
            ];

            if ($validated['type'] === 'dashboard') {
                $data = $this->buildDashboardReport($from, $to);
                $data['logo'] = $logoDataUri;
                $pdf = Pdf::setOptions($pdfOptions)
                    ->loadView('reports.dashboard', $data)
                    ->setPaper('A4', 'portrait');
                $filename = 'dashboard-report-' . $from->format('Ymd') . '-to-' . $to->format('Ymd') . '.pdf';
                $content = $pdf->output();
                return response($content, 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                ]);
            }

            $data = $this->buildSalesReport($from, $to);
            $data['logo'] = $logoDataUri;

            $pdf = Pdf::setOptions($pdfOptions)
                ->loadView('reports.sales', $data)
                ->setPaper('A4', 'portrait');
            $filename = 'sales-report-' . $from->format('Ymd') . '-to-' . $to->format('Ymd') . '.pdf';
            $content = $pdf->output();
            return response($content, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        } catch (\Throwable $e) {
            Log::error('Report PDF download failed', [
                'type' => $validated['type'],
                'from' => $validated['from'],
                'to' => $validated['to'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to generate PDF. Please try again.',
            ], 500);
        }
    }

    public function downloadExcel(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:sales,dashboard'],
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        $from = Carbon::parse($validated['from']);
        $to = Carbon::parse($validated['to']);

        if ($from->gt($to)) {
            return response()->json(['message' => 'Date From must be before Date To.'], 422);
        }

        try {
            if ($validated['type'] === 'dashboard') {
                $data = $this->buildDashboardReport($from, $to);
                $filename = 'dashboard-report-'.$from->format('Ymd').'-to-'.$to->format('Ymd').'.xls';

                return AdminSpreadsheetExport::download(
                    ['Metric', 'Value'],
                    [
                        ['Report period', $data['from'].' to '.$data['to']],
                        ['Revenue in range', '$'.number_format($data['revenue']['total'], 2)],
                        ['Revenue this month', '$'.number_format($data['revenue']['month'], 2)],
                        ['Revenue today', '$'.number_format($data['revenue']['today'], 2)],
                        ['Total orders', (string) $data['orders']['total']],
                        ['Pending orders', (string) $data['orders']['pending']],
                        ['Processing orders', (string) $data['orders']['processing']],
                        ['Completed orders', (string) $data['orders']['completed']],
                        ['Total products', (string) $data['products']['total']],
                        ['Active products', (string) $data['products']['active']],
                        ['Low stock products', (string) $data['products']['low_stock']],
                        ['Total customers', (string) $data['customers']['total']],
                        ['New customers in range', (string) $data['customers']['new_this_month']],
                    ],
                    $filename,
                );
            }

            $data = $this->buildSalesReport($from, $to);
            $filename = 'sales-report-'.$from->format('Ymd').'-to-'.$to->format('Ymd').'.xls';
            $rows = [];

            foreach ($data['rows'] as $row) {
                $rows[] = [
                    (string) $row->date,
                    (string) $row->orders,
                    '$'.number_format((float) $row->revenue, 2),
                ];
            }

            $rows[] = [
                'Total',
                (string) $data['summary']['total_orders'],
                '$'.number_format($data['summary']['total_revenue'], 2),
            ];

            return AdminSpreadsheetExport::download(
                ['Date', 'Orders', 'Revenue'],
                $rows,
                $filename,
            );
        } catch (\Throwable $e) {
            Log::error('Report Excel download failed', [
                'type' => $validated['type'],
                'from' => $validated['from'],
                'to' => $validated['to'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to generate Excel file. Please try again.',
            ], 500);
        }
    }

    // Resolve a date range from request params (from/to or period days)
    private function resolveDateRange(Request $request): array
    {
        if ($request->filled('from') && $request->filled('to')) {
            return [
                Carbon::parse($request->input('from'))->startOfDay(),
                Carbon::parse($request->input('to'))->endOfDay(),
            ];
        }

        if ($request->filled('period')) {
            $days = (int) $request->input('period');
            return [
                now()->subDays($days)->startOfDay(),
                now()->endOfDay(),
            ];
        }

        // Lifetime / no filter
        return [
            Carbon::parse('2000-01-01')->startOfDay(),
            now()->endOfDay(),
        ];
    }

    // Dashboard overview — respects from/to or period query params
    public function dashboard(Request $request)
    {
        [$fromRange, $toRange] = $this->resolveDateRange($request);

        $today      = now()->startOfDay();
        $thisMonth  = now()->startOfMonth();

        // Revenue in the selected range
        $totalRevenue = OrderMetrics::sumRevenue($fromRange, $toRange);

        // Always-current reference figures for the subtext
        $monthRevenue = OrderMetrics::sumRevenue($thisMonth, null);
        $todayRevenue = OrderMetrics::sumRevenue($today, null);

        // Orders in the selected range
        $ordersInRange    = Order::whereBetween('created_at', [$fromRange, $toRange]);
        $totalOrders      = (clone $ordersInRange)->count();
        $pendingOrders    = (clone $ordersInRange)->where('status', 'pending')->count();
        $processingOrders = (clone $ordersInRange)->where('status', 'processing')->count();
        $completedOrders  = (clone $ordersInRange)->where('status', 'completed')->count();

        /** Counts grouped by lifecycle status — used for dashboard charts */
        $ordersByStatusRows = Order::query()
            ->whereBetween('created_at', [$fromRange, $toRange])
            ->select('status', DB::raw('COUNT(*) as cnt'))
            ->groupBy('status')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get();

        // Product stats — inventory has no date context
        $totalProducts   = Product::count();
        $activeProducts  = Product::where('is_active', true)->count();
        $lowStockProducts = Product::where('stock', '<', 10)->count();

        // Customer stats
        $totalCustomers       = User::where('role', 'customer')->count();
        $newCustomersInRange  = User::where('role', 'customer')
            ->whereBetween('created_at', [$fromRange, $toRange])
            ->count();

        return response()->json([
            'revenue' => [
                'total' => round($totalRevenue, 2),
                'month' => round($monthRevenue, 2),
                'today' => round($todayRevenue, 2),
            ],
            'orders' => [
                'total'      => $totalOrders,
                'pending'    => $pendingOrders,
                'processing' => $processingOrders,
                'completed'  => $completedOrders,
            ],
            /** For charts: `{ status: string, count: int }[]` ordered by descending count */
            'orders_by_status' => $ordersByStatusRows->map(fn ($row) => [
                'status' => (string) $row->status,
                'count'  => (int) $row->cnt,
            ])->values(),
            'products' => [
                'total'     => $totalProducts,
                'active'    => $activeProducts,
                'low_stock' => $lowStockProducts,
            ],
            'customers' => [
                'total'          => $totalCustomers,
                'new_this_month' => $newCustomersInRange,
            ],
            'period' => [
                'from' => $fromRange->toDateString(),
                'to' => $toRange->toDateString(),
            ],
        ]);
    }

    // Sales chart — respects from/to or period query params
    public function sales(Request $request)
    {
        [$startDate, $endDate] = $this->resolveDateRange($request);

        $sales = Order::select(
            DB::raw('DATE(created_at) as date'),
            DB::raw('COUNT(*) as orders'),
            DB::raw('SUM(total) as revenue')
        )
            ->whereBetween('created_at', [$startDate, $endDate])
            ->where('status', '!=', 'cancelled')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get();

        return response()->json([
            'sales' => $sales,
        ]);
    }

    public function monthlyDriverPerformance(Request $request)
    {
        $range = $request->input('range', 'month');
        if (! in_array($range, ['today', 'week', 'month', 'year'], true)) {
            return response()->json(['message' => 'Invalid range. Use today, week, month, or year.'], 422);
        }

        $now = now();

        if ($range === 'today') {
            $start = $now->copy()->startOfDay();
            $end = $now->copy()->endOfDay();
        } elseif ($range === 'week') {
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
        } elseif ($range === 'month') {
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
        } else {
            $start = $now->copy()->startOfYear();
            $end = $now->copy()->endOfYear();
        }

        $events = ShipmentTrackingEvent::query()
            ->with('updatedBy:id,name')
            ->where('status', 'delivered')
            ->whereNotNull('updated_by')
            ->whereBetween('event_time', [$start, $end])
            ->get();

        $buckets = [];

        foreach ($events as $event) {
            if (! $event->event_time) {
                continue;
            }

            if ($range === 'today') {
                $bucketKey = $event->event_time->format('Y-m-d H');
                $bucketLabel = $event->event_time->format('H:00');
            } elseif ($range === 'week') {
                $bucketKey = $event->event_time->toDateString();
                $bucketLabel = $event->event_time->format('D');
            } elseif ($range === 'month') {
                $weekStart = $event->event_time->copy()->startOfWeek();
                $bucketKey = $weekStart->toDateString();
                $bucketLabel = $weekStart->format('M d');
            } else {
                $bucketKey = $event->event_time->format('Y-m');
                $bucketLabel = $event->event_time->format('M');
            }

            $driverId = (int) $event->updated_by;

            if (! isset($buckets[$bucketKey])) {
                $buckets[$bucketKey] = [
                    'label' => $bucketLabel,
                    'counts' => [],
                    'names' => [],
                ];
            }

            $buckets[$bucketKey]['counts'][$driverId] = ($buckets[$bucketKey]['counts'][$driverId] ?? 0) + 1;

            if (! empty($event->updatedBy?->name)) {
                $buckets[$bucketKey]['names'][$driverId] = $event->updatedBy->name;
            }
        }

        $rows = [];
        if ($range === 'today') {
            $cursor = $start->copy();
            while ($cursor->lte($end)) {
                $bucketKey = $cursor->format('Y-m-d H');
                $bucketLabel = $cursor->format('H:00');

                $counts = $buckets[$bucketKey]['counts'] ?? [];
                $names = $buckets[$bucketKey]['names'] ?? [];

                if (! empty($counts)) {
                    arsort($counts);
                    $topDriverId = (int) array_key_first($counts);
                    $topCount = (int) ($counts[$topDriverId] ?? 0);
                    $topDriverName = $names[$topDriverId] ?? 'Unknown Driver';
                } else {
                    $topDriverId = null;
                    $topCount = 0;
                    $topDriverName = null;
                }

                $rows[] = [
                    'bucket' => $bucketKey,
                    'bucket_label' => $bucketLabel,
                    'month' => $bucketKey,
                    'month_label' => $bucketLabel,
                    'top_driver_id' => $topDriverId,
                    'top_driver_name' => $topDriverName,
                    'successful_deliveries' => $topCount,
                ];

                $cursor->addHour();
            }
        } elseif ($range === 'week') {
            $cursor = $start->copy();
            while ($cursor->lte($end)) {
                $bucketKey = $cursor->toDateString();
                $bucketLabel = $cursor->format('D');

                $counts = $buckets[$bucketKey]['counts'] ?? [];
                $names = $buckets[$bucketKey]['names'] ?? [];

                if (! empty($counts)) {
                    arsort($counts);
                    $topDriverId = (int) array_key_first($counts);
                    $topCount = (int) ($counts[$topDriverId] ?? 0);
                    $topDriverName = $names[$topDriverId] ?? 'Unknown Driver';
                } else {
                    $topDriverId = null;
                    $topCount = 0;
                    $topDriverName = null;
                }

                $rows[] = [
                    'bucket' => $bucketKey,
                    'bucket_label' => $bucketLabel,
                    'month' => $bucketKey,
                    'month_label' => $bucketLabel,
                    'top_driver_id' => $topDriverId,
                    'top_driver_name' => $topDriverName,
                    'successful_deliveries' => $topCount,
                ];

                $cursor->addDay();
            }
        } elseif ($range === 'month') {
            $cursor = $start->copy()->startOfWeek();
            $endCursor = $end->copy()->endOfWeek();
            while ($cursor->lte($endCursor)) {
                $bucketKey = $cursor->toDateString();
                $bucketLabel = $cursor->format('M d');

                $counts = $buckets[$bucketKey]['counts'] ?? [];
                $names = $buckets[$bucketKey]['names'] ?? [];

                if (! empty($counts)) {
                    arsort($counts);
                    $topDriverId = (int) array_key_first($counts);
                    $topCount = (int) ($counts[$topDriverId] ?? 0);
                    $topDriverName = $names[$topDriverId] ?? 'Unknown Driver';
                } else {
                    $topDriverId = null;
                    $topCount = 0;
                    $topDriverName = null;
                }

                $rows[] = [
                    'bucket' => $bucketKey,
                    'bucket_label' => $bucketLabel,
                    'month' => $bucketKey,
                    'month_label' => $bucketLabel,
                    'top_driver_id' => $topDriverId,
                    'top_driver_name' => $topDriverName,
                    'successful_deliveries' => $topCount,
                ];

                $cursor->addWeek();
            }
        } else {
            $cursor = $start->copy();
            while ($cursor->lte($end)) {
                $bucketKey = $cursor->format('Y-m');
                $bucketLabel = $cursor->format('M');

                $counts = $buckets[$bucketKey]['counts'] ?? [];
                $names = $buckets[$bucketKey]['names'] ?? [];

                if (! empty($counts)) {
                    arsort($counts);
                    $topDriverId = (int) array_key_first($counts);
                    $topCount = (int) ($counts[$topDriverId] ?? 0);
                    $topDriverName = $names[$topDriverId] ?? 'Unknown Driver';
                } else {
                    $topDriverId = null;
                    $topCount = 0;
                    $topDriverName = null;
                }

                $rows[] = [
                    'bucket' => $bucketKey,
                    'bucket_label' => $bucketLabel,
                    'month' => $bucketKey,
                    'month_label' => $bucketLabel,
                    'top_driver_id' => $topDriverId,
                    'top_driver_name' => $topDriverName,
                    'successful_deliveries' => $topCount,
                ];

                $cursor->addMonth();
            }
        }

        return response()->json([
            'range' => $range,
            'from' => $start->toDateString(),
            'to' => $end->toDateString(),
            'data' => $rows,
        ]);
    }

    // Top products — respects from/to or period query params
    public function topProducts(Request $request)
    {
        $limit = $request->input('limit', 10);

        $query = OrderItem::select(
            'product_id',
            DB::raw('SUM(qty) as total_sold'),
            DB::raw('SUM(line_total) as total_revenue')
        )->with('product:id,name,image_url,price');

        // Filter order items through their parent order's created_at
        if ($request->filled('from') && $request->filled('to')) {
            $from = Carbon::parse($request->input('from'))->startOfDay();
            $to   = Carbon::parse($request->input('to'))->endOfDay();
            $query->whereHas('order', fn($q) =>
                $q->whereBetween('created_at', [$from, $to])
                  ->where('status', '!=', 'cancelled')
            );
        } elseif ($request->filled('period')) {
            $start = now()->subDays((int) $request->input('period'))->startOfDay();
            $query->whereHas('order', fn($q) =>
                $q->where('created_at', '>=', $start)
                  ->where('status', '!=', 'cancelled')
            );
        }

        $topProducts = $query
            ->groupBy('product_id')
            ->orderByDesc('total_sold')
            ->limit($limit)
            ->get()
            ->map(fn($item) => [
                'product_id'    => $item->product_id,
                'product'       => $item->product,
                'total_sold'    => (int)   $item->total_sold,
                'total_revenue' => (float) $item->total_revenue,
            ]);

        return response()->json(['data' => $topProducts]);
    }

    // Category performance
    public function categoryPerformance()
    {
        $categories = Category::withCount(['products as products_count' => function ($query) {
                $query->where('is_active', true);
            }])
            ->withSum(['products' => function ($query) {
                $query->where('is_active', true);
            }], 'stock')
            ->get();

        return response()->json($categories);
    }

    /**
     * Product catalogue breakdown: count by storefront category and by stock-label origin (country).
     */
    public function productAnalytics()
    {
        $totalProducts = Product::count();

        $stockType = Category::STOCK_INVENTORY_TYPE;
        $categoryRows = Product::query()
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->select(
                DB::raw("CASE
                    WHEN products.category_id IS NULL THEN 0
                    WHEN categories.type = '{$stockType}' THEN 0
                    ELSE categories.id
                END as category_id"),
                DB::raw("CASE
                    WHEN products.category_id IS NULL THEN 'Uncategorized'
                    WHEN categories.type = '{$stockType}' OR categories.id IS NULL THEN 'Uncategorized'
                    WHEN TRIM(COALESCE(categories.name, '')) = '' THEN 'Uncategorized'
                    ELSE categories.name
                END as name"),
                DB::raw('COUNT(products.id) as count')
            )
            ->groupBy(DB::raw('1'), DB::raw('2'))
            ->orderByDesc('count')
            ->get();

        $byCategory = $this->bucketChartSlices(
            $categoryRows->map(fn ($row) => [
                'id' => (int) $row->category_id,
                'name' => (string) $row->name,
                'count' => (int) $row->count,
            ])->values()->all(),
            $totalProducts,
            11,
            'Other categories'
        );

        $countryRows = Product::query()
            ->leftJoin('categories as stock_labels', 'products.stock_label_id', '=', 'stock_labels.id')
            ->select(
                DB::raw("COALESCE(NULLIF(TRIM(stock_labels.origin), ''), 'unknown') as country_key"),
                DB::raw('COUNT(products.id) as count')
            )
            ->groupBy('country_key')
            ->orderByDesc('count')
            ->get();

        $byCountry = $this->bucketChartSlices(
            $countryRows->map(fn ($row) => [
                'code' => (string) $row->country_key,
                'name' => $this->formatCountryKey((string) $row->country_key),
                'count' => (int) $row->count,
            ])->values()->all(),
            $totalProducts,
            9,
            'Other countries'
        );

        return response()->json([
            'total_products' => $totalProducts,
            'by_category' => $byCategory,
            'by_country' => $byCountry,
        ]);
    }

    /**
     * Order breakdown: counts by lifecycle status and by storefront category (distinct orders).
     */
    public function orderAnalytics(Request $request)
    {
        $ordersQuery = Order::query();
        $this->applyOrderPeriodFilter($ordersQuery, $request, 'created_at');

        $statusRows = (clone $ordersQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get();

        $totalOrders = (int) $statusRows->sum('count');

        $byStatus = $this->bucketChartSlices(
            $statusRows->map(fn ($row) => [
                'name' => $this->formatOrderStatus((string) $row->status),
                'count' => (int) $row->count,
            ])->values()->all(),
            (float) max($totalOrders, 0),
            11,
            'Other statuses'
        );

        $stockType = Category::STOCK_INVENTORY_TYPE;
        $categoryNameSql = "CASE
            WHEN products.category_id IS NULL THEN 'Uncategorized'
            WHEN categories.type = '{$stockType}' OR categories.id IS NULL THEN 'Uncategorized'
            WHEN TRIM(COALESCE(categories.name, '')) = '' THEN 'Uncategorized'
            ELSE categories.name
        END";

        $categoryQuery = OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->leftJoin('products', 'order_items.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->where('orders.status', '!=', 'cancelled');

        $this->applyOrderPeriodFilter($categoryQuery, $request);

        $categoryRows = (clone $categoryQuery)
            ->select(
                DB::raw("{$categoryNameSql} as category_name"),
                DB::raw('COUNT(DISTINCT orders.id) as count')
            )
            ->groupBy(DB::raw($categoryNameSql))
            ->orderByDesc('count')
            ->get();

        $categoryOrderTotal = (int) $categoryRows->sum('count');

        $byCategory = $this->bucketChartSlices(
            $categoryRows->map(fn ($row) => [
                'name' => (string) $row->category_name,
                'count' => (int) $row->count,
            ])->values()->all(),
            (float) max($categoryOrderTotal, 0),
            11,
            'Other categories'
        );

        return response()->json([
            'total_orders' => $totalOrders,
            'by_status' => $byStatus,
            'by_category' => $byCategory,
        ]);
    }

    private function applyOrderPeriodFilter($query, Request $request, string $dateColumn = 'orders.created_at'): void
    {
        if ($request->filled('from') && $request->filled('to')) {
            $from = Carbon::parse($request->input('from'))->startOfDay();
            $to = Carbon::parse($request->input('to'))->endOfDay();
            $query->whereBetween($dateColumn, [$from, $to]);

            return;
        }

        if ($request->filled('period')) {
            $start = now()->subDays((int) $request->input('period'))->startOfDay();
            $query->where($dateColumn, '>=', $start);
        }
    }

    private function formatOrderStatus(string $status): string
    {
        $normalized = trim(str_replace(['_', '-'], ' ', $status));

        return $normalized !== '' ? ucwords($normalized) : 'Unknown';
    }

    /**
     * Sales performance grouped by storefront product category (order line items).
     */
    public function categorySalesAnalytics(Request $request)
    {
        $limit = min(max((int) $request->input('limit', 10), 1), 20);
        $stockType = Category::STOCK_INVENTORY_TYPE;

        $query = OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->leftJoin('products', 'order_items.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->where('orders.status', '!=', 'cancelled');

        if ($request->filled('from') && $request->filled('to')) {
            $from = Carbon::parse($request->input('from'))->startOfDay();
            $to = Carbon::parse($request->input('to'))->endOfDay();
            $query->whereBetween('orders.created_at', [$from, $to]);
        } elseif ($request->filled('period')) {
            $start = now()->subDays((int) $request->input('period'))->startOfDay();
            $query->where('orders.created_at', '>=', $start);
        }

        $categoryNameSql = "CASE
            WHEN products.category_id IS NULL THEN 'Uncategorized'
            WHEN categories.type = '{$stockType}' OR categories.id IS NULL THEN 'Uncategorized'
            WHEN TRIM(COALESCE(categories.name, '')) = '' THEN 'Uncategorized'
            ELSE categories.name
        END";

        $rows = (clone $query)
            ->select(
                DB::raw("{$categoryNameSql} as category_name"),
                DB::raw('SUM(order_items.qty) as units_sold'),
                DB::raw('SUM(order_items.line_total) as revenue')
            )
            ->groupBy(DB::raw($categoryNameSql))
            ->orderByDesc('revenue')
            ->get();

        $totalRevenue = (float) $rows->sum('revenue');
        $totalUnits = (int) $rows->sum('units_sold');

        $revenueByCategory = $this->bucketChartSlices(
            $rows->map(fn ($row) => [
                'name' => (string) $row->category_name,
                'revenue' => (float) $row->revenue,
            ])->values()->all(),
            $totalRevenue,
            11,
            'Other categories',
            'revenue'
        );

        $topCategories = $rows
            ->take($limit)
            ->map(fn ($row) => [
                'name' => (string) $row->category_name,
                'units_sold' => (int) $row->units_sold,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->values();

        return response()->json([
            'total_revenue' => round($totalRevenue, 2),
            'total_units' => $totalUnits,
            'revenue_by_category' => $revenueByCategory,
            'top_categories' => $topCategories,
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function bucketChartSlices(array $rows, float $total, int $maxSlices, string $otherLabel, string $valueKey = 'count'): array
    {
        if ($total <= 0 || $rows === []) {
            return [];
        }

        $top = array_slice($rows, 0, $maxSlices);
        $rest = array_slice($rows, $maxSlices);
        if ($rest !== []) {
            $otherValue = array_sum(array_map(fn ($row) => (float) ($row[$valueKey] ?? 0), $rest));
            if ($otherValue > 0) {
                $top[] = [
                    'name' => $otherLabel,
                    'code' => 'other',
                    $valueKey => $otherValue,
                ];
            }
        }

        return array_values(array_map(function ($row) use ($total, $valueKey) {
            $value = (float) ($row[$valueKey] ?? 0);
            $slice = [
                'name' => (string) ($row['name'] ?? '—'),
                'percentage' => round(($value / $total) * 100, 1),
            ];
            if (isset($row['code'])) {
                $slice['code'] = (string) $row['code'];
            }
            $slice[$valueKey] = $valueKey === 'count' ? (int) $value : round($value, 2);

            return $slice;
        }, $top));
    }

    private function formatCountryKey(string $key): string
    {
        if ($key === '' || strtolower($key) === 'unknown') {
            return 'Not set';
        }

        if (strlen($key) === 2 && ctype_alpha($key)) {
            $code = strtoupper($key);
            $names = [
                'US' => 'United States',
                'GB' => 'United Kingdom',
                'KH' => 'Cambodia',
                'CN' => 'China',
                'JP' => 'Japan',
                'KR' => 'South Korea',
                'TH' => 'Thailand',
                'VN' => 'Vietnam',
                'FR' => 'France',
                'DE' => 'Germany',
                'IT' => 'Italy',
            ];

            return $names[$code] ?? $code;
        }

        return $key;
    }

    /**
     * Revenue dashboard: monthly trend, product breakdown, and geography for a calendar year.
     */
    public function revenueAnalytics(Request $request)
    {
        $validated = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
        ]);

        $year = (int) ($validated['year'] ?? now()->year);
        $categoryId = isset($validated['category_id']) ? (int) $validated['category_id'] : null;
        $productId = isset($validated['product_id']) ? (int) $validated['product_id'] : null;
        $scopedByLineItems = $categoryId !== null || $productId !== null;

        $start = Carbon::create($year, 1, 1)->startOfDay();
        $end = Carbon::create($year, 12, 31)->endOfDay();
        $stockType = Category::STOCK_INVENTORY_TYPE;

        $itemsQuery = OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->leftJoin('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$start, $end]);

        if ($categoryId) {
            $itemsQuery->where('products.category_id', $categoryId);
        }

        if ($productId) {
            $itemsQuery->where('order_items.product_id', $productId);
        }

        if ($scopedByLineItems) {
            $monthlyRows = (clone $itemsQuery)
                ->select(
                    DB::raw('EXTRACT(MONTH FROM orders.created_at)::int as month'),
                    DB::raw('SUM(order_items.line_total) as revenue')
                )
                ->groupBy(DB::raw('EXTRACT(MONTH FROM orders.created_at)'))
                ->orderBy('month')
                ->get()
                ->keyBy('month');
        } else {
            $monthlyRows = OrderMetrics::revenueOrdersQuery($start, $end)
                ->select(
                    DB::raw('EXTRACT(MONTH FROM orders.created_at)::int as month'),
                    DB::raw('SUM(orders.total) as revenue')
                )
                ->groupBy(DB::raw('EXTRACT(MONTH FROM orders.created_at)'))
                ->orderBy('month')
                ->get()
                ->keyBy('month');
        }

        $monthLabels = [
            1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
            5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
            9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December',
        ];

        $monthly = [];
        for ($m = 1; $m <= 12; $m++) {
            $revenue = (float) ($monthlyRows->get($m)?->revenue ?? 0);
            $label = $monthLabels[$m];
            $monthly[] = [
                'month' => $m,
                'month_label' => $label,
                'month_short' => substr($label, 0, 3),
                'revenue' => round($revenue, 2),
                'year' => $year,
            ];
        }

        $byProduct = (clone $itemsQuery)
            ->select(
                'order_items.product_id',
                'products.name as product_name',
                DB::raw('SUM(order_items.line_total) as revenue')
            )
            ->whereNotNull('order_items.product_id')
            ->groupBy('order_items.product_id', 'products.name')
            ->orderByDesc(DB::raw('SUM(order_items.line_total)'))
            ->limit(20)
            ->get()
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'name' => (string) ($row->product_name ?: 'Unknown product'),
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->values();

        $countryRows = (clone $itemsQuery)
            ->select(
                DB::raw("COALESCE(NULLIF(TRIM(orders.shipping_address->>'country'), ''), 'unknown') as country_key"),
                DB::raw('SUM(order_items.line_total) as revenue')
            )
            ->groupBy(DB::raw("COALESCE(NULLIF(TRIM(orders.shipping_address->>'country'), ''), 'unknown')"))
            ->orderByDesc(DB::raw('SUM(order_items.line_total)'))
            ->limit(12)
            ->get();

        $byCountry = $countryRows->map(fn ($row) => [
            'code' => (string) $row->country_key,
            'name' => $this->formatCountryKey((string) $row->country_key),
            'revenue' => round((float) $row->revenue, 2),
        ])->values();

        $categories = Category::query()
            ->catalogOnly()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])
            ->values();

        $productsForFilter = OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$start, $end])
            ->where(function ($q) use ($stockType) {
                $q->whereNull('categories.id')
                    ->orWhere('categories.type', '!=', $stockType);
            })
            ->when($categoryId, fn ($q) => $q->where('products.category_id', $categoryId))
            ->select('products.id', 'products.name')
            ->distinct()
            ->orderBy('products.name')
            ->limit(200)
            ->get()
            ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])
            ->values();

        $totalRevenue = $scopedByLineItems
            ? round(array_sum(array_column($monthly, 'revenue')), 2)
            : OrderMetrics::sumRevenue($start, $end);

        return response()->json([
            'year' => $year,
            'total_revenue' => $totalRevenue,
            'monthly' => $monthly,
            'by_product' => $byProduct,
            'by_country' => $byCountry,
            'filters' => [
                'categories' => $categories,
                'products' => $productsForFilter,
            ],
        ]);
    }

    /**
     * Stock & Inventory: on-hand units by master label, and stock-in (received) by month across a year range.
     */
    public function stockAnalytics(Request $request)
    {
        $validated = $request->validate([
            'from_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'to_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            /** @deprecated use from_year / to_year */
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
        ]);

        $toYear = (int) ($validated['to_year'] ?? $validated['year'] ?? now()->year);
        $fromYear = (int) ($validated['from_year'] ?? $toYear - 1);

        if ($fromYear > $toYear) {
            [$fromYear, $toYear] = [$toYear, $fromYear];
        }

        $yearSpan = $toYear - $fromYear + 1;
        if ($yearSpan > 8) {
            return response()->json([
                'message' => 'Year range cannot exceed 8 years.',
            ], 422);
        }

        $compareYears = range($fromYear, $toYear);
        $stockType = Category::STOCK_INVENTORY_TYPE;

        $receivedUnitsSql = 'GREATEST(COALESCE(stock_received, stock, 0), 0)';

        $labelRows = Category::query()
            ->where('type', $stockType)
            ->whereNull('parent_id')
            ->select(
                'id',
                DB::raw("COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(slug), ''), 'Unnamed label') as label_name"),
                DB::raw("GREATEST(COALESCE(stock, 0), 0) as stock")
            )
            ->orderByDesc(DB::raw('GREATEST(COALESCE(stock, 0), 0)'))
            ->get();

        $totalStock = (int) $labelRows->sum('stock');

        $byLabel = $this->bucketChartSlices(
            $labelRows->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => (string) $row->label_name,
                'count' => (int) $row->stock,
            ])->values()->all(),
            (float) max($totalStock, 0),
            11,
            'Other labels',
            'count'
        );

        $receiveRows = Category::query()
            ->where('type', $stockType)
            ->whereNotNull('parent_id')
            ->whereNotNull('date_in')
            ->whereBetween(DB::raw('EXTRACT(YEAR FROM date_in)::int'), [$fromYear, $toYear])
            ->select(
                DB::raw('EXTRACT(YEAR FROM date_in)::int as yr'),
                DB::raw('EXTRACT(MONTH FROM date_in)::int as month'),
                DB::raw("SUM({$receivedUnitsSql}) as units")
            )
            ->groupBy(DB::raw('EXTRACT(YEAR FROM date_in)'), DB::raw('EXTRACT(MONTH FROM date_in)'))
            ->get();

        $receiveByYearMonth = [];
        foreach ($receiveRows as $row) {
            $receiveByYearMonth[(int) $row->yr][(int) $row->month] = (int) $row->units;
        }

        $monthLabels = [
            1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
            5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
            9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December',
        ];

        $monthlyCompare = [];
        for ($m = 1; $m <= 12; $m++) {
            $label = $monthLabels[$m];
            $byYear = [];
            foreach ($compareYears as $yr) {
                $byYear[(string) $yr] = (int) ($receiveByYearMonth[$yr][$m] ?? 0);
            }
            $monthlyCompare[] = [
                'month' => $m,
                'month_label' => $label,
                'month_short' => substr($label, 0, 3),
                'by_year' => $byYear,
            ];
        }

        return response()->json([
            'total_stock' => $totalStock,
            'by_label' => $byLabel,
            'monthly_compare' => $monthlyCompare,
            'compare_years' => $compareYears,
            'year_range' => [
                'from' => $fromYear,
                'to' => $toYear,
            ],
        ]);
    }

    private const PLAN_CONFIG_KEY = 'plan_config';

    /**
     * Revenue plan: target for a month range; current = cumulative revenue from plan start through plan end (or today).
     */
    public function plan(Request $request)
    {
        $validated = $request->validate([
            'plan_start_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'plan_start_month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'plan_end_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'plan_end_month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $config = $this->mergePlanConfigInput($this->resolvePlanConfig(), $validated);

        $planStart = $this->monthStart($config['plan_start']['year'], $config['plan_start']['month']);
        $planEnd = $this->monthEnd($config['plan_end']['year'], $config['plan_end']['month']);

        $now = now();
        $countEnd = $planEnd->lt($now) ? $planEnd : $now->copy()->endOfDay();
        if ($planStart->gt($countEnd)) {
            $countEnd = $planStart->copy();
        }

        $currentRevenue = $this->sumPlanRevenue($planStart, $countEnd);

        $target = (float) $config['target'];

        return response()->json([
            'target' => round($target, 2),
            'plan_start' => $config['plan_start'],
            'plan_end' => $config['plan_end'],
            'current_revenue' => round($currentRevenue, 2),
            'progress_percent' => $target > 0
                ? round(min(100, ($currentRevenue / $target) * 100), 1)
                : 0,
            'plan_period' => [
                'from' => $planStart->toDateString(),
                'to' => $planEnd->toDateString(),
                'label' => $planStart->format('M Y').' – '.$planEnd->format('M Y'),
            ],
            'count_period' => [
                'from' => $planStart->toDateString(),
                'to' => $countEnd->toDateString(),
                'label' => $planStart->format('M Y').' – '.$countEnd->format('M Y'),
            ],
            'months_in_plan' => $this->monthsBetweenInclusive($planStart, $planEnd),
            'months_counted' => $this->monthsBetweenInclusive($planStart, $countEnd->copy()->startOfMonth()),
        ]);
    }

    public function updatePlanTarget(Request $request)
    {
        $validated = $request->validate([
            'target' => ['required', 'numeric', 'min:0'],
            'plan_start_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'plan_start_month' => ['required', 'integer', 'min:1', 'max:12'],
            'plan_end_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'plan_end_month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $planStart = $this->monthStart((int) $validated['plan_start_year'], (int) $validated['plan_start_month']);
        $planEnd = $this->monthEnd((int) $validated['plan_end_year'], (int) $validated['plan_end_month']);

        if ($planStart->gt($planEnd)) {
            return response()->json(['message' => 'Plan start must be before or equal to plan end.'], 422);
        }

        $config = [
            'target' => round((float) $validated['target'], 2),
            'plan_start' => [
                'year' => (int) $validated['plan_start_year'],
                'month' => (int) $validated['plan_start_month'],
            ],
            'plan_end' => [
                'year' => (int) $validated['plan_end_year'],
                'month' => (int) $validated['plan_end_month'],
            ],
        ];

        Setting::updateOrCreate(
            ['key' => self::PLAN_CONFIG_KEY, 'group' => 'reports'],
            ['value' => $config]
        );

        return response()->json([
            'message' => 'Plan saved.',
            'config' => $config,
        ]);
    }

    /**
     * @param  array<string, mixed>  $saved
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function mergePlanConfigInput(array $saved, array $input): array
    {
        $now = now();
        $config = array_merge([
            'target' => 0.0,
            'plan_start' => ['year' => (int) $now->year, 'month' => (int) $now->month],
            'plan_end' => ['year' => (int) $now->year, 'month' => (int) $now->month],
        ], $saved);

        foreach (['plan_start', 'plan_end'] as $key) {
            if (isset($input[$key.'_year'], $input[$key.'_month'])) {
                $config[$key] = [
                    'year' => (int) $input[$key.'_year'],
                    'month' => (int) $input[$key.'_month'],
                ];
            }
        }

        $planStart = $this->monthStart($config['plan_start']['year'], $config['plan_start']['month']);
        $planEnd = $this->monthEnd($config['plan_end']['year'], $config['plan_end']['month']);
        if ($planStart->gt($planEnd)) {
            $config['plan_end'] = $config['plan_start'];
        }

        return $config;
    }

    /**
     * @return array<string, mixed>
     */
    private function resolvePlanConfig(): array
    {
        $legacyTarget = Setting::query()
            ->where('key', 'plan_revenue_target')
            ->where('group', 'reports')
            ->first();

        $setting = Setting::query()
            ->where('key', self::PLAN_CONFIG_KEY)
            ->where('group', 'reports')
            ->first();

        $now = now();
        $planEndDefault = $now->copy()->addMonths(5);

        $defaults = [
            'target' => (float) ($legacyTarget?->value ?? 0),
            'plan_start' => ['year' => (int) $now->year, 'month' => (int) $now->month],
            'plan_end' => ['year' => (int) $planEndDefault->year, 'month' => (int) $planEndDefault->month],
        ];

        if (! $setting?->value || ! is_array($setting->value)) {
            return $defaults;
        }

        return array_merge($defaults, $setting->value);
    }

    private function monthStart(int $year, int $month): Carbon
    {
        return Carbon::create($year, $month, 1)->startOfDay();
    }

    private function monthEnd(int $year, int $month): Carbon
    {
        return Carbon::create($year, $month, 1)->endOfMonth()->endOfDay();
    }

    private function sumPlanRevenue(Carbon $countFrom, Carbon $countEnd): float
    {
        if ($countFrom->gt($countEnd)) {
            return 0.0;
        }

        return OrderMetrics::sumRevenue($countFrom, $countEnd);
    }

    private function monthsBetweenInclusive(Carbon $start, Carbon $end): int
    {
        if ($end->lt($start)) {
            return 0;
        }

        return ($end->year - $start->year) * 12 + ($end->month - $start->month) + 1;
    }

    // Recent orders
    public function recentOrders(Request $request)
    {
        $limit = $request->input('limit', 20);

        $orders = Order::with('user:id,name,email')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'user_name' => $order->user->name ?? 'Unknown',
                    'user_email' => $order->user->email ?? '',
                    'total' => (float)$order->total,
                    'status' => $order->status,
                    'created_at' => $order->created_at->format('Y-m-d H:i'),
                ];
            });

        return response()->json([
            'data' => $orders,
        ]);
    }
}

