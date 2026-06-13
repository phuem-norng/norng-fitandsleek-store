<?php

use App\Models\Setting;
use App\Services\InventoryLotService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_lots') && ! Schema::hasColumn('inventory_lots', 'lot_tier')) {
            Schema::table('inventory_lots', function (Blueprint $table) {
                $table->string('lot_tier', 16)->default('newer')->after('listing_status');
                $table->index(['product_id', 'size', 'color', 'lot_tier']);
            });
        }

        Setting::query()->updateOrCreate(
            ['key' => 'inventory_sell_old_first'],
            ['value' => 'true', 'type' => 'boolean', 'group' => 'inventory'],
        );

        if (Schema::hasTable('inventory_lots')) {
            $variants = \App\Models\InventoryLot::query()
                ->select('product_id', 'size', 'color')
                ->distinct()
                ->get();

            $service = app(InventoryLotService::class);
            foreach ($variants as $variant) {
                $service->syncLotTiersForVariant(
                    (int) $variant->product_id,
                    $variant->size,
                    $variant->color,
                );
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('inventory_lots') && Schema::hasColumn('inventory_lots', 'lot_tier')) {
            Schema::table('inventory_lots', function (Blueprint $table) {
                $table->dropIndex(['product_id', 'size', 'color', 'lot_tier']);
                $table->dropColumn('lot_tier');
            });
        }

        Setting::query()->where('key', 'inventory_sell_old_first')->delete();
    }
};
