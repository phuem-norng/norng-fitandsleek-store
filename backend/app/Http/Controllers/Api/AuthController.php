<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\NewDeviceLoginAlertMail;
use App\Mail\OtpCodeMail;
use App\Models\OtpCode;
use App\Models\User;
use App\Models\UserDeviceSession;
use App\Services\DeviceSessionService;
use App\Services\SecurityAuditService;
use App\Services\TwoFactorService;
use App\Services\VerificationChallengeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
  public function __construct(
    private DeviceSessionService $deviceSessionService,
    private TwoFactorService $twoFactor,
    private VerificationChallengeService $verificationChallenge,
    private SecurityAuditService $securityAudit,
  ) {
  }

  public function register(Request $request)
  {
    $data = $request->validate([
      'name' => ['required','string','max:120'],
      'email' => ['required','email','max:190','unique:users,email'],
      'phone' => ['nullable','string','max:30'],
      'password' => ['required', 'confirmed', PasswordRule::min(8)],
    ]);

    $user = User::create([
      'name' => $data['name'],
      'email' => $data['email'],
      'password' => Hash::make($data['password']),
      'role' => 'customer',
      'phone' => $data['phone'] ?? null,
      'status' => 'pending',
      'email_verified_at' => null,
    ]);

    $challengeToken = $this->verificationChallenge->create($user, 'register');
    $this->verificationChallenge->setMethod($challengeToken, 'email');
    $otpDelivery = $this->sendOtpCode($user->email, 'register');

    return response()->json(array_merge([
      'message' => $this->otpSentMessage($otpDelivery['email_sent']),
      'verification_required' => true,
      'step' => 'otp',
      'challenge_token' => $challengeToken,
      'verification_methods' => $this->verificationChallenge->availableMethods($user),
      'preferred_method' => $user->two_factor_preferred_method ?? 'email',
      'purpose' => 'register',
    ], $this->otpDeliveryPayload($otpDelivery)), 201);
  }

  public function login(Request $request)
  {
    $data = $request->validate([
      'email' => ['required','email'],
      'password' => ['nullable','string'],
    ]);

    $user = User::where('email', $data['email'])->first();

    if (!$user) {
      return response()->json(['message' => 'Invalid credentials'], 422);
    }

    if (!empty($data['password']) && !Hash::check($data['password'], $user->password)) {
      return response()->json(['message' => 'Invalid credentials'], 422);
    }

    if (! $user->email_verified_at || $user->status !== 'active') {
      if (
        $this->deviceSessionService->isTrustedDevice($user, $request)
        && ! empty($data['password'])
        && Hash::check($data['password'], $user->password)
      ) {
        $user->update([
          'email_verified_at' => $user->email_verified_at ?? now(),
          'status' => 'active',
        ]);
        $user->refresh();
      } else {
        return response()->json(
          $this->beginVerificationChallengeResponse($user, $request, 'register', 'Account not verified. OTP sent to email.'),
          403
        );
      }
    }

    if ($this->deviceSessionService->isTrustedDevice($user, $request)) {
      if (empty($data['password'])) {
        return response()->json(['message' => 'Password is required on this device.'], 422);
      }

      $this->deviceSessionService->touchTrustedDevice($user, $request);
      $token = $this->issueDeviceBoundToken($user, 'fitandsleekpro', $request, markTrusted: false);
      $this->securityAudit->record($request, 'login.trusted_device', $user);

      return response()->json([
        'message' => 'Signed in on a trusted device.',
        'token' => $token,
        'user' => $user,
        'trusted_device' => true,
      ]);
    }

    $this->securityAudit->record($request, 'login.verification_required', $user, [
      'reason' => 'new_or_untrusted_device',
    ]);

    return response()->json(
      $this->beginVerificationChallengeResponse(
        $user,
        $request,
        'login',
        'A verification code was sent to your email.'
      )
    );
  }

  /** @return array<string, mixed> */
  private function beginVerificationChallengeResponse(
    User $user,
    Request $request,
    string $purpose,
    string $message,
  ): array {
    $context = $this->deviceSessionService->resolveDeviceContext($request);
    $deviceMeta = [
      'device_id' => $context['device_id'],
      'device_name' => $context['device_name'],
      'platform' => $request->input('platform'),
      'app_version' => $request->input('app_version'),
    ];
    $challengeToken = $this->verificationChallenge->create($user, $purpose, $deviceMeta);
    $this->verificationChallenge->setMethod($challengeToken, 'email');
    $otpDelivery = $this->sendOtpCode($user->email, $purpose);

    return array_merge([
      'message' => $otpDelivery['email_sent'] ? $message : $this->otpSentMessage(false),
      'verification_required' => true,
      'step' => 'otp',
      'challenge_token' => $challengeToken,
      'verification_methods' => $this->verificationChallenge->availableMethods($user),
      'preferred_method' => $user->two_factor_preferred_method ?? 'email',
      'purpose' => $purpose,
      'device_verification_required' => $purpose === 'login',
    ], $this->otpDeliveryPayload($otpDelivery));
  }

  public function selectVerificationMethod(Request $request)
  {
    $data = $request->validate([
      'challenge_token' => ['required', 'string'],
      'method' => ['required', 'in:email,authenticator'],
    ]);

    $payload = $this->verificationChallenge->get($data['challenge_token']);
    if (! $payload) {
      return response()->json(['message' => 'Verification session expired. Please try again.'], 422);
    }

    $user = $this->verificationChallenge->resolveUser($data['challenge_token']);
    if (! $user) {
      return response()->json(['message' => 'Account not found.'], 404);
    }

    if (! $this->verificationChallenge->isMethodAllowed($user, $data['method'])) {
      return response()->json(['message' => 'This verification method is not available.'], 422);
    }

    $this->verificationChallenge->setMethod($data['challenge_token'], $data['method']);

    $this->securityAudit->record($request, 'login.verification_method', $user, [
      'method' => $data['method'],
      'purpose' => $payload['purpose'] ?? 'login',
    ]);

    if ($data['method'] === 'email') {
      $purpose = $this->otpPurposeForChallenge($payload);
      $otpDelivery = $this->sendOtpCode($user->email, $purpose);

      return response()->json(array_merge([
        'step' => 'otp',
        'email' => $user->email,
        'purpose' => $purpose,
        'message' => $this->otpSentMessage($otpDelivery['email_sent']),
      ], $this->otpDeliveryPayload($otpDelivery)));
    }

    return response()->json([
      'step' => 'authenticator',
      'message' => 'Enter the 6-digit code from your authenticator app (or a recovery code).',
    ]);
  }

  public function verifyOtp(Request $request)
  {
    $data = $request->validate([
      'email' => ['required','email'],
      'code' => ['required','string','min:4','max:12'],
      'purpose' => ['required','in:register,login,forgot'],
      'challenge_token' => ['nullable', 'string'],
    ]);

    $otp = OtpCode::where('email', $data['email'])
      ->where('purpose', $data['purpose'])
      ->whereNull('consumed_at')
      ->where('expires_at', '>', now())
      ->latest('id')
      ->first();

    if (!$otp) {
      return response()->json(['message' => 'OTP expired or not found'], 422);
    }


    $otp->increment('attempts');

    if (!Hash::check($data['code'], $otp->code_hash)) {
      return response()->json(['message' => 'Invalid OTP'], 422);
    }

    // Only consume OTP if not 'forgot' purpose
    if ($data['purpose'] !== 'forgot') {
      $otp->update(['consumed_at' => now()]);
    }

    $user = User::where('email', $data['email'])->first();
    if (!$user) {
      return response()->json(['message' => 'User not found'], 404);
    }

  if (empty($data['challenge_token'])) {
    if ($data['purpose'] === 'register') {
      $user->update([
        'email_verified_at' => now(),
        'status' => 'active',
      ]);
    }

    if ($data['purpose'] !== 'forgot' && $user->status !== 'active') {
      return response()->json(['message' => 'Account is not active'], 403);
    }
  }

    if (! empty($data['challenge_token'])) {
      $payload = $this->verificationChallenge->get($data['challenge_token']);
      $expectedPurpose = is_array($payload) ? ($payload['purpose'] ?? $data['purpose']) : $data['purpose'];

      return $this->completeVerificationChallenge(
        $data['challenge_token'],
        $user,
        $request,
        $expectedPurpose,
        'email'
      );
    }

    if ($data['purpose'] === 'forgot') {
      return response()->json([
        'verified' => true,
        'message' => 'OTP verified successfully.',
      ]);
    }

    if ($this->twoFactor->isEnabled($user)) {
      $challengeToken = $this->twoFactor->createLoginChallenge($user, $request->only([
        'device_id', 'device_name', 'platform', 'app_version',
      ]));

      return response()->json([
        'message' => 'Enter the code from your authenticator app.',
        'two_factor_required' => true,
        'challenge_token' => $challengeToken,
        'user' => $user,
      ]);
    }

    $token = $this->issueDeviceBoundToken($user, 'fitandsleekpro', $request, markTrusted: true);

    return response()->json([
      'token' => $token,
      'user' => $user,
      'device_verified' => true,
    ]);
  }

  public function resendOtp(Request $request)
  {
    $data = $request->validate([
      'email' => ['required','email'],
      'purpose' => ['required','in:register,login,forgot'],
      'challenge_token' => ['nullable', 'string'],
    ]);

    if (! empty($data['challenge_token'])) {
      $payload = $this->verificationChallenge->get($data['challenge_token']);
      if (! $payload || ($payload['method'] ?? '') !== 'email') {
        return response()->json(['message' => 'Verification session expired. Please try again.'], 422);
      }

      $user = $this->verificationChallenge->resolveUser($data['challenge_token']);
      if (! $user || $user->email !== $data['email']) {
        return response()->json(['message' => 'Email does not match this verification session.'], 422);
      }

      $purpose = $this->otpPurposeForChallenge($payload);
      $otpDelivery = $this->sendOtpCode($user->email, $purpose);

      return response()->json(array_merge([
        'message' => $this->otpSentMessage($otpDelivery['email_sent']),
        'otp_required' => true,
        'purpose' => $purpose,
      ], $this->otpDeliveryPayload($otpDelivery)));
    }

    $otpDelivery = $this->sendOtpCode($data['email'], $data['purpose']);

    return response()->json(array_merge([
      'message' => $this->otpSentMessage($otpDelivery['email_sent']),
      'otp_required' => true,
      'purpose' => $data['purpose'],
    ], $this->otpDeliveryPayload($otpDelivery)));
  }

  public function me(Request $request)
  {
    return response()->json($request->user());
  }

  public function driverToken(Request $request)
  {
    $user = $request->user();

    if (! $user || $user->role !== 'driver') {
      return response()->json(['message' => 'Forbidden (driver only).'], 403);
    }

    $token = $this->issueDeviceBoundToken($user, 'driver-device', $request);

    return response()->json([
      'token' => $token,
      'user' => $user,
    ]);
  }

  public function logout(Request $request)
  {
    $user = $request->user();
    $token = $user?->currentAccessToken();

    if ($token) {
      UserDeviceSession::query()
        ->where('user_id', $user->id)
        ->where('personal_access_token_id', $token->id)
        ->update(['personal_access_token_id' => null]);

      $token->delete();
    }

    return response()->json(['message' => 'Logged out']);
  }

  public function redirectToFacebook()
  {
    return Socialite::driver('facebook')
      ->stateless()
      ->redirect();
  }

  public function handleFacebookCallback(Request $request)
  {
    try {
      $facebookUser = Socialite::driver('facebook')
        ->stateless()
        ->user();
    } catch (\Throwable $e) {
      return response()->json([
        'message' => 'Facebook login failed.',
      ], 422);
    }

    $email = trim((string) $facebookUser->getEmail());
    if ($email === '') {
      return response()->json([
        'message' => 'Facebook account does not provide an email.',
      ], 422);
    }

    $facebookId = (string) $facebookUser->getId();
    $name = $facebookUser->getName() ?: $facebookUser->getNickname() ?: 'Customer';

    $user = User::where('email', $email)->first();

    if (!$user) {
      $user = User::create([
        'name' => $name,
        'email' => $email,
        'password' => null,
        'role' => 'customer',
        'status' => 'active',
        'email_verified_at' => now(),
        'facebook_id' => $facebookId !== '' ? $facebookId : null,
        'social_type' => 'facebook',
      ]);
    } else {
      $updates = [
        'social_type' => 'facebook',
      ];

      if ($facebookId !== '' && empty($user->facebook_id)) {
        $updates['facebook_id'] = $facebookId;
      }

      if (!$user->email_verified_at) {
        $updates['email_verified_at'] = now();
      }

      if ($user->status !== 'active') {
        $updates['status'] = 'active';
      }

      $user->update($updates);
      $user->refresh();
    }

    $token = $this->issueDeviceBoundToken($user, 'facebook-login', $request);

    return response()->json([
      'message' => 'Facebook login successful.',
      'token' => $token,
      'user' => $user,
    ]);
  }

    public function forgotPassword(Request $request)
    {
      $data = $request->validate([
        'email' => ['required', 'email'],
      ]);

      $user = User::where('email', $data['email'])->first();

      if (! $user) {
        return response()->json([
          'message' => 'If the account exists, you can choose how to verify your identity.',
        ], 200);
      }

      $challengeToken = $this->verificationChallenge->create($user, 'forgot');
      $this->verificationChallenge->setMethod($challengeToken, 'email');
      $otpDelivery = $this->sendOtpCode($user->email, 'forgot');

      return response()->json(array_merge([
        'message' => $this->otpSentMessage($otpDelivery['email_sent']),
        'verification_required' => true,
        'step' => 'otp',
        'challenge_token' => $challengeToken,
        'verification_methods' => $this->verificationChallenge->availableMethods($user),
        'preferred_method' => $user->two_factor_preferred_method ?? 'email',
        'purpose' => 'forgot',
      ], $this->otpDeliveryPayload($otpDelivery)), 200);
    }

    public function resetPasswordOtp(Request $request)
    {
      $data = $request->validate([
        'challenge_token' => ['required', 'string'],
        'password' => [
          'required',
          'confirmed',
          PasswordRule::min(8)->letters()->mixedCase()->numbers()->symbols(),
        ],
      ]);

      $payload = $this->verificationChallenge->get($data['challenge_token']);
      if (! $payload || ($payload['purpose'] ?? '') !== 'forgot' || empty($payload['verified_at'])) {
        return response()->json([
          'message' => 'Please complete identity verification before resetting your password.',
        ], 422);
      }

      $user = User::query()->find($payload['user_id']);
      if (! $user) {
        return response()->json(['message' => 'Account not found.'], 404);
      }

      $user->forceFill([
        'password' => Hash::make($data['password']),
        'remember_token' => Str::random(60),
      ])->save();

      $user->tokens()->delete();
      $this->verificationChallenge->forget($data['challenge_token']);

      return response()->json([
        'message' => 'Password has been reset successfully. You can sign in now.',
      ], 200);
    }

    public function resetPassword(Request $request)
    {
      $data = $request->validate([
        'token' => ['required', 'string'],
        'email' => ['required', 'email:rfc,dns'],
        'password' => [
          'required',
          'confirmed',
          PasswordRule::min(8)->letters()->mixedCase()->numbers()->symbols(),
        ],
      ]);

      $status = Password::reset([
        'email' => $data['email'],
        'token' => $data['token'],
        'password' => $data['password'],
        'password_confirmation' => $request->input('password_confirmation'),
      ], function (User $user, string $password) {
        $user->forceFill([
          'password' => Hash::make($password),
          'remember_token' => Str::random(60),
        ])->save();

        $user->tokens()->delete();
      });

      if ($status === Password::PASSWORD_RESET) {
        return response()->json([
          'message' => 'Password has been reset successfully.',
        ], 200);
      }

      return response()->json([
        'message' => 'The reset token is invalid or expired.',
      ], 422);
    }

  private function completeVerificationChallenge(
    string $challengeToken,
    User $user,
    Request $request,
    string $expectedPurpose,
    string $expectedMethod
  ) {
    $payload = $this->verificationChallenge->get($challengeToken);
    if (! $payload || ($payload['user_id'] ?? null) !== $user->id) {
      return response()->json(['message' => 'Verification session expired. Please try again.'], 422);
    }

    if (($payload['purpose'] ?? '') !== $expectedPurpose) {
      return response()->json(['message' => 'Invalid verification session.'], 422);
    }

    if (($payload['method'] ?? '') !== $expectedMethod) {
      return response()->json(['message' => 'Use the verification method you selected.'], 422);
    }

    if ($expectedPurpose === 'forgot') {
      $this->verificationChallenge->markVerified($challengeToken);

      return response()->json([
        'verified' => true,
        'challenge_token' => $challengeToken,
        'message' => 'Identity verified. You can set a new password.',
      ]);
    }

    if ($expectedPurpose === 'register') {
      $user->update([
        'email_verified_at' => now(),
        'status' => 'active',
      ]);
    } elseif ($user->status !== 'active') {
      return response()->json(['message' => 'Account is not active'], 403);
    }

    $this->verificationChallenge->forget($challengeToken);
    $token = $this->issueDeviceBoundToken($user, 'fitandsleekpro', $request, markTrusted: true);

    return response()->json([
      'token' => $token,
      'user' => $user->fresh(),
      'device_verified' => true,
    ]);
  }

  /** @param array<string, mixed> $payload */
  private function otpPurposeForChallenge(array $payload): string
  {
    $purpose = (string) ($payload['purpose'] ?? 'login');

    return in_array($purpose, ['register', 'login', 'forgot'], true) ? $purpose : 'login';
  }

  /** @return array{email_sent: bool, debug_otp: ?string} */
  private function sendOtpCode(string $email, string $purpose): array
  {
    $expiresMinutes = (int) (config('auth.otp_expires_minutes') ?? 10);
    $code = (string) random_int(100000, 999999);

    OtpCode::where('email', $email)->where('purpose', $purpose)->delete();

    OtpCode::create([
      'email' => $email,
      'purpose' => $purpose,
      'code_hash' => Hash::make($code),
      'expires_at' => now()->addMinutes($expiresMinutes),
    ]);

    $emailSent = true;

    try {
      Mail::to($email)->send(new OtpCodeMail($code, $purpose, $expiresMinutes));
      Log::info('OTP email accepted by mail transport', [
        'email' => $email,
        'purpose' => $purpose,
        'mailer' => config('mail.default'),
        'from' => config('mail.from.address'),
      ]);
    } catch (\Throwable $e) {
      $emailSent = false;

      Log::warning('OTP email delivery failed', [
        'email' => $email,
        'purpose' => $purpose,
        'error' => $e->getMessage(),
      ]);

      if (! filter_var(env('OTP_DEBUG', false), FILTER_VALIDATE_BOOL) && ! app()->environment('local')) {
        throw $e;
      }
    }

    return [
      'email_sent' => $emailSent,
      'debug_otp' => filter_var(env('OTP_DEBUG', false), FILTER_VALIDATE_BOOL) ? $code : null,
    ];
  }

  private function otpSentMessage(bool $emailSent): string
  {
    if ($emailSent) {
      return 'A verification code was sent to your email.';
    }

    if (filter_var(env('OTP_DEBUG', false), FILTER_VALIDATE_BOOL) || app()->environment('local')) {
      return 'Email delivery failed. Use the dev code below or tap Resend after fixing mail settings.';
    }

    return 'We could not send the verification email. Please try again in a few minutes.';
  }

  /** @param array{email_sent: bool, debug_otp: ?string} $delivery */
  private function otpDeliveryPayload(array $delivery): array
  {
    $payload = [
      'email_sent' => $delivery['email_sent'],
    ];

    if ($delivery['debug_otp'] !== null) {
      $payload['debug_otp'] = $delivery['debug_otp'];
    }

    return $payload;
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
        try {
          Mail::to($user->email)->send(new NewDeviceLoginAlertMail(
            $this->securityAudit->mailContextFromDevice($binding['context'])
          ));
        } catch (\Throwable $e) {
          Log::warning('New device login alert email failed', [
            'email' => $user->email,
            'error' => $e->getMessage(),
          ]);
        }
      }
    }

    return $plainTextToken;
  }
}
