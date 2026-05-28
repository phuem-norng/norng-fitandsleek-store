<?php

namespace App\Support;

class Media
{
    private static function isPrivateHost(string $host): bool
    {
        $host = strtolower($host);
        if (in_array($host, ['localhost', '127.0.0.1', 'host.docker.internal', 'backend'], true)) {
            return true;
        }

        return preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/', $host) === 1;
    }

    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $path = trim($path);

        if (preg_match('#^https?://#i', $path)) {
            $parts = parse_url($path);
            $host = strtolower((string) ($parts['host'] ?? ''));
            if ($host !== '' && self::isPrivateHost($host)) {
                $normalizedPath = '/'.ltrim((string) ($parts['path'] ?? ''), '/');
                $storagePos = strpos($normalizedPath, '/storage/');
                if ($storagePos !== false) {
                    return substr($normalizedPath, $storagePos);
                }

                return $normalizedPath !== '/' ? $normalizedPath : null;
            }

            return $path;
        }

        $key = MediaDisk::normalizeStorageKey($path);
        if ($key === null) {
            return null;
        }

        if (! MediaDisk::exists($key)) {
            return asset('placeholder.svg');
        }

        if (MediaDisk::isRemote()) {
            return MediaDisk::url($key);
        }

        if (str_starts_with($path, '/storage/')) {
            return $path;
        }

        if (str_starts_with($path, 'storage/')) {
            return '/'.$path;
        }

        if (! str_contains($path, '/')) {
            return '/storage/banners/'.ltrim($path, '/');
        }

        return '/storage/'.$key;
    }

    public static function publicUrl(?string $path): ?string
    {
        return self::url($path);
    }
}
