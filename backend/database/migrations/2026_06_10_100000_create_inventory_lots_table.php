<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_lots')) {
            return;
        }

        Schema::create('inventory_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('sku', 100)->nullable();
            $table->string('size', 40)->nullable();
            $table->string('color', 80)->nullable();
            $table->string('lot_number', 64)->unique();
            $table->string('season', 40)->nullable();
            $table->string('collection_code', 64)->nullable();
            $table->string('listing_status', 32)->default('active');
            $table->unsignedInteger('quantity_on_hand')->default(0);
            $table->unsignedInteger('quantity_received')->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->string('price_rule', 32)->default('fixed');
            $table->decimal('price_percent', 8, 2)->nullable();
            $table->string('barcode', 120)->nullable();
            $table->boolean('is_sellable')->default(true);
            $table->foreignId('purchase_order_item_id')->nullable()->constrained('purchase_order_items')->nullOnDelete();
            $table->foreignId('stock_received_id')->nullable()->constrained('stock_received')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->unique('barcode');
            $table->index(['product_id', 'size', 'color', 'listing_status']);
            $table->index(['listing_status', 'is_sellable']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_lots');
    }
};
