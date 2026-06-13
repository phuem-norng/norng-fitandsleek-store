<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('inventory_lots')
            ->where('listing_status', 'new_arrival')
            ->update(['listing_status' => 'active']);
    }

    public function down(): void
    {
        // Cannot restore which lots were new_arrival.
    }
};
