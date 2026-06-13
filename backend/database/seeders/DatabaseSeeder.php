<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SuperAdminSeeder::class,
            CoreSeeder::class,
            FooterHeaderSeeder::class,
            AdminUserSeeder::class,
            CategorySeeder::class,
            ProductSeeder::class,
            DiscountSeeder::class,
            CustomerSeeder::class,
            HomepageSeeder::class,
            ExtraDataSeeder::class,
            // Optional full catalog + stock example (nav-aligned categories):
            // StorefrontExampleSeeder::class,
            // Optional small inventory/procurement sample (suppliers + purchase orders + stock receive):
            // InventoryProcurementMiniSeeder::class,
            // Optional top-fans sample (tier rules + loyalty profiles):
            // TopFansMiniSeeder::class,
        ]);
    }
}
