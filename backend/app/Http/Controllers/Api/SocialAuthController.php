<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\FacebookProvider;
use Laravel\Socialite\Two\GoogleProvider;
use Symfony\Component\HttpFoundation\Cookie as HttpCookie;

class SocialAuthController extends Controller
{
    protected function createOauthTicket(array $payload): string
    {
        $ticket = Str::random(64);
        Cache::put("oauth_ticket:{$ticket}", $payload, now()->addMinutes(10));
        return $ticket;
    }

    protected function callbackPathWithTicket(string $frontendCallbackUrl, string $ticket): string
    {
        return rtrim($frontendCallbackUrl, '/') . '/' . $ticket;
    }

    protected function oauthCookie(Request $request, string $name, string $value)
    {
        return new HttpCookie(
            $name,
            $value,
            now()->addMinutes(10),
            '/',
            null,
            false,
            true,
            false,
            'Lax'
        );
    }

    protected function forgetOauthCookie(Request $request, string $name)
    {
        return new HttpCookie(
            $name,
            '',
            now()->subMinutes(5),
            '/',
            null,
            false,
            true,
            false,
            'Lax'
        );
    }

    protected function isLoopbackHost(?string $host): bool
    {
        if ($host === null || $host === '') {
            return false;
        }

        $host = strtolower($host);

        return in_array($host, ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'], true);
    }

    protected function allowedApiOrigins(): array
    {
        return (array) config('oauth.allowed_api_origins', []);
    }

    protected function trustsOnrenderApiHosts(): bool
    {
        return (bool) config('oauth.trust_onrender_api_hosts', false);
    }

    protected function isOnrenderApiHost(?string $host): bool
    {
        if ($host === null || $host === '') {
            return false;
        }

        return (bool) preg_match('/\.onrender\.com$/i', $host);
    }

    protected function isAllowedApiOrigin(Request $request): bool
    {
        $origin = rtrim($request->getSchemeAndHttpHost(), '/');

        foreach ($this->allowedApiOrigins() as $allowed) {
            $allowed = rtrim((string) $allowed, '/');
            if ($allowed !== '' && strcasecmp($origin, $allowed) === 0) {
                return true;
            }
        }

        if ($this->trustsOnrenderApiHosts() && $this->isOnrenderApiHost($request->getHost())) {
            return $request->getScheme() === 'https';
        }

        // Local Laravel on any loopback port (8000, 8001, docker, etc.).
        return app()->environment('local') && $this->isLoopbackHost($request->getHost());
    }

    protected function resolveProviderRedirectUri(Request $request, string $provider): string
    {
        $fromRequest = rtrim($request->getSchemeAndHttpHost(), '/')."/api/auth/{$provider}/callback";
        $requestPort = $request->getPort();

        // Avoid generating redirect_uri like http://localhost/api/... (no explicit port),
        // because Google requires an exact URI match and local dev usually runs on :8001.
        if ($this->isAllowedApiOrigin($request) && ! ($this->isLoopbackHost($request->getHost()) && $requestPort === 80)) {
            return $fromRequest;
        }

        $configured = trim((string) config("services.{$provider}.redirect", ''));
        if ($configured === '' || ! filter_var($configured, FILTER_VALIDATE_URL)) {
            return $fromRequest;
        }

        return rtrim($configured, '/');
    }

    protected function providerRedirectUriFromCookieOrRequest(Request $request, string $provider): string
    {
        $candidate = trim((string) $request->cookie('oauth_provider_redirect_uri', ''));

        if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_URL)) {
            return rtrim($candidate, '/');
        }

        return $this->resolveProviderRedirectUri($request, $provider);
    }

    protected function socialiteDriver(string $provider, string $redirectUri)
    {
        $serviceConfig = (array) config("services.{$provider}");

        $providerClass = match ($provider) {
            'google' => GoogleProvider::class,
            'facebook' => FacebookProvider::class,
            default => null,
        };

        if ($providerClass === null) {
            return Socialite::driver($provider);
        }

        return Socialite::buildProvider($providerClass, [
            'client_id' => (string) ($serviceConfig['client_id'] ?? ''),
            'client_secret' => (string) ($serviceConfig['client_secret'] ?? ''),
            'redirect' => $redirectUri,
            'guzzle' => (array) ($serviceConfig['guzzle'] ?? []),
        ]);
    }

    protected function allowedFrontendOrigins(): array
    {
        return (array) config('oauth.allowed_frontend_origins', []);
    }

    protected function allowedMobileCallbackUrls(): array
    {
        return (array) config('oauth.allowed_mobile_callback_urls', []);
    }

    protected function isAllowedMobileCallbackUrl(string $url): bool
    {
        $url = rtrim(trim($url), '/');
        if ($url === '') {
            return false;
        }

        foreach ($this->allowedMobileCallbackUrls() as $allowed) {
            $allowed = rtrim((string) $allowed, '/');
            if ($allowed !== '' && strcasecmp($url, $allowed) === 0) {
                return true;
            }
        }

        return false;
    }

    protected function isAllowedFrontendCallbackUrl(string $url): bool
    {
        $url = rtrim(trim($url), '/');

        if ($url === '') {
            return false;
        }

        if ($this->isAllowedMobileCallbackUrl($url)) {
            return true;
        }

        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $path = (string) ($parts['path'] ?? '');
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = isset($parts['port']) ? (int) $parts['port'] : null;

        if (! in_array($scheme, ['http', 'https'], true) || $path !== '/oauth/callback') {
            return false;
        }

        $origin = $scheme.'://'.$host.($port ? ':'.$port : '');

        foreach ($this->allowedFrontendOrigins() as $allowed) {
            $allowed = rtrim((string) $allowed, '/');
            if ($allowed === '') {
                continue;
            }
            if (strcasecmp($origin, $allowed) === 0) {
                return true;
            }
        }

        // Local SPA on any loopback port (e.g. Vite 5173).
        if (app()->environment('local') && $this->isLoopbackHost($host)) {
            return true;
        }

        return false;
    }

    protected function normalizeFrontendCallbackUrl(string $candidate): string
    {
        $candidate = rtrim(trim($candidate), '/');

        if ($candidate !== '' && $this->isAllowedFrontendCallbackUrl($candidate)) {
            return $candidate;
        }

        return $this->frontendUrl().'/oauth/callback';
    }

    protected function resolveFrontendCallbackUrl(Request $request): string
    {
        $candidate = trim((string) $request->query('frontend_callback', ''));

        if ($candidate === '') {
            return $this->frontendUrl().'/oauth/callback';
        }

        return $this->normalizeFrontendCallbackUrl($candidate);
    }

    protected function callbackUrlFromCookieOrDefault(Request $request): string
    {
        $candidate = trim((string) $request->cookie('oauth_frontend_callback', ''));

        if ($candidate === '') {
            return $this->frontendUrl().'/oauth/callback';
        }

        return $this->normalizeFrontendCallbackUrl($candidate);
    }

    protected function frontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
    }

    protected function isValidProvider(string $provider): bool
    {
        return in_array($provider, ['google', 'facebook'], true);
    }

    protected function findOrCreateSocialUser($socialUser, string $provider, string $email): User
    {
        $name = $socialUser->getName() ?: $socialUser->getNickname() ?: 'Customer';
        $avatar = trim((string) $socialUser->getAvatar());
        $providerId = trim((string) $socialUser->getId());

        $user = User::where('email', $email)->first();

        if (! $user) {
            return User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make(Str::random(24)),
                'role' => 'customer',
                'status' => 'active',
                'email_verified_at' => now(),
                'social_type' => $provider,
                'facebook_id' => $provider === 'facebook' && $providerId !== '' ? $providerId : null,
                'profile_image_path' => $avatar !== '' ? $avatar : null,
                'profile_image_updated_at' => $avatar !== '' ? now() : null,
            ]);
        }

        $updates = [
            'social_type' => $provider,
        ];

        if ($provider === 'facebook' && $providerId !== '' && empty($user->facebook_id)) {
            $updates['facebook_id'] = $providerId;
        }

        if ($avatar !== '' && empty($user->profile_image_path)) {
            $updates['profile_image_path'] = $avatar;
            $updates['profile_image_updated_at'] = now();
        }

        if (! $user->email_verified_at) {
            $updates['email_verified_at'] = now();
        }

        if ($user->status !== 'active') {
            $updates['status'] = 'active';
        }

        $user->update($updates);

        return $user->fresh();
    }

    public function redirect(Request $request, string $provider)
    {
        if (!$this->isValidProvider($provider)) {
            return response()->json(['message' => 'Unsupported provider'], 400);
        }

        $frontendCallbackUrl = $this->resolveFrontendCallbackUrl($request);
        $providerRedirectUri = $this->resolveProviderRedirectUri($request, $provider);

        return $this->socialiteDriver($provider, $providerRedirectUri)
            ->stateless()
            ->redirect()
            ->withCookie($this->oauthCookie($request, 'oauth_frontend_callback', $frontendCallbackUrl))
            ->withCookie($this->oauthCookie($request, 'oauth_provider_redirect_uri', $providerRedirectUri));
    }

    public function callback(Request $request, string $provider)
    {
        if (!$this->isValidProvider($provider)) {
            return response()->json(['message' => 'Unsupported provider'], 400);
        }

        $frontendCallbackUrl = $this->callbackUrlFromCookieOrDefault($request);
        $providerRedirectUri = $this->providerRedirectUriFromCookieOrRequest($request, $provider);
        $forgetCallbackCookie = $this->forgetOauthCookie($request, 'oauth_frontend_callback');
        $forgetProviderRedirectCookie = $this->forgetOauthCookie($request, 'oauth_provider_redirect_uri');

        try {
            $socialUser = $this->socialiteDriver($provider, $providerRedirectUri)
                ->stateless()
                ->user();
        } catch (\Exception $e) {
            // Capture the root cause so we can debug provider errors (redirect_uri, client_id, etc.)
            $this->logSocialAuth('error', '[SocialAuth] Callback failed', [
                'provider' => $provider,
                'message' => $e->getMessage(),
                'query' => request()->query(),
            ]);

            $ticket = $this->createOauthTicket([
                'error' => 'Social login failed. Please try again.',
            ]);

            $redirectUrl = $this->callbackPathWithTicket($frontendCallbackUrl, $ticket);
            return $this->redirectWithFallback($redirectUrl, $forgetCallbackCookie, $forgetProviderRedirectCookie);
        }

        $email = $socialUser->getEmail();
        if (!$email) {
            $ticket = $this->createOauthTicket([
                'error' => 'Your social account does not provide an email.',
            ]);

            $redirectUrl = $this->callbackPathWithTicket($frontendCallbackUrl, $ticket);
            return $this->redirectWithFallback($redirectUrl, $forgetCallbackCookie, $forgetProviderRedirectCookie);
        }

        $user = $this->findOrCreateSocialUser($socialUser, $provider, $email);

        $token = $user->createToken('fitandsleekpro')->plainTextToken;

        $this->logSocialAuth('info', '[SocialAuth] Callback success', [
            'provider' => $provider,
            'user_id' => $user->id,
            'email' => $user->email,
            'frontend_callback_url' => $frontendCallbackUrl,
        ]);

        $ticket = $this->createOauthTicket([
            'token' => $token,
            'provider' => $provider,
        ]);

        $redirectUrl = $this->callbackPathWithTicket($frontendCallbackUrl, $ticket);
        return $this->redirectWithFallback($redirectUrl, $forgetCallbackCookie, $forgetProviderRedirectCookie);
    }

    protected function redirectWithFallback(string $redirectUrl, $forgetCallbackCookie, $forgetProviderRedirectCookie)
    {
        return redirect()->away($redirectUrl)
            ->withCookie($forgetCallbackCookie)
            ->withCookie($forgetProviderRedirectCookie);
    }

    protected function logSocialAuth(string $level, string $message, array $context = []): void
    {
        try {
            Log::log($level, $message, $context);
        } catch (\Throwable) {
            // Never block OAuth redirects when storage/logging is misconfigured.
        }
    }

    public function exchange(string $ticket)
    {
        $key = "oauth_ticket:{$ticket}";
        $usedKey = "oauth_ticket_used:{$ticket}";

        $usedPayload = Cache::get($usedKey);
        if (is_array($usedPayload)) {
            return response()->json($usedPayload);
        }

        $payload = Cache::pull($key);

        if (!is_array($payload)) {
            return response()->json([
                'message' => 'OAuth ticket expired or invalid.',
            ], 404);
        }

        Cache::put($usedKey, $payload, now()->addMinutes(5));

        return response()->json($payload);
    }
}
