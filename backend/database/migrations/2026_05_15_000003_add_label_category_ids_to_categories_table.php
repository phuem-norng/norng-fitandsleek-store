<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('categories', 'label_category_ids')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->json('label_category_ids')->nullable()->after('label_category_id');
            });
        }

        if (Schema::hasColumn('categories', 'label_category_id')) {
            DB::table('categories')
                ->whereNotNull('label_category_id')
                ->whereNull('label_category_ids')
                ->orderBy('id')
                ->chunkById(200, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('categories')
                            ->where('id', $row->id)
                            ->update(['label_category_ids' => json_encode([(int) $row->label_category_id])]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('categories', 'label_category_ids')) {
            Schema::table('categories', function (Blueprint $table) {
                $table->dropColumn('label_category_ids');
            });
        }
    }
};
