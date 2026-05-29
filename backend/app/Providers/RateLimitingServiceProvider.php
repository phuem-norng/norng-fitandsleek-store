<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class RateLimitingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    protected function configureRateLimiting(): void
    {
        RateLimiter::for('api', function (Request $request) {
            if ($request->user()) {
                return Limit::perMinute(300)->by('user:'.$request->user()->id);
            }

            return Limit::perMinute(120)->by($request->ip());
        });

        RateLimiter::for('api-sensitive', function (Request $request) {
            return Limit::perMinute(30)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('auth-login', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(5)->by('ip:'.$request->ip()),
                Limit::perMinute(5)->by('email:'.($email !== '' ? $email : $request->ip())),
            ];
        });

        RateLimiter::for('auth-register', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('auth-otp-verify', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(10)->by('ip:'.$request->ip()),
                Limit::perMinute(10)->by('email:'.($email !== '' ? $email : $request->ip())),
            ];
        });

        RateLimiter::for('auth-otp-resend', function (Request $request) {
            $email = strtolower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(3)->by('email:'.($email !== '' ? $email : $request->ip())),
                Limit::perMinute(10)->by('ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('auth-social', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('auth-two-factor', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // KHQR status polling while customer waits on checkout (was throttle:30,1 → 429 errors).
        RateLimiter::for('bakong-status', function (Request $request) {
            $paymentId = (string) $request->route('payment');
            $userId = $request->user()?->id;

            $key = $userId
                ? 'user:'.$userId.':payment:'.($paymentId !== '' ? $paymentId : 'x')
                : 'ip:'.$request->ip().':payment:'.($paymentId !== '' ? $paymentId : 'x');

            return Limit::perMinute(90)->by($key);
        });
    }
}
