<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class BakongApi
{
    public function checkByMd5(string $md5): array
    {
        $baseUrl = rtrim(config('services.bakong.base_url'), '/');
        $token = config('services.bakong.token');

        if (! $token) {
            throw new RuntimeException('Bakong token is not configured.');
        }

        if (empty($md5)) {
            throw new RuntimeException('Payment MD5 is missing.');
        }

        $http = Http::timeout(20)->withHeaders([
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ]);

        $verifyOption = $this->resolveVerifyOption();
        $http = $http->withOptions(['verify' => $verifyOption]);

        try {
            $response = $http->post($baseUrl . '/v1/check_transaction_by_md5', [
                'md5' => $md5,
            ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Bakong connection failed: ' . $e->getMessage(), 0, $e);
        }

        if ($response->failed()) {
            throw new RuntimeException('Bakong HTTP ' . $response->status() . ': ' . $response->body());
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new RuntimeException('Bakong returned an invalid response.');
        }

        return $json;
    }

    private function resolveVerifyOption(): bool|string
    {
        $verify = config('services.bakong.verify', true);
        $caBundle = (string) config('services.bakong.ca_bundle', '');

        if (is_string($verify)) {
            $parsed = filter_var($verify, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            $verify = $parsed ?? true;
        }

        if ($verify === false) {
            return false;
        }

        $caBundle = trim($caBundle);
        if ($caBundle !== '') {
            if (is_readable($caBundle)) {
                return $caBundle;
            }

            Log::warning('Bakong CA bundle path is not readable, using system trust store.', [
                'path' => $caBundle,
            ]);
        }

        return true;
    }
}
