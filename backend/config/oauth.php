<?php

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/');

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
        'https://web-fitandsleek.onrender.com',
    ]))),

];
