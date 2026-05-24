<?php

namespace App\Services;

use App\Models\User;
use Endroid\QrCode\Color\Color;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
    private const SETUP_CACHE_PREFIX = 'two_factor_setup:';

    private const CHALLENGE_CACHE_PREFIX = 'two_factor_challenge:';

    public function __construct(private Google2FA $google2fa)
    {
    }

    public function isEnabled(User $user): bool
    {
        return $user->two_factor_confirmed_at !== null
            && ! empty($user->two_factor_secret);
    }

    public function generateSecret(): string
    {
        return $this->google2fa->generateSecretKey();
    }

    public function beginSetup(User $user): array
    {
        $secret = $this->generateSecret();

        Cache::put(self::SETUP_CACHE_PREFIX.$user->id, Crypt::encryptString($secret), now()->addMinutes(15));

        return [
            'secret' => $secret,
            'qr_code' => $this->buildQrCodeDataUri($user, $secret),
            'manual_entry_key' => $secret,
        ];
    }

    public function confirmSetup(User $user, string $code): array
    {
        $secret = $this->pullSetupSecret($user->id);
        if (! $secret) {
            throw new \RuntimeException('Two-factor setup expired. Please start again.');
        }

        if (! $this->verifyCodeForSecret($secret, $code)) {
            throw new \InvalidArgumentException('Invalid authenticator code.');
        }

        $recoveryCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_secret' => Crypt::encryptString($secret),
            'two_factor_recovery_codes' => Crypt::encryptString(json_encode($this->hashRecoveryCodes($recoveryCodes))),
            'two_factor_confirmed_at' => now(),
        ])->save();

        return [
            'recovery_codes' => $recoveryCodes,
        ];
    }

    public function disable(User $user, string $code): void
    {
        if (! $this->verifyUserCode($user, $code)) {
            throw new \InvalidArgumentException('Invalid authenticator or recovery code.');
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        Cache::forget(self::SETUP_CACHE_PREFIX.$user->id);
    }

    public function regenerateRecoveryCodes(User $user, string $code): array
    {
        if (! $this->isEnabled($user)) {
            throw new \RuntimeException('Two-factor authentication is not enabled.');
        }

        if (! $this->verifyUserCode($user, $code)) {
            throw new \InvalidArgumentException('Invalid authenticator or recovery code.');
        }

        $recoveryCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => Crypt::encryptString(json_encode($this->hashRecoveryCodes($recoveryCodes))),
        ])->save();

        return $recoveryCodes;
    }

    public function verifyUserCode(User $user, string $code): bool
    {
        $normalized = $this->normalizeCode($code);

        if ($this->isRecoveryCodeFormat($normalized)) {
            return $this->consumeRecoveryCode($user, $normalized);
        }

        $secret = $this->decryptSecret($user->two_factor_secret);
        if (! $secret) {
            return false;
        }

        return $this->verifyCodeForSecret($secret, $normalized);
    }

    public function createLoginChallenge(User $user, array $deviceMeta = []): string
    {
        $token = Str::random(64);

        Cache::put(self::CHALLENGE_CACHE_PREFIX.$token, [
            'user_id' => $user->id,
            'device_meta' => $deviceMeta,
        ], now()->addMinutes(5));

        return $token;
    }

    public function resolveLoginChallenge(string $challengeToken): ?array
    {
        $payload = Cache::get(self::CHALLENGE_CACHE_PREFIX.$challengeToken);
        if (! is_array($payload) || empty($payload['user_id'])) {
            return null;
        }

        return $payload;
    }

    public function forgetLoginChallenge(string $challengeToken): void
    {
        Cache::forget(self::CHALLENGE_CACHE_PREFIX.$challengeToken);
    }

    private function pullSetupSecret(int $userId): ?string
    {
        $encrypted = Cache::pull(self::SETUP_CACHE_PREFIX.$userId);
        if (! $encrypted) {
            return null;
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    private function decryptSecret(?string $encrypted): ?string
    {
        if (! $encrypted) {
            return null;
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    private function verifyCodeForSecret(string $secret, string $code): bool
    {
        $normalized = $this->normalizeCode($code);
        if ($normalized === '' || strlen($normalized) !== 6) {
            return false;
        }

        return $this->google2fa->verifyKey($secret, $normalized);
    }

    private function buildQrCodeDataUri(User $user, string $secret): string
    {
        $issuer = rawurlencode(config('app.name', 'Fit & Sleek'));
        $label = rawurlencode($user->email);
        $otpauth = "otpauth://totp/{$issuer}:{$label}?secret={$secret}&issuer={$issuer}&digits=6";

        $qrCode = QrCode::create($otpauth)
            ->setEncoding(new Encoding('UTF-8'))
            ->setSize(220)
            ->setMargin(8)
            ->setForegroundColor(new Color(15, 23, 42))
            ->setBackgroundColor(new Color(255, 255, 255));

        $result = (new PngWriter())->write($qrCode);

        return 'data:image/png;base64,'.base64_encode($result->getString());
    }

    /** @return list<string> */
    private function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $codes[] = strtoupper(Str::random(4).'-'.Str::random(4));
        }

        return $codes;
    }

    /** @param list<string> $codes */
    private function hashRecoveryCodes(array $codes): array
    {
        return array_map(fn (string $code) => Hash::make(str_replace('-', '', strtoupper($code))), $codes);
    }

    private function consumeRecoveryCode(User $user, string $code): bool
    {
        $encrypted = $user->two_factor_recovery_codes;
        if (! $encrypted) {
            return false;
        }

        try {
            $hashed = json_decode(Crypt::decryptString($encrypted), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($hashed)) {
            return false;
        }

        $plain = str_replace('-', '', strtoupper($code));
        $remaining = [];
        $matched = false;

        foreach ($hashed as $hash) {
            if (! $matched && Hash::check($plain, (string) $hash)) {
                $matched = true;
                continue;
            }
            $remaining[] = $hash;
        }

        if (! $matched) {
            return false;
        }

        $user->forceFill([
            'two_factor_recovery_codes' => Crypt::encryptString(json_encode(array_values($remaining))),
        ])->save();

        return true;
    }

    private function normalizeCode(string $code): string
    {
        return preg_replace('/\s+/', '', trim($code)) ?? '';
    }

    private function isRecoveryCodeFormat(string $code): bool
    {
        $upper = strtoupper($code);

        return (bool) preg_match('/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/', $upper);
    }
}
