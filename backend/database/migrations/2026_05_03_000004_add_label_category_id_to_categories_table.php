<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'label_category_id')) {
                $table->foreignId('label_category_id')
                    ->nullable()
                    ->after('brand_id')
                    ->constrained('categories')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'label_category_id')) {
                $table->dropForeign(['label_category_id']);
                $table->dropColumn('label_category_id');
            }
        });
    }
};
