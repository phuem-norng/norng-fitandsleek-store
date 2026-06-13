<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('replacement_cases', function (Blueprint $table) {
            if (! Schema::hasColumn('replacement_cases', 'replacement_order_id')) {
                $table->foreignId('replacement_order_id')->nullable()->after('order_id')->constrained('orders')->nullOnDelete();
            }
            if (! Schema::hasColumn('replacement_cases', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('notes');
            }
            if (! Schema::hasColumn('replacement_cases', 'completed_by')) {
                $table->foreignId('completed_by')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('replacement_case_items', function (Blueprint $table) {
            if (! Schema::hasColumn('replacement_case_items', 'fulfillment_lot_id')) {
                $table->foreignId('fulfillment_lot_id')->nullable()->after('order_item_id')->constrained('inventory_lots')->nullOnDelete();
            }
            if (! Schema::hasColumn('replacement_case_items', 'return_lot_id')) {
                $table->foreignId('return_lot_id')->nullable()->after('fulfillment_lot_id')->constrained('inventory_lots')->nullOnDelete();
            }
            if (! Schema::hasColumn('replacement_case_items', 'returned_qty')) {
                $table->unsignedInteger('returned_qty')->nullable()->after('return_lot_id');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'parent_order_id')) {
                $table->foreignId('parent_order_id')->nullable()->after('user_id')->constrained('orders')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'replacement_case_id')) {
                $table->foreignId('replacement_case_id')->nullable()->after('parent_order_id')->constrained('replacement_cases')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'replacement_case_id')) {
                $table->dropConstrainedForeignId('replacement_case_id');
            }
            if (Schema::hasColumn('orders', 'parent_order_id')) {
                $table->dropConstrainedForeignId('parent_order_id');
            }
        });

        Schema::table('replacement_case_items', function (Blueprint $table) {
            if (Schema::hasColumn('replacement_case_items', 'returned_qty')) {
                $table->dropColumn('returned_qty');
            }
            if (Schema::hasColumn('replacement_case_items', 'return_lot_id')) {
                $table->dropConstrainedForeignId('return_lot_id');
            }
            if (Schema::hasColumn('replacement_case_items', 'fulfillment_lot_id')) {
                $table->dropConstrainedForeignId('fulfillment_lot_id');
            }
        });

        Schema::table('replacement_cases', function (Blueprint $table) {
            if (Schema::hasColumn('replacement_cases', 'completed_by')) {
                $table->dropConstrainedForeignId('completed_by');
            }
            if (Schema::hasColumn('replacement_cases', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            if (Schema::hasColumn('replacement_cases', 'replacement_order_id')) {
                $table->dropConstrainedForeignId('replacement_order_id');
            }
        });
    }
};
