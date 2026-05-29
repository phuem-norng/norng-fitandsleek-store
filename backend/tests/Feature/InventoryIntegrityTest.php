<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Services\InventoryIntegrityService;
use App\Services\PaidOrderInventory;
use App\Services\StockReceiveService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InventoryIntegrityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->createMinimalTables();
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('categories');
        parent::tearDown();
    }

    private function createMinimalTables(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('type')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('manage_stock')->default(false);
            $table->unsignedInteger('stock')->nullable();
            $table->unsignedInteger('stock_received')->nullable();
            $table->unsignedInteger('min_stock')->nullable();
            $table->date('date_in')->nullable();
            $table->timestamps();
        });
    }

    public function test_total_received_unchanged_after_sale_on_hand_decreases(): void
    {
        $master = Category::create([
            'name' => 'Test Label',
            'slug' => 'TEST-LABEL',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'manage_stock' => true,
            'stock_received' => 100,
            'stock' => 100,
        ]);

        $stockReceive = app(StockReceiveService::class);
        $this->assertSame(100, $stockReceive->totalReceivedQuantity($master));

        $master->update(['stock' => 70]);
        $master->refresh();

        $this->assertSame(100, $stockReceive->totalReceivedQuantity($master));

        $audit = app(InventoryIntegrityService::class)->auditMaster($master);
        $this->assertSame(100, $audit['total_received']);
        $this->assertSame(70, $audit['on_hand']);
        $this->assertSame(30, $audit['implied_sold_or_issued']);
    }

    public function test_audit_infers_total_from_on_hand_when_receive_log_missing(): void
    {
        $master = Category::create([
            'name' => 'Legacy Label',
            'slug' => 'LEGACY-LABEL',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'manage_stock' => true,
            'stock_received' => null,
            'stock' => 996,
        ]);

        $stockReceive = app(StockReceiveService::class);
        $this->assertSame(0, $stockReceive->totalReceivedQuantity($master));

        $audit = app(InventoryIntegrityService::class)->auditMaster($master);
        $this->assertSame(996, $audit['total_received']);
        $this->assertSame(996, $audit['on_hand']);
        $this->assertSame(0, $audit['implied_sold_or_issued']);
        $this->assertSame('warning', $audit['status']);
    }

    public function test_audit_ok_when_stock_received_minus_on_hand_equals_sold(): void
    {
        $master = Category::create([
            'name' => 'Men Clothes',
            'slug' => '0T9SJCU39S5Q',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'manage_stock' => true,
            'stock_received' => 1000,
            'stock' => 997,
        ]);

        $audit = app(InventoryIntegrityService::class)->auditMaster($master);
        $this->assertSame('ok', $audit['status']);
        $this->assertSame(1000, $audit['total_received']);
        $this->assertSame(997, $audit['on_hand']);
        $this->assertSame(3, $audit['implied_sold_or_issued']);
    }

    public function test_repair_backfills_missing_stock_received_log(): void
    {
        $master = Category::create([
            'name' => 'Timberland',
            'slug' => 'KG8CALWWELNJ',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'manage_stock' => true,
            'stock_received' => null,
            'stock' => 100,
        ]);

        $service = app(InventoryIntegrityService::class);
        $service->repair($master->id);
        $master->refresh();

        $audit = $service->auditMaster($master);
        $this->assertSame('ok', $audit['status']);
        $this->assertSame(100, (int) $master->stock_received);
        $this->assertSame(100, (int) $master->stock);
    }

    public function test_audit_keeps_stock_received_total_when_on_hand_is_inflated(): void
    {
        $master = Category::create([
            'name' => 'Nike Hats',
            'slug' => 'ZFTO7KFWXJR4',
            'type' => PaidOrderInventory::BARCODE_CATEGORY_TYPE,
            'manage_stock' => true,
            'stock_received' => 1000,
            'stock' => 10000,
        ]);

        $audit = app(InventoryIntegrityService::class)->auditMaster($master);
        $this->assertSame(1000, $audit['total_received']);
        $this->assertSame(10000, $audit['on_hand']);
        $this->assertSame(1000, $audit['corrected_on_hand']);
        $this->assertSame('error', $audit['status']);
    }
}
