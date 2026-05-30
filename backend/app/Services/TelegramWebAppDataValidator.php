<?php

namespace App\Services;

class TelegramWebAppDataValidator
{
    public function validate(string $initData, string $botToken): bool
    {
        if ($initData === '' || $botToken === '') {
            return false;
        }

        parse_str($initData, $params);
        $hash = (string) ($params['hash'] ?? '');
        if ($hash === '') {
            return false;
        }

        unset($params['hash']);
        ksort($params);

        $pairs = [];
        foreach ($params as $key => $value) {
            if (is_array($value)) {
                continue;
            }
            $pairs[] = $key.'='.$value;
        }

        $dataCheckString = implode("\n", $pairs);
        $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);
        $calculatedHash = bin2hex(hash_hmac('sha256', $dataCheckString, $secretKey, true));

        return hash_equals($calculatedHash, $hash);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function parseUser(string $initData): ?array
    {
        parse_str($initData, $params);
        $userRaw = $params['user'] ?? null;
        if (!is_string($userRaw) || $userRaw === '') {
            return null;
        }

        $decoded = json_decode($userRaw, true);

        return is_array($decoded) ? $decoded : null;
    }
}
