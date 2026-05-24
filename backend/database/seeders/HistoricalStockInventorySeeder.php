<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\PaidOrderInventory;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stock & Inventory + Stock Received log: 30 labels, 30 receives/month (2023–2025).
 *
 * Run: php artisan db:seed --class=HistoricalStockInventorySeeder
 * Or:  php artisan db:seed --class=HistoricalAllDemoSeeder
 */
class HistoricalStockInventorySeeder extends Seeder
{
    private const SLUG_PREFIX = 'FS-STOCK-DEMO';

    private const YEARS = [2023, 2024, 2025];

    /** @var list<array{name: string, origin: string, unit_band: string}> */
    private const MASTER_TEMPLATES = [
        ['name' => 'Men Cotton Crew Tee — White M', 'origin' => 'KH', 'unit_band' => 'high'],
        ['name' => 'Men Cotton Crew Tee — Black L', 'origin' => 'KH', 'unit_band' => 'high'],
        ['name' => 'Women Rib Tank — Sage S', 'origin' => 'VN', 'unit_band' => 'high'],
        ['name' => 'Women Rib Tank — Blush M', 'origin' => 'VN', 'unit_band' => 'high'],
        ['name' => 'Unisex Fleece Hoodie — Charcoal XL', 'origin' => 'CN', 'unit_band' => 'mid'],
        ['name' => 'Unisex Fleece Hoodie — Navy L', 'origin' => 'CN', 'unit_band' => 'mid'],
        ['name' => 'Men Chino Trouser — Khaki 32', 'origin' => 'TH', 'unit_band' => 'mid'],
        ['name' => 'Men Chino Trouser — Olive 34', 'origin' => 'TH', 'unit_band' => 'mid'],
        ['name' => 'Women High-Rise Legging — Black S', 'origin' => 'KH', 'unit_band' => 'high'],
        ['name' => 'Women Midi Skirt — Sand M', 'origin' => 'US', 'unit_band' => 'mid'],
        ['name' => 'Boy Performance Tee — Blue 10Y', 'origin' => 'KH', 'unit_band' => 'high'],
        ['name' => 'Girl Pleated Skort — Pink 12Y', 'origin' => 'KH', 'unit_band' => 'mid'],
        ['name' => 'Men Oxford Shirt — Sky L', 'origin' => 'US', 'unit_band' => 'mid'],
        ['name' => 'Women Wrap Blouse — Ivory M', 'origin' => 'SG', 'unit_band' => 'mid'],
        ['name' => 'Men Denim Jacket — Indigo L', 'origin' => 'US', 'unit_band' => 'low'],
        ['name' => 'Women Lightweight Puffer — Rose S', 'origin' => 'CN', 'unit_band' => 'low'],
        ['name' => 'Unisex Jogger — Graphite M', 'origin' => 'VN', 'unit_band' => 'mid'],
        ['name' => 'Men Running Short — Electric M', 'origin' => 'TH', 'unit_band' => 'high'],
        ['name' => 'Women Sports Bra — Black M', 'origin' => 'TH', 'unit_band' => 'high'],
        ['name' => 'Crew Sock 3-Pack — Assorted', 'origin' => 'KH', 'unit_band' => 'bulk'],
        ['name' => 'Leather Belt — Brown 34', 'origin' => 'IT', 'unit_band' => 'low'],
        ['name' => 'Canvas Tote Bag — Natural', 'origin' => 'KH', 'unit_band' => 'low'],
        ['name' => 'Men Polo — Forest L', 'origin' => 'VN', 'unit_band' => 'mid'],
        ['name' => 'Women Linen Shirt Dress — Oat M', 'origin' => 'US', 'unit_band' => 'mid'],
        ['name' => 'Boy Cargo Short — Olive 8Y', 'origin' => 'CN', 'unit_band' => 'mid'],
        ['name' => 'Girl Knit Cardigan — Lilac 10Y', 'origin' => 'CN', 'unit_band' => 'mid'],
        ['name' => 'Men Merino Sweater — Heather M', 'origin' => 'US', 'unit_band' => 'low'],
        ['name' => 'Women Satin Cami — Champagne S', 'origin' => 'SG', 'unit_band' => 'high'],
        ['name' => 'Unisex Windbreaker — Cobalt L', 'origin' => 'JP', 'unit_band' => 'low'],
        ['name' => 'Training Tank — Citrus M', 'origin' => 'TH', 'unit_band' => 'high'],
    ];

    public function run(): void
    {
        $this->command?->info('Seeding Stock & Inventory / Stock Received demo (2023–2025)…');

        DB::transaction(function () {
            $catalogCategoryIds = $this->resolveCatalogCategoryIds();
            $this->purgePreviousDemoStock();
            $masters = $this->seedMasterLabels($catalogCategoryIds);
            $batchCount = $this->seedMonthlyReceives($masters, $catalogCategoryIds);
            $this->syncMasterStockFromBatches($masters);
            $this->linkCatalogProducts($masters);
            $ledgerCount = $this->seedStockReceivedLedgerTable();

            $this->command?->info("Created {$batchCount} receive batches (30/month × 36 months).");
            if ($ledgerCount > 0) {
                $this->command?->info("Inserted {$ledgerCount} rows into stock_received table (pgAdmin).");
            }
        });

        $masters = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNull('parent_id')
            ->where('slug', 'like', self::SLUG_PREFIX.'-%')
            ->count();

        $batches = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNotNull('parent_id')
            ->where('slug', 'like', self::SLUG_PREFIX.'-%')
            ->count();

        $this->command?->info("Done. Master labels: {$masters}, Stock Received rows: {$batches}");
    }

    /** @return list<int> */
    private function resolveCatalogCategoryIds(): array
    {
        $ids = Category::query()
            ->catalogOnly()
            ->where('is_active', true)
            ->orderBy('id')
            ->limit(12)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $ids !== [] ? $ids : [1];
    }

    private function purgePreviousDemoStock(): void
    {
        $demoIds = Category::query()
            ->where('slug', 'like', self::SLUG_PREFIX.'-%')
            ->pluck('id');

        $demoProductIds = Product::query()->where('sku', 'like', 'FS-DEMO-%')->pluck('id');

        if (Schema::hasTable('stock_received') && $demoProductIds->isNotEmpty()) {
            DB::table('stock_received')->whereIn('product_id', $demoProductIds)->delete();
        }

        if ($demoIds->isNotEmpty()) {
            $fallbackCategoryId = Category::query()
                ->catalogOnly()
                ->where('is_active', true)
                ->orderBy('id')
                ->value('id');

            if ($fallbackCategoryId) {
                Product::query()
                    ->whereIn('category_id', $demoIds)
                    ->update(['category_id' => $fallbackCategoryId]);
            }

            Product::query()->whereIn('stock_label_id', $demoIds)->update(['stock_label_id' => null]);
            Category::query()->whereIn('parent_id', $demoIds)->delete();
            Category::query()->whereIn('id', $demoIds)->delete();
        }
    }

    /**
     * @param  list<int>  $catalogCategoryIds
     * @return list<Category>
     */
    private function seedMasterLabels(array $catalogCategoryIds): array
    {
        $masters = [];
        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;

        foreach (self::MASTER_TEMPLATES as $index => $template) {
            $seq = str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
            $slug = self::SLUG_PREFIX.'-M'.$seq;
            $cost = round(mt_rand(450, 4200) / 100, 2);
            $price = round($cost * mt_rand(180, 260) / 100, 2);
            $labelCategoryId = $catalogCategoryIds[$index % count($catalogCategoryIds)];

            $masters[] = Category::create([
                'parent_id' => null,
                'name' => $template['name'],
                'slug' => $slug,
                'sku' => $slug,
                'type' => $stockType,
                'sort_order' => $index,
                'is_active' => true,
                'description' => 'Demo inventory label for Stock Received and reports (2023–2025).',
                'price' => $price,
                'compare_at_price' => round($price * 1.12, 2),
                'cost' => $cost,
                'unit' => 'pcs',
                'origin' => $template['origin'],
                'label_category_id' => $labelCategoryId,
                'label_category_ids' => [$labelCategoryId],
                'manage_stock' => true,
                'stock' => 0,
                'stock_received' => null,
                'min_stock' => 10,
                'product_condition' => 'new',
                'has_variation' => false,
            ]);
        }

        return $masters;
    }

    /**
     * @param  list<Category>  $masters
     * @param  list<int>  $catalogCategoryIds
     */
    private function seedMonthlyReceives(array $masters, array $catalogCategoryIds): int
    {
        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;
        $count = 0;

        foreach (self::YEARS as $year) {
            for ($month = 1; $month <= 12; $month++) {
                foreach ($masters as $masterIndex => $master) {
                    $day = $this->randomBusinessDay($year, $month);
                    $receivedAt = Carbon::create($year, $month, $day, mt_rand(8, 17), mt_rand(0, 59), 0);
                    $dateIn = $receivedAt->toDateString();
                    $units = $this->unitsForBand(self::MASTER_TEMPLATES[$masterIndex]['unit_band'], $month);
                    $batchSlug = sprintf(
                        '%s-M%02d-R%d%02d',
                        self::SLUG_PREFIX,
                        $masterIndex + 1,
                        $year,
                        $month
                    );
                    $labelCategoryId = $catalogCategoryIds[$masterIndex % count($catalogCategoryIds)];

                    Category::create([
                        'parent_id' => $master->id,
                        'name' => $master->name.' · '.$receivedAt->format('M Y'),
                        'slug' => $batchSlug,
                        'sku' => $master->sku,
                        'type' => $stockType,
                        'sort_order' => (int) $master->sort_order,
                        'is_active' => true,
                        'description' => "Receive batch {$dateIn} — demo data.",
                        'price' => $master->price,
                        'compare_at_price' => $master->compare_at_price,
                        'cost' => $master->cost,
                        'unit' => $master->unit,
                        'origin' => $master->origin,
                        'label_category_id' => $labelCategoryId,
                        'label_category_ids' => [$labelCategoryId],
                        'manage_stock' => true,
                        'stock_received' => $units,
                        'stock' => $units,
                        'min_stock' => $master->min_stock,
                        'date_in' => $dateIn,
                        'product_condition' => 'new',
                        'has_variation' => false,
                        'created_at' => $receivedAt,
                        'updated_at' => $receivedAt,
                    ]);

                    $count++;
                }
            }
        }

        return $count;
    }

    /**
     * @param  list<Category>  $masters
     */
    private function syncMasterStockFromBatches(array $masters): void
    {
        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;

        foreach ($masters as $master) {
            $received = (int) Category::query()
                ->where('parent_id', $master->id)
                ->where('type', $stockType)
                ->selectRaw('COALESCE(SUM(GREATEST(COALESCE(stock_received, stock, 0), 0)), 0) as total')
                ->value('total');

            $master->stock = $received;
            $master->save();
        }
    }

    /**
     * Link FS-DEMO products to the receive batch for their year/month (Stock Received page).
     *
     * @param  list<Category>  $masters
     */
    private function linkCatalogProducts(array $masters): void
    {
        $demoProducts = Product::query()
            ->where('sku', 'like', 'FS-DEMO-%')
            ->orderBy('id')
            ->get();

        if ($demoProducts->isEmpty()) {
            return;
        }

        foreach ($demoProducts as $i => $product) {
            if (! preg_match('/FS-DEMO-(\d{4})-(\d+)/', (string) $product->sku, $m)) {
                continue;
            }

            $year = (int) $m[1];
            $masterIndex = ((int) $m[2] - 1) % count($masters);
            $month = Carbon::parse($product->created_at)->month;
            if (! in_array($year, self::YEARS, true)) {
                $year = self::YEARS[array_rand(self::YEARS)];
            }

            $batchSlug = sprintf(
                '%s-M%02d-R%d%02d',
                self::SLUG_PREFIX,
                $masterIndex + 1,
                $year,
                $month
            );

            $batch = Category::query()->where('slug', $batchSlug)->first();
            $master = $masters[$masterIndex];

            $product->stock_label_id = $batch?->id ?? $master->id;
            $product->barcode_code = $master->slug;
            if ((int) $product->stock < 1) {
                $units = $batch ? (int) ($batch->stock_received ?? 0) : (int) $master->stock;
                $product->stock = max(12, (int) floor($units / 4));
            }
            $product->save();
        }
    }

    private function randomBusinessDay(int $year, int $month): int
    {
        $last = Carbon::create($year, $month, 1)->endOfMonth()->day;

        return mt_rand(1, $last);
    }

    /**
     * Mirror receive batches into public.stock_received (visible as its own table in pgAdmin).
     */
    private function seedStockReceivedLedgerTable(): int
    {
        if (! Schema::hasTable('stock_received')) {
            return 0;
        }

        $createdBy = User::query()->whereIn('role', ['admin', 'superadmin'])->value('id');

        $batches = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNotNull('parent_id')
            ->where('slug', 'like', self::SLUG_PREFIX.'-%')
            ->orderBy('id')
            ->get();

        $productByBatch = Product::query()
            ->where('sku', 'like', 'FS-DEMO-%')
            ->whereNotNull('stock_label_id')
            ->pluck('id', 'stock_label_id');

        $fallbackProducts = Product::query()
            ->where('sku', 'like', 'FS-DEMO-%')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $rows = [];
        $fallbackIndex = 0;

        foreach ($batches as $batch) {
            $qty = max(0, (int) ($batch->stock_received ?? $batch->stock ?? 0));
            if ($qty < 1) {
                continue;
            }

            $productId = $productByBatch->get($batch->id)
                ?? $productByBatch->get($batch->parent_id)
                ?? ($fallbackProducts[$fallbackIndex % max(1, count($fallbackProducts))] ?? null);

            $fallbackIndex++;

            if ($productId === null) {
                continue;
            }

            $unitCost = round((float) ($batch->cost ?? 0), 2);
            $receivedAt = $batch->created_at
                ? Carbon::parse($batch->created_at)
                : Carbon::parse($batch->date_in ?? now());

            $rows[] = [
                'product_id' => $productId,
                'created_by' => $createdBy,
                'corrects_stock_received_id' => null,
                'entry_type' => 'receive',
                'quantity' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => round($unitCost * $qty, 2),
                'supplier_name' => 'Demo Supplier '.strtoupper((string) $batch->origin),
                'invoice_number' => 'INV-'.$batch->slug,
                'received_at' => $receivedAt,
                'notes' => 'Historical demo 2023–2025',
                'created_at' => $receivedAt,
                'updated_at' => $receivedAt,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('stock_received')->insert($chunk);
        }

        return count($rows);
    }

    private function unitsForBand(string $band, int $month): int
    {
        $seasonBoost = in_array($month, [11, 12, 1, 2], true) ? 1.12 : 1.0;
        if (in_array($month, [6, 7, 8], true)) {
            $seasonBoost *= 1.08;
        }

        [$min, $max] = match ($band) {
            'bulk' => [96, 240],
            'high' => [48, 120],
            'mid' => [24, 72],
            'low' => [12, 36],
            default => [24, 72],
        };

        return max(12, (int) round(mt_rand($min, $max) * $seasonBoost));
    }
}
