<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Discount;
use App\Models\Product;
use App\Models\User;
use App\Services\PaidOrderInventory;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Simple production seed for Neon PostgreSQL + Cloudflare R2 media.
 *
 * Creates: admin users, all 17 catalog categories, brands, one product per category,
 * sample discounts, and stock-inventory labels (barcode_qr) linked to catalog categories.
 *
 * Run after migrations:
 *   php artisan db:seed --class=NeonHostingSeeder
 */
class NeonHostingSeeder extends Seeder
{
    public const SKU_PREFIX = 'NH-';

    public const STOCK_SLUG_PREFIX = 'nh-stock-m';

    /** @return list<array{name: string, slug?: string, type?: string, gender?: string, sort_order?: int}> */
    public static function catalogCategories(): array
    {
        return [
            ['name' => 'Clothes', 'slug' => 'clothes', 'type' => 'parent', 'sort_order' => 1],
            ['name' => 'Shoes', 'slug' => 'shoes', 'type' => 'parent', 'sort_order' => 2],
            ['name' => 'Belts', 'slug' => 'belts', 'type' => 'parent', 'sort_order' => 3],

            ['name' => 'Men - T-Shirts', 'gender' => 'MEN', 'sort_order' => 10],
            ['name' => 'Men - Shirts', 'gender' => 'MEN', 'sort_order' => 11],
            ['name' => 'Men - Pants', 'gender' => 'MEN', 'sort_order' => 12],
            ['name' => 'Men - Shoes', 'gender' => 'MEN', 'sort_order' => 13],

            ['name' => 'Women - Dresses', 'gender' => 'WOMEN', 'sort_order' => 20],
            ['name' => 'Women - Tops', 'gender' => 'WOMEN', 'sort_order' => 21],
            ['name' => 'Women - Skirts', 'gender' => 'WOMEN', 'sort_order' => 22],
            ['name' => 'Women - Shoes', 'gender' => 'WOMEN', 'sort_order' => 23],

            ['name' => 'Boy - T-Shirts', 'gender' => 'BOY', 'sort_order' => 30],
            ['name' => 'Boy - Shorts', 'gender' => 'BOY', 'sort_order' => 31],
            ['name' => 'Boy - Shoes', 'gender' => 'BOY', 'sort_order' => 32],

            ['name' => 'Girl - Dresses', 'gender' => 'GIRL', 'sort_order' => 40],
            ['name' => 'Girl - Tops', 'gender' => 'GIRL', 'sort_order' => 41],
            ['name' => 'Girl - Shoes', 'gender' => 'GIRL', 'sort_order' => 42],
        ];
    }

    /** @return list<array{name: string, slug: string, sort_order: int}> */
    public static function catalogBrands(): array
    {
        return [
            ['name' => 'Nike', 'slug' => 'nike', 'sort_order' => 1],
            ['name' => 'Adidas', 'slug' => 'adidas', 'sort_order' => 2],
            ['name' => 'Uniqlo', 'slug' => 'uniqlo', 'sort_order' => 3],
            ['name' => 'Zara', 'slug' => 'zara', 'sort_order' => 4],
            ['name' => 'Puma', 'slug' => 'puma', 'sort_order' => 5],
            ['name' => 'H&M', 'slug' => 'hm', 'sort_order' => 6],
        ];
    }

    public function run(): void
    {
        $this->seedAdminUsers();
        $this->seedCatalogCategories();

        $brands = $this->seedBrands();
        $stockCount = $this->seedStockLabels();
        $productCount = $this->seedProducts($brands);
        $discountCount = $this->seedDiscounts();
        $this->tryIndexProductsInQdrant();

        $categoryCount = count(self::catalogCategories());
        $brandCount = count(self::catalogBrands());

        $this->command?->info(sprintf(
            'Neon hosting seed complete: %d categories, %d brands, %d products, %d discounts, %d stock labels (+ admin users).',
            $categoryCount,
            $brandCount,
            $productCount,
            $discountCount,
            $stockCount
        ));
        $this->command?->line('Product images use external URLs (picsum). Upload real assets to Cloudflare R2 from admin when ready.');
    }

    private function seedAdminUsers(): void
    {
        User::updateOrCreate(
            ['email' => 'superadmin@fitandsleek.com'],
            [
                'name' => 'Super Administrator',
                'password' => Hash::make('SuperAdmin@123'),
                'role' => 'superadmin',
                'status' => 'active',
                'phone' => '+85510000001',
            ]
        );

        User::updateOrCreate(
            ['email' => 'admin@fitandsleek.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('Admin@123'),
                'role' => 'admin',
                'status' => 'active',
                'phone' => '+85510000002',
            ]
        );
    }

    private function seedCatalogCategories(): void
    {
        foreach (self::catalogCategories() as $row) {
            $slug = $row['slug'] ?? Str::slug($row['name']);

            Category::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $row['name'],
                    'type' => $row['type'] ?? null,
                    'gender' => $row['gender'] ?? null,
                    'sort_order' => $row['sort_order'] ?? 0,
                    'is_active' => true,
                ]
            );
        }
    }

    /** @return array<string, Brand> slug => model */
    private function seedBrands(): array
    {
        $map = [];

        foreach (self::catalogBrands() as $row) {
            $map[$row['slug']] = Brand::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'sort_order' => $row['sort_order'],
                    'is_active' => true,
                ]
            );
        }

        return $map;
    }

    /**
     * One simple active product per catalog category (all 17).
     *
     * @param  array<string, Brand>  $brands
     */
    private function seedProducts(array $brands): int
    {
        $brandList = array_values($brands);
        $stockLabelsByCategoryId = $this->stockLabelIdsByCatalogCategory();

        $catalogSlugs = collect(self::catalogCategories())
            ->map(fn (array $row) => $row['slug'] ?? Str::slug($row['name']))
            ->values()
            ->all();

        $categories = Category::query()
            ->catalogOnly()
            ->whereIn('slug', $catalogSlugs)
            ->orderBy('sort_order')
            ->get();

        foreach ($categories as $index => $category) {
            $brand = $brandList[$index % count($brandList)];
            $sku = self::SKU_PREFIX.strtoupper(str_replace('-', '_', $category->slug));
            $name = 'Sample '.$category->name;
            $price = round(12.99 + ($index * 2.5), 2);
            $stock = 40 + ($index * 5);

            $product = Product::updateOrCreate(
                ['sku' => $sku],
                [
                    'category_id' => $category->id,
                    'brand_id' => $brand->id,
                    'name' => $name,
                    'slug' => Str::slug($name.'-'.$category->slug),
                    'description' => 'Simple demo product for '.$category->name.' (Neon hosting seed).',
                    'price' => $price,
                    'compare_at_price' => round($price * 1.15, 2),
                    'image_url' => $this->placeholderImageUrl($category->slug),
                    'stock' => $stock,
                    'stock_label_id' => $stockLabelsByCategoryId[$category->id] ?? null,
                    'is_active' => true,
                ]
            );
        }

        return $categories->count();
    }

    private function seedDiscounts(): int
    {
        $products = Product::query()
            ->where('sku', 'like', self::SKU_PREFIX.'%')
            ->orderBy('id')
            ->get();

        $configs = [
            ['type' => 'percentage', 'value' => 10],
            ['type' => 'percentage', 'value' => 15],
            ['type' => 'percentage', 'value' => 20],
            ['type' => 'fixed', 'value' => 3],
            ['type' => 'fixed', 'value' => 5],
            ['type' => 'percentage', 'value' => 25],
        ];

        $count = 0;
        foreach ($products->take(6) as $index => $product) {
            $config = $configs[$index % count($configs)];
            $base = (float) $product->price;

            if ($config['type'] === 'percentage') {
                $salePrice = round($base * (1 - $config['value'] / 100), 2);
            } else {
                $salePrice = max(round($base - $config['value'], 2), 1.0);
            }

            Discount::updateOrCreate(
                ['product_id' => $product->id],
                [
                    'discount_type' => $config['type'],
                    'discount_value' => $config['value'],
                    'sale_price' => $salePrice,
                    'start_date' => Carbon::now()->subDay(),
                    'end_date' => Carbon::now()->addMonths(3),
                    'is_active' => true,
                    'description' => 'Neon hosting sample discount',
                ]
            );
            $count++;
        }

        return $count;
    }

    /**
     * Stock & Inventory master labels (type barcode_qr), spread across all catalog categories.
     */
    private function seedStockLabels(): int
    {
        $catalogIds = Category::query()
            ->catalogOnly()
            ->orderBy('sort_order')
            ->pluck('id')
            ->all();

        if ($catalogIds === []) {
            return 0;
        }

        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;
        $templates = [
            ['name' => 'NH Stock — Clothes & tops', 'units' => 100],
            ['name' => 'NH Stock — Footwear', 'units' => 80],
            ['name' => 'NH Stock — Belts & accessories', 'units' => 60],
            ['name' => 'NH Stock — Men\'s line', 'units' => 90],
            ['name' => 'NH Stock — Women\'s line', 'units' => 85],
            ['name' => 'NH Stock — Boys\' line', 'units' => 70],
            ['name' => 'NH Stock — Girls\' line', 'units' => 75],
            ['name' => 'NH Stock — Mixed seasonal', 'units' => 110],
        ];

        $created = 0;
        foreach ($templates as $index => $template) {
            $slug = self::STOCK_SLUG_PREFIX.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
            $labelCategoryId = $catalogIds[$index % count($catalogIds)];
            $units = (int) $template['units'];
            $cost = round(mt_rand(800, 3500) / 100, 2);
            $price = round($cost * 1.8, 2);

            $master = Category::updateOrCreate(
                ['slug' => $slug],
                [
                    'parent_id' => null,
                    'name' => $template['name'],
                    'sku' => strtoupper($slug),
                    'type' => $stockType,
                    'sort_order' => $index,
                    'is_active' => true,
                    'description' => 'Simple stock label for Neon / Cloudflare hosting (re-run safe).',
                    'price' => $price,
                    'compare_at_price' => round($price * 1.1, 2),
                    'cost' => $cost,
                    'unit' => 'pcs',
                    'origin' => 'Cambodia',
                    'label_category_id' => $labelCategoryId,
                    'label_category_ids' => [$labelCategoryId],
                    'manage_stock' => true,
                    'stock' => $units,
                    'stock_received' => $units,
                    'min_stock' => 10,
                    'product_condition' => 'new',
                    'has_variation' => false,
                    'date_in' => now()->toDateString(),
                ]
            );

            $batchSlug = $slug.'-recv-'.now()->format('Ym');
            Category::updateOrCreate(
                ['slug' => $batchSlug],
                [
                    'parent_id' => $master->id,
                    'name' => $master->name.' · '.now()->format('M Y'),
                    'sku' => $master->sku,
                    'type' => $stockType,
                    'sort_order' => $master->sort_order,
                    'is_active' => true,
                    'description' => 'Initial receive batch (Neon hosting seed).',
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
                    'date_in' => now()->toDateString(),
                    'product_condition' => 'new',
                    'has_variation' => false,
                ]
            );

            $created++;
        }

        return $created;
    }

    /** @return array<int, int> catalog category id => stock label master id */
    private function stockLabelIdsByCatalogCategory(): array
    {
        $map = [];
        $masters = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNull('parent_id')
            ->where('slug', 'like', self::STOCK_SLUG_PREFIX.'%')
            ->get();

        foreach ($masters as $master) {
            if ($master->label_category_id) {
                $map[(int) $master->label_category_id] = (int) $master->id;
            }
        }

        return $map;
    }

    private function placeholderImageUrl(string $seed): string
    {
        $safe = preg_replace('/[^a-z0-9-]/i', '-', $seed) ?: 'product';

        return 'https://picsum.photos/seed/fitandsleek-'.$safe.'/800/800';
    }

    /**
     * Index seeded product images into Qdrant when ai-service + Qdrant are reachable.
     */
    private function tryIndexProductsInQdrant(): void
    {
        try {
            Artisan::call('qdrant:setup');
            Artisan::call('qdrant:index-products', [
                '--only-missing' => true,
            ]);
            $this->command?->info(trim(Artisan::output()) ?: 'Qdrant indexing attempted for NH-* products.');
        } catch (\Throwable $e) {
            $this->command?->warn('Qdrant indexing skipped (start ai-service + Qdrant, then run qdrant:index-products): '.$e->getMessage());
        }
    }
}
