<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loyalty_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 40)->index(); // earn_purchase, adjustment, redeem
            $table->integer('points_delta')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'order_id', 'event_type'], 'loyalty_events_unique_order_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_events');
    }
};

