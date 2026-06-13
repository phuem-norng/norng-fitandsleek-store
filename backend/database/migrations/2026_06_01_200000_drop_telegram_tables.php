<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('telegram_broadcast_deliveries');
        Schema::dropIfExists('telegram_broadcasts');
        Schema::dropIfExists('telegram_users');
    }

    public function down(): void
    {
        // Telegram tables removed intentionally; restore from earlier migrations if needed.
    }
};
