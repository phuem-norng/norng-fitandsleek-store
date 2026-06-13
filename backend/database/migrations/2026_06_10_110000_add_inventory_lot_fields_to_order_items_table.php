<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'inventory_lot_id')) {
                $table->foreignId('inventory_lot_id')->nullable()->after('product_id')->constrained('inventory_lots')->nullOnDelete();
            }
            if (! Schema::hasColumn('order_items', 'unit_cost_at_sale')) {
                $table->decimal('unit_cost_at_sale', 12, 2)->nullable()->after('price');
            }
            if (! Schema::hasColumn('order_items', 'listing_status_at_sale')) {
                $table->string('listing_status_at_sale', 32)->nullable()->after('unit_cost_at_sale');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'listing_status_at_sale')) {
                $table->dropColumn('listing_status_at_sale');
            }
            if (Schema::hasColumn('order_items', 'unit_cost_at_sale')) {
                $table->dropColumn('unit_cost_at_sale');
            }
            if (Schema::hasColumn('order_items', 'inventory_lot_id')) {
                $table->dropConstrainedForeignId('inventory_lot_id');
            }
        });
    }
};
