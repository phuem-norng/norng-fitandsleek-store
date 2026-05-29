<?php

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

$originFromUrl = static function (?string $url): ?string {
    $url = trim((string) $url);
    if ($url === '' || ! filter_var($url, FILTER_VALIDATE_URL)) {
        return null;
    }

    $parts = parse_url($url);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = (string) ($parts['host'] ?? '');
    $port = isset($parts['port']) ? (int) $parts['port'] : null;

    if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
        return null;
    }

    $defaultPort = $scheme === 'https' ? 443 : 80;
    $includePort = $port !== null && $port !== $defaultPort;

    return $scheme.'://'.$host.($includePort ? ':'.$port : '');
};

$extraApiOrigins = array_filter(array_map('trim', explode(',', (string) env('OAUTH_EXTRA_API_ORIGINS', ''))));
$isLocal = env('APP_ENV') === 'local';

return [

    /*
    |--------------------------------------------------------------------------
    | Allowed frontend origins (OAuth callback after social login)
    |--------------------------------------------------------------------------
    |
    | The SPA may run on localhost or 127.0.0.1 during local dev. Production
    | uses FRONTEND_URL from .env.
    |
    */

    'allowed_frontend_origins' => array_values(array_unique(array_filter([
        $frontend,
        rtrim((string) env('FRONTEND_URL_LOCAL', ''), '/'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://localhost:5173',
        'https://127.0.0.1:5173',
        'https://fitandsleek.kalapak-team.space',
        'https://www.fitandsleek.kalapak-team.space',
        'https://web-fitandsleek.onrender.com',
        'https://www.web-fitandsleek.onrender.com',
    ]))),

    /*
    |--------------------------------------------------------------------------
    | Allowed Laravel API origins (Google/Facebook redirect_uri host)
    |--------------------------------------------------------------------------
    |
    | When the browser hits /api/auth/{provider}/redirect on one of these
    | hosts, redirect_uri is built from that request (so local, Kalapak, and
    | Render each use their own callback URL). Register every callback URL in
    | Google Cloud Console → Authorized redirect URIs.
    |
    */

    'allowed_api_origins' => array_values(array_unique(array_filter([
        $originFromUrl(env('APP_URL')),
        $originFromUrl(env('APP_URL_LOCAL')),
        $originFromUrl(env('GOOGLE_REDIRECT_URI')),
        $originFromUrl(env('GOOGLE_REDIRECT_URI_LOCAL')),
        $originFromUrl(env('FACEBOOK_REDIRECT_URI')),
        $originFromUrl(env('FACEBOOK_REDIRECT_URI_LOCAL')),
        $isLocal ? 'http://localhost:8001' : null,
        $isLocal ? 'http://127.0.0.1:8001' : null,
        $isLocal ? 'http://localhost:8000' : null,
        $isLocal ? 'http://127.0.0.1:8000' : null,
        'https://fitandsleekapp.kalapak-team.space',
        'https://api-fitandsleek.onrender.com',
        ...$extraApiOrigins,
    ]))),

    /*
    | Trust any https://*.onrender.com API host (Render deploys). Set false to
    | restrict OAuth callbacks to allowed_api_origins only.
    */
    'trust_onrender_api_hosts' => filter_var(
        env('OAUTH_TRUST_ONRENDER_API_HOSTS', true),
        FILTER_VALIDATE_BOOLEAN
    ),

];
