<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Full example stack: catalog (FS-EX) + multi-year orders/stock demo (FS-DEMO / FS-STOCK-DEMO).
 *
 *   php artisan db:seed --class=StorefrontExampleAllSeeder
 */
class StorefrontExampleAllSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            StorefrontExampleSeeder::class,
            HistoricalAllDemoSeeder::class,
        ]);
    }
}
