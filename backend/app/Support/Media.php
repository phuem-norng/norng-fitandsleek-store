<?php

namespace App\Support;

class Media
{
    private static function mediaDisk(): string
    {
        return (string) config('filesystems.default', 'public');
    }

    private static function isPrivateHost(string $host): bool
    {
        $host = strtolower($host);
        if (in_array($host, ['localhost', '127.0.0.1', 'host.docker.internal', 'backend'], true)) {
            return true;
        }

        return preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/', $host) === 1;
    }

    private static function placeholderUrl(): string
    {
        $url = (string) \asset('placeholder.svg');

        // Prevent mixed-content warnings when upstream app URL is accidentally http.
        if (str_starts_with(strtolower($url), 'http://')) {
            return 'https://' . substr($url, 7);
        }

        return $url;
    }

    public static function url(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $path = trim($path);

        // already absolute url
        if (preg_match('#^https?://#i', $path)) {
            $parts = parse_url($path);
            $host = strtolower((string) ($parts['host'] ?? ''));
            if ($host !== '' && self::isPrivateHost($host)) {
                $normalizedPath = '/' . ltrim((string) ($parts['path'] ?? ''), '/');
                return $normalizedPath !== '/' ? $normalizedPath : null;
            }
            return $path;
        }

        if (str_starts_with($path, '/storage/')) {
            return $path;
        }

        if (str_starts_with($path, 'storage/')) {
            return '/' . $path;
        }

        if (!str_contains($path, '/')) {
            // Filename-only fallback for legacy banner/image fields.
            return '/storage/banners/' . ltrim($path, '/');
        }

        $normalized = ltrim($path, '/');
        if (str_starts_with($normalized, 'storage/')) {
            $normalized = ltrim(substr($normalized, 8), '/');
        }

        $disk = self::mediaDisk();

        if ($disk !== 'public') {
            try {
                return \Storage::disk($disk)->url($normalized);
            } catch (\Throwable) {
                // Continue to local fallback for legacy paths.
            }
        }

        try {
            if (\Storage::disk('public')->exists($normalized)) {
                // storage:link -> /storage
                return '/storage/' . $normalized;
            }
        } catch (\Throwable) {
            // ignore and return placeholder below
        }

        return self::placeholderUrl();
    }

    // Backward-compatible alias (so both calls work)
    public static function publicUrl(?string $path): ?string
    {
        return self::url($path);
    }
}
