<?php

namespace App\Services;

use App\Models\SecurityAuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class SecurityAuditService
{
    public function __construct(
        private DeviceSessionService $deviceSessionService,
        private IpGeolocationService $ipGeolocation,
    ) {
    }

    public function record(Request $request, string $eventType, ?User $user = null, array $metadata = []): SecurityAuditLog
    {
        $context = $this->deviceSessionService->resolveDeviceContext($request);
        $geo = $context['geo'] ?? null;

        $log = SecurityAuditLog::create([
            'user_id' => $user?->id,
            'event_type' => $eventType,
            'ip_address' => $context['ip_address'] ?? null,
            'ip_city' => $geo['city'] ?? null,
            'ip_region' => $geo['region'] ?? null,
            'ip_country' => $geo['country'] ?? null,
            'ip_country_code' => $geo['country_code'] ?? null,
            'device_id' => $context['device_id'] ?? null,
            'device_name' => $context['device_name'] ?? null,
            'browser' => $context['browser'] ?? null,
            'os' => $context['os'] ?? null,
            'metadata' => $metadata !== [] ? $metadata : null,
            'created_at' => now(),
        ]);

        if ($user && $this->isLoginEvent($eventType)) {
            $this->maybeRecordSuspiciousCountryChange($user, $log, $metadata);
        }

        return $log;
    }

    public function mailContextFromDevice(array $context): array
    {
        $geo = $context['geo'] ?? null;
        $location = $this->ipGeolocation->formatLocation($geo);

        return [
            'time' => now()->toDateTimeString(),
            'device_name' => $context['device_name'] ?? 'Unknown device',
            'browser' => $context['browser'] ?? 'Unknown browser',
            'os' => $context['os'] ?? 'Unknown OS',
            'ip_address' => $context['ip_address'] ?? 'Unknown IP',
            'location' => $location,
            'ip_city' => $geo['city'] ?? null,
            'ip_country' => $geo['country'] ?? null,
        ];
    }

    private function isLoginEvent(string $eventType): bool
    {
        return str_starts_with($eventType, 'login.');
    }

    private function maybeRecordSuspiciousCountryChange(User $user, SecurityAuditLog $current, array $metadata): void
    {
        if (! empty($metadata['suspicious'])) {
            return;
        }

        $currentCode = $current->ip_country_code;
        if (! $currentCode) {
            return;
        }

        $previous = SecurityAuditLog::query()
            ->where('user_id', $user->id)
            ->where('id', '<', $current->id)
            ->whereIn('event_type', [
                'login.success',
                'login.trusted_device',
                'login.new_device',
            ])
            ->whereNotNull('ip_country_code')
            ->orderByDesc('id')
            ->first();

        if (! $previous || $previous->ip_country_code === $currentCode) {
            return;
        }

        SecurityAuditLog::create([
            'user_id' => $user->id,
            'event_type' => 'login.suspicious_country',
            'ip_address' => $current->ip_address,
            'ip_city' => $current->ip_city,
            'ip_region' => $current->ip_region,
            'ip_country' => $current->ip_country,
            'ip_country_code' => $current->ip_country_code,
            'device_id' => $current->device_id,
            'device_name' => $current->device_name,
            'browser' => $current->browser,
            'os' => $current->os,
            'metadata' => [
                'previous_country_code' => $previous->ip_country_code,
                'previous_country' => $previous->ip_country,
                'previous_at' => optional($previous->created_at)?->toDateTimeString(),
            ],
            'created_at' => now(),
        ]);
    }
}
