<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'variant_matrix')) {
            Schema::table('products', function (Blueprint $table) {
                $table->json('variant_matrix')->nullable()->after('sizes');
            });
        }

        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'color')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->string('color', 80)->nullable()->after('size');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'variant_matrix')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('variant_matrix');
            });
        }
        if (Schema::hasColumn('order_items', 'color')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->dropColumn('color');
            });
        }
    }
};
