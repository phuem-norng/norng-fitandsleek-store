<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Full demo dataset for 2023–2025: catalog, orders, stock receives (Stock Received page).
 *
 * Run: php artisan db:seed --class=HistoricalAllDemoSeeder
 */
class HistoricalAllDemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            HistoricalDemoDataSeeder::class,
            HistoricalStockInventorySeeder::class,
        ]);
    }
}
