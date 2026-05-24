<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_trusted_devices')) {
            Schema::create('user_trusted_devices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('device_id', 120);
                $table->timestamp('verified_at');
                $table->timestamp('last_seen_at')->nullable();
                $table->string('device_name', 190)->nullable();
                $table->string('browser', 120)->nullable();
                $table->string('os', 120)->nullable();
                $table->timestamps();

                $table->unique(['user_id', 'device_id']);
            });
        }

        if (Schema::hasTable('user_device_sessions') && Schema::hasColumn('user_device_sessions', 'device_verified_at')) {
            $rows = DB::table('user_device_sessions')
                ->whereNotNull('device_verified_at')
                ->select(['user_id', 'device_id', 'device_verified_at', 'last_used_at', 'last_login_at', 'device_name', 'browser', 'os'])
                ->get();

            foreach ($rows as $row) {
                $verifiedAt = $row->device_verified_at;
                $lastSeen = $row->last_used_at ?? $row->last_login_at ?? $verifiedAt;

                DB::table('user_trusted_devices')->updateOrInsert(
                    [
                        'user_id' => $row->user_id,
                        'device_id' => $row->device_id,
                    ],
                    [
                        'verified_at' => $verifiedAt,
                        'last_seen_at' => $lastSeen,
                        'device_name' => $row->device_name,
                        'browser' => $row->browser,
                        'os' => $row->os,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_trusted_devices');
    }
};
