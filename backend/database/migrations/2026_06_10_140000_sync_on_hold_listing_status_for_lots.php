<?php

use App\Models\InventoryLot;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('inventory_lots')
            ->where('is_sellable', false)
            ->whereNotIn('listing_status', [
                InventoryLot::LISTING_ON_HOLD,
                InventoryLot::LISTING_DISCONTINUED,
            ])
            ->update(['listing_status' => InventoryLot::LISTING_ON_HOLD]);
    }

    public function down(): void
    {
        // Cannot reliably restore previous listing statuses.
    }
};
