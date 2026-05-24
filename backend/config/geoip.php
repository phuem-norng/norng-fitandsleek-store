<?php

return [

    'enabled' => filter_var(env('GEOIP_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    // ipwho = https://ipwho.is (free, HTTPS, city-level, no API key)
    'provider' => env('GEOIP_PROVIDER', 'ipwho'),

    'cache_ttl_minutes' => (int) env('GEOIP_CACHE_TTL', 1440),

    'timeout_seconds' => (int) env('GEOIP_TIMEOUT', 3),

];
