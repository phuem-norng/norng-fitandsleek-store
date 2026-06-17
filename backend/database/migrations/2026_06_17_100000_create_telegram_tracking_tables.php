<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telegram_users', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('telegram_user_id')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->bigInteger('chat_id')->index();
            $table->string('username')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('language_code', 12)->nullable();
            $table->timestamp('last_interacted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('telegram_order_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('telegram_user_id')->nullable()->constrained('telegram_users')->nullOnDelete();
            $table->bigInteger('chat_id')->index();
            $table->timestamps();

            $table->unique(['order_id', 'chat_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_order_subscriptions');
        Schema::dropIfExists('telegram_users');
    }
};
