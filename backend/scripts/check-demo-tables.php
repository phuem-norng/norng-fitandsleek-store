<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$db = config('database.connections.pgsql.database');
$host = config('database.connections.pgsql.host');
$port = config('database.connections.pgsql.port');

echo "Database: {$db} @ {$host}:{$port}\n\n";

$checks = [
    'products (FS-DEMO-*)' => fn () => DB::table('products')->where('sku', 'like', 'FS-DEMO-%')->count(),
    'orders (DEMO-*)' => fn () => DB::table('orders')->where('order_number', 'like', 'DEMO-%')->count(),
    'order_items (demo orders)' => fn () => DB::table('order_items')->whereIn('order_id', DB::table('orders')->where('order_number', 'like', 'DEMO-%')->pluck('id'))->count(),
    'categories stock masters' => fn () => DB::table('categories')->where('slug', 'like', 'FS-STOCK-DEMO-%')->whereNull('parent_id')->count(),
    'categories stock batches (Stock Received)' => fn () => DB::table('categories')->where('slug', 'like', 'FS-STOCK-DEMO-%')->whereNotNull('parent_id')->count(),
    'users (demo customers)' => fn () => DB::table('users')->where('email', 'like', '%@fitandsleek.test')->count(),
];

foreach ($checks as $label => $fn) {
    echo str_pad($label, 42).': '.$fn()."\n";
}

if (Schema::hasTable('stock_received')) {
    echo str_pad('stock_received table (all rows)', 42).': '.DB::table('stock_received')->count()."\n";
    $demoLedger = DB::table('stock_received')
        ->whereIn('product_id', DB::table('products')->where('sku', 'like', 'FS-DEMO-%')->pluck('id'))
        ->count();
    echo str_pad('stock_received (demo products)', 42).': '.$demoLedger."\n";
} else {
    echo "stock_received table: (does not exist — receives stored in categories table)\n";
}

echo "\nSample pgAdmin tables to open:\n";
echo "  - public.products\n";
echo "  - public.orders\n";
echo "  - public.order_items\n";
echo "  - public.categories  (type = barcode_qr for stock)\n";
echo "  - public.users\n";
