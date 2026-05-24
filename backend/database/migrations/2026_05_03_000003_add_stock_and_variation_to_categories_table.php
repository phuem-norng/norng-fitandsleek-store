<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'manage_stock')) {
                $table->boolean('manage_stock')->default(false)->after('brand_id');
            }
            if (!Schema::hasColumn('categories', 'stock')) {
                $table->unsignedInteger('stock')->nullable()->after('manage_stock');
            }
            if (!Schema::hasColumn('categories', 'min_stock')) {
                $table->unsignedInteger('min_stock')->nullable()->after('stock');
            }
            if (!Schema::hasColumn('categories', 'has_variation')) {
                $table->boolean('has_variation')->default(false)->after('min_stock');
            }
            if (!Schema::hasColumn('categories', 'variation_product_type')) {
                $table->string('variation_product_type', 50)->nullable()->after('has_variation');
            }
            if (!Schema::hasColumn('categories', 'variation_colors')) {
                $table->text('variation_colors')->nullable()->after('variation_product_type');
            }
            if (!Schema::hasColumn('categories', 'variation_sizes')) {
                $table->json('variation_sizes')->nullable()->after('variation_colors');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            foreach (['manage_stock', 'stock', 'min_stock', 'has_variation', 'variation_product_type', 'variation_colors', 'variation_sizes'] as $col) {
                if (Schema::hasColumn('categories', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
