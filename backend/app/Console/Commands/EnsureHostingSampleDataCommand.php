<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use Database\Seeders\NeonHostingSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent sample data for production (Neon): runs NeonHostingSeeder only when the
 * catalog is empty. Safe to call on every Render/Docker boot.
 */
class EnsureHostingSampleDataCommand extends Command
{
    protected $signature = 'hosting:ensure-sample-data
                            {--force : Run NeonHostingSeeder even if categories exist}';

    protected $description = 'Seed Neon hosting demo data (categories, products, brands) when the catalog is empty';

    public function handle(): int
    {
        if (! Schema::hasTable('categories')) {
            $this->warn('categories table missing — run migrations first.');

            return self::FAILURE;
        }

        $categoryCount = Category::query()->catalogOnly()->count();
        $sampleProducts = Product::query()
            ->where('sku', 'like', NeonHostingSeeder::SKU_PREFIX.'%')
            ->count();

        if ($categoryCount > 0 && $sampleProducts > 0 && ! $this->option('force')) {
            $this->info("Sample data present ({$categoryCount} categories, {$sampleProducts} NH products) — skipping.");

            return self::SUCCESS;
        }

        if ($categoryCount > 0 && $sampleProducts === 0) {
            $this->warn("Found {$categoryCount} categories but no NH-* products — running sample seed.");
        }

        if ($this->option('force')) {
            $this->warn('Re-seeding with --force (upserts by slug/SKU).');
        }

        $this->call('db:seed', [
            '--class' => 'NeonHostingSeeder',
            '--force' => true,
        ]);

        $this->info('Hosting sample data ensured.');

        return self::SUCCESS;
    }
}
