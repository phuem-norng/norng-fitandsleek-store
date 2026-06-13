<?php

namespace App\Services;

use App\Models\Setting;

class DeliveryFeeService
{
    public const KEY_PHNOM_PENH = 'delivery_fee_phnom_penh';

    public const KEY_PROVINCE = 'delivery_fee_province';

    public const DEFAULT_PHNOM_PENH = 1.50;

    public const DEFAULT_PROVINCE = 2.00;

    public function getRates(): array
    {
        return [
            'phnom_penh' => $this->rateForKey(self::KEY_PHNOM_PENH, self::DEFAULT_PHNOM_PENH),
            'province' => $this->rateForKey(self::KEY_PROVINCE, self::DEFAULT_PROVINCE),
        ];
    }

    public function isPhnomPenh(?string $province): bool
    {
        $normalized = $this->normalizeProvince($province);
        if ($normalized === '') {
            return false;
        }

        $exact = [
            'phnom penh',
            'phnompenh',
            'pp',
            'ភ្នំពេញ',
            'រាជធានីភ្នំពេញ',
            'phnom penh capital',
        ];

        if (in_array($normalized, $exact, true)) {
            return true;
        }

        return str_contains($normalized, 'phnom penh')
            || str_contains($normalized, 'phnompenh')
            || str_contains($normalized, 'ភ្នំពេញ');
    }

    public function resolveZone(?string $province): string
    {
        return $this->isPhnomPenh($province) ? 'phnom_penh' : 'province';
    }

    public function resolveForProvince(?string $province): float
    {
        $rates = $this->getRates();

        return $this->isPhnomPenh($province)
            ? $rates['phnom_penh']
            : $rates['province'];
    }

    public function quote(?string $province): array
    {
        $zone = $this->resolveZone($province);
        $rates = $this->getRates();

        return [
            'zone' => $zone,
            'fee' => round($rates[$zone], 2),
            'label' => $zone === 'phnom_penh' ? 'Phnom Penh' : 'Province',
        ];
    }

    public function updateRates(float $phnomPenh, float $province): array
    {
        Setting::updateOrCreate(
            ['key' => self::KEY_PHNOM_PENH],
            ['value' => round(max($phnomPenh, 0), 2), 'group' => 'commerce', 'type' => 'number']
        );

        Setting::updateOrCreate(
            ['key' => self::KEY_PROVINCE],
            ['value' => round(max($province, 0), 2), 'group' => 'commerce', 'type' => 'number']
        );

        return $this->getRates();
    }

    private function rateForKey(string $key, float $default): float
    {
        $setting = Setting::where('key', $key)->first();
        if (! $setting || ! is_numeric($setting->value)) {
            return $default;
        }

        return round(max((float) $setting->value, 0), 2);
    }

    private function normalizeProvince(?string $province): string
    {
        $value = trim(mb_strtolower((string) $province));

        return preg_replace('/\s+/u', ' ', $value) ?? '';
    }
}
