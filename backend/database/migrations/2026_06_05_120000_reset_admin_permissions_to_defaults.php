<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Reset stored admin permission overrides so operational defaults apply.
     * Fixes accounts saved with incomplete/false permission matrices from early builds.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'admin')
            ->whereNotNull('admin_permissions')
            ->update(['admin_permissions' => null]);
    }

    public function down(): void
    {
        // Non-reversible — superadmin can reconfigure via Administrators → Manage Permissions.
    }
};
