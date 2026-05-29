<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Support\Str;
use RuntimeException;

class BakongKhqrService
{
    public function __construct(private readonly KhqrNode $generator)
    {
    }

    public function generate(Order $order, Payment $payment): array
    {
        $bakong = $this->resolvedBakongOptions();
        $accountId = $bakong['receive_account'];

        if (blank($accountId)) {
            throw new RuntimeException('Bakong receive account is not configured (admin payment settings or BAKONG_RECEIVE_ACCOUNT).');
        }

        $currency = strtoupper($payment->currency ?: config('services.bakong.currency', 'KHR'));
        $rawAmount = (float) ($payment->amount ?: $order->total ?: 0);
        // KHR < 1 (e.g. 0.01 test orders) must encode as ≥1 in the QR or ts-khqr emits a *static*
        // QR (POI 11). Bakong check_transaction_by_md5 only works for dynamic QR (POI 12).
        $amount = self::resolveKhqrAmount($rawAmount, $currency);
        $billNumber = $payment->bill_number ?: $this->makeBillNumber($order);
        $billNumber = $this->ensureUniqueBillNumber($billNumber, $payment->id);

        $expiresAt = now()->addSeconds(config('services.bakong.expired_in', 300));

        $payload = [
            'accountID' => $accountId,
            'merchantName' => $bakong['merchant_name'] ?: 'Fitandsleek Clothes Store',
            'merchantCity' => $bakong['merchant_city'] ?: 'Phnom Penh',
            'currency' => $currency,
            'amount' => $amount,
            'billNumber' => $billNumber,
            'storeLabel' => 'FitandSleek',
            'terminalLabel' => 'FitandSleekWeb',
            'expirationTimestamp' => $expiresAt->getTimestampMs(),
        ];

        $result = $this->generator->generate($payload);

        return [
            'bill_number' => $billNumber,
            'qr_string' => $result['qr'],
            'md5' => $result['md5'],
            'expires_at' => $expiresAt,
            'payload' => $payload,
            'amount' => $amount,
            'currency' => $currency,
        ];
    }

    /**
     * Amount encoded into the EMV KHQR payload (whole KHR; min 1 when order total is positive).
     */
    public static function resolveKhqrAmount(float $rawAmount, string $currency): float
    {
        if (strtoupper($currency) !== 'KHR') {
            return round(max(0, $rawAmount), 2);
        }

        if ($rawAmount <= 0) {
            return 0;
        }

        return (float) max(1, (int) round($rawAmount));
    }

    /** True when QR uses static point-of-initiation (Bakong MD5 check will fail with errorCode 2). */
    public static function qrStringIsStatic(?string $qrString): bool
    {
        if (! filled($qrString)) {
            return false;
        }

        return (bool) preg_match('/010211/', (string) $qrString);
    }

    /**
     * Same precedence as storefront payment settings: DB (admin) overrides .env.
     *
     * @return array{receive_account: ?string, merchant_name: ?string, merchant_city: ?string}
     */
    private function resolvedBakongOptions(): array
    {
        /** @var \Illuminate\Support\Collection<string, Setting> $settings */
        $settings = Setting::where('group', 'payment')->get()->keyBy('key');

        $receive = $settings->get('bakong_receive_account');
        $merchantName = $settings->get('bakong_merchant_name');
        $merchantCity = $settings->get('bakong_merchant_city');

        return [
            'receive_account' => filled($receive?->value)
                ? (string) $receive->value
                : (string) config('services.bakong.receive_account'),
            'merchant_name' => filled($merchantName?->value)
                ? (string) $merchantName->value
                : (string) (config('services.bakong.merchant_name') ?: ''),
            'merchant_city' => filled($merchantCity?->value)
                ? (string) $merchantCity->value
                : (string) (config('services.bakong.merchant_city') ?: ''),
        ];
    }

    private function makeBillNumber(Order $order): string
    {
        if ($order->order_number) {
            return $order->order_number;
        }

        return 'FS-' . now()->format('Ymd') . '-' . Str::upper(Str::random(6));
    }

    private function ensureUniqueBillNumber(string $base, ?int $paymentId = null): string
    {
        $candidate = $base;

        while (
            Payment::where('bill_number', $candidate)
                ->when($paymentId, fn ($q) => $q->where('id', '!=', $paymentId))
                ->exists()
        ) {
            $candidate = $base . '-' . Str::upper(Str::random(3));
        }

        return $candidate;
    }
}
