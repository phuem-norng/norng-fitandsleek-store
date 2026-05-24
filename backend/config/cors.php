<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'register', 'auth/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://localhost:5173',
        'https://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://fitandsleek.kalapak-team.space',
        'https://fitandsleekapp.kalapak-team.space',
    ],

    'allowed_origins_patterns' => [
        '~^http://localhost:\d+$~',
        '~^http://127\.0\.0\.1:\d+$~',
        '~^https://localhost:\d+$~',
        '~^https://127\.0\.0\.1:\d+$~',
        // Cloudflare quick Tunnel (ephemeral *.trycloudflare.com)
        '~^https://[a-zA-Z0-9.-]+\.trycloudflare\.com$~i',
        '~^https://[a-zA-Z0-9-]+\.ngrok-free\.app$~',
        '~^https://[a-zA-Z0-9-]+\.ngrok-free\.dev$~',
        '~^https://[a-zA-Z0-9-]+\.ngrok\.io$~',
    ],

    /*
     * Wildcard avoids preflight failures when the SPA sends extra headers
     * (e.g. ngrok-skip-browser-warning, Accept) that would otherwise be rejected.
     */
    'allowed_headers' => ['*'],

    'exposed_headers' => ['XSRF-TOKEN', 'X-CSRF-TOKEN'],

    'max_age' => 0,

    'supports_credentials' => true,

];

