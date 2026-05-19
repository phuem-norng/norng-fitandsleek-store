<?php

use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        __DIR__.'/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->redirectGuestsTo(function (Request $request) {
            return $request->is('api/*') ? null : '/';
        });
        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
            'superadmin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'driver' => \App\Http\Middleware\EnsureDriver::class,
            'device.bound' => \App\Http\Middleware\EnsureDeviceBoundToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        // Database / connection issues: return a clear JSON 503 for API clients (no HTML stack traces).
        $exceptions->renderable(function (\Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if (! ($e instanceof QueryException)) {
                return null;
            }

            $state = isset($e->errorInfo[0]) ? (string) $e->errorInfo[0] : '';
            // SQLSTATE class 08xxx = connection exception (e.g. PostgreSQL down / refused).
            if ($state === '' || ! str_starts_with($state, '08')) {
                return null;
            }

            return response()->json([
                'message' => 'Service temporarily unavailable. Please try again shortly.',
                'error' => 'service_unavailable',
            ], 503);
        });
    })
    ->create();
