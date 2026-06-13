<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('order_items', 'lot_tier_at_sale')) {
                $table->string('lot_tier_at_sale', 16)->nullable()->after('listing_status_at_sale');
            }
            if (! Schema::hasColumn('order_items', 'lot_number_at_sale')) {
                $table->string('lot_number_at_sale', 80)->nullable()->after('lot_tier_at_sale');
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            if (Schema::hasColumn('order_items', 'lot_number_at_sale')) {
                $table->dropColumn('lot_number_at_sale');
            }
            if (Schema::hasColumn('order_items', 'lot_tier_at_sale')) {
                $table->dropColumn('lot_tier_at_sale');
            }
        });
    }
};
