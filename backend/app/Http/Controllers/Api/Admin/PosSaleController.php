<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Services\BarcodeScanStockService;
use App\Services\BakongKhqrService;
use App\Services\OrderItemLotAllocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosSaleController extends Controller
{
    public function __construct(
        private readonly BakongKhqrService $bakongKhqr
    ) {
    }

    /** Matches admin POS / Barcode UI method ids */
    private const PAYMENT_METHODS = [
        'cash',
        'khqr',
        'debit',
        'credit',
        'store_credit',
        'payment_link',
        'other',
        'barcode_reduce',
    ];

    /**
     * Deduct stock and create a paid POS order (atomic).
     */
    public function completeSale(Request $request): JsonResponse
    {
        $validated = $this->validateLinesPayload($request, true);
        $this->assertPaymentMethod($validated['payment_method']);

        $adminId = (int) $request->user()->id;

        $payload = DB::transaction(function () use ($validated, $adminId) {
            $snapshot = [];

            foreach ($validated['lines'] as $line) {
                $row = BarcodeScanStockService::lookupDisplay($line['code']);
                if ($row === null) {
                    throw ValidationException::withMessages([
                        'lines' => ['Unknown code: '.$line['code']],
                    ]);
                }
                $qty = (int) $line['qty'];

                $deduction = BarcodeScanStockService::applyScanDeduction($row['code'], $qty);
                $allocations = $deduction['inventory_lot_allocations'] ?? [];

                foreach (OrderItemLotAllocation::expandSnapshotLine($row, $qty, $allocations) as $snap) {
                    $snapshot[] = $snap;
                }
            }

            $subtotal = round(
                array_sum(array_map(fn (array $s) => $s['unit_price'] * $s['qty'], $snapshot)),
                2
            );

            $posMeta = array_filter([
                'receipt_no' => $validated['receipt_no'] ?? null,
                'tender_received_cents' => $validated['tender_received_cents'] ?? null,
            ], fn ($v) => $v !== null && $v !== '');

            $order = Order::create([
                'user_id' => $adminId,
                'order_number' => $this->generatePosOrderNumber(),
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => $validated['payment_method'],
                'subtotal' => $subtotal,
                'shipping' => 0,
                'discount' => 0,
                'total' => $subtotal,
                'shipping_address' => null,
                'billing_address' => null,
                'sale_channel' => 'pos',
                'pos_meta' => $posMeta === [] ? null : $posMeta,
            ]);

            foreach ($snapshot as $s) {
                $this->createOrderItemForLine(
                    $order->id,
                    $s['code'],
                    $s['name'],
                    $s['qty'],
                    $s['unit_price'],
                    $s['inventory_lot_id'] ?? null,
                    $s['unit_cost_at_sale'] ?? null,
                    $s['listing_status_at_sale'] ?? null,
                    $s['lot_tier_at_sale'] ?? null,
                    $s['lot_number_at_sale'] ?? null,
                );
            }

            $khqrOut = null;
            if ($validated['payment_method'] === 'khqr') {
                $currency = strtoupper((string) config('services.bakong.currency', 'KHR'));
                $payment = Payment::create([
                    'order_id' => $order->id,
                    'provider' => 'bakong',
                    'method' => 'bakong_khqr',
                    'status' => 'pending',
                    'amount' => $subtotal,
                    'currency' => $currency,
                ]);
                try {
                    $result = $this->bakongKhqr->generate($order, $payment);
                } catch (\Throwable $e) {
                    report($e);
                    $payment->update(['status' => 'failed']);
                    $detail = config('app.debug') ? $e->getMessage() : 'Configure Bakong receive account and Node KHQR (see server logs).';

                    throw ValidationException::withMessages([
                        'payment_method' => ['Unable to generate KHQR for this receipt. '.$detail],
                    ]);
                }
                $payment->update([
                    'bill_number' => $result['bill_number'],
                    'md5' => $result['md5'],
                    'khqr_payload' => $result['payload'],
                    'qr_string' => $result['qr_string'],
                    'qr_image_base64' => null,
                    'expires_at' => $result['expires_at'],
                ]);
                $khqrOut = [
                    'qr_string' => $result['qr_string'],
                    'expires_at' => $result['expires_at']->toIso8601String(),
                    'amount' => (float) $subtotal,
                    'currency' => $currency,
                ];
            }

            return [$order, $snapshot, $subtotal, $khqrOut];
        });

        [$order, $snapshot, $subtotal, $khqrOut] = $payload;

        $data = [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
            ],
            'subtotal' => $subtotal,
            'lines' => array_map(fn (array $s) => [
                'code' => $s['code'],
                'name' => $s['name'],
                'qty' => $s['qty'],
                'unit_price' => $s['unit_price'],
            ], $snapshot),
        ];
        if ($khqrOut !== null) {
            $data['khqr'] = $khqrOut;
        }

        return response()->json([
            'message' => 'Sale recorded. Stock updated.',
            'data' => $data,
        ]);
    }

    /**
     * Save cart as a pending order (no stock change) for later payment / reference.
     */
    public function saveDraft(Request $request): JsonResponse
    {
        $validated = $this->validateLinesPayload($request, false);
        if (! empty($validated['payment_method'])) {
            $this->assertPaymentMethod($validated['payment_method']);
        }

        $adminId = (int) $request->user()->id;

        $payload = DB::transaction(function () use ($validated, $adminId) {
            $snapshot = [];

            foreach ($validated['lines'] as $line) {
                $row = BarcodeScanStockService::lookupDisplay($line['code']);
                if ($row === null) {
                    throw ValidationException::withMessages([
                        'lines' => ['Unknown code: '.$line['code']],
                    ]);
                }
                $qty = (int) $line['qty'];

                $snapshot[] = [
                    'code' => $row['code'],
                    'name' => $row['name'],
                    'qty' => $qty,
                    'unit_price' => round((float) $row['price'], 2),
                ];
            }

            $subtotal = round(
                array_sum(array_map(fn (array $s) => $s['unit_price'] * $s['qty'], $snapshot)),
                2
            );

            $order = Order::create([
                'user_id' => $adminId,
                'order_number' => $this->generatePosOrderNumber(),
                'status' => 'pending_payment',
                'payment_status' => 'pending',
                'payment_method' => $validated['payment_method'] ?? null,
                'subtotal' => $subtotal,
                'shipping' => 0,
                'discount' => 0,
                'total' => $subtotal,
                'shipping_address' => null,
                'billing_address' => null,
                'sale_channel' => 'pos',
                'pos_meta' => ['draft' => true],
            ]);

            foreach ($snapshot as $s) {
                $this->createOrderItemForLine($order->id, $s['code'], $s['name'], $s['qty'], $s['unit_price']);
            }

            return [$order, $subtotal];
        });

        [$order, $subtotal] = $payload;

        return response()->json([
            'message' => 'Draft order saved.',
            'data' => [
                'order' => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                ],
                'subtotal' => $subtotal,
            ],
        ]);
    }

    private function validateLinesPayload(Request $request, bool $requirePaymentMethod): array
    {
        $rules = [
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.code' => ['required', 'string', 'max:120'],
            'lines.*.qty' => ['required', 'integer', 'min:1', 'max:9999'],
            'receipt_no' => ['nullable', 'string', 'max:60'],
            'tender_received_cents' => ['nullable', 'integer', 'min:0', 'max:999999999'],
        ];
        $rules['payment_method'] = $requirePaymentMethod
            ? ['required', 'string', 'max:64']
            : ['nullable', 'string', 'max:64'];

        return $request->validate($rules);
    }

    private function assertPaymentMethod(string $m): void
    {
        if (! in_array($m, self::PAYMENT_METHODS, true)) {
            throw ValidationException::withMessages([
                'payment_method' => ['Invalid payment method.'],
            ]);
        }
    }

    private function generatePosOrderNumber(): string
    {
        do {
            $n = 'POS-'.now()->format('Y').'-'.strtoupper(Str::random(6));
        } while (Order::where('order_number', $n)->exists());

        return $n;
    }

    private function createOrderItemForLine(
        int $orderId,
        string $code,
        string $name,
        int $qty,
        float $unitPrice,
        ?int $inventoryLotId = null,
        ?float $unitCostAtSale = null,
        ?string $listingStatusAtSale = null,
        ?string $lotTierAtSale = null,
        ?string $lotNumberAtSale = null,
    ): void {
        $candidates = BarcodeScanStockService::collectScanCandidates($code);
        $variantMatch = \App\Services\ProductVariantInventory::findBySkuBarcodeCandidates($candidates);
        $bundle = BarcodeScanStockService::findBundleAmongCandidates($candidates);
        $products = BarcodeScanStockService::findLinkedProductsAmongCandidates($candidates, $bundle);
        $product = $variantMatch['product'] ?? $products->first();
        $variant = $variantMatch['variant'] ?? null;
        $lineTotal = round($unitPrice * $qty, 2);
        $sku = Str::limit($code, 60, '');

        OrderItem::create([
            'order_id' => $orderId,
            'product_id' => $product?->id,
            'inventory_lot_id' => $inventoryLotId,
            'size' => $variant['size'] ?? null,
            'color' => $variant['color'] ?? null,
            'name' => $name,
            'sku' => $sku,
            'price' => $unitPrice,
            'unit_cost_at_sale' => $unitCostAtSale,
            'listing_status_at_sale' => $listingStatusAtSale,
            'lot_tier_at_sale' => $lotTierAtSale,
            'lot_number_at_sale' => $lotNumberAtSale,
            'qty' => $qty,
            'line_total' => $lineTotal,
        ]);
    }
}
