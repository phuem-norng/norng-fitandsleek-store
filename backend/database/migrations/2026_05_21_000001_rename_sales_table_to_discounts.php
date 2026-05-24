<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('sales') && ! Schema::hasTable('discounts')) {
            Schema::rename('sales', 'discounts');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('discounts') && ! Schema::hasTable('sales')) {
            Schema::rename('discounts', 'sales');
        }
    }
};
