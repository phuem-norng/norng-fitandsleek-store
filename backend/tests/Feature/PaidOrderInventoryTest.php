<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\BarcodeScanStockService;
use App\Services\PaidOrderInventory;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Verifies storefront paid-order behaviour: numeric product.stock and linked
 * barcode_qr category stock both decrement (see PaidOrderInventory).
 *
 * Uses minimal SQLite tables instead of RefreshDatabase because some migrations
 * fail on SQLite (:memory:) (e.g. carts session_id drop).
 */
class PaidOrderInventoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->createMinimalTables();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    private function createMinimalTables(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('sku', 100)->nullable();
            $table->string('type')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('manage_stock')->default(false);
            $table->unsignedInteger('stock')->nullable();
            $table->unsignedInteger('stock_received')->nullable();
            $table->string('product_condition', 30)->nullable();
            $table->string('second_hand_sale_type', 30)->nullable();
            $table->decimal('price', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->unsignedBigInteger('stock_label_id')->nullable();
            $table->string('name', 180);
            $table->string('slug', 200)->unique();
            $table->string('sku', 60)->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->integer('stock')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('barcode_code', 120)->nullable();
            $table->string('audience', 20)->default('unisex');
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('sale_channel', 24)->default('storefront');
            $table->string('order_number', 40)->unique();
            $table->string('status', 30)->default('pending');
            $table->string('payment_status', 30)->default('unpaid');
            $table->string('payment_method', 64)->nullable();
            $table->decimal('subtotal', 12, 2);
            $table->decimal('shipping', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('name', 180);
            $table->string('sku', 60);
            $table->decimal('price', 12, 2);
            $table->unsignedInteger('qty');
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });
    }

    public function test_apply_for_order_reduces_product_stock_and_linked_barcode_qr_stock(): void
    {
        $user = User::create([
            'name' => 'Buyer',
            'email' => 'buyer-'.uniqid().'@example.test',
            'password' => Hash::make('secret'),
        ]);

        $productCategory = Category::create([
            'name' => 'Test category',
            'slug' => 'test-cat-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $labelSlug = 'test-label-'.uniqid();
        $barcodeBundle = Category::create([
            'name' => 'QR label',
            'slug' => $labelSlug,
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock' => 50,
        ]);

        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Test product',
            'slug' => 'test-prod-'.uniqid(),
            'sku' => 'SKU-'.uniqid(),
            'description' => null,
            'price' => 20,
            'stock' => 100,
            'is_active' => true,
            'barcode_code' => $labelSlug,
            'audience' => 'men',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD-'.uniqid(),
            'status' => 'processing',
            'payment_status' => 'paid',
            'payment_method' => 'bakong_khqr',
            'subtotal' => 60,
            'total' => 60,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku,
            'price' => 20,
            'qty' => 3,
            'line_total' => 60,
        ]);

        $order->load('items.product');
        PaidOrderInventory::applyForOrder($order);

        $product->refresh();
        $barcodeBundle->refresh();

        $this->assertSame(97, (int) $product->stock);
        $this->assertSame(47, (int) $barcodeBundle->stock);
    }

    public function test_linked_barcode_bundle_unchanged_when_manage_stock_disabled(): void
    {
        $user = User::create([
            'name' => 'Buyer 2',
            'email' => 'buyer2-'.uniqid().'@example.test',
            'password' => Hash::make('secret'),
        ]);

        $productCategory = Category::create([
            'name' => 'Test category 2',
            'slug' => 'test-cat2-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $labelSlug = 'test-label2-'.uniqid();
        $barcodeBundle = Category::create([
            'name' => 'QR label 2',
            'slug' => $labelSlug,
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => false,
            'stock' => 50,
        ]);

        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Test product 2',
            'slug' => 'test-prod2-'.uniqid(),
            'sku' => 'SKU2-'.uniqid(),
            'description' => null,
            'price' => 10,
            'stock' => 20,
            'is_active' => true,
            'barcode_code' => $labelSlug,
            'audience' => 'men',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD2-'.uniqid(),
            'status' => 'processing',
            'payment_status' => 'paid',
            'payment_method' => 'card_visa',
            'subtotal' => 10,
            'total' => 10,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku,
            'price' => 10,
            'qty' => 1,
            'line_total' => 10,
        ]);

        $order->load('items.product');
        PaidOrderInventory::applyForOrder($order);

        $product->refresh();
        $barcodeBundle->refresh();

        $this->assertSame(19, (int) $product->stock);
        $this->assertSame(50, (int) $barcodeBundle->stock);
    }

    public function test_barcode_bundle_resolves_case_insensitive_slug_match(): void
    {
        $user = User::create([
            'name' => 'Buyer 3',
            'email' => 'buyer3-'.uniqid().'@example.test',
            'password' => Hash::make('secret'),
        ]);

        $productCategory = Category::create([
            'name' => 'Cat',
            'slug' => 'cat-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $barcodeBundle = Category::create([
            'name' => 'Label',
            'slug' => 'my-label-code',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock' => 10,
        ]);

        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Prod',
            'slug' => 'prod-'.uniqid(),
            'sku' => 'SKU-'.uniqid(),
            'description' => null,
            'price' => 5,
            'stock' => 10,
            'is_active' => true,
            'barcode_code' => 'MY-LABEL-CODE',
            'audience' => 'men',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD3-'.uniqid(),
            'status' => 'processing',
            'payment_status' => 'paid',
            'payment_method' => 'bakong_khqr',
            'subtotal' => 5,
            'total' => 5,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku,
            'price' => 5,
            'qty' => 2,
            'line_total' => 10,
        ]);

        $order->load('items.product');
        PaidOrderInventory::applyForOrder($order);

        $product->refresh();
        $barcodeBundle->refresh();

        $this->assertSame(8, (int) $product->stock);
        $this->assertSame(8, (int) $barcodeBundle->stock);
    }

    public function test_pos_scan_by_product_sku_reduces_product_stock_and_linked_barcode_qr_stock(): void
    {
        $productCategory = Category::create([
            'name' => 'POS category',
            'slug' => 'pos-cat-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $labelSlug = 'pos-label-'.uniqid();
        $barcodeBundle = Category::create([
            'name' => 'POS QR label',
            'slug' => $labelSlug,
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock' => 7,
        ]);

        $sku = 'POS-SKU-'.uniqid();
        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'POS product',
            'slug' => 'pos-prod-'.uniqid(),
            'sku' => $sku,
            'description' => null,
            'price' => 12,
            'stock' => 9,
            'is_active' => true,
            'barcode_code' => $labelSlug,
            'audience' => 'men',
        ]);

        $this->assertSame(7, BarcodeScanStockService::maxSellableQty(null, collect([$product])));

        BarcodeScanStockService::applyScanDeduction($sku, 3);

        $product->refresh();
        $barcodeBundle->refresh();

        $this->assertSame(6, (int) $product->stock);
        $this->assertSame(4, (int) $barcodeBundle->stock);
    }

    public function test_paid_order_keeps_stock_received_and_receive_batch_stock_unchanged(): void
    {
        $user = User::create([
            'name' => 'Buyer 4',
            'email' => 'buyer4-'.uniqid().'@example.test',
            'password' => Hash::make('secret'),
        ]);

        $productCategory = Category::create([
            'name' => 'Men Clothes',
            'slug' => 'men-clothes-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $master = Category::create([
            'name' => 'MEN CLOTHES SECOND HAND AVERAGE',
            'slug' => '8VWI26G4O2IX-'.uniqid(),
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock' => 80,
            'product_condition' => 'second_hand',
            'second_hand_sale_type' => 'average_bundle',
        ]);

        $receiveBatch = Category::create([
            'parent_id' => $master->id,
            'name' => $master->name,
            'slug' => $master->slug.'-R'.uniqid(),
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock_received' => 100,
            'stock' => 100,
            'product_condition' => 'second_hand',
            'second_hand_sale_type' => 'average_bundle',
        ]);

        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Jacket',
            'slug' => 'jacket-'.uniqid(),
            'sku' => 'SKU-J-'.uniqid(),
            'description' => null,
            'price' => 20,
            'stock' => 10,
            'is_active' => true,
            'barcode_code' => 'product-only-barcode',
            'stock_label_id' => $master->id,
            'audience' => 'men',
        ]);

        $order = Order::create([
            'user_id' => $user->id,
            'order_number' => 'ORD4-'.uniqid(),
            'status' => 'processing',
            'payment_status' => 'paid',
            'payment_method' => 'bakong_khqr',
            'subtotal' => 20,
            'total' => 20,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'name' => $product->name,
            'sku' => $product->sku,
            'price' => 20,
            'qty' => 1,
            'line_total' => 20,
        ]);

        $order->load('items.product');
        PaidOrderInventory::applyForOrder($order);

        $product->refresh();
        $master->refresh();
        $receiveBatch->refresh();

        $this->assertSame(9, (int) $product->stock);
        $this->assertSame(79, (int) $master->stock);
        $this->assertSame(100, (int) $receiveBatch->stock_received);
        $this->assertSame(100, (int) $receiveBatch->stock);
    }

    public function test_pos_lookup_and_scan_by_inventory_label_slug_with_stock_label_products(): void
    {
        $productCategory = Category::create([
            'name' => 'Men Clothes',
            'slug' => 'men-clothes-scan-'.uniqid(),
            'type' => 'clothing',
            'is_active' => true,
        ]);

        $labelSlug = '8VWI26G4O2IX';
        $master = Category::create([
            'name' => 'MEN CLOTHES SECOND HAND AVERAGE',
            'slug' => $labelSlug,
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'is_active' => true,
            'manage_stock' => true,
            'stock' => 50,
            'product_condition' => 'second_hand',
            'second_hand_sale_type' => 'average_bundle',
            'price' => 20,
        ]);

        $product = Product::create([
            'category_id' => $productCategory->id,
            'name' => 'Jacket',
            'slug' => 'jacket-scan-'.uniqid(),
            'sku' => 'SKU-SCAN-'.uniqid(),
            'description' => null,
            'price' => 20,
            'stock' => 10,
            'is_active' => true,
            'barcode_code' => 'unique-product-barcode',
            'stock_label_id' => $master->id,
            'audience' => 'men',
        ]);

        $lookup = BarcodeScanStockService::lookupDisplay($labelSlug);
        $this->assertNotNull($lookup);
        $this->assertSame($labelSlug, $lookup['code']);
        $this->assertSame('MEN CLOTHES SECOND HAND AVERAGE', $lookup['name']);
        $this->assertSame(20.0, $lookup['price']);
        $this->assertSame(10, $lookup['max_sellable_qty']);

        BarcodeScanStockService::applyScanDeduction($labelSlug, 2);

        $master->refresh();
        $product->refresh();

        $this->assertSame(48, (int) $master->stock);
        $this->assertSame(8, (int) $product->stock);
    }
}
