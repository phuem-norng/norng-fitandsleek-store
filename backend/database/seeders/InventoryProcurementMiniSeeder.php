<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PaidOrderInventory;
use App\Services\PurchaseOrderReceiveService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InventoryProcurementMiniSeeder extends Seeder
{
    public function run(): void
    {
        $products = Product::query()
            ->where('is_active', true)
            ->inRandomOrder()
            ->limit(24)
            ->get(['id', 'name', 'price', 'cost_price']);

        // Fallback: if active products are too few, use any products to keep admin demo pages populated.
        if ($products->count() < 3) {
            $products = Product::query()
                ->inRandomOrder()
                ->limit(24)
                ->get(['id', 'name', 'price', 'cost_price']);
        }

        if ($products->isEmpty()) {
            $this->command?->warn('InventoryProcurementMiniSeeder skipped: no products found.');
            return;
        }

        $purchaser = User::query()
            ->whereIn('role', ['superadmin', 'admin'])
            ->orderBy('id')
            ->value('name');

        $suppliers = collect([
            [
                'supplier_code' => 'SUP-ANG-001',
                'name' => 'Angkor Apparel Supply',
                'contact_person' => 'Sok Dara',
                'email' => 'procurement@angkor-apparel.test',
                'phone' => '+855-10-110-221',
                'address' => 'Street 271, Khan Chamkar Mon',
                'city' => 'Phnom Penh',
                'country' => 'Cambodia',
                'notes' => 'Fast delivery for apparel and casualwear.',
                'is_active' => true,
            ],
            [
                'supplier_code' => 'SUP-MEK-002',
                'name' => 'Mekong Footwear Trading',
                'contact_person' => 'Vannak Lim',
                'email' => 'sales@mekong-footwear.test',
                'phone' => '+855-12-885-672',
                'address' => 'National Road 6A',
                'city' => 'Phnom Penh',
                'country' => 'Cambodia',
                'notes' => 'Sneakers and sports shoes.',
                'is_active' => true,
            ],
            [
                'supplier_code' => 'SUP-TON-003',
                'name' => 'Tonle Accessories Hub',
                'contact_person' => 'Chantha Rith',
                'email' => 'hello@tonle-accessories.test',
                'phone' => '+855-15-990-884',
                'address' => 'Sisowath Quay',
                'city' => 'Phnom Penh',
                'country' => 'Cambodia',
                'notes' => 'Bags, belts, and fashion accessories.',
                'is_active' => true,
            ],
            [
                'supplier_code' => 'SUP-SIE-004',
                'name' => 'Siem Reap Textile Co.',
                'contact_person' => 'Piseth Oum',
                'email' => 'orders@sr-textile.test',
                'phone' => '+855-17-221-006',
                'address' => 'Airport Road',
                'city' => 'Siem Reap',
                'country' => 'Cambodia',
                'notes' => 'Seasonal textile and woven goods.',
                'is_active' => false,
            ],
        ])->map(function (array $payload) {
            return Supplier::query()->updateOrCreate(
                ['supplier_code' => $payload['supplier_code']],
                $payload
            );
        });

        /** @var PurchaseOrderReceiveService $receiveService */
        $receiveService = app(PurchaseOrderReceiveService::class);

        $poPerSupplier = 2;
        $poSequence = 1;
        foreach ($suppliers as $supplier) {
            for ($i = 0; $i < $poPerSupplier; $i++) {
                $date = now()->subDays(random_int(15, 220));
                $poNumber = sprintf('PO-MINI-%s-%04d', now()->format('Y'), $poSequence++);

                DB::transaction(function () use (
                    $supplier,
                    $products,
                    $date,
                    $poNumber,
                    $purchaser,
                    $receiveService
                ) {
                    $order = PurchaseOrder::query()->create([
                        'supplier_id' => $supplier->id,
                        'po_number' => $poNumber,
                        'status' => PurchaseOrder::STATUS_DRAFT,
                        'order_date' => $date->toDateString(),
                        'expected_delivery' => $date->copy()->addDays(random_int(3, 9))->toDateString(),
                        'notes' => 'Seeded mini procurement batch for inventory testing.',
                        'purchaser' => $purchaser ?: 'System Seeder',
                    ]);

                    $lineCount = min($products->count(), random_int(2, 4));
                    $lineProducts = $products->shuffle()->take(max(1, $lineCount))->values();
                    foreach ($lineProducts as $product) {
                        $qty = random_int(8, 65);
                        $cost = (float) ($product->cost_price ?: max(1, ((float) $product->price) * random_int(45, 70) / 100));
                        $sell = (float) ($product->price ?: ($cost * 1.4));

                        PurchaseOrderItem::query()->create([
                            'purchase_order_id' => $order->id,
                            'product_id' => $product->id,
                            'size' => null,
                            'color' => null,
                            'qty' => $qty,
                            'cost_per_unit' => round($cost, 2),
                            'sell_price' => round($sell, 2),
                            'line_total_cost' => round($cost * $qty, 2),
                            'line_subtotal_sell' => round($sell * $qty, 2),
                        ]);
                    }

                    $fresh = $order->fresh(['supplier', 'items.product']);
                    $receiveService->receiveOrder($fresh);
                    $fresh->update([
                        'status' => PurchaseOrder::STATUS_RECEIVED,
                        'received_at' => now(),
                    ]);
                });
            }
        }

        $this->command?->info('InventoryProcurementMiniSeeder complete: suppliers, POs, stock received seeded.');
    }
}

