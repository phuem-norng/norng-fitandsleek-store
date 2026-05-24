<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'date_in')) {
                $table->date('date_in')->nullable()->after('min_stock');
            }
        });

        if (Schema::hasColumn('categories', 'date_in')) {
            DB::table('categories')
                ->whereNull('date_in')
                ->update(['date_in' => DB::raw('DATE(created_at)')]);
        }
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'date_in')) {
                $table->dropColumn('date_in');
            }
        });
    }
};
