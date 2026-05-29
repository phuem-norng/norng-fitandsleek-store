<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaidOrderInventory;
use App\Models\Cart;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Services\BakongApi;
use App\Services\BakongKhqrService;
use Illuminate\Database\UniqueConstraintViolationException;
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

        Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);

        $activePayment = Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->where('status', 'pending')
            ->whereNotNull('qr_string')
            ->whereNotNull('md5')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('id')
            ->first();

        if ($activePayment && ! BakongKhqrService::qrStringIsStatic($activePayment->qr_string)) {
            return response()->json($this->formatPaymentResponse($activePayment));
        }

        $payment = Payment::where('order_id', $order->id)
            ->where('provider', 'bakong')
            ->whereIn('status', ['pending', 'failed'])
            ->latest('id')
            ->first();

        if ($payment) {
            $payment->update([
                'status' => 'pending',
                'amount' => $order->total,
                'currency' => config('services.bakong.currency', 'KHR'),
                'bill_number' => null,
                'md5' => null,
                'qr_string' => null,
                'khqr_payload' => null,
                'qr_image_base64' => null,
                'expires_at' => null,
                'paid_at' => null,
            ]);
        } else {
            $payment = Payment::create([
                'order_id' => $order->id,
                'provider' => 'bakong',
                'method' => 'bakong_khqr',
                'status' => 'pending',
                'amount' => $order->total,
                'currency' => config('services.bakong.currency', 'KHR'),
            ]);
        }

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

        try {
            $this->persistKhqrResult($payment, $result);
        } catch (UniqueConstraintViolationException $e) {
            if (! str_contains($e->getMessage(), 'bill_number')) {
                throw $e;
            }

            $payment->update(['bill_number' => null]);
            $result = $this->khqr->generate($order, $payment->fresh());
            $this->persistKhqrResult($payment, $result);
        }

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

        if ($payment->status === 'paid' || $order->payment_status === 'paid') {
            return response()->json(array_merge(
                $this->formatPaymentResponse($payment),
                [
                    'status' => 'paid',
                    'payment_status' => 'paid',
                    'order_payment_status' => $order->payment_status,
                ]
            ));
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

        if (BakongKhqrService::qrStringIsStatic($payment->qr_string)) {
            return $this->regenerateKhqrResponse($order, $payment);
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
        $transaction = is_array($response['data'] ?? null) ? $response['data'] : [];

        if ((int) $responseCode === 0 && $this->transactionConfirmsPayment($payment, $transaction)) {
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

            return response()->json(array_merge(
                $this->formatPaymentResponse($payment->fresh()),
                [
                    'status' => 'paid',
                    'payment_status' => 'paid',
                    'order_payment_status' => $order->fresh()->payment_status,
                    'data' => $transaction,
                ]
            ));
        }

        if ((int) $responseCode === 0 && ! empty($transaction)) {
            Log::info('Bakong transaction returned but did not match payment', [
                'payment_id' => $payment->id,
                'bill_number' => $payment->bill_number,
                'transaction' => $transaction,
            ]);
        }

        $errorCode = (int) ($response['errorCode'] ?? 0);
        $pendingPayload = array_merge(
            $this->formatPaymentResponse($payment),
            ['status' => 'pending']
        );

        if ((int) $responseCode === 1 && $errorCode === 15) {
            $pendingPayload['verification_note'] =
                'Payment verification is blocked from this server region. Set BAKONG_PROXY_URL to a Cambodia-hosted proxy (see backend/bakong-proxy).';
            $pendingPayload['bakong_error_code'] = 15;
        }

        if ((int) $responseCode === 1 && $errorCode === 2) {
            return $this->regenerateKhqrResponse($order, $payment);
        }

        if ($payment->expires_at && now()->greaterThan($payment->expires_at)) {
            $payment->update(['status' => 'expired']);
            $pendingPayload['status'] = 'expired';
        }

        return response()->json($pendingPayload);
    }

    /**
     * Bakong success payloads include hash, amount, and toAccountId — not always billNumber.
     */
    private function transactionConfirmsPayment(Payment $payment, array $transaction): bool
    {
        if ($transaction === [] || ! filled(data_get($transaction, 'hash'))) {
            return false;
        }

        $expectedAccount = $this->expectedReceiveAccount();
        $toAccount = strtolower(trim((string) data_get($transaction, 'toAccountId', '')));

        if ($expectedAccount !== '' && $toAccount !== '' && ! $this->accountsMatch($expectedAccount, $toAccount)) {
            return false;
        }

        $paidAmount = data_get($transaction, 'amount');
        if ($paidAmount !== null && ! $this->amountsMatch((float) $payment->amount, (float) $paidAmount, (string) $payment->currency)) {
            return false;
        }

        return true;
    }

    private function expectedReceiveAccount(): string
    {
        $fromDb = Setting::query()
            ->where('group', 'payment')
            ->where('key', 'bakong_receive_account')
            ->value('value');

        $account = filled($fromDb)
            ? (string) $fromDb
            : (string) config('services.bakong.receive_account');

        return strtolower(trim($account));
    }

    private function accountsMatch(string $expected, string $actual): bool
    {
        return strtolower(trim($expected)) === strtolower(trim($actual));
    }

    private function amountsMatch(float $expected, float $actual, string $currency): bool
    {
        if (strtoupper($currency) === 'KHR') {
            $expectedKh = (int) BakongKhqrService::resolveKhqrAmount($expected, 'KHR');

            return $expectedKh === (int) round($actual);
        }

        return abs($expected - $actual) < 0.01;
    }

    private function regenerateKhqrResponse(Order $order, Payment $payment): JsonResponse
    {
        try {
            $result = $this->khqr->generate($order, $payment);
            $this->persistKhqrResult($payment, $result);

            return response()->json(array_merge(
                $this->formatPaymentResponse($payment->fresh()),
                [
                    'status' => 'pending',
                    'verification_note' => 'QR code refreshed — scan again and pay the amount shown.',
                ]
            ));
        } catch (\Throwable $e) {
            report($e);

            return response()->json(array_merge(
                $this->formatPaymentResponse($payment),
                [
                    'status' => 'pending',
                    'message' => 'Unable to refresh KHQR. Please close and try checkout again.',
                ]
            ), 500);
        }
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

    /**
     * @param  array{bill_number: string, md5: string, payload: array, qr_string: string, expires_at: \Illuminate\Support\Carbon}  $result
     */
    private function persistKhqrResult(Payment $payment, array $result): void
    {
        $payment->update([
            'bill_number' => $result['bill_number'],
            'md5' => $result['md5'],
            'khqr_payload' => $result['payload'],
            'qr_string' => $result['qr_string'],
            'qr_image_base64' => null,
            'expires_at' => $result['expires_at'],
            'amount' => $result['amount'] ?? $payment->amount,
            'currency' => $result['currency'] ?? $payment->currency,
        ]);
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
        $direct = data_get($data, 'billNumber')
            ?? data_get($data, 'bill_no')
            ?? data_get($data, 'bill_number');

        if (filled($direct)) {
            return (string) $direct;
        }

        $description = trim((string) data_get($data, 'description', ''));
        if ($description !== '' && preg_match('/ORD-[A-Z0-9-]+/i', $description, $matches)) {
            return $matches[0];
        }

        return null;
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
