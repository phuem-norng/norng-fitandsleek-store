<?php

namespace App\Support;

class Media
{
    public static function url(?string $path): ?string
    {
        if (!$path) return null;

        // already absolute url
        if (preg_match('#^https?://#i', $path)) return $path;

        $normalized = ltrim($path, '/');
        if (str_starts_with($normalized, 'storage/')) {
            $normalized = ltrim(substr($normalized, 8), '/');
        }

        // If the backing file is missing, always return a safe placeholder.
        if (!\Storage::disk('public')->exists($normalized)) {
            return \asset('placeholder.svg');
        }

        // storage:link -> /storage
        return \asset('storage/' . $normalized);
    }

    // Backward-compatible alias (so both calls work)
    public static function publicUrl(?string $path): ?string
    {
        return self::url($path);
    }
}
