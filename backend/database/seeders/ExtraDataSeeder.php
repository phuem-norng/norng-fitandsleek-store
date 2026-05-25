<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * ExtraDataSeeder
 *
 * - Creates 5 additional named users (1 superadmin, 2 admins, 2 customers)
 *   on top of whatever SuperAdmin/Admin/Customer seeders already inserted.
 * - Fills the remaining empty tables (brands, addresses, wishlists,
 *   wishlist_items, carts, cart_items, contacts, notifications, messages,
 *   payments, shipments, shipment_tracking_events, product_images,
 *   replacement_cases) with realistic demo data.
 *
 * Safe to run multiple times - all writes are idempotent (updateOrCreate
 * or guarded by "table is empty" checks).
 */
class ExtraDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedFiveUsers();
        $this->seedBrands();
        $this->seedAddresses();
        $this->seedWishlists();
        $this->seedCarts();
        $this->seedContacts();
        $this->seedNotifications();
        $this->seedMessages();
        $this->seedPayments();
        $this->seedShipments();
        $this->seedProductImages();
        $this->seedReplacementCases();

        $this->command?->info('ExtraDataSeeder: finished populating extra demo data.');
    }

    /* ------------------------------------------------------------------ */
    /*  5 named users (the request: superadmin / admin / customer)         */
    /* ------------------------------------------------------------------ */
    private function seedFiveUsers(): void
    {
        $users = [
            [
                'name'  => 'Sopheak Chan',
                'email' => 'superadmin2@fitandsleek.com',
                'phone' => '+855 12 100 001',
                'role'  => 'superadmin',
                'password' => 'SuperAdmin@123',
            ],
            [
                'name'  => 'Dara Kim',
                'email' => 'admin.dara@fitandsleek.com',
                'phone' => '+855 12 200 001',
                'role'  => 'admin',
                'password' => 'Admin@123',
            ],
            [
                'name'  => 'Linda Sok',
                'email' => 'admin.linda@fitandsleek.com',
                'phone' => '+855 12 200 002',
                'role'  => 'admin',
                'password' => 'Admin@123',
            ],
            [
                'name'  => 'Vannak Mao',
                'email' => 'customer.vannak@fitandsleek.com',
                'phone' => '+855 12 300 001',
                'role'  => 'customer',
                'password' => 'Customer@123',
            ],
            [
                'name'  => 'Srey Pich',
                'email' => 'customer.pich@fitandsleek.com',
                'phone' => '+855 12 300 002',
                'role'  => 'customer',
                'password' => 'Customer@123',
            ],
        ];

        foreach ($users as $u) {
            User::updateOrCreate(
                ['email' => $u['email']],
                [
                    'name'     => $u['name'],
                    'phone'    => $u['phone'],
                    'role'     => $u['role'],
                    'status'   => 'active',
                    'password' => Hash::make($u['password']),
                    'email_verified_at' => now(),
                ]
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Brands                                                             */
    /* ------------------------------------------------------------------ */
    private function seedBrands(): void
    {
        $brands = [
            ['name' => 'Nike',         'sort_order' => 1],
            ['name' => 'Adidas',       'sort_order' => 2],
            ['name' => 'Puma',         'sort_order' => 3],
            ['name' => 'Uniqlo',       'sort_order' => 4],
            ['name' => 'Zara',         'sort_order' => 5],
            ['name' => 'H&M',          'sort_order' => 6],
            ['name' => 'Champion',     'sort_order' => 7],
            ['name' => 'Under Armour', 'sort_order' => 8],
            ['name' => 'Lacoste',      'sort_order' => 9],
            ['name' => 'Converse',     'sort_order' => 10],
            ['name' => 'New Balance',  'sort_order' => 11],
            ['name' => 'Levi\'s',      'sort_order' => 12],
        ];

        foreach ($brands as $b) {
            Brand::updateOrCreate(
                ['slug' => Str::slug($b['name'])],
                [
                    'name'       => $b['name'],
                    'sort_order' => $b['sort_order'],
                    'is_active'  => true,
                ]
            );
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Addresses                                                          */
    /* ------------------------------------------------------------------ */
    private function seedAddresses(): void
    {
        if (DB::table('addresses')->count() > 0) {
            return;
        }

        $customers = User::where('role', 'customer')->take(8)->get();
        if ($customers->isEmpty()) {
            return;
        }

        $samples = [
            ['Phnom Penh', 'Chamkar Mon',   'Tonle Bassac',  'Home',   '+855 99 100 001'],
            ['Phnom Penh', 'Daun Penh',     'Phsar Thmei 1', 'Office', '+855 99 100 002'],
            ['Phnom Penh', 'Toul Kork',     'Boeng Kak 1',   'Home',   '+855 99 100 003'],
            ['Siem Reap',  'Siem Reap',     'Svay Dangkum',  'Home',   '+855 99 100 004'],
            ['Battambang', 'Battambang',    'Svay Por',      'Office', '+855 99 100 005'],
            ['Phnom Penh', 'Sen Sok',       'Phnom Penh Thmey', 'Home', '+855 99 100 006'],
            ['Kandal',     'Ta Khmau',      'Ta Khmau',      'Home',   '+855 99 100 007'],
            ['Sihanoukville', 'Mittakpheap','Buon',          'Office', '+855 99 100 008'],
        ];

        foreach ($customers as $i => $cust) {
            $sample = $samples[$i % count($samples)];
            DB::table('addresses')->insert([
                'user_id'        => $cust->id,
                'label'          => $sample[3],
                'receiver_name'  => $cust->name,
                'receiver_phone' => $sample[4],
                'house_no'       => (string)(100 + $i),
                'street_no'      => (string)((($i + 1) * 7) % 600 + 100),
                'sangkat'        => $sample[2],
                'khan'           => $sample[1],
                'province'       => $sample[0],
                'landmark'       => 'Near central market',
                'street'         => 'Street ' . ((($i + 1) * 7) % 600 + 100),
                'city'           => $sample[0],
                'state'          => $sample[1],
                'zip'            => '12000',
                'country'        => 'Cambodia',
                'latitude'       => 11.5564 + ($i * 0.01),
                'longitude'      => 104.9282 + ($i * 0.01),
                'is_default'     => true,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Wishlists + items                                                  */
    /* ------------------------------------------------------------------ */
    private function seedWishlists(): void
    {
        if (DB::table('wishlists')->count() > 0) {
            return;
        }

        $customers = User::where('role', 'customer')->take(6)->get();
        $products  = Product::inRandomOrder()->take(20)->get();
        if ($customers->isEmpty() || $products->isEmpty()) {
            return;
        }

        foreach ($customers as $cust) {
            $wishlistId = DB::table('wishlists')->insertGetId([
                'user_id'    => $cust->id,
                'name'       => 'My Favorites',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($products->random(min(4, $products->count())) as $p) {
                DB::table('wishlist_items')->insertOrIgnore([
                    'wishlist_id' => $wishlistId,
                    'product_id'  => $p->id,
                    'created_at'  => now(),
                ]);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Active carts + items                                               */
    /* ------------------------------------------------------------------ */
    private function seedCarts(): void
    {
        if (DB::table('carts')->count() > 0) {
            return;
        }

        $customers = User::where('role', 'customer')->take(4)->get();
        $products  = Product::inRandomOrder()->take(15)->get();
        if ($customers->isEmpty() || $products->isEmpty()) {
            return;
        }

        foreach ($customers as $cust) {
            $cartId = DB::table('carts')->insertGetId([
                'user_id'    => $cust->id,
                'status'     => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($products->random(min(3, $products->count())) as $p) {
                DB::table('cart_items')->insertOrIgnore([
                    'cart_id'    => $cartId,
                    'product_id' => $p->id,
                    'quantity'   => rand(1, 3),
                    'unit_price' => $p->price,
                    'size'       => ['S','M','L','XL'][array_rand(['S','M','L','XL'])],
                    'color'      => ['Black','White','Navy','Grey'][array_rand(['Black','White','Navy','Grey'])],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Contacts (contact-us form)                                         */
    /* ------------------------------------------------------------------ */
    private function seedContacts(): void
    {
        if (DB::table('contacts')->count() > 0) {
            return;
        }

        $contacts = [
            ['Alice Tan',   'alice.tan@example.com',   '+855 12 555 001', 'Order question',         'Hello, can I change the shipping address of my order?', 'new'],
            ['Bob Heng',    'bob.heng@example.com',    '+855 12 555 002', 'Wrong size delivered',   'I received a size M but ordered size L. Please advise.', 'in_progress'],
            ['Cathy Ouk',   'cathy.ouk@example.com',   '+855 12 555 003', 'Discount code',          'Is there a first-time-buyer discount code available?', 'closed'],
            ['Daniel Sam',  'daniel.sam@example.com',  '+855 12 555 004', 'Product availability',   'When will Nike Air Max in size 42 be back in stock?', 'new'],
            ['Eva Pen',     'eva.pen@example.com',     '+855 12 555 005', 'Return request',        'I would like to return order ORD-12345, the item is too small.', 'in_progress'],
            ['Frank Long',  'frank.long@example.com',  '+855 12 555 006', 'Bulk order inquiry',    'Do you offer bulk pricing for 50+ T-shirts for our company?', 'new'],
            ['Grace Sok',   'grace.sok@example.com',   '+855 12 555 007', 'Payment failed',        'My ABA payment did not go through but money was deducted.', 'in_progress'],
            ['Henry Vong',  'henry.vong@example.com',  '+855 12 555 008', 'Loyalty programme',     'Do you have a loyalty programme or membership?', 'closed'],
        ];

        foreach ($contacts as $c) {
            DB::table('contacts')->insert([
                'name'       => $c[0],
                'email'      => $c[1],
                'phone'      => $c[2],
                'subject'    => $c[3],
                'message'    => $c[4],
                'status'     => $c[5],
                'admin_note' => $c[5] === 'closed' ? 'Resolved by support.' : null,
                'created_at' => now()->subDays(rand(1, 30)),
                'updated_at' => now(),
            ]);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Notifications                                                      */
    /* ------------------------------------------------------------------ */
    private function seedNotifications(): void
    {
        if (DB::table('notifications')->count() > 0) {
            return;
        }

        $users = User::take(15)->get();
        if ($users->isEmpty()) {
            return;
        }

        $templates = [
            ['order',     'Order shipped',          'Your order has been shipped and is on its way!'],
            ['order',     'Order delivered',        'Your order was delivered. Enjoy your purchase!'],
            ['promotion', 'Flash sale - 30% off',   'Today only: 30% off all sneakers. Shop now!'],
            ['promotion', 'New collection live',    'Our Summer 2026 collection just dropped. Check it out!'],
            ['system',    'Welcome to Fitandsleek', 'Thanks for joining. Here is a 10% off welcome code: WELCOME10.'],
            ['account',   'Password changed',       'Your account password was changed successfully.'],
        ];

        foreach ($users as $u) {
            foreach (array_rand($templates, 3) as $idx) {
                $t = $templates[$idx];
                DB::table('notifications')->insert([
                    'user_id'    => $u->id,
                    'type'       => $t[0],
                    'title'      => $t[1],
                    'message'    => $t[2],
                    'data'       => json_encode(['source' => 'seeder']),
                    'is_read'    => (bool)rand(0, 1),
                    'created_at' => now()->subDays(rand(1, 20)),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Messages (admin announcements)                                     */
    /* ------------------------------------------------------------------ */
    private function seedMessages(): void
    {
        if (DB::table('messages')->count() > 0) {
            return;
        }

        $admin = User::whereIn('role', ['admin', 'superadmin'])->first();
        if (!$admin) {
            return;
        }

        $messages = [
            ['Welcome promo',     'Welcome to Fitandsleek! Enjoy 10% off your first order with code WELCOME10.', 'all',       'en'],
            ['សួស្តីពីយើង',       'សូមស្វាគមន៍មកកាន់ Fitandsleek! រីករាយជាមួយការបញ្ចុះតម្លៃ 10% នៅការបញ្ជាទិញដំបូង។', 'all',       'km'],
            ['Free shipping',     'Free shipping on all orders over $50 this week only.',                       'customers', 'en'],
            ['Sale weekend',      'This weekend only: up to 50% off selected items. Don\'t miss out!',          'all',       'en'],
            ['Guest signup',      'Create an account to track your orders and earn rewards.',                   'guests',    'en'],
        ];

        foreach ($messages as $m) {
            DB::table('messages')->insert([
                'title'           => $m[0],
                'content'         => $m[1],
                'language'        => $m[3],
                'target_audience' => $m[2],
                'is_active'       => true,
                'created_by'      => $admin->id,
                'scheduled_at'    => now()->subDays(rand(1, 10)),
                'expires_at'      => now()->addDays(30),
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Payments (one per existing order)                                  */
    /* ------------------------------------------------------------------ */
    private function seedPayments(): void
    {
        if (DB::table('payments')->count() > 0) {
            return;
        }

        $orders = Order::all();
        if ($orders->isEmpty()) {
            return;
        }

        $admin = User::whereIn('role', ['admin', 'superadmin'])->first();
        $methods = ['khqr', 'aba_payway', 'cod', 'card'];

        foreach ($orders as $i => $order) {
            $isPaid = $order->payment_status === 'paid';
            $method = $methods[$i % count($methods)];

            DB::table('payments')->insert([
                'order_id'       => $order->id,
                'verified_by'    => $isPaid && $admin ? $admin->id : null,
                'method'         => $method,
                'provider'       => $method === 'khqr' ? 'bakong' : ($method === 'aba_payway' ? 'aba' : null),
                'status'         => $isPaid ? 'paid' : ($order->status === 'pending' ? 'pending' : 'paid'),
                'reference_code' => strtoupper(Str::random(10)),
                'amount'         => $order->total,
                'currency'       => 'USD',
                'bill_number'    => 'BILL-' . strtoupper(Str::random(8)) . '-' . $order->id,
                'paid_at'        => $isPaid ? $order->created_at : null,
                'verified_at'    => $isPaid ? $order->created_at : null,
                'created_at'     => $order->created_at,
                'updated_at'     => now(),
            ]);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Shipments + tracking events                                        */
    /* ------------------------------------------------------------------ */
    private function seedShipments(): void
    {
        if (DB::table('shipments')->count() > 0) {
            return;
        }

        $orders = Order::whereIn('status', ['completed', 'processing'])->get();
        if ($orders->isEmpty()) {
            return;
        }

        $admin     = User::whereIn('role', ['admin', 'superadmin'])->first();
        $providers = ['JNE', 'J&T Express', 'DHL', 'Cambodia Post', 'Vireak Buntham'];

        foreach ($orders as $i => $order) {
            $isDelivered  = $order->status === 'completed';
            $shippedAt    = Carbon::parse($order->created_at)->addHours(6);
            $deliveredAt  = $isDelivered ? Carbon::parse($order->created_at)->addDays(3) : null;
            $provider     = $providers[$i % count($providers)];

            $shipmentId = DB::table('shipments')->insertGetId([
                'order_id'      => $order->id,
                'provider'      => $provider,
                'tracking_code' => strtoupper($provider[0]) . 'F' . strtoupper(Str::random(10)),
                'status'        => $isDelivered ? 'delivered' : 'in_transit',
                'shipped_at'    => $shippedAt,
                'delivered_at'  => $deliveredAt,
                'created_at'    => $order->created_at,
                'updated_at'    => now(),
            ]);

            // tracking events timeline
            $events = [
                ['received',   'Warehouse',  'Package received at warehouse',          $order->created_at],
                ['shipped',    $provider . ' Sorting Hub', 'Package picked up by courier',  $shippedAt],
                ['in_transit', 'Phnom Penh', 'Package in transit',                     $shippedAt->copy()->addHours(12)],
            ];
            if ($isDelivered) {
                $events[] = ['out_for_delivery', 'Local Hub', 'Out for delivery', $deliveredAt->copy()->subHours(4)];
                $events[] = ['delivered',        'Recipient', 'Delivered to recipient', $deliveredAt];
            }

            foreach ($events as $ev) {
                DB::table('shipment_tracking_events')->insert([
                    'shipment_id' => $shipmentId,
                    'updated_by'  => $admin?->id,
                    'status'      => $ev[0],
                    'location'    => $ev[1],
                    'note'        => $ev[2],
                    'event_time'  => $ev[3],
                    'created_at'  => $ev[3],
                ]);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Extra gallery rows for product_images                              */
    /* ------------------------------------------------------------------ */
    private function seedProductImages(): void
    {
        if (DB::table('product_images')->count() > 0) {
            return;
        }

        $products = Product::take(40)->get();
        foreach ($products as $p) {
            $base = 'https://picsum.photos/seed/' . $p->id . '-';
            for ($i = 1; $i <= 3; $i++) {
                DB::table('product_images')->insert([
                    'product_id' => $p->id,
                    'path'       => $base . $i . '/800/800',
                    'is_primary' => $i === 1,
                    'sort_order' => $i,
                    'created_at' => now(),
                ]);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Replacement cases (returns/exchanges)                              */
    /* ------------------------------------------------------------------ */
    private function seedReplacementCases(): void
    {
        if (DB::table('replacement_cases')->count() > 0) {
            return;
        }

        $orders = Order::where('status', 'completed')->take(4)->get();
        if ($orders->isEmpty()) {
            return;
        }

        $admin  = User::whereIn('role', ['admin', 'superadmin'])->first();
        $cases  = [
            ['Wrong size delivered',    'pending',     'Customer requested size up.'],
            ['Defective product',       'in_progress', 'Investigation ongoing with warehouse.'],
            ['Wrong colour delivered',  'resolved',    'Replacement shipped with tracking code provided.'],
            ['Changed mind',            'rejected',    'Outside 7-day return window.'],
        ];

        foreach ($orders as $i => $order) {
            $c = $cases[$i % count($cases)];
            DB::table('replacement_cases')->insert([
                'order_id'   => $order->id,
                'handled_by' => $admin?->id,
                'reason'     => $c[0],
                'status'     => $c[1],
                'notes'      => $c[2],
                'created_at' => Carbon::parse($order->created_at)->addDays(2),
                'updated_at' => now(),
            ]);
        }
    }
}
