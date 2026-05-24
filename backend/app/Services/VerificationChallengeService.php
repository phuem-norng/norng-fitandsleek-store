<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class VerificationChallengeService
{
    private const CACHE_PREFIX = 'verification_challenge:';

    public function __construct(private TwoFactorService $twoFactor)
    {
    }

    public function create(User $user, string $purpose, array $deviceMeta = []): string
    {
        $token = Str::random(64);

        Cache::put(self::CACHE_PREFIX.$token, [
            'user_id' => $user->id,
            'purpose' => $purpose,
            'method' => null,
            'verified_at' => null,
            'device_meta' => $deviceMeta,
        ], now()->addMinutes(10));

        return $token;
    }

    public function get(string $token): ?array
    {
        $payload = Cache::get(self::CACHE_PREFIX.$token);

        return is_array($payload) ? $payload : null;
    }

    public function forget(string $token): void
    {
        Cache::forget(self::CACHE_PREFIX.$token);
    }

    public function setMethod(string $token, string $method): ?array
    {
        $payload = $this->get($token);
        if (! $payload) {
            return null;
        }

        $payload['method'] = $method;
        Cache::put(self::CACHE_PREFIX.$token, $payload, now()->addMinutes(10));

        return $payload;
    }

    public function markVerified(string $token): ?array
    {
        $payload = $this->get($token);
        if (! $payload) {
            return null;
        }

        $payload['verified_at'] = now()->toDateTimeString();
        Cache::put(self::CACHE_PREFIX.$token, $payload, now()->addMinutes(15));

        return $payload;
    }

    /** @return list<array{type: string, label: string, description: string, recommended: bool}> */
    public function availableMethods(User $user): array
    {
        $methods = [
            [
                'type' => 'email',
                'label' => 'Email code',
                'description' => 'Send a 6-digit code to '.$this->maskEmail($user->email),
                'recommended' => ($user->two_factor_preferred_method ?? 'email') === 'email',
            ],
        ];

        if ($this->twoFactor->isEnabled($user)) {
            $methods[] = [
                'type' => 'authenticator',
                'label' => 'Authenticator app',
                'description' => 'Use Google Authenticator, Authy, or similar',
                'recommended' => $user->two_factor_preferred_method === 'authenticator',
            ];
        }

        return $methods;
    }

    public function resolveUser(string $token): ?User
    {
        $payload = $this->get($token);
        if (! $payload || empty($payload['user_id'])) {
            return null;
        }

        return User::query()->find($payload['user_id']);
    }

    public function isMethodAllowed(User $user, string $method): bool
    {
        if ($method === 'email') {
            return true;
        }

        if ($method === 'authenticator') {
            return $this->twoFactor->isEnabled($user);
        }

        return false;
    }

    private function maskEmail(string $email): string
    {
        if (! str_contains($email, '@')) {
            return '***';
        }

        [$local, $domain] = explode('@', $email, 2);
        $visible = mb_substr($local, 0, 1);
        $maskedLocal = strlen($local) > 1 ? $visible.'***' : $visible.'*';

        return $maskedLocal.'@'.$domain;
    }
}
