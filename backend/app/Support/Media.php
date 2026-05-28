<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class Media
{
    public static function disk(): string
    {
        return (string) config('filesystems.default', 'public');
    }

    public static function fallbackToPublic(): bool
    {
        return filter_var(
            env('MEDIA_FALLBACK_TO_PUBLIC', env('ADMIN_PROFILE_IMAGE_FALLBACK_TO_PUBLIC', env('APP_ENV') !== 'production')),
            FILTER_VALIDATE_BOOL
        );
    }

    public static function isExternalUrl(?string $value): bool
    {
        return is_string($value) && preg_match('#^https?://#i', $value) === 1;
    }

    /**
     * Strip /storage/ prefix and return a disk-relative key when possible.
     */
    public static function storageKey(?string $reference): ?string
    {
        $reference = trim((string) $reference);
        if ($reference === '') {
            return null;
        }

        if (self::isExternalUrl($reference)) {
            return null;
        }

        if (str_starts_with($reference, '/storage/')) {
            return ltrim(substr($reference, 9), '/');
        }

        if (str_starts_with($reference, 'storage/')) {
            return ltrim(substr($reference, 8), '/');
        }

        return ltrim($reference, '/');
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

        if (str_starts_with(strtolower($url), 'http://')) {
            return 'https://'.substr($url, 7);
        }

        return $url;
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

                return $normalizedPath !== '/' ? $normalizedPath : null;
            }

            return $path;
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

        $normalized = self::storageKey($path);
        if ($normalized === null || $normalized === '') {
            return self::placeholderUrl();
        }

        $disk = self::disk();

        if ($disk !== 'public') {
            try {
                return Storage::disk($disk)->url($normalized);
            } catch (\Throwable) {
                // Continue to local fallback for legacy paths.
            }
        }

        try {
            if (Storage::disk('public')->exists($normalized)) {
                return '/storage/'.$normalized;
            }
        } catch (\Throwable) {
            // ignore
        }

        return self::placeholderUrl();
    }

    public static function publicUrl(?string $path): ?string
    {
        return self::url($path);
    }

    /**
     * Store an uploaded file on the configured media disk (Cloudinary when FILESYSTEM_DISK=cloudinary).
     * Returns a disk key or absolute CDN URL suitable for persisting in the database.
     */
    public static function storeUploaded(UploadedFile $file, string $directory, ?string $disk = null): string
    {
        $disk = $disk ?? self::disk();

        try {
            $path = $file->store(trim($directory, '/'), $disk);

            return self::canonicalStoredReference($path, $disk);
        } catch (\Throwable $e) {
            if (! self::fallbackToPublic() || $disk === 'public') {
                throw $e;
            }

            Log::warning('Media upload failed on preferred disk, falling back to public.', [
                'preferred_disk' => $disk,
                'directory' => $directory,
                'error' => $e->getMessage(),
            ]);

            $path = $file->store(trim($directory, '/'), 'public');

            return self::canonicalStoredReference($path, 'public');
        }
    }

    public static function storeUploadedAs(
        UploadedFile $file,
        string $directory,
        string $filename,
        ?string $disk = null
    ): string {
        $disk = $disk ?? self::disk();
        $directory = trim($directory, '/');

        try {
            $path = $file->storeAs($directory, $filename, $disk);

            return self::canonicalStoredReference($path, $disk);
        } catch (\Throwable $e) {
            if (! self::fallbackToPublic() || $disk === 'public') {
                throw $e;
            }

            Log::warning('Media upload failed on preferred disk, falling back to public.', [
                'preferred_disk' => $disk,
                'directory' => $directory,
                'filename' => $filename,
                'error' => $e->getMessage(),
            ]);

            $path = $file->storeAs($directory, $filename, 'public');

            return self::canonicalStoredReference($path, 'public');
        }
    }

    public static function put(string $relativePath, string $contents, ?string $disk = null): string
    {
        $disk = $disk ?? self::disk();
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');

        try {
            Storage::disk($disk)->put($relativePath, $contents);

            return self::canonicalStoredReference($relativePath, $disk);
        } catch (\Throwable $e) {
            if (! self::fallbackToPublic() || $disk === 'public') {
                throw $e;
            }

            Storage::disk('public')->put($relativePath, $contents);

            return self::canonicalStoredReference($relativePath, 'public');
        }
    }

    /**
     * For remote disks, persist the HTTPS URL when available so clients never see /storage paths.
     */
    public static function canonicalStoredReference(string $path, ?string $disk = null): string
    {
        $path = trim(str_replace('\\', '/', $path));
        if ($path === '') {
            return $path;
        }

        if (self::isExternalUrl($path)) {
            return $path;
        }

        $disk = $disk ?? self::disk();
        if ($disk === 'public') {
            return $path;
        }

        $key = self::storageKey($path) ?? $path;

        try {
            $url = Storage::disk($disk)->url($key);
            if (is_string($url) && $url !== '' && self::isExternalUrl($url)) {
                return $url;
            }
        } catch (\Throwable) {
            // Keep disk-relative key.
        }

        return $path;
    }

    public static function delete(?string $reference): void
    {
        $reference = trim((string) $reference);
        if ($reference === '') {
            return;
        }

        if (self::isExternalUrl($reference)) {
            return;
        }

        $key = self::storageKey($reference);
        if ($key === null || $key === '') {
            return;
        }

        foreach (array_unique([self::disk(), 'cloudinary', 'public']) as $disk) {
            try {
                Storage::disk($disk)->delete($key);
            } catch (\Throwable) {
                // Best-effort cleanup across old/new storage backends.
            }
        }
    }

    /**
     * Read raw bytes for a stored reference (path, /storage URL, or remote CDN URL).
     */
    public static function readBytes(?string $reference): ?string
    {
        $reference = trim((string) $reference);
        if ($reference === '') {
            return null;
        }

        if (str_starts_with($reference, 'data:image/')) {
            if (! preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', $reference, $matches)) {
                return null;
            }
            $decoded = base64_decode($matches[2], true);

            return $decoded === false ? null : $decoded;
        }

        if (self::isExternalUrl($reference)) {
            try {
                $response = \Illuminate\Support\Facades\Http::timeout(30)->get($reference);
                if ($response->successful()) {
                    return $response->body();
                }
            } catch (\Throwable) {
                return null;
            }

            return null;
        }

        $key = self::storageKey($reference);
        if ($key === null || $key === '') {
            return null;
        }

        foreach (array_unique([self::disk(), 'public']) as $disk) {
            try {
                if (Storage::disk($disk)->exists($key)) {
                    return Storage::disk($disk)->get($key);
                }
            } catch (\Throwable) {
                continue;
            }
        }

        $local = self::resolveLocalPath($reference);

        return ($local && file_exists($local)) ? (file_get_contents($local) ?: null) : null;
    }

    public static function resolveLocalPath(?string $reference): ?string
    {
        $path = trim((string) $reference);
        if ($path === '') {
            return null;
        }

        if (str_starts_with($path, '/storage/')) {
            return storage_path('app/public/'.ltrim(substr($path, 9), '/'));
        }

        if (str_starts_with($path, 'storage/')) {
            return storage_path('app/public/'.ltrim(substr($path, 8), '/'));
        }

        if (str_starts_with($path, '/')) {
            $publicPath = public_path(ltrim($path, '/'));
            if (file_exists($publicPath)) {
                return $publicPath;
            }
        }

        $key = self::storageKey($path);
        if ($key !== null && $key !== '') {
            $diskPath = Storage::disk('public')->path($key);
            if (file_exists($diskPath)) {
                return $diskPath;
            }
        }

        if (file_exists($path)) {
            return $path;
        }

        return null;
    }
}
