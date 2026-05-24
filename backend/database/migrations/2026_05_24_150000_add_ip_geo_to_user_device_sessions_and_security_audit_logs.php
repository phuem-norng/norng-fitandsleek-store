<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_device_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('user_device_sessions', 'ip_city')) {
                $table->string('ip_city', 120)->nullable()->after('ip_address');
                $table->string('ip_region', 120)->nullable()->after('ip_city');
                $table->string('ip_country', 120)->nullable()->after('ip_region');
                $table->string('ip_country_code', 8)->nullable()->after('ip_country');
            }
        });

        if (! Schema::hasTable('security_audit_logs')) {
            Schema::create('security_audit_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
                $table->string('event_type', 64)->index();
                $table->string('ip_address', 64)->nullable();
                $table->string('ip_city', 120)->nullable();
                $table->string('ip_region', 120)->nullable();
                $table->string('ip_country', 120)->nullable();
                $table->string('ip_country_code', 8)->nullable();
                $table->string('device_id', 120)->nullable();
                $table->string('device_name', 190)->nullable();
                $table->string('browser', 120)->nullable();
                $table->string('os', 120)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['user_id', 'created_at']);
                $table->index(['event_type', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('security_audit_logs');

        Schema::table('user_device_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('user_device_sessions', 'ip_city')) {
                $table->dropColumn(['ip_city', 'ip_region', 'ip_country', 'ip_country_code']);
            }
        });
    }
};
