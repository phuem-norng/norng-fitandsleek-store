<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedInteger('stock_received')->nullable()->after('stock');
        });

        DB::table('categories')
            ->where('type', 'barcode_qr')
            ->whereNotNull('stock')
            ->update(['stock_received' => DB::raw('stock')]);
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('stock_received');
        });
    }
};
