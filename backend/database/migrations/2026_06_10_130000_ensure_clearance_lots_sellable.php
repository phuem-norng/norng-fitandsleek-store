<?php

use App\Models\InventoryLot;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        InventoryLot::query()
            ->where('listing_status', InventoryLot::LISTING_CLEARANCE)
            ->where('is_sellable', false)
            ->where('quantity_on_hand', '>', 0)
            ->update(['is_sellable' => true]);
    }

    public function down(): void
    {
        // Non-reversible without a snapshot of prior hold state.
    }
};
