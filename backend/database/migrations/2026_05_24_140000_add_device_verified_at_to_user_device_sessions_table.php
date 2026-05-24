<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_device_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('user_device_sessions', 'device_verified_at')) {
                $table->timestamp('device_verified_at')->nullable()->after('last_used_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_device_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('user_device_sessions', 'device_verified_at')) {
                $table->dropColumn('device_verified_at');
            }
        });
    }
};
