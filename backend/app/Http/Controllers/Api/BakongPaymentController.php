<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaidOrderInventory;
use App\Models\Cart;
use App\Models\Order;
use App\Models\Payment;
use App\Services\BakongApi;
use App\Services\BakongKhqrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BakongPaymentController extends Controller
{
    public function __construct(
        private readonly BakongApi $bakong,
        private readonly BakongKhqrService $khqr
    ) {
    }

    public function create(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
        ]);

        $order = Order::with('items.product')->findOrFail($data['order_id']);
        $this->ensureOrderOwner($order, $request);

        if ($order->payment_method !== 'bakong_khqr') {
            return response()->json(['message' => 'Order payment method is not Bakong KHQR.'], 422);
        }

        if ($order->payment_status === 'paid') {
            return response()->json(['message' => 'Order already paid.'], 409);
        }

        $activePayment = Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('id')
            ->first();

        if ($activePayment && $activePayment->qr_string && $activePayment->md5) {
            return response()->json($this->formatPaymentResponse($activePayment));
        }

        Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);
        $payment = Payment::create([
            'order_id' => $order->id,
            'provider' => 'bakong',
            'method' => 'bakong_khqr',
            'status' => 'pending',
            'amount' => $order->total,
            'currency' => config('services.bakong.currency', 'KHR'),
        ]);

        try {
            $result = $this->khqr->generate($order, $payment);
        } catch (\Throwable $e) {
            report($e);
            $payment->update(['status' => 'failed']);

            $response = [
                'message' => 'Unable to generate Bakong KHQR. Please try again.',
            ];

            if (config('app.debug')) {
                $response['detail'] = $e->getMessage();
            }

            return response()->json($response, 500);
        }

        $payment->update([
            'bill_number' => $result['bill_number'],
            'md5' => $result['md5'],
            'khqr_payload' => $result['payload'],
            'qr_string' => $result['qr_string'],
            'qr_image_base64' => null,
            'expires_at' => $result['expires_at'],
        ]);

        return response()->json($this->formatPaymentResponse($payment->fresh()));
    }

    public function status(Payment $payment, Request $request): JsonResponse
    {
        $payment->load('order.items.product');
        $order = $payment->order;

        if (! $order) {
            return response()->json(['message' => 'Payment order not found'], 404);
        }

        $this->ensureOrderOwner($order, $request);

        if ($payment->status === 'paid') {
            return response()->json(['status' => 'paid']);
        }

        if ($payment->expires_at && now()->greaterThan($payment->expires_at)) {
            $payment->update(['status' => 'expired']);

            return response()->json(['status' => 'expired']);
        }

        // If we somehow have a payment without an md5 (older records), regenerate a fresh KHQR
        if (empty($payment->md5)) {
            try {
                $result = $this->khqr->generate($order, $payment);

                $payment->update([
                    'bill_number' => $result['bill_number'],
                    'md5' => $result['md5'],
                    'khqr_payload' => $result['payload'],
                    'qr_string' => $result['qr_string'],
                    'qr_image_base64' => null,
                    'expires_at' => $result['expires_at'],
                    'status' => 'pending',
                ]);

                return response()->json($this->formatPaymentResponse($payment->fresh()));
            } catch (\Throwable $e) {
                report($e);

                return response()->json([
                    'status' => 'pending',
                    'message' => 'Unable to refresh KHQR, please try again.',
                ], 500);
            }
        }

        try {
            $response = $this->bakong->checkByMd5((string) $payment->md5);
        } catch (\Throwable $e) {
            Log::warning('Bakong status check failed', [
                'payment_id' => $payment->id,
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(array_merge(
                $this->formatPaymentResponse($payment),
                [
                    'status' => 'pending',
                    'message' => 'Payment status check is temporarily unavailable. Keep this screen open.',
                ]
            ));
        }

        $responseCode = $response['responseCode'] ?? $response['response_code'] ?? null;
        $transaction = $response['data'] ?? [];
        $billNumber = $this->extractBillNumber((array) $transaction);
        $matchesOrder = $this->billMatches($billNumber, $payment->bill_number);

        $transactionHasBill = $billNumber !== null && $billNumber !== '';

        if ((int) $responseCode === 0 && ! empty($transaction) && ($matchesOrder || ! $transactionHasBill)) {
            try {
                DB::transaction(function () use ($payment, $order, $response, $transaction) {
                    $payment->update([
                        'status' => 'paid',
                        'paid_at' => now(),
                        'bakong_data' => $transaction,
                        'raw_response' => $response,
                    ]);

                    if ($order->payment_status !== 'paid') {
                        $this->markOrderAsPaid($order);
                        $this->clearUserCart((int) $order->user_id);
                    }
                });
            } catch (\Throwable $e) {
                Log::error('Bakong payment confirmation failed', [
                    'payment_id' => $payment->id,
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);

                return response()->json(array_merge(
                    $this->formatPaymentResponse($payment->fresh()),
                    [
                        'status' => 'pending',
                        'message' => 'Payment received but order update failed. Contact support with your bill number.',
                    ]
                ));
            }

            return response()->json([
                'status' => 'paid',
                'data' => $transaction,
            ]);
        }

        if ((int) $responseCode === 0 && ! empty($transaction) && ! $matchesOrder) {
            return response()->json([
                'status' => 'pending',
                'message' => 'Awaiting matching bill number confirmation.',
            ]);
        }

        return response()->json(array_merge(
            $this->formatPaymentResponse($payment),
            ['status' => 'pending']
        ));
    }

    private function ensureOrderOwner(Order $order, Request $request): void
    {
        $userId = $request->user()?->id;

        if ($order->user_id !== $userId) {
            abort(403, 'Unauthorized');
        }
    }

    private function markOrderAsPaid(Order $order): void
    {
        $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

        if ($locked->payment_status === 'paid') {
            return;
        }

        $locked->update([
            'payment_status' => 'paid',
            'status' => 'processing',
        ]);

        $locked->loadMissing('items.product');

        PaidOrderInventory::applyForOrder($locked);
    }

    private function formatPaymentResponse(Payment $payment): array
    {
        return [
            'payment_id' => $payment->id,
            'status' => $payment->status,
            'bill_number' => $payment->bill_number,
            'qr_string' => $payment->qr_string,
            'md5' => $payment->md5,
            'expires_at' => optional($payment->expires_at)->toIso8601String(),
            'amount' => $payment->amount,
            'currency' => $payment->currency,
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

    private function clearUserCart(int $userId): void
    {
        $cart = Cart::with('items')->where('user_id', $userId)->first();
        if ($cart) {
            $cart->items()->delete();
        }
    }
}
