<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        // Normalize legacy localhost URLs to relative /storage paths.
        // This prevents mixed-content errors when the storefront runs on HTTPS.
        if (Schema::hasColumn('users', 'profile_image_path')) {
            DB::statement("
                UPDATE users
                SET profile_image_path = REPLACE(profile_image_path, 'http://127.0.0.1:8001', '')
                WHERE profile_image_path LIKE 'http://127.0.0.1:8001/%'
            ");

            DB::statement("
                UPDATE users
                SET profile_image_path = REPLACE(profile_image_path, 'http://localhost:8001', '')
                WHERE profile_image_path LIKE 'http://localhost:8001/%'
            ");
        }
    }

    public function down(): void
    {
        // Irreversible normalization.
    }
};

