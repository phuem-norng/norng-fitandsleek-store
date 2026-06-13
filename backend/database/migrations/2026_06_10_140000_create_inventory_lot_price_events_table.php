<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_lot_price_events')) {
            return;
        }

        Schema::create('inventory_lot_price_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_lot_id')->constrained('inventory_lots')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 48);
            $table->decimal('unit_price_before', 12, 2)->nullable();
            $table->decimal('unit_price_after', 12, 2)->nullable();
            $table->string('listing_status_before', 32)->nullable();
            $table->string('listing_status_after', 32)->nullable();
            $table->string('price_rule_before', 32)->nullable();
            $table->string('price_rule_after', 32)->nullable();
            $table->decimal('discount_percent_off', 8, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['inventory_lot_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_lot_price_events');
    }
};
