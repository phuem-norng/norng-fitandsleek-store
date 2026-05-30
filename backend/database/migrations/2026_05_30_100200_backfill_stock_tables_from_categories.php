<?php

use App\Models\Category;
use App\Models\Product;
use App\Services\PaidOrderInventory;
use App\Services\StockTableSyncService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_inventory') || ! Schema::hasTable('stock_received')) {
            return;
        }

        $sync = app(StockTableSyncService::class);
        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;

        Category::query()
            ->where('type', $stockType)
            ->whereNull('parent_id')
            ->orderBy('id')
            ->each(fn (Category $master) => $sync->syncMasterFromCategory($master));

        Category::query()
            ->where('type', $stockType)
            ->whereNotNull('parent_id')
            ->orderBy('id')
            ->each(function (Category $batch) use ($sync) {
                $productId = Product::query()
                    ->where('stock_label_id', $batch->id)
                    ->value('id');

                $sync->syncReceiveFromCategory($batch, $productId ? (int) $productId : null);
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('stock_received') || ! Schema::hasTable('stock_inventory')) {
            return;
        }

        \Illuminate\Support\Facades\DB::table('stock_received')->delete();
        \Illuminate\Support\Facades\DB::table('stock_inventory')->delete();
    }
};
