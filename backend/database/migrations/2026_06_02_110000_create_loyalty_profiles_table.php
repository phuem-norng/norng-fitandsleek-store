<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loyalty_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('points')->default(0);
            $table->string('tier', 20)->default('bronze')->index();
            $table->unsignedInteger('orders_count')->default(0);
            $table->decimal('lifetime_spend', 12, 2)->default(0);
            $table->timestamp('last_earned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_profiles');
    }
};

