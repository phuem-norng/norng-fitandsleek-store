<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IpGeolocationService
{
    /**
     * City-level geolocation from IP (no GPS). Returns null for private/local IPs.
     *
     * @return array{ip: string, city: ?string, region: ?string, country: ?string, country_code: ?string}|null
     */
    public function lookup(?string $ip): ?array
    {
        if (! config('geoip.enabled', true)) {
            return null;
        }

        $ip = trim((string) $ip);
        if ($ip === '' || $this->isPrivateOrReserved($ip)) {
            return null;
        }

        $ttl = max(1, (int) config('geoip.cache_ttl_minutes', 1440));

        return Cache::remember("geoip:v1:{$ip}", now()->addMinutes($ttl), function () use ($ip) {
            return $this->fetch($ip);
        });
    }

    public function formatLocation(?array $geo): ?string
    {
        if (! $geo) {
            return null;
        }

        $parts = array_values(array_unique(array_filter([
            $geo['city'] ?? null,
            $geo['region'] ?? null,
            $geo['country'] ?? null,
        ])));

        return $parts !== [] ? implode(', ', $parts) : null;
    }

    private function fetch(string $ip): ?array
    {
        $provider = (string) config('geoip.provider', 'ipwho');
        if ($provider === 'none') {
            return null;
        }

        return match ($provider) {
            'ipwho' => $this->fetchIpWho($ip),
            default => $this->fetchIpWho($ip),
        };
    }

    private function fetchIpWho(string $ip): ?array
    {
        $timeout = max(1, (int) config('geoip.timeout_seconds', 3));

        try {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->get("https://ipwho.is/{$ip}");

            if (! $response->successful()) {
                return null;
            }

            $data = $response->json();
            if (! is_array($data) || empty($data['success'])) {
                return null;
            }

            return [
                'ip' => $ip,
                'city' => $this->stringOrNull($data['city'] ?? null),
                'region' => $this->stringOrNull($data['region'] ?? null),
                'country' => $this->stringOrNull($data['country'] ?? null),
                'country_code' => $this->stringOrNull($data['country_code'] ?? null),
            ];
        } catch (\Throwable $e) {
            Log::debug('GeoIP lookup failed', ['ip' => $ip, 'error' => $e->getMessage()]);

            return null;
        }
    }

    private function stringOrNull(mixed $value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed !== '' ? substr($trimmed, 0, 120) : null;
    }

    private function isPrivateOrReserved(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return true;
        }

        return ! filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }
}
