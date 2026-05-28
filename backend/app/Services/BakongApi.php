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
        if (empty($md5)) {
            throw new RuntimeException('Payment MD5 is missing.');
        }

        $md5 = strtolower(trim($md5));
        $proxyUrl = rtrim((string) config('services.bakong.proxy_url', ''), '/');

        if ($proxyUrl !== '') {
            return $this->checkByMd5ViaProxy($md5, $proxyUrl);
        }

        return $this->checkByMd5Direct($md5);
    }

    /**
     * @return array<string, mixed>
     */
    private function checkByMd5ViaProxy(string $md5, string $proxyUrl): array
    {
        $headers = ['Accept' => 'application/json'];
        $proxySecret = (string) config('services.bakong.proxy_secret', '');
        if ($proxySecret !== '') {
            $headers['X-Bakong-Proxy-Secret'] = $proxySecret;
        }

        try {
            $response = Http::timeout(25)
                ->withHeaders($headers)
                ->post($proxyUrl, ['md5' => $md5]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Bakong proxy connection failed: ' . $e->getMessage(), 0, $e);
        }

        if ($response->failed()) {
            throw new RuntimeException('Bakong proxy HTTP ' . $response->status() . ': ' . $response->body());
        }

        $json = $response->json();
        if (! is_array($json)) {
            throw new RuntimeException('Bakong proxy returned an invalid response.');
        }

        return $json;
    }

    /**
     * @return array<string, mixed>
     */
    private function checkByMd5Direct(string $md5): array
    {
        $baseUrl = rtrim((string) config('services.bakong.base_url'), '/');
        $token = config('services.bakong.token');

        if (! $token) {
            throw new RuntimeException('Bakong token is not configured.');
        }

        $http = Http::timeout(20)->withHeaders([
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
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

        $errorCode = (int) ($json['errorCode'] ?? 0);
        if ((int) ($json['responseCode'] ?? 1) === 1 && $errorCode === 15) {
            Log::warning('Bakong API geo/region block (errorCode 15). Configure BAKONG_PROXY_URL on a Cambodia host.', [
                'md5' => $md5,
            ]);
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
