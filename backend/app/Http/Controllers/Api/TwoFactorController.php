<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NewDeviceLoginAlertMail;
use App\Models\User;
use App\Services\DeviceSessionService;
use App\Services\SecurityAuditService;
use App\Services\TwoFactorService;
use App\Services\VerificationChallengeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\PersonalAccessToken;

class TwoFactorController extends Controller
{
    public function __construct(
        private TwoFactorService $twoFactor,
        private DeviceSessionService $deviceSessionService,
        private VerificationChallengeService $verificationChallenge,
        private SecurityAuditService $securityAudit,
    ) {
    }

    public function status(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $this->twoFactor->isEnabled($user),
            'confirmed_at' => optional($user->two_factor_confirmed_at)?->toDateTimeString(),
            'preferred_method' => $user->two_factor_preferred_method ?? 'email',
        ]);
    }

    public function updatePreferredMethod(Request $request)
    {
        $data = $request->validate([
            'method' => ['required', 'in:email,authenticator'],
        ]);

        $user = $request->user();

        if ($data['method'] === 'authenticator' && ! $this->twoFactor->isEnabled($user)) {
            return response()->json([
                'message' => 'Enable authenticator app first before setting it as default.',
            ], 422);
        }

        $user->forceFill([
            'two_factor_preferred_method' => $data['method'],
        ])->save();

        return response()->json([
            'message' => 'Default verification method updated.',
            'preferred_method' => $user->two_factor_preferred_method,
        ]);
    }

    public function setup(Request $request)
    {
        $user = $request->user();

        if ($this->twoFactor->isEnabled($user)) {
            return response()->json([
                'message' => 'Two-factor authentication is already enabled. Disable it first to set up again.',
            ], 422);
        }

        $payload = $this->twoFactor->beginSetup($user);

        return response()->json([
            'message' => 'Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.',
            ...$payload,
        ]);
    }

    public function confirm(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'min:6', 'max:12'],
        ]);

        $user = $request->user();

        try {
            $result = $this->twoFactor->confirmSetup($user, $data['code']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Two-factor authentication enabled.',
            'enabled' => true,
            'recovery_codes' => $result['recovery_codes'],
        ]);
    }

    public function disable(Request $request)
    {
        $user = $request->user();

        if (! $this->twoFactor->isEnabled($user)) {
            return response()->json(['message' => 'Two-factor authentication is not enabled.'], 422);
        }

        $rules = [
            'code' => ['required', 'string', 'min:6', 'max:12'],
        ];

        if (! empty($user->password)) {
            $rules['password'] = ['required', 'string'];
        }

        $data = $request->validate($rules);

        if (! empty($user->password) && ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        try {
            $this->twoFactor->disable($user, $data['code']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Two-factor authentication disabled.',
            'enabled' => false,
        ]);
    }

    public function regenerateRecoveryCodes(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'min:6', 'max:12'],
        ]);

        $user = $request->user();

        try {
            $codes = $this->twoFactor->regenerateRecoveryCodes($user, $data['code']);
        } catch (\InvalidArgumentException|\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Recovery codes regenerated. Store them in a safe place.',
            'recovery_codes' => $codes,
        ]);
    }

    public function challenge(Request $request)
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['required', 'string', 'min:6', 'max:12'],
            'device_id' => ['nullable', 'string', 'max:190'],
            'device_name' => ['nullable', 'string', 'max:190'],
            'platform' => ['nullable', 'string', 'max:80'],
            'app_version' => ['nullable', 'string', 'max:40'],
        ]);

        $verificationPayload = $this->verificationChallenge->get($data['challenge_token']);
        if ($verificationPayload) {
            return $this->completeVerificationChallengeAuthenticator(
                $data['challenge_token'],
                $verificationPayload,
                $data['code'],
                $request
            );
        }

        $payload = $this->twoFactor->resolveLoginChallenge($data['challenge_token']);
        if (! $payload) {
            return response()->json(['message' => 'Two-factor challenge expired. Please login again.'], 422);
        }

        $user = User::query()->find($payload['user_id']);
        if (! $user || $user->status !== 'active') {
            return response()->json(['message' => 'Account is not active.'], 403);
        }

        if (! $this->twoFactor->verifyUserCode($user, $data['code'])) {
            return response()->json(['message' => 'Invalid authenticator or recovery code.'], 422);
        }

        $this->twoFactor->forgetLoginChallenge($data['challenge_token']);

        $token = $this->issueDeviceBoundToken($user, 'fitandsleekpro', $request, markTrusted: true);

        return response()->json([
            'token' => $token,
            'user' => $user->fresh(),
            'device_verified' => true,
        ]);
    }

    private function completeVerificationChallengeAuthenticator(
        string $challengeToken,
        array $payload,
        string $code,
        Request $request
    ) {
        if (($payload['method'] ?? '') !== 'authenticator') {
            return response()->json(['message' => 'Use the verification method you selected.'], 422);
        }

        $user = User::query()->find($payload['user_id'] ?? 0);
        if (! $user) {
            return response()->json(['message' => 'Account not found.'], 404);
        }

        if (! $this->twoFactor->verifyUserCode($user, $code)) {
            return response()->json(['message' => 'Invalid authenticator or recovery code.'], 422);
        }

        if (($payload['purpose'] ?? '') === 'forgot') {
            $this->verificationChallenge->markVerified($challengeToken);

            return response()->json([
                'verified' => true,
                'challenge_token' => $challengeToken,
                'message' => 'Identity verified. You can set a new password.',
            ]);
        }

        if (($payload['purpose'] ?? '') === 'register') {
            $user->update([
                'email_verified_at' => now(),
                'status' => 'active',
            ]);
        } elseif ($user->status !== 'active') {
            return response()->json(['message' => 'Account is not active.'], 403);
        }

        $this->verificationChallenge->forget($challengeToken);
        $token = $this->issueDeviceBoundToken($user, 'fitandsleekpro', $request, markTrusted: true);

        return response()->json([
            'token' => $token,
            'user' => $user->fresh(),
            'device_verified' => true,
        ]);
    }

    private function issueDeviceBoundToken(
        User $user,
        string $tokenName,
        Request $request,
        bool $markTrusted = true,
    ): string {
        $plainTextToken = $user->createToken($tokenName, ['*'], now()->addMonths(6))->plainTextToken;
        $tokenId = (int) explode('|', $plainTextToken, 2)[0];
        $tokenModel = PersonalAccessToken::query()->find($tokenId);

        if ($tokenModel) {
            $binding = $this->deviceSessionService->bindTokenToDevice($user, $tokenModel, $request);

            if ($markTrusted) {
                $this->deviceSessionService->markDeviceVerified($user, $request);
            }

            $event = $binding['is_new_device'] ? 'login.new_device' : 'login.success';
            $this->securityAudit->record($request, $event, $user, [
                'token_name' => $tokenName,
                'new_device' => $binding['is_new_device'],
            ]);

            if ($binding['is_new_device']) {
                Mail::to($user->email)->send(new NewDeviceLoginAlertMail(
                    $this->securityAudit->mailContextFromDevice($binding['context'])
                ));
            }
        }

        return $plainTextToken;
    }
}
