<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserDeviceSession;
use App\Models\UserTrustedDevice;
use App\Services\DeviceSessionService;
use App\Services\SecurityAuditService;
use Illuminate\Http\Request;

class AuthSessionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user?->currentAccessToken()?->id;

        $trustedDeviceIds = UserTrustedDevice::query()
            ->where('user_id', $user->id)
            ->pluck('device_id')
            ->all();

        $sessions = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_used_at')
            ->orderByDesc('last_login_at')
            ->get()
            ->map(function (UserDeviceSession $session) use ($currentTokenId, $trustedDeviceIds) {
                return [
                    'id' => $session->id,
                    'device_id' => $session->device_id,
                    'is_trusted' => in_array($session->device_id, $trustedDeviceIds, true),
                    'device_name' => $session->device_name,
                    'browser' => $session->browser,
                    'os' => $session->os,
                    'ip_address' => $session->ip_address,
                    'location' => collect([$session->ip_city, $session->ip_region, $session->ip_country])->filter()->unique()->implode(', ') ?: null,
                    'ip_city' => $session->ip_city,
                    'ip_country' => $session->ip_country,
                    'last_login_at' => optional($session->last_login_at)?->toDateTimeString(),
                    'last_used_at' => optional($session->last_used_at)?->toDateTimeString(),
                    'created_at' => optional($session->created_at)?->toDateTimeString(),
                    'is_current' => (int) $session->personal_access_token_id === (int) $currentTokenId,
                ];
            })
            ->values();

        return response()->json([
            'message' => 'Active sessions retrieved',
            'data' => $sessions,
        ]);
    }

    public function destroy(
        Request $request,
        UserDeviceSession $session,
        DeviceSessionService $deviceSessionService,
        SecurityAuditService $securityAudit,
    ) {
        $user = $request->user();

        if ((int) $session->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        $currentTokenId = $user?->currentAccessToken()?->id;
        $isCurrent = (int) $session->personal_access_token_id === (int) $currentTokenId;
        $deviceId = (string) $session->device_id;

        $deviceSessionService->revokeSession($session);

        $securityAudit->record($request, 'device.revoked', $user, [
            'device_id' => $deviceId,
            'current_session' => $isCurrent,
        ]);

        return response()->json([
            'message' => $isCurrent
                ? 'Device removed. You will need to verify again on next login from this device.'
                : 'Device removed. It will need verification on next login.',
            'current_session_revoked' => $isCurrent,
        ]);
    }
}
