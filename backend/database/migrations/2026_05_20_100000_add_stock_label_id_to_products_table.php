<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'stock_label_id')) {
                $table->foreignId('stock_label_id')
                    ->nullable()
                    ->after('barcode_code')
                    ->constrained('categories')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'stock_label_id')) {
                $table->dropForeign(['stock_label_id']);
                $table->dropColumn('stock_label_id');
            }
        });
    }
};
