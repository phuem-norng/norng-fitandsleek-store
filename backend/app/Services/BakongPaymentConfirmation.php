<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class BakongPaymentConfirmation
{
    public function findPaymentFromPayload(array $data): ?Payment
    {
        $md5 = $this->extractMd5($data);
        $billNumber = $this->extractBillNumber($data);

        if ($md5 === null && $billNumber === null) {
            return null;
        }

        return Payment::query()
            ->where('provider', 'bakong')
            ->when($md5, fn ($query) => $query->where('md5', $md5))
            ->when(! $md5 && $billNumber, fn ($query) => $query->where('bill_number', $billNumber))
            ->latest('id')
            ->first();
    }

    public function payloadIndicatesPaid(array $data, Payment $payment): bool
    {
        $responseCode = data_get($data, 'responseCode') ?? data_get($data, 'response_code');
        $transaction = data_get($data, 'data');
        $transaction = is_array($transaction) ? $transaction : [];

        if ((int) $responseCode === 0 && $this->transactionConfirmsPayment($payment, $transaction)) {
            return true;
        }

        $status = strtoupper((string) (
            data_get($data, 'status')
            ?? data_get($data, 'data.status')
            ?? data_get($data, 'payment_status')
            ?? ''
        ));

        return in_array($status, ['PAID', 'SUCCESS', 'COMPLETED', 'APPROVED'], true);
    }

    public function markPaid(Payment $payment, array $rawPayload, ?array $transaction = null): void
    {
        DB::transaction(function () use ($payment, $rawPayload, $transaction) {
            $payment->refresh();

            if ($payment->status === 'paid') {
                return;
            }

            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'bakong_data' => $transaction ?? (is_array(data_get($rawPayload, 'data')) ? data_get($rawPayload, 'data') : null),
                'raw_response' => $rawPayload,
            ]);

            $order = Order::query()->whereKey($payment->order_id)->lockForUpdate()->first();
            if (! $order || $order->payment_status === 'paid') {
                return;
            }

            $order->update([
                'payment_status' => 'paid',
                'status' => 'processing',
            ]);

            $this->clearUserCart((int) $order->user_id);

            $order->loadMissing('items.product');
            PaidOrderInventory::applyForOrder($order);
        });
    }

    public function transactionConfirmsPayment(Payment $payment, array $transaction): bool
    {
        if ($transaction === [] || ! filled(data_get($transaction, 'hash'))) {
            return false;
        }

        $expectedAccount = $this->expectedReceiveAccount();
        $toAccount = strtolower(trim((string) data_get($transaction, 'toAccountId', '')));

        if ($expectedAccount !== '' && $toAccount !== '' && $expectedAccount !== $toAccount) {
            return false;
        }

        $paidAmount = data_get($transaction, 'amount');
        if ($paidAmount !== null && ! $this->amountsMatch((float) $payment->amount, (float) $paidAmount, (string) $payment->currency)) {
            return false;
        }

        return true;
    }

    private function extractMd5(array $data): ?string
    {
        $md5 = data_get($data, 'md5')
            ?? data_get($data, 'data.md5')
            ?? data_get($data, 'payload.md5')
            ?? data_get($data, 'data.hash');

        if (! filled($md5)) {
            return null;
        }

        return strtolower(trim((string) $md5));
    }

    private function extractBillNumber(array $data): ?string
    {
        $transaction = is_array(data_get($data, 'data')) ? data_get($data, 'data') : [];

        $direct = data_get($data, 'bill_number')
            ?? data_get($data, 'billNumber')
            ?? data_get($data, 'merchant_ref')
            ?? data_get($data, 'data.billNumber')
            ?? data_get($data, 'data.bill_number');

        if (filled($direct)) {
            return (string) $direct;
        }

        $description = trim((string) data_get($transaction, 'description', ''));
        if ($description !== '' && preg_match('/ORD-[A-Z0-9-]+/i', $description, $matches)) {
            return $matches[0];
        }

        return null;
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

    private function amountsMatch(float $expected, float $actual, string $currency): bool
    {
        if (strtoupper($currency) === 'KHR') {
            $expectedKh = (int) BakongKhqrService::resolveKhqrAmount($expected, 'KHR');

            return $expectedKh === (int) round($actual);
        }

        return abs($expected - $actual) < 0.01;
    }

    private function clearUserCart(int $userId): void
    {
        $cart = Cart::with('items')->where('user_id', $userId)->first();
        if ($cart) {
            $cart->items()->delete();
        }
    }
}
