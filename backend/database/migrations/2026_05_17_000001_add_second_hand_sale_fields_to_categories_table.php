<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (!Schema::hasColumn('categories', 'product_condition')) {
                $table->string('product_condition', 30)->default('new')->after('date_in');
            }
            if (!Schema::hasColumn('categories', 'second_hand_sale_type')) {
                $table->string('second_hand_sale_type', 30)->nullable()->after('product_condition');
            }
            if (!Schema::hasColumn('categories', 'bundle_total_cost')) {
                $table->decimal('bundle_total_cost', 12, 2)->nullable()->after('second_hand_sale_type');
            }
            if (!Schema::hasColumn('categories', 'bundle_total_quantity')) {
                $table->unsignedInteger('bundle_total_quantity')->nullable()->after('bundle_total_cost');
            }
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            foreach (['bundle_total_quantity', 'bundle_total_cost', 'second_hand_sale_type', 'product_condition'] as $col) {
                if (Schema::hasColumn('categories', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
