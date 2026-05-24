<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Demo catalog + orders for 2023–2025 (every month).
 *
 * Run: php artisan db:seed --class=HistoricalDemoDataSeeder
 *
 * Creates ~100 products (named by collection year) and thousands of
 * POS + online orders for reports / sale history testing.
 */
class HistoricalDemoDataSeeder extends Seeder
{
    private const SKU_PREFIX = 'FS-DEMO';

    private const YEARS = [2023, 2024, 2025];

    private const PRODUCTS_PER_YEAR = [2023 => 34, 2024 => 33, 2025 => 33];

    private const POS_METHODS = ['cash', 'khqr', 'debit', 'credit', 'store_credit'];

    private const ONLINE_METHODS = ['card', 'bank', 'wallet', 'khqr'];

    private const COUNTRIES = [
        ['code' => 'KH', 'name' => 'Cambodia', 'cities' => ['Phnom Penh', 'Siem Reap', 'Battambang']],
        ['code' => 'US', 'name' => 'United States', 'cities' => ['New York', 'Los Angeles', 'Chicago']],
        ['code' => 'TH', 'name' => 'Thailand', 'cities' => ['Bangkok', 'Chiang Mai', 'Phuket']],
        ['code' => 'SG', 'name' => 'Singapore', 'cities' => ['Singapore']],
        ['code' => 'VN', 'name' => 'Vietnam', 'cities' => ['Ho Chi Minh City', 'Hanoi', 'Da Nang']],
    ];

    public function run(): void
    {
        $this->command?->info('Seeding historical demo data (2023–2025)…');

        DB::transaction(function () {
            $this->purgePreviousDemoData();
            $categories = $this->resolveCategories();
            $admins = $this->ensureSellers();
            $customers = $this->ensureCustomers();
            $products = $this->seedProducts($categories);
            $this->seedOrders($products, $admins, $customers);
        });

        $this->command?->info('Done. Products: '.Product::where('sku', 'like', self::SKU_PREFIX.'-%')->count());
        $this->command?->info('Demo orders: '.Order::where('order_number', 'like', 'DEMO-%')->count());
    }

    private function purgePreviousDemoData(): void
    {
        $orderIds = Order::query()
            ->where('order_number', 'like', 'DEMO-%')
            ->pluck('id');

        if ($orderIds->isNotEmpty()) {
            OrderItem::query()->whereIn('order_id', $orderIds)->delete();
            Order::query()->whereIn('id', $orderIds)->delete();
        }

        Product::query()->where('sku', 'like', self::SKU_PREFIX.'-%')->delete();
    }

    /** @return \Illuminate\Support\Collection<int, Category> */
    private function resolveCategories()
    {
        $categories = Category::query()
            ->catalogOnly()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        if ($categories->isEmpty()) {
            $categories = collect([
                Category::updateOrCreate(
                    ['slug' => 'demo-apparel'],
                    ['name' => 'Demo Apparel', 'is_active' => true, 'gender' => 'MEN']
                ),
            ]);
        }

        return $categories;
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function ensureSellers()
    {
        $sellers = User::query()->whereIn('role', ['admin', 'superadmin'])->get();

        $extra = [
            ['name' => 'Sokha Chea', 'email' => 'sokha.seller@fitandsleekpro.com'],
            ['name' => 'Dara Lim', 'email' => 'dara.seller@fitandsleekpro.com'],
            ['name' => 'Malis Keo', 'email' => 'malis.seller@fitandsleekpro.com'],
        ];

        foreach ($extra as $row) {
            $sellers->push(User::updateOrCreate(
                ['email' => $row['email']],
                [
                    'name' => $row['name'],
                    'password' => Hash::make('seller12345'),
                    'role' => 'admin',
                ]
            ));
        }

        return $sellers->unique('id')->values();
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function ensureCustomers()
    {
        $names = [
            'John Smith', 'Emily Johnson', 'Michael Williams', 'Sarah Brown', 'David Davis',
            'Jessica Miller', 'Christopher Wilson', 'Amanda Taylor', 'James Anderson', 'Ashley Thomas',
            'Sophea Chan', 'Vanna Heng', 'Bopha Ros', 'Kim Lee', 'Nary Phan',
            'Alex Turner', 'Maria Garcia', 'Wei Zhang', 'Priya Patel', 'Liam O\'Connor',
        ];

        $customers = collect();
        foreach ($names as $i => $name) {
            $slug = Str::slug($name);
            $customers->push(User::updateOrCreate(
                ['email' => "demo.customer.{$slug}@fitandsleek.test"],
                [
                    'name' => $name,
                    'password' => Hash::make('password123'),
                    'role' => 'customer',
                ]
            ));
        }

        return $customers;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Category>  $categories
     * @return list<Product>
     */
    private function seedProducts($categories): array
    {
        $products = [];
        $categoryIds = $categories->pluck('id')->all();
        $audiences = ['men', 'women', 'unisex', 'boy', 'girl'];

        foreach (self::YEARS as $year) {
            $count = self::PRODUCTS_PER_YEAR[$year];
            $names = $this->productNamesForYear($year, $count);

            foreach ($names as $index => $name) {
                $seq = str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);
                $sku = self::SKU_PREFIX."-{$year}-{$seq}";
                $slug = Str::slug("demo-{$year}-{$name}-{$seq}");
                $categoryId = $categoryIds[array_rand($categoryIds)];
                $price = round(mt_rand(1299, 18999) / 100, 2);
                $launched = Carbon::create($year, mt_rand(1, 3), mt_rand(1, 28), 10, 0, 0);

                $products[] = Product::create([
                    'category_id' => $categoryId,
                    'sku' => $sku,
                    'name' => $name,
                    'slug' => $slug,
                    'description' => "Fit & Sleek {$year} collection — {$name}. Premium materials for everyday wear.",
                    'price' => $price,
                    'compare_at_price' => round($price * 1.15, 2),
                    'stock' => mt_rand(40, 250),
                    'is_active' => true,
                    'image_url' => "https://picsum.photos/seed/{$sku}/800/800",
                    'audience' => $audiences[array_rand($audiences)],
                    'created_at' => $launched,
                    'updated_at' => $launched,
                ]);
            }
        }

        return $products;
    }

    /** @return list<string> */
    private function productNamesForYear(int $year, int $count): array
    {
        $styles = match ($year) {
            2023 => [
                'Heritage Cotton Tee', 'Classic Oxford Shirt', 'Vintage Denim Jacket', 'Essential Chino Pant',
                'Relaxed Linen Short', 'Wool Blend Blazer', 'Ribbed Mock Neck', 'Canvas Work Jacket',
                'Pleated Midi Skirt', 'Satin Slip Dress', 'High-Rise Straight Jean', 'Merino Crew Sweater',
                'Tailored Taper Trouser', 'Organic Hoodie', 'Striped Rugby Polo', 'Quilted Liner Vest',
                'Corduroy Trucker', 'Soft Touch Legging', 'Belted Trench Coat', 'Everyday Crew Sock 3-Pack',
                'Performance Track Pant', 'Floral Wrap Blouse', 'Selvedge Denim', 'Cashmere Touch Scarf',
                'Utility Cargo Short', 'Fine Gauge Cardigan', 'Structured Shoulder Bag', 'Breathable Running Tee',
                'Ponte Midi Dress', 'Stretch Slim Suit Pant', 'Fleece Quarter Zip', 'Embroidered Cap',
                'Lightweight Puffer', 'Bamboo Lounge Set',
            ],
            2024 => [
                'Urban Tech Hoodie', 'Modern Slim Chino', 'Linen Resort Shirt', 'Eco Dye Graphic Tee',
                'Seamless Sports Bra', 'Wide Leg Trouser', 'Recycled Nylon Windbreaker', 'City Commuter Backpack',
                'Modal Sleep Shirt', 'Pleated Tennis Skirt', 'Hybrid Jogger Pant', 'Crisp Poplin Dress Shirt',
                'Cloud Knit Pullover', 'Trail Ready Anorak', 'Minimal Leather Belt', 'Soft Sculpt Legging',
                'Boxy Cropped Jacket', 'Performance Polo', 'Drapey Camisole', 'Stretch Denim Short',
                'Merino Base Layer', 'Oversized Linen Blazer', 'Mesh Training Tank', 'Cordless Packable Vest',
                'Suede Touch Sneaker Sock', 'Rib Tank Dress', 'Tapered Wool Coat', 'Everyday Crossbody',
                'Cooling Athletic Short', 'Relaxed Barrel Jean', 'Fine Stripe Oxford', 'Velour Track Set',
                'Sheer Layer Top', 'Water Repellent Parka',
            ],
            2025 => [
                'AeroFlex Training Tee', 'Smart Weave Blazer', 'Core Seamless Legging', 'Climate Adapt Jacket',
                'Pro Studio Tank', 'Future Denim Jean', 'Velocity Running Short', 'Hybrid Merino Hoodie',
                'Precision Tailored Pant', 'Lite Trek Shell', 'Contour Fit Dress', 'Elite Court Polo',
                'Thermo Regulate Base', 'Metro Sling Bag', 'CloudStride Sneaker Liner', 'Studio Wrap Top',
                'Summit Softshell', 'Renew Knit Sweater', 'Active Recovery Jogger', 'Sleek Satin Midi',
                'Pro Flex Suit Jacket', 'Ventilated Golf Polo', 'Urban Explorer Vest', 'Second Skin Bodysuit',
                'Edge Puffer Coat', 'Motion Mesh Short', 'Refined Wool Trouser', 'Day to Night Shirt Dress',
                'Peak Performance Hoodie', 'Featherweight Packable Coat', 'Studio Sculpt Bra', 'Commuter Tech Pant',
                'Luxe Lounge Hoodie', 'Precision Fit Chino',
            ],
            default => [],
        };

        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $base = $styles[$i % count($styles)];
            $color = ['Black', 'Navy', 'Stone', 'Ivory', 'Olive', 'Burgundy'][($i + $year) % 6];
            $out[] = "{$year} {$base} — {$color}";
        }

        return $out;
    }

    /**
     * @param  list<Product>  $products
     * @param  \Illuminate\Support\Collection<int, User>  $admins
     * @param  \Illuminate\Support\Collection<int, User>  $customers
     */
    private function seedOrders(array $products, $admins, $customers): void
    {
        $productPool = collect($products);
        $posSeq = 1;
        $webSeq = 1;

        foreach (self::YEARS as $year) {
            $yearProducts = $productPool->filter(fn (Product $p) => str_contains($p->sku, "-{$year}-"))->values();
            if ($yearProducts->isEmpty()) {
                continue;
            }

            for ($month = 1; $month <= 12; $month++) {
                $daysInMonth = Carbon::create($year, $month, 1)->daysInMonth;
                $posCount = mt_rand(6, 14);
                $webCount = mt_rand(10, 22);

                for ($i = 0; $i < $posCount; $i++) {
                    $day = mt_rand(1, $daysInMonth);
                    $hour = mt_rand(9, 20);
                    $minute = mt_rand(0, 59);
                    $soldAt = Carbon::create($year, $month, $day, $hour, $minute, 0);
                    $this->createPosSale($yearProducts, $admins, $soldAt, $posSeq++);
                }

                for ($i = 0; $i < $webCount; $i++) {
                    $day = mt_rand(1, $daysInMonth);
                    $hour = mt_rand(8, 22);
                    $minute = mt_rand(0, 59);
                    $soldAt = Carbon::create($year, $month, $day, $hour, $minute, 0);
                    $this->createOnlineOrder($yearProducts, $customers, $soldAt, $webSeq++);
                }
            }
        }
    }

    /** @param  \Illuminate\Support\Collection<int, Product>  $yearProducts */
    private function createPosSale($yearProducts, $admins, Carbon $soldAt, int $seq): void
    {
        $seller = $admins->random();
        $lines = $this->buildLines($yearProducts, mt_rand(1, 4));
        $subtotal = round($lines->sum('line_total'), 2);

        $order = Order::create([
            'user_id' => $seller->id,
            'order_number' => sprintf('DEMO-POS-%s-%05d', $soldAt->format('Ym'), $seq),
            'status' => 'completed',
            'payment_status' => 'paid',
            'payment_method' => self::POS_METHODS[array_rand(self::POS_METHODS)],
            'subtotal' => $subtotal,
            'shipping' => 0,
            'discount' => 0,
            'total' => $subtotal,
            'shipping_address' => null,
            'billing_address' => null,
            'sale_channel' => 'pos',
            'pos_meta' => [
                'receipt_no' => 'RCP-'.$soldAt->format('Ymd').'-'.$seq,
                'demo' => true,
            ],
            'created_at' => $soldAt,
            'updated_at' => $soldAt,
        ]);

        foreach ($lines as $line) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $line['product']->id,
                'name' => $line['product']->name,
                'sku' => $line['product']->sku,
                'price' => $line['price'],
                'qty' => $line['qty'],
                'line_total' => $line['line_total'],
                'created_at' => $soldAt,
                'updated_at' => $soldAt,
            ]);
        }
    }

    /** @param  \Illuminate\Support\Collection<int, Product>  $yearProducts */
    private function createOnlineOrder($yearProducts, $customers, Carbon $soldAt, int $seq): void
    {
        $customer = $customers->random();
        $lines = $this->buildLines($yearProducts, mt_rand(1, 5));
        $subtotal = round($lines->sum('line_total'), 2);
        $shipping = mt_rand(0, 1) ? round(mt_rand(499, 1299) / 100, 2) : 0;
        $discount = mt_rand(0, 4) === 0 ? round($subtotal * 0.1, 2) : 0;
        $total = round($subtotal + $shipping - $discount, 2);
        $address = $this->randomAddress();

        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => sprintf('DEMO-WEB-%s-%05d', $soldAt->format('Ym'), $seq),
            'status' => 'completed',
            'payment_status' => 'paid',
            'payment_method' => self::ONLINE_METHODS[array_rand(self::ONLINE_METHODS)],
            'subtotal' => $subtotal,
            'shipping' => $shipping,
            'discount' => $discount,
            'total' => $total,
            'shipping_address' => $address,
            'billing_address' => $address,
            'sale_channel' => 'storefront',
            'created_at' => $soldAt,
            'updated_at' => $soldAt,
        ]);

        foreach ($lines as $line) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $line['product']->id,
                'name' => $line['product']->name,
                'sku' => $line['product']->sku,
                'price' => $line['price'],
                'qty' => $line['qty'],
                'line_total' => $line['line_total'],
                'created_at' => $soldAt,
                'updated_at' => $soldAt,
            ]);
        }
    }

    /** @param  \Illuminate\Support\Collection<int, Product>  $pool */
    private function buildLines($pool, int $lineCount)
    {
        $picked = $pool->random(min($lineCount, $pool->count()));

        return collect($picked)->map(function (Product $product) {
            $qty = mt_rand(1, 3);
            $price = (float) $product->price;

            return [
                'product' => $product,
                'price' => $price,
                'qty' => $qty,
                'line_total' => round($price * $qty, 2),
            ];
        });
    }

    private function randomAddress(): array
    {
        $country = self::COUNTRIES[array_rand(self::COUNTRIES)];
        $city = $country['cities'][array_rand($country['cities'])];
        $first = ['Sophea', 'John', 'Emily', 'Dara', 'Kim', 'Sarah', 'Alex', 'Nary'][array_rand(['Sophea', 'John', 'Emily', 'Dara', 'Kim', 'Sarah', 'Alex', 'Nary'])];
        $last = ['Chan', 'Smith', 'Lee', 'Heng', 'Brown', 'Patel', 'Wilson', 'Ros'][array_rand(['Chan', 'Smith', 'Lee', 'Heng', 'Brown', 'Patel', 'Wilson', 'Ros'])];

        return [
            'name' => "{$first} {$last}",
            'phone' => '+855'.mt_rand(10000000, 99999999),
            'street' => mt_rand(1, 199).' '.['Street', 'Avenue', 'Boulevard'][array_rand(['Street', 'Avenue', 'Boulevard'])],
            'city' => $city,
            'state' => $city,
            'zip' => (string) mt_rand(10000, 99999),
            'country' => $country['name'],
        ];
    }
}
