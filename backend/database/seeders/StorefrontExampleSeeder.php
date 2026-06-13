<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Discount;
use App\Models\Product;
use App\Models\Supplier;
use App\Services\PaidOrderInventory;
use App\Services\ProductVariantInventory;
use App\Services\StockTableSyncService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Full storefront example: brands, catalog categories (nav-aligned slugs), products with
 * variants, suppliers, discounts, and stock labels + receive history (2023–2025).
 *
 * Run (after migrate):
 *   php artisan db:seed --class=StorefrontExampleSeeder
 *
 * Safe to re-run: removes prior FS-EX-* demo rows first.
 */
class StorefrontExampleSeeder extends Seeder
{
    public const SKU_PREFIX = 'FS-EX';

    public const STOCK_SLUG_PREFIX = 'FS-EX-STOCK';

    private const YEARS = [2023, 2024, 2025];

    /** @var array<string, int> */
    private array $categoryIds = [];

    /** @var array<string, int> */
    private array $brandIds = [];

    /** @var list<int> */
    private array $supplierIds = [];

    public function run(): void
    {
        $this->command?->info('StorefrontExampleSeeder: building catalog + stock example…');

        DB::transaction(function () {
            $this->purgeExampleData();
            $this->seedBrands();
            $this->seedSuppliers();
            $this->seedCategories();
            $this->seedProducts();
            $this->seedDiscounts();
            $this->seedStockInventory();
        });

        $this->command?->info('Done. Categories: '.count($this->categoryIds));
        $this->command?->info('Products: '.Product::query()->where('sku', 'like', self::SKU_PREFIX.'-%')->count());
        $this->command?->info('Brands: '.Brand::query()->count().' | Suppliers: '.Supplier::query()->count());
    }

    private function purgeExampleData(): void
    {
        $stockSlugs = Category::query()
            ->where('slug', 'like', self::STOCK_SLUG_PREFIX.'%')
            ->pluck('id');

        if ($stockSlugs->isNotEmpty()) {
            if (Schema::hasTable('stock_received')) {
                DB::table('stock_received')->whereIn('category_id', $stockSlugs)->delete();
            }
            if (Schema::hasTable('stock_inventory')) {
                DB::table('stock_inventory')->whereIn('category_id', $stockSlugs)->delete();
            }
            Category::query()->whereIn('parent_id', $stockSlugs)->delete();
            Category::query()->whereIn('id', $stockSlugs)->delete();
        }

        $productIds = Product::query()->where('sku', 'like', self::SKU_PREFIX.'-%')->pluck('id');
        if ($productIds->isNotEmpty()) {
            Discount::query()->whereIn('product_id', $productIds)->delete();
            Product::query()->whereIn('id', $productIds)->delete();
        }
    }

    private function seedBrands(): void
    {
        $brands = [
            'Nike', 'Adidas', 'Puma', 'Uniqlo', 'Zara', 'H&M',
            'Champion', 'Under Armour', 'Lacoste', 'Converse', 'New Balance', "Levi's",
        ];

        foreach ($brands as $i => $name) {
            $brand = Brand::updateOrCreate(
                ['slug' => Str::slug($name)],
                [
                    'name' => $name,
                    'sort_order' => $i + 1,
                    'is_active' => true,
                ]
            );
            $this->brandIds[Str::slug($name)] = $brand->id;
        }
    }

    private function seedSuppliers(): void
    {
        $rows = [
            ['code' => 'SUP-PP', 'name' => 'Phnom Penh Garment Co.', 'city' => 'Phnom Penh', 'country' => 'KH'],
            ['code' => 'SUP-SG', 'name' => 'Straits Apparel Trading', 'city' => 'Singapore', 'country' => 'SG'],
            ['code' => 'SUP-BKK', 'name' => 'Bangkok Wholesale Hub', 'city' => 'Bangkok', 'country' => 'TH'],
            ['code' => 'SUP-HCMC', 'name' => 'Saigon Textile Partners', 'city' => 'Ho Chi Minh City', 'country' => 'VN'],
        ];

        foreach ($rows as $row) {
            $supplier = Supplier::updateOrCreate(
                ['supplier_code' => $row['code']],
                [
                    'name' => $row['name'],
                    'contact_person' => 'Demo contact',
                    'email' => strtolower($row['code']).'@example.fitandsleek.test',
                    'phone' => '+855 23 '.mt_rand(100000, 999999),
                    'city' => $row['city'],
                    'country' => $row['country'],
                    'is_active' => true,
                ]
            );
            $this->supplierIds[] = $supplier->id;
        }
    }

    private function seedCategories(): void
    {
        $catalog = [
            // Legacy / broad (used by older seeders)
            ['name' => 'Clothes', 'slug' => 'clothes', 'gender' => null],
            ['name' => 'Shoes', 'slug' => 'shoes', 'gender' => null],
            ['name' => 'Belts', 'slug' => 'belts', 'gender' => null],
            ['name' => 'Men Clothes', 'slug' => 'men-clothes', 'gender' => 'men'],
            ['name' => 'Women Clothes', 'slug' => 'women-clothes', 'gender' => 'women'],
            ['name' => 'Men Shoes', 'slug' => 'men-shoes', 'gender' => 'men'],
            ['name' => 'Women Shoes', 'slug' => 'women-shoes', 'gender' => 'women'],
            ['name' => 'Men Accessories', 'slug' => 'men-accessory', 'gender' => 'men'],
            ['name' => 'Women Accessories', 'slug' => 'women-accessory', 'gender' => 'women'],
            // Women — nav slugs
            ['name' => 'Women Tops', 'slug' => 'tops', 'gender' => 'women'],
            ['name' => 'Women Bottoms', 'slug' => 'bottoms', 'gender' => 'women'],
            ['name' => 'Women Dresses', 'slug' => 'dresses', 'gender' => 'women'],
            ['name' => 'Women Outerwear', 'slug' => 'outerwear', 'gender' => 'women'],
            ['name' => 'Women Activewear', 'slug' => 'activewear', 'gender' => 'women'],
            ['name' => 'Women Sneakers', 'slug' => 'sneakers', 'gender' => 'women'],
            ['name' => 'Women Slides', 'slug' => 'slides', 'gender' => 'women'],
            ['name' => 'Women Heels', 'slug' => 'heels', 'gender' => 'women'],
            ['name' => 'Women Boots', 'slug' => 'boots', 'gender' => 'women'],
            ['name' => 'Women Bags', 'slug' => 'bags', 'gender' => 'women'],
            ['name' => 'Women Hats', 'slug' => 'hats', 'gender' => 'women'],
            ['name' => 'Women Jewelry', 'slug' => 'jewelry', 'gender' => 'women'],
            // Men — nav slugs
            ['name' => 'Men T-Shirts', 'slug' => 't-shirts', 'gender' => 'men'],
            ['name' => 'Men Shirts', 'slug' => 'shirts', 'gender' => 'men'],
            ['name' => 'Men Hoodies', 'slug' => 'hoodies', 'gender' => 'men'],
            ['name' => 'Men Jeans', 'slug' => 'jeans', 'gender' => 'men'],
            ['name' => 'Men Shorts', 'slug' => 'shorts', 'gender' => 'men'],
            ['name' => 'Men Running Shoes', 'slug' => 'running', 'gender' => 'men'],
            ['name' => 'Men Caps & Hats', 'slug' => 'caps-hats', 'gender' => 'men'],
            ['name' => 'Men Watches', 'slug' => 'watches', 'gender' => 'men'],
            // Kids
            ['name' => 'Boys Apparel', 'slug' => 'boys-apparel', 'gender' => 'boys'],
            ['name' => 'Girls Apparel', 'slug' => 'girls-apparel', 'gender' => 'girls'],
        ];

        foreach ($catalog as $i => $row) {
            $cat = Category::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'gender' => $row['gender'],
                    'sort_order' => $i + 1,
                    'is_active' => true,
                ]
            );
            $this->categoryIds[$row['slug']] = $cat->id;
        }
    }

    private function seedProducts(): void
    {
        $templates = $this->productTemplates();
        $brandSlugs = array_keys($this->brandIds);
        $seq = 0;

        foreach ($templates as $template) {
            $categoryId = $this->categoryIds[$template['category_slug']] ?? null;
            if (! $categoryId) {
                continue;
            }

            foreach ($template['items'] as $item) {
                $seq++;
                $sku = sprintf('%s-%s-%03d', self::SKU_PREFIX, $template['category_slug'], $seq);
                $slug = Str::slug($item['name'].'-'.$seq);
                $brandSlug = $brandSlugs[array_rand($brandSlugs)];
                $price = (float) $item['price'];
                $cost = round($price * mt_rand(48, 62) / 100, 2);
                $launched = Carbon::create(
                    $item['year'] ?? self::YEARS[array_rand(self::YEARS)],
                    mt_rand(1, 12),
                    mt_rand(1, 28),
                    9,
                    0,
                    0
                );

                $colors = $item['colors'] ?? ['Black', 'White'];
                $sizes = $item['sizes'] ?? ['S', 'M', 'L', 'XL'];
                $matrix = $this->buildVariantMatrix($sku, $colors, $sizes, $item['stock_each'] ?? 8);
                $totalStock = array_sum(array_column($matrix, 'qty'));

                Product::updateOrCreate(
                    ['sku' => $sku],
                    [
                        'category_id' => $categoryId,
                        'brand_id' => $this->brandIds[$brandSlug],
                        'supplier_id' => $this->supplierIds[array_rand($this->supplierIds)],
                        'name' => $item['name'],
                        'slug' => $slug,
                        'description' => $item['description'] ?? "Store example — {$item['name']}. Quality materials for everyday wear.",
                        'price' => $price,
                        'cost_price' => $cost,
                        'compare_at_price' => $item['compare_at'] ?? round($price * 1.2, 2),
                        'stock' => $totalStock,
                        'colors' => $colors,
                        'sizes' => $sizes,
                        'variant_matrix' => $matrix,
                        'image_url' => 'https://picsum.photos/seed/'.urlencode($sku).'/800/800',
                        'is_active' => true,
                        'created_at' => $launched,
                        'updated_at' => $launched->copy()->addDays(mt_rand(1, 90)),
                    ]
                );
            }
        }
    }

    /**
     * @return list<array{category_slug: string, items: list<array<string, mixed>>}>
     */
    private function productTemplates(): array
    {
        return [
            [
                'category_slug' => 'tops',
                'items' => [
                    ['name' => 'Ribbed Cotton Tank', 'price' => 18.99, 'colors' => ['White', 'Black', 'Sage'], 'year' => 2024],
                    ['name' => 'Linen Blend Blouse', 'price' => 32.50, 'colors' => ['Ivory', 'Sky'], 'year' => 2023],
                    ['name' => 'Oversized Graphic Tee', 'price' => 22.00, 'year' => 2025],
                ],
            ],
            [
                'category_slug' => 'dresses',
                'items' => [
                    ['name' => 'Midi Wrap Dress', 'price' => 48.99, 'sizes' => ['XS', 'S', 'M', 'L'], 'year' => 2024],
                    ['name' => 'Satin Slip Dress', 'price' => 54.00, 'year' => 2023],
                ],
            ],
            [
                'category_slug' => 't-shirts',
                'items' => [
                    ['name' => 'Essential Crew Tee 3-Pack', 'price' => 29.99, 'year' => 2023],
                    ['name' => 'Performance Dry-Fit Tee', 'price' => 24.99, 'colors' => ['Black', 'Navy', 'Grey'], 'year' => 2024],
                    ['name' => 'Heavyweight Pocket Tee', 'price' => 26.50, 'year' => 2025],
                ],
            ],
            [
                'category_slug' => 'hoodies',
                'items' => [
                    ['name' => 'Fleece Pullover Hoodie', 'price' => 59.99, 'year' => 2024],
                    ['name' => 'Zip-Up Tech Hoodie', 'price' => 64.00, 'year' => 2025],
                ],
            ],
            [
                'category_slug' => 'jeans',
                'items' => [
                    ['name' => 'Slim Taper Denim', 'price' => 49.99, 'sizes' => ['28', '30', '32', '34', '36'], 'year' => 2023],
                    ['name' => 'Relaxed Straight Jean', 'price' => 44.99, 'year' => 2024],
                ],
            ],
            [
                'category_slug' => 'sneakers',
                'items' => [
                    ['name' => 'Street Runner Sneaker', 'price' => 79.99, 'sizes' => ['6', '7', '8', '9', '10', '11'], 'year' => 2024],
                    ['name' => 'Classic Court Low', 'price' => 69.00, 'year' => 2023],
                ],
            ],
            [
                'category_slug' => 'heels',
                'items' => [
                    ['name' => 'Block Heel Sandal', 'price' => 42.99, 'sizes' => ['5', '6', '7', '8', '9'], 'year' => 2025],
                ],
            ],
            [
                'category_slug' => 'bags',
                'items' => [
                    ['name' => 'Canvas Crossbody Bag', 'price' => 34.99, 'sizes' => ['One Size'], 'colors' => ['Natural', 'Black'], 'year' => 2024],
                    ['name' => 'Mini Leather Tote', 'price' => 58.00, 'year' => 2023],
                ],
            ],
            [
                'category_slug' => 'running',
                'items' => [
                    ['name' => 'Lightweight Running Shoe', 'price' => 89.99, 'year' => 2025],
                    ['name' => 'Trail Grip Runner', 'price' => 94.50, 'year' => 2024],
                ],
            ],
            [
                'category_slug' => 'boys-apparel',
                'items' => [
                    ['name' => 'Boys Graphic Hoodie', 'price' => 28.99, 'sizes' => ['8Y', '10Y', '12Y', '14Y'], 'year' => 2024],
                ],
            ],
            [
                'category_slug' => 'girls-apparel',
                'items' => [
                    ['name' => 'Girls Pleated Skort', 'price' => 24.99, 'sizes' => ['8Y', '10Y', '12Y'], 'year' => 2025],
                ],
            ],
            [
                'category_slug' => 'men-clothes',
                'items' => [
                    ['name' => 'Oxford Button-Down Shirt', 'price' => 39.99, 'year' => 2023],
                    ['name' => 'Chino Stretch Pant', 'price' => 45.00, 'year' => 2024],
                ],
            ],
            [
                'category_slug' => 'women-clothes',
                'items' => [
                    ['name' => 'High-Rise Wide Leg Pant', 'price' => 46.99, 'year' => 2024],
                    ['name' => 'Soft Knit Cardigan', 'price' => 38.50, 'year' => 2023],
                ],
            ],
        ];
    }

    /**
     * @param  list<string>  $colors
     * @param  list<string>  $sizes
     * @return list<array{color: string, size: string, qty: int, sku_barcode: string}>
     */
    private function buildVariantMatrix(string $baseSku, array $colors, array $sizes, int $qtyEach): array
    {
        $rows = [];
        $i = 0;
        foreach ($colors as $color) {
            foreach ($sizes as $size) {
                $i++;
                $rows[] = [
                    'color' => $color,
                    'size' => $size,
                    'qty' => max(0, $qtyEach + mt_rand(-2, 6)),
                    'sku_barcode' => strtoupper($baseSku).'-'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                ];
            }
        }

        return $rows;
    }

    private function seedDiscounts(): void
    {
        $products = Product::query()
            ->where('sku', 'like', self::SKU_PREFIX.'-%')
            ->inRandomOrder()
            ->limit(12)
            ->get();

        foreach ($products as $i => $product) {
            $pct = [10, 15, 20, 25][ $i % 4 ];
            $sale = round((float) $product->price * (1 - $pct / 100), 2);

            Discount::updateOrCreate(
                ['product_id' => $product->id],
                [
                    'discount_type' => 'percentage',
                    'discount_value' => $pct,
                    'sale_price' => $sale,
                    'start_date' => Carbon::now()->subMonths(2),
                    'end_date' => Carbon::now()->addMonths(3),
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedStockInventory(): void
    {
        $stockType = PaidOrderInventory::BARCODE_CATEGORY_TYPE;
        $catalogIds = array_values($this->categoryIds);
        $products = Product::query()
            ->where('sku', 'like', self::SKU_PREFIX.'-%')
            ->orderBy('id')
            ->limit(18)
            ->get();

        if ($products->isEmpty()) {
            return;
        }

        $masters = [];
        foreach ($products as $index => $product) {
            $seq = str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
            $slug = self::STOCK_SLUG_PREFIX.'-M'.$seq;
            $cost = (float) ($product->cost_price ?: round((float) $product->price * 0.55, 2));
            $price = (float) $product->price;
            $labelCategoryId = $catalogIds[$index % count($catalogIds)];

            $master = Category::create([
                'parent_id' => null,
                'name' => $product->name.' (Stock Label)',
                'slug' => $slug,
                'sku' => $slug,
                'type' => $stockType,
                'sort_order' => $index,
                'is_active' => true,
                'description' => 'Example stock label linked to catalog SKU '.$product->sku,
                'price' => $price,
                'compare_at_price' => (float) ($product->compare_at_price ?? $price * 1.1),
                'cost' => $cost,
                'unit' => 'pcs',
                'origin' => 'KH',
                'label_category_id' => $labelCategoryId,
                'label_category_ids' => [$labelCategoryId],
                'manage_stock' => true,
                'stock' => 0,
                'min_stock' => 5,
                'product_condition' => 'new',
                'has_variation' => ProductVariantInventory::usesMatrix($product),
            ]);

            $masters[] = $master;
            $totalReceived = 0;

            foreach (self::YEARS as $year) {
                for ($month = 1; $month <= 12; $month++) {
                    if ($year === 2023 && $month < 4) {
                        continue;
                    }
                    $units = mt_rand(8, 35);
                    $receivedAt = Carbon::create($year, $month, min(28, mt_rand(1, 28)), 10, 0, 0);
                    $batchSlug = sprintf('%s-M%s-R%d%02d', self::STOCK_SLUG_PREFIX, $seq, $year, $month);

                    Category::create([
                        'parent_id' => $master->id,
                        'name' => $product->name.' · '.$receivedAt->format('M Y'),
                        'slug' => $batchSlug,
                        'sku' => $master->sku,
                        'type' => $stockType,
                        'is_active' => true,
                        'price' => $price,
                        'cost' => $cost,
                        'unit' => 'pcs',
                        'origin' => 'KH',
                        'label_category_id' => $labelCategoryId,
                        'label_category_ids' => [$labelCategoryId],
                        'manage_stock' => true,
                        'stock_received' => $units,
                        'stock' => $units,
                        'date_in' => $receivedAt->toDateString(),
                        'product_condition' => 'new',
                        'created_at' => $receivedAt,
                        'updated_at' => $receivedAt,
                    ]);

                    $totalReceived += $units;
                }
            }

            $master->stock = $totalReceived;
            $master->save();

            $product->stock_label_id = $master->id;
            $product->barcode_code = $master->slug;
            if (! ProductVariantInventory::usesMatrix($product)) {
                $product->stock = max((int) $product->stock, (int) floor($totalReceived / 6));
            }
            $product->save();
        }

        if (Schema::hasTable('stock_inventory') && Schema::hasTable('stock_received')) {
            $sync = app(StockTableSyncService::class);
            foreach ($masters as $master) {
                $sync->syncMasterFromCategory($master->fresh());
            }
            $this->command?->info('Synced '.count($masters).' stock labels to stock_inventory / stock_received tables.');
        }
    }
}
