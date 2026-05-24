<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'description')) {
                $table->text('description')->nullable()->after('type');
            }
            if (!Schema::hasColumn('categories', 'price')) {
                $table->decimal('price', 12, 2)->nullable()->after('description');
            }
            if (!Schema::hasColumn('categories', 'compare_at_price')) {
                $table->decimal('compare_at_price', 12, 2)->nullable()->after('price');
            }
            if (!Schema::hasColumn('categories', 'label_color')) {
                $table->string('label_color', 30)->nullable()->after('compare_at_price');
            }
            if (!Schema::hasColumn('categories', 'image_url')) {
                $table->string('image_url')->nullable()->after('label_color');
            }
            if (!Schema::hasColumn('categories', 'gallery')) {
                $table->text('gallery')->nullable()->after('image_url');
            }
            if (!Schema::hasColumn('categories', 'sku')) {
                $table->string('sku', 100)->nullable()->after('gallery');
            }
            if (!Schema::hasColumn('categories', 'cost')) {
                $table->decimal('cost', 12, 2)->nullable()->after('sku');
            }
            if (!Schema::hasColumn('categories', 'unit')) {
                $table->string('unit', 50)->nullable()->after('cost');
            }
            if (!Schema::hasColumn('categories', 'brand_id')) {
                $table->unsignedBigInteger('brand_id')->nullable()->after('unit');
                $table->foreign('brand_id')->references('id')->on('brands')->nullOnDelete();
            }
            if (!Schema::hasColumn('categories', 'details')) {
                $table->text('details')->nullable()->after('description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $columns = ['description', 'price', 'compare_at_price', 'label_color', 'image_url', 'gallery', 'sku', 'cost', 'unit', 'brand_id', 'details'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('categories', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
