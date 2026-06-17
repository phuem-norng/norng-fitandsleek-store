<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Cart;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\BakongApi;
use App\Services\BakongKhqrService;
use App\Services\BakongPaymentConfirmation;
use App\Services\PaidOrderInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    public function __construct(
        private readonly BakongKhqrService $bakong,
        private readonly BakongApi $bakongApi,
        private readonly BakongPaymentConfirmation $bakongConfirmation,
    ) {
    }

    private function clearUserCart(int $userId): void
    {
        $cart = Cart::with('items')->where('user_id', $userId)->first();
        if ($cart) {
            $cart->items()->delete();
        }
    }

    /**
     * Get payment page for an order
     */
    public function show(Order $order, Request $request)
    {
        // Verify order belongs to user
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $order->load(['items.product']);

        // Get payment settings
        $paymentSettings = $this->getPaymentSettings();

        return response()->json([
            'data' => $order,
            'payment_settings' => $paymentSettings,
        ]);
    }

    /**
     * Process Bakong KHQR payment
     */
    public function verifyBKash(Order $order, Request $request)
    {
        // Verify order belongs to user
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Find payment record
        $payment = Payment::where('order_id', $order->id)
            ->where('method', 'bakong_khqr')
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found'], 404);
        }

        // In production, you would verify with Bakong API here
        // For now, we'll simulate successful verification
        
        DB::transaction(function () use ($payment, $order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->payment_status === 'paid') {
                $payment->update([
                    'status' => 'paid',
                    'paid_at' => now(),
                ]);

                return;
            }

            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            $order->update([
                'payment_status' => 'paid',
                'status' => 'processing',
            ]);

            $order->load('items.product');
            PaidOrderInventory::applyForOrder($order);
        });

        // Clear cart only after payment succeeds
        $this->clearUserCart((int) $order->user_id);

        return response()->json([
            'success' => true,
            'message' => 'Payment verified successfully',
            'payment' => $payment,
        ]);
    }

    /**
     * Process card payment
     */
    public function processCard(Order $order, Request $request)
    {
        // Verify order belongs to user
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'card_number' => 'required|string',
            'card_name' => 'required|string',
            'expiry_date' => 'required|string',
            'cvv' => 'required|string',
        ]);

        // Find payment record
        $payment = Payment::where('order_id', $order->id)
            ->where('method', 'card_visa')
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found'], 404);
        }

        // Validate card format
        $cardNumber = str_replace(' ', '', $validated['card_number']);
        if (!preg_match('/^[0-9]{13,19}$/', $cardNumber)) {
            return response()->json(['message' => 'Invalid card number'], 422);
        }

        // In production, you would process with Stripe or similar here
        // For now, we'll simulate successful payment
        
        $shouldFail = false;

        // Demo: Decline test card numbers
        if (str_starts_with($cardNumber, '4000000000000002')) {
            $shouldFail = true;
        }

        if ($shouldFail) {
            return response()->json([
                'success' => false,
                'message' => 'Card declined. Please try another card.',
            ], 402);
        }

        DB::transaction(function () use ($payment, $order, $validated) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->payment_status === 'paid') {
                $payment->update([
                    'status' => 'paid',
                    'paid_at' => now(),
                    'reference_code' => 'CARD-' . strtoupper(substr($validated['card_number'], -4)) . '-' . now()->timestamp,
                ]);

                return;
            }

            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'reference_code' => 'CARD-' . strtoupper(substr($validated['card_number'], -4)) . '-' . now()->timestamp,
            ]);

            $order->update([
                'payment_status' => 'paid',
                'status' => 'processing',
            ]);

            $order->load('items.product');
            PaidOrderInventory::applyForOrder($order);
        });

        // Clear cart only after payment succeeds
        $this->clearUserCart((int) $order->user_id);

        return response()->json([
            'success' => true,
            'message' => 'Payment processed successfully',
            'payment' => $payment,
        ]);
    }

    /**
     * Get payment settings from database
     */
    private function getPaymentSettings()
    {
        $settings = Setting::where('group', 'payment')->get()->keyBy('key');

        return [
            'bakong' => [
                'receive_account' => $settings->get('bakong_receive_account')?->value ?? config('services.bakong.receive_account'),
                'merchant_name' => $settings->get('bakong_merchant_name')?->value ?? config('services.bakong.merchant_name'),
                'merchant_city' => $settings->get('bakong_merchant_city')?->value ?? config('services.bakong.merchant_city'),
                'enabled' => (bool) ($settings->get('payment_method_bakong_khqr')?->value ?? true),
            ],
            'card' => [
                'provider' => $settings->get('card_provider')?->value ?? 'demo',
                'enabled' => (bool) ($settings->get('payment_method_card_visa')?->value ?? true),
            ],
        ];
    }

    /**
     * Create KHQR payment and return QR image
     */
    public function createKhqr(Request $request)
    {
        $validated = $request->validate([
            'order_id' => 'required|integer|exists:orders,id',
        ]);

        $order = Order::with('items.product')->findOrFail((int) $validated['order_id']);

        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($order->payment_method !== 'bakong_khqr') {
            return response()->json(['message' => 'Order payment method is not KHQR.'], 422);
        }

        if ($order->payment_status === 'paid') {
            return response()->json(['message' => 'Order is already paid.'], 409);
        }

        $existing = Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('id')
            ->first();

        if ($existing && $existing->khqr_payload && $existing->qr_string) {
            return response()->json([
                'payment' => $this->sanitizePayment($existing),
            ]);
        }

        Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);

        $payment = $existing ?: Payment::create([
            'order_id' => $order->id,
            'provider' => 'bakong',
            'amount' => $order->total,
            'currency' => config('services.bakong.currency', 'KHR'),
            'method' => 'bakong_khqr',
            'status' => 'pending',
        ]);

        try {
            $result = $this->bakong->generate($order, $payment);

            $payment->update([
                'bill_number' => $result['bill_number'],
                'md5' => $result['md5'],
                'khqr_payload' => $result['payload'],
                'qr_string' => $result['qr_string'],
                'qr_image_base64' => null,
                'expires_at' => $result['expires_at'],
                'raw_response' => null,
            ]);

            return response()->json([
                'payment' => $this->sanitizePayment($payment->fresh()),
            ]);
        } catch (\Throwable $e) {
            Log::error('KHQR create failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $payment->update(['status' => 'failed']);

            return response()->json([
                'message' => 'Failed to create KHQR payment. Please try again.',
            ], 500);
        }
    }

    public function khqrStatus(int $orderId, Request $request)
    {
        $order = Order::with('items.product')->findOrFail($orderId);

        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $payment = Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->latest('id')
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found'], 404);
        }

        if (in_array($payment->status, ['paid', 'failed', 'expired', 'cancelled'], true)) {
            return response()->json([
                'payment' => $this->sanitizePayment($payment),
            ]);
        }

        if ($payment->expires_at && now()->greaterThan($payment->expires_at)) {
            $payment->update(['status' => 'expired']);

            return response()->json([
                'payment' => $this->sanitizePayment($payment->fresh()),
            ]);
        }

        try {
            $response = $this->bakongApi->checkByMd5((string) $payment->md5);
            $responseCode = $response['responseCode'] ?? $response['response_code'] ?? null;
            $transaction = $response['data'] ?? [];
            $billNumber = $this->extractBillNumber((array) $transaction);
            $matchesOrder = $this->billMatches($billNumber, $payment->bill_number);

            if ((int) $responseCode === 0 && ! empty($transaction) && $matchesOrder) {
                DB::transaction(function () use ($payment, $order, $transaction, $response) {
                    $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

                    $payment->update([
                        'status' => 'paid',
                        'paid_at' => now(),
                        'bakong_data' => $transaction,
                        'raw_response' => $response,
                    ]);

                    if ($order->payment_status !== 'paid') {
                        $order->update([
                            'payment_status' => 'paid',
                            'status' => 'processing',
                        ]);
                        $this->clearUserCart((int) $order->user_id);

                        $order->load('items.product');
                        PaidOrderInventory::applyForOrder($order);
                    }
                });
            }

            return response()->json([
                'payment' => $this->sanitizePayment($payment->fresh()),
            ]);
        } catch (\Throwable $e) {
            Log::error('KHQR status check failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $payment->refresh();
            $order->refresh();

            if ($payment->status === 'paid' || $order->payment_status === 'paid') {
                return response()->json([
                    'payment' => $this->sanitizePayment($payment),
                ]);
            }

            return response()->json([
                'payment' => $this->sanitizePayment($payment),
                'message' => blank(config('services.bakong.proxy_url'))
                    ? 'Waiting for payment confirmation. Keep this screen open after you pay in your banking app.'
                    : 'Failed to check KHQR status. Please try again.',
            ]);
        }
    }

    /**
     * Optional webhook handler for KHQR
     */
    public function khqrWebhook(Request $request)
    {
        $secret = config('services.bakong.webhook_secret');

        if ($secret) {
            $signature = $request->header('X-Bakong-Signature');
            $payload = $request->getContent();
            $expected = hash_hmac('sha256', $payload, $secret);

            if (! hash_equals($expected, (string) $signature)) {
                Log::warning('Bakong webhook rejected: invalid signature');

                return response()->json(['message' => 'Invalid signature'], 401);
            }
        }

        $data = $request->all();
        Log::info('Bakong KHQR webhook received', [
            'responseCode' => data_get($data, 'responseCode'),
            'has_md5' => filled(data_get($data, 'md5') ?? data_get($data, 'data.md5')),
            'has_data_hash' => filled(data_get($data, 'data.hash')),
        ]);

        $payment = $this->bakongConfirmation->findPaymentFromPayload($data);
        if (! $payment) {
            Log::warning('Bakong webhook: payment not found', [
                'md5' => data_get($data, 'md5') ?? data_get($data, 'data.md5'),
                'bill_number' => data_get($data, 'billNumber') ?? data_get($data, 'bill_number'),
            ]);

            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($this->bakongConfirmation->payloadIndicatesPaid($data, $payment)) {
            $transaction = is_array(data_get($data, 'data')) ? data_get($data, 'data') : null;
            $this->bakongConfirmation->markPaid($payment, $data, $transaction);

            return response()->json(['ok' => true, 'status' => 'paid']);
        }

        $status = $this->normalizeKhqrStatus(
            data_get($data, 'status')
            ?? data_get($data, 'data.status')
            ?? data_get($data, 'payment_status')
        );

        $payment->update([
            'status' => $status,
            'paid_at' => $status === 'paid' ? now() : null,
            'raw_response' => $data,
        ]);

        return response()->json(['ok' => true, 'status' => $status]);
    }

    private function sanitizePayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'order_id' => $payment->order_id,
            'provider' => $payment->provider,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'status' => $payment->status,
            'bill_number' => $payment->bill_number,
            'md5' => $payment->md5,
            'qr_string' => $payment->qr_string,
            'khqr_payload' => $payment->khqr_payload,
            'qr_image_base64' => $payment->qr_image_base64,
            'expires_at' => optional($payment->expires_at)->toIso8601String(),
            'paid_at' => optional($payment->paid_at)->toIso8601String(),
            'created_at' => optional($payment->created_at)->toIso8601String(),
        ];
    }

    private function extractBillNumber(array $data): ?string
    {
        return data_get($data, 'billNumber')
            ?? data_get($data, 'bill_no')
            ?? data_get($data, 'bill_number');
    }

    private function billMatches(?string $actual, ?string $expected): bool
    {
        if (! $expected) {
            return false;
        }

        if ($actual === null) {
            return false;
        }

        return strcasecmp(trim((string) $actual), trim((string) $expected)) === 0;
    }

    private function normalizeKhqrStatus(?string $status): string
    {
        $status = strtoupper((string) $status);

        return match ($status) {
            'PAID', 'SUCCESS', 'COMPLETED' => 'paid',
            'FAILED' => 'failed',
            'EXPIRED' => 'expired',
            'CANCELLED', 'CANCELED' => 'cancelled',
            default => 'pending',
        };
    }
}
