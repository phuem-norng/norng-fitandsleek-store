<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_inventory')) {
            return;
        }

        Schema::create('stock_inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->unique()->constrained('categories')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku', 100)->nullable();
            $table->unsignedInteger('stock')->nullable();
            $table->unsignedInteger('stock_received')->nullable();
            $table->unsignedInteger('min_stock')->nullable();
            $table->boolean('manage_stock')->default(true);
            $table->decimal('cost', 12, 2)->nullable();
            $table->decimal('price', 12, 2)->nullable();
            $table->string('unit', 50)->nullable();
            $table->string('origin', 80)->nullable();
            $table->unsignedBigInteger('brand_id')->nullable();
            $table->string('product_condition', 20)->default('new');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('brand_id')->references('id')->on('brands')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_inventory');
    }
};
