<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDeviceSession;
use App\Models\UserTrustedDevice;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class DeviceSessionService
{
    public function __construct(private IpGeolocationService $ipGeolocation)
    {
    }

    public function trustedDeviceTtlDays(): int
    {
        return max(1, (int) config('auth.device_trust_days', 90));
    }

    /**
     * Device completed login verification recently — skip OTP / 2FA picker on this device.
     */
    public function isTrustedDevice(User $user, Request $request): bool
    {
        $context = $this->resolveDeviceContext($request);
        $deviceId = (string) ($context['device_id'] ?? '');
        if ($deviceId === '') {
            return false;
        }

        $trusted = $this->findTrustedDeviceRecord($user, $deviceId);
        if ($trusted) {
            return $this->trustedRecordIsValid($trusted);
        }

        $session = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->whereNotNull('device_verified_at')
            ->orderByDesc('device_verified_at')
            ->first();

        if ($session && $this->sessionTrustIsValid($session)) {
            $this->persistTrustedDevice($user, $deviceId, $context, $session->device_verified_at ?? now());

            return true;
        }

        foreach ($this->legacyDeviceIdCandidates($request, $deviceId) as $legacyId) {
            $trusted = $this->findTrustedDeviceRecord($user, $legacyId);
            if ($trusted && $this->trustedRecordIsValid($trusted)) {
                $this->migrateTrustedDeviceId($user, $legacyId, $deviceId, $context);

                return true;
            }

            $session = UserDeviceSession::query()
                ->where('user_id', $user->id)
                ->where('device_id', $legacyId)
                ->whereNotNull('device_verified_at')
                ->orderByDesc('device_verified_at')
                ->first();

            if ($session && $this->sessionTrustIsValid($session)) {
                $this->persistTrustedDevice($user, $deviceId, $context, $session->device_verified_at ?? now());

                return true;
            }
        }

        return false;
    }

    public function markDeviceVerified(User $user, Request $request): void
    {
        $context = $this->resolveDeviceContext($request);
        $deviceId = (string) ($context['device_id'] ?? '');
        if ($deviceId === '') {
            return;
        }

        $now = now();

        $this->persistTrustedDevice($user, $deviceId, $context, $now);

        UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->update([
                'device_verified_at' => $now,
                'last_login_at' => $now,
                'last_used_at' => $now,
            ]);
    }

    public function touchTrustedDevice(User $user, Request $request): void
    {
        $context = $this->resolveDeviceContext($request);
        $deviceId = (string) ($context['device_id'] ?? '');
        if ($deviceId === '') {
            return;
        }

        $now = now();

        UserTrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->update([
                'last_seen_at' => $now,
                'device_name' => $context['device_name'] ?: null,
                'browser' => $context['browser'] ?: null,
                'os' => $context['os'] ?: null,
            ]);
    }

    private function findTrustedDeviceRecord(User $user, string $deviceId): ?UserTrustedDevice
    {
        return UserTrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->first();
    }

    private function trustedRecordIsValid(UserTrustedDevice $trusted): bool
    {
        $lastActivity = collect([
            $trusted->verified_at,
            $trusted->last_seen_at,
        ])->filter()->max();

        if (! $lastActivity) {
            return false;
        }

        return $lastActivity->copy()->addDays($this->trustedDeviceTtlDays())->isFuture();
    }

    private function sessionTrustIsValid(UserDeviceSession $session): bool
    {
        $lastActivity = collect([
            $session->device_verified_at,
            $session->last_login_at,
            $session->last_used_at,
        ])->filter()->max();

        if (! $lastActivity) {
            return false;
        }

        return $lastActivity->copy()->addDays($this->trustedDeviceTtlDays())->isFuture();
    }

    private function persistTrustedDevice(User $user, string $deviceId, array $context, $verifiedAt): void
    {
        $now = now();

        UserTrustedDevice::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'device_id' => $deviceId,
            ],
            [
                'verified_at' => $verifiedAt,
                'last_seen_at' => $now,
                'device_name' => $context['device_name'] ?? null,
                'browser' => $context['browser'] ?? null,
                'os' => $context['os'] ?? null,
            ]
        );
    }

    private function migrateTrustedDeviceId(User $user, string $fromId, string $toId, array $context): void
    {
        if ($fromId === $toId) {
            return;
        }

        $existing = $this->findTrustedDeviceRecord($user, $fromId);
        if (! $existing) {
            return;
        }

        $this->persistTrustedDevice($user, $toId, $context, $existing->verified_at);
        $existing->delete();

        UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $fromId)
            ->update(['device_id' => $toId]);
    }

    /** @return list<string> */
    private function legacyDeviceIdCandidates(Request $request, string $currentDeviceId): array
    {
        $candidates = [];

        $fallbackId = substr(sha1(($request->userAgent() ?: 'unknown').($request->ip() ?: '0.0.0.0')), 0, 120);
        if ($fallbackId !== '' && $fallbackId !== $currentDeviceId) {
            $candidates[] = $fallbackId;
        }

        return $candidates;
    }

    private function deviceWasVerifiedBefore(User $user, string $deviceId): bool
    {
        if ($this->findTrustedDeviceRecord($user, $deviceId)) {
            return true;
        }

        return UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->whereNotNull('device_verified_at')
            ->exists();
    }

    private function findSessionForToken(User $user, PersonalAccessToken $token): ?UserDeviceSession
    {
        return UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('personal_access_token_id', $token->id)
            ->first();
    }

    /** @return \Illuminate\Support\Collection<int, UserDeviceSession> */
    private function findSessionsForPhysicalDevice(User $user, array $context): \Illuminate\Support\Collection
    {
        $deviceId = (string) ($context['device_id'] ?? '');

        return UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where(function ($query) use ($deviceId, $context) {
                if ($deviceId !== '') {
                    $query->where('device_id', $deviceId);
                    $this->applyPhysicalDeviceFingerprintScope($query, $context, 'or');
                    return;
                }

                $this->applyPhysicalDeviceFingerprintScope($query, $context, 'and');
            })
            ->orderByDesc('last_used_at')
            ->orderByDesc('last_login_at')
            ->get();
    }

    private function applyPhysicalDeviceFingerprintScope($query, array $context, string $boolean = 'or'): void
    {
        $browser = trim((string) ($context['browser'] ?? ''));
        $os = trim((string) ($context['os'] ?? ''));
        $deviceName = trim((string) ($context['device_name'] ?? ''));

        if ($browser === '' || $os === '') {
            return;
        }

        $method = $boolean === 'and' ? 'where' : 'orWhere';

        $query->{$method}(function ($inner) use ($browser, $os, $deviceName) {
            $inner->where('browser', $browser)->where('os', $os);
            if ($deviceName !== '') {
                $inner->where('device_name', $deviceName);
            }
        });
    }

    private function canMigrateToFrontendDeviceId(Request $request, array $context, ?UserDeviceSession $existingSession): bool
    {
        if (!$existingSession) {
            return false;
        }

        $hasExplicitDeviceHeader = (string) $request->header('X-Device-ID', '') !== '';
        $incomingDeviceId = (string) ($context['device_id'] ?? '');

        $incomingLooksFrontendId = str_starts_with($incomingDeviceId, 'dev_');
        $existingLooksFallbackId = !str_starts_with((string) $existingSession->device_id, 'dev_');

        return $hasExplicitDeviceHeader && $incomingLooksFrontendId && $existingLooksFallbackId;
    }

    private function migrateSessionDevice(UserDeviceSession $session, array $context): UserDeviceSession
    {
        $session->update(array_merge([
            'device_id' => (string) $context['device_id'],
            'last_used_at' => now(),
            'last_login_at' => $session->last_login_at ?: now(),
            'ip_address' => $context['ip_address'],
            'user_agent' => $context['user_agent'],
            'device_name' => $context['device_name'] ?: $session->device_name,
            'browser' => $context['browser'] ?: $session->browser,
            'os' => $context['os'] ?: $session->os,
        ], $this->geoSessionAttributes($context)));

        return $session->fresh();
    }

    public function resolveDeviceContext(Request $request): array
    {
        $deviceId = (string) ($request->header('X-Device-ID') ?: $request->input('device_id') ?: '');
        if ($deviceId === '') {
            $deviceId = sha1(($request->userAgent() ?: 'unknown').($request->ip() ?: '0.0.0.0'));
        }

        $ip = $request->ip();
        $geo = $this->ipGeolocation->lookup($ip);

        return [
            'device_id' => substr($deviceId, 0, 120),
            'device_name' => substr((string) $request->header('X-Device-Name', ''), 0, 190) ?: null,
            'browser' => substr((string) $request->header('X-Device-Browser', ''), 0, 120) ?: null,
            'os' => substr((string) $request->header('X-Device-OS', ''), 0, 120) ?: null,
            'user_agent' => $request->userAgent(),
            'ip_address' => $ip,
            'geo' => $geo,
        ];
    }

    /** @return array<string, mixed> */
    private function geoSessionAttributes(array $context): array
    {
        $geo = $context['geo'] ?? null;
        if (! is_array($geo)) {
            return [];
        }

        return [
            'ip_city' => $geo['city'] ?? null,
            'ip_region' => $geo['region'] ?? null,
            'ip_country' => $geo['country'] ?? null,
            'ip_country_code' => $geo['country_code'] ?? null,
        ];
    }

    public function bindTokenToDevice(User $user, PersonalAccessToken $token, Request $request): array
    {
        $context = $this->resolveDeviceContext($request);
        $deviceId = (string) $context['device_id'];

        $relatedSessions = $this->findSessionsForPhysicalDevice($user, $context);
        $hadVerifiedBefore = $relatedSessions->contains(
            fn (UserDeviceSession $session) => $session->device_verified_at !== null
        ) || $this->deviceWasVerifiedBefore($user, $deviceId);

        $verifiedAt = $relatedSessions
            ->pluck('device_verified_at')
            ->filter()
            ->max();

        $canonical = $relatedSessions->sortByDesc(fn (UserDeviceSession $session) => $session->last_used_at?->timestamp ?? 0)
            ->first();

        foreach ($relatedSessions as $related) {
            $oldTokenId = (int) $related->personal_access_token_id;
            if ($oldTokenId > 0 && $oldTokenId !== (int) $token->id) {
                PersonalAccessToken::query()->where('id', $oldTokenId)->delete();
            }
        }

        $existing = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->first();

        if (
            $existing
            && $existing->ip_address
            && $existing->ip_address !== $context['ip_address']
        ) {
            UserDeviceSession::query()->create(array_merge([
                'user_id' => $user->id,
                'device_id' => $deviceId.'_hist_'.substr(sha1($existing->ip_address.($existing->last_used_at ?? now())), 0, 10),
                'personal_access_token_id' => null,
                'device_name' => $existing->device_name,
                'browser' => $existing->browser,
                'os' => $existing->os,
                'user_agent' => $existing->user_agent,
                'ip_address' => $existing->ip_address,
                'device_verified_at' => $existing->device_verified_at,
                'last_login_at' => $existing->last_login_at,
                'last_used_at' => $existing->last_used_at,
            ], array_filter([
                'ip_city' => $existing->ip_city,
                'ip_region' => $existing->ip_region,
                'ip_country' => $existing->ip_country,
                'ip_country_code' => $existing->ip_country_code,
            ])));
        }

        $session = UserDeviceSession::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'device_id' => $deviceId,
            ],
            array_merge([
                'personal_access_token_id' => $token->id,
                'device_name' => $context['device_name'] ?: $canonical?->device_name,
                'browser' => $context['browser'] ?: $canonical?->browser,
                'os' => $context['os'] ?: $canonical?->os,
                'user_agent' => $context['user_agent'],
                'ip_address' => $context['ip_address'],
                'device_verified_at' => $verifiedAt,
                'last_login_at' => now(),
                'last_used_at' => now(),
            ], $this->geoSessionAttributes($context))
        );

        UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('id', '!=', $session->id)
            ->where(function ($query) use ($deviceId, $context) {
                $query->where('device_id', $deviceId);
                $this->applyPhysicalDeviceFingerprintScope($query, $context);
            })
            ->update(['personal_access_token_id' => null]);

        return [
            'session' => $session->fresh(),
            'is_new_device' => ! $hadVerifiedBefore,
            'context' => $context,
        ];
    }

    public function validateCurrentTokenBinding(Request $request, User $user, PersonalAccessToken $token): ?UserDeviceSession
    {
        $context = $this->resolveDeviceContext($request);
        $session = $this->findSessionForToken($user, $token);

        if (! $session) {
            $session = UserDeviceSession::query()
                ->where('user_id', $user->id)
                ->where('device_id', (string) $context['device_id'])
                ->first();

            if (! $session) {
                $session = $this->findSessionsForPhysicalDevice($user, $context)->first();
            }

            if ($session) {
                $session->update(array_merge([
                    'personal_access_token_id' => $token->id,
                    'device_id' => (string) $context['device_id'],
                    'last_used_at' => now(),
                    'ip_address' => $context['ip_address'],
                    'user_agent' => $context['user_agent'],
                    'device_name' => $context['device_name'] ?: $session->device_name,
                    'browser' => $context['browser'] ?: $session->browser,
                    'os' => $context['os'] ?: $session->os,
                ], $this->geoSessionAttributes($context)));

                return $session->fresh();
            }

            $binding = $this->bindTokenToDevice($user, $token, $request);

            return $binding['session'] ?? null;
        }

        if ((string) $session->device_id !== (string) $context['device_id']) {
            if ($this->canMigrateToFrontendDeviceId($request, $context, $session)) {
                return $this->migrateSessionDevice($session, $context);
            }

            return null;
        }

        $session->update(array_merge([
            'last_used_at' => now(),
            'ip_address' => $context['ip_address'],
            'user_agent' => $context['user_agent'],
            'device_name' => $context['device_name'] ?: $session->device_name,
            'browser' => $context['browser'] ?: $session->browser,
            'os' => $context['os'] ?: $session->os,
        ], $this->geoSessionAttributes($context)));

        return $session;
    }

    /**
     * User removed a device from their account — require OTP/2FA on next login from that device.
     */
    public function revokeTrustedDevice(User $user, string $deviceId): void
    {
        if ($deviceId === '') {
            return;
        }

        UserTrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->delete();

        UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->update(['device_verified_at' => null]);
    }

    /**
     * Revoke one login session. Logout uses token delete only and keeps device trust.
     */
    public function revokeSession(UserDeviceSession $session): void
    {
        $user = $session->user;
        $deviceId = (string) $session->device_id;
        $hadActiveToken = (int) $session->personal_access_token_id > 0;

        if ($hadActiveToken) {
            PersonalAccessToken::query()->where('id', $session->personal_access_token_id)->delete();
        }

        $session->delete();

        if ($hadActiveToken && $user && $deviceId !== '') {
            $stillActive = UserDeviceSession::query()
                ->where('user_id', $user->id)
                ->where('device_id', $deviceId)
                ->whereNotNull('personal_access_token_id')
                ->exists();

            if (! $stillActive) {
                $this->revokeTrustedDevice($user, $deviceId);
            }
        }
    }
}
