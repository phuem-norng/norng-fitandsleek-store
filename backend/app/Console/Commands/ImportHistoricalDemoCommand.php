<?php

namespace App\Console\Commands;

use Database\Seeders\HistoricalDemoDataSeeder;
use Database\Seeders\HistoricalStockInventorySeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Import 2023–2025 demo rows directly into the configured PostgreSQL database
 * (same DB as the app — not a separate seed store).
 */
class ImportHistoricalDemoCommand extends Command
{
    protected $signature = 'demo:import-historical
                            {--force : Skip confirmation}
                            {--orders-only : Products + orders only}
                            {--stock-only : Stock & Stock Received only}';

    protected $description = 'Insert 2023–2025 demo data into the live PostgreSQL database (orders, products, stock receives)';

    public function handle(): int
    {
        $connection = config('database.default');
        $cfg = config("database.connections.{$connection}");
        $dbName = $cfg['database'] ?? '?';
        $host = $cfg['host'] ?? '?';
        $port = $cfg['port'] ?? '?';

        $this->line('');
        $this->info('Target database (from .env):');
        $this->table(
            ['Setting', 'Value'],
            [
                ['Connection', $connection],
                ['Host', $host],
                ['Port', $port],
                ['Database', $dbName],
            ]
        );

        try {
            DB::connection()->getPdo();
            $this->info('Connection OK.');
        } catch (\Throwable $e) {
            $this->error('Cannot connect: '.$e->getMessage());

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Insert / refresh demo data in this database?', true)) {
            $this->warn('Cancelled.');

            return self::SUCCESS;
        }

        $ordersOnly = (bool) $this->option('orders-only');
        $stockOnly = (bool) $this->option('stock-only');

        if ($ordersOnly && $stockOnly) {
            $this->error('Use only one of --orders-only or --stock-only.');

            return self::FAILURE;
        }

        if (! $stockOnly) {
            $this->info('Importing products & orders (2023–2025)…');
            $this->callSilent(HistoricalDemoDataSeeder::class);
        }

        if (! $ordersOnly) {
            $this->info('Importing Stock & Inventory / Stock Received (2023–2025)…');
            $this->callSilent(HistoricalStockInventorySeeder::class);
        }

        $demoOrderIds = DB::table('orders')->where('order_number', 'like', 'DEMO-%')->pluck('id');
        $demoOrders = $demoOrderIds->count();
        $demoOrderItems = DB::table('order_items')->whereIn('order_id', $demoOrderIds)->count();
        $demoProducts = DB::table('products')->where('sku', 'like', 'FS-DEMO-%')->count();
        $stockMasters = DB::table('categories')
            ->where('slug', 'like', 'FS-STOCK-DEMO-%')
            ->whereNull('parent_id')
            ->count();
        $stockBatches = DB::table('categories')
            ->where('slug', 'like', 'FS-STOCK-DEMO-%')
            ->whereNotNull('parent_id')
            ->count();
        $demoCustomers = DB::table('users')->where('email', 'like', '%@fitandsleek.test')->count();
        $ledgerRows = \Illuminate\Support\Facades\Schema::hasTable('stock_received')
            ? DB::table('stock_received')->whereIn(
                'product_id',
                DB::table('products')->where('sku', 'like', 'FS-DEMO-%')->pluck('id')
            )->count()
            : 0;

        $this->line('');
        $this->info("PostgreSQL tables in <fg=cyan>{$dbName}</> (open in pgAdmin → Schemas → public):");
        $rows = [
            ['public.products', $demoProducts],
            ['public.orders', $demoOrders],
            ['public.order_items', $demoOrderItems],
            ['public.users (demo customers)', $demoCustomers],
            ['public.categories (stock masters)', $stockMasters],
            ['public.categories (stock receives / Stock Received UI)', $stockBatches],
        ];
        if ($ledgerRows > 0) {
            $rows[] = ['public.stock_received (ledger)', $ledgerRows];
        }
        $this->table(['Table', 'Rows'], $rows);

        $this->line('pgAdmin: host '.$host.' · port '.$port.' · database '.$dbName);

        return self::SUCCESS;
    }
}
