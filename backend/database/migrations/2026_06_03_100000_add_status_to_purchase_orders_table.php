<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('status', 20)->default('draft')->after('po_number');
            $table->timestamp('received_at')->nullable()->after('status');
            $table->index('status');
        });

        // Existing rows were created with immediate stock receive — treat as received.
        DB::table('purchase_orders')->update([
            'status' => 'received',
            'received_at' => DB::raw('COALESCE(updated_at, created_at, NOW())'),
        ]);
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'received_at']);
        });
    }
};
