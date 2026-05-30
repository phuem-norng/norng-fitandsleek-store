<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_received')) {
            return;
        }

        Schema::create('stock_received', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_inventory_id')->nullable()->constrained('stock_inventory')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->unique()->constrained('categories')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('corrects_stock_received_id')->nullable();
            $table->string('entry_type', 30)->default('receive');
            $table->unsignedInteger('quantity');
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->string('supplier_name')->nullable();
            $table->string('invoice_number')->nullable();
            $table->date('date_in')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('corrects_stock_received_id')
                ->references('id')
                ->on('stock_received')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_received');
    }
};
