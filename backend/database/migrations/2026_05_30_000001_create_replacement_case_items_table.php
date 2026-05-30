<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('replacement_case_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('replacement_case_id')->constrained('replacement_cases')->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained('order_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->string('requested_size', 50)->nullable();
            $table->string('requested_color', 50)->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->unique(['replacement_case_id', 'order_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('replacement_case_items');
    }
};
