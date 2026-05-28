<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MediaDisk
{
    public static function name(): string
    {
        return (string) config('filesystems.media_disk', config('filesystems.default', 'public'));
    }

    public static function disk(): Filesystem
    {
        return Storage::disk(self::name());
    }

    public static function isRemote(): bool
    {
        return self::name() !== 'public';
    }

    public static function url(string $path): string
    {
        return self::disk()->url(ltrim($path, '/'));
    }

    public static function exists(string $path): bool
    {
        $key = self::normalizeStorageKey($path);
        if ($key === null) {
            return false;
        }

        try {
            return self::disk()->exists($key);
        } catch (\Throwable) {
            return false;
        }
    }

    public static function delete(?string $path): void
    {
        $key = self::normalizeStorageKey($path ?? '');
        if ($key === null) {
            return;
        }

        try {
            self::disk()->delete($key);
        } catch (\Throwable) {
            // Best-effort cleanup.
        }
    }

    public static function put(string $path, mixed $contents, array $options = []): void
    {
        self::disk()->put(ltrim($path, '/'), $contents, $options);
    }

    public static function storeUploadedFile(UploadedFile $file, string $directory): string
    {
        return $file->store($directory, self::name());
    }

    /**
     * Turn DB paths, /storage paths, or same-origin CDN URLs into an object key.
     */
    public static function normalizeStorageKey(string $path): ?string
    {
        $path = trim($path);
        if ($path === '') {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            $parsedPath = (string) (parse_url($path, PHP_URL_PATH) ?? '');
            if ($parsedPath !== '' && str_contains($parsedPath, '/storage/')) {
                return ltrim(substr($parsedPath, strpos($parsedPath, '/storage/') + 9), '/');
            }

            $base = rtrim((string) config('filesystems.disks.'.self::name().'.url', ''), '/');
            if ($base !== '' && str_starts_with($path, $base.'/')) {
                return ltrim(substr($path, strlen($base)), '/');
            }

            return null;
        }

        if (str_starts_with($path, '/storage/')) {
            return ltrim(substr($path, 9), '/');
        }

        if (str_starts_with($path, 'storage/')) {
            return ltrim(substr($path, 8), '/');
        }

        return ltrim($path, '/');
    }

    /**
     * Local absolute path for GD / Qdrant. Remote objects are copied to a temp file.
     */
    public static function localPathForProcessing(string $path): ?string
    {
        $key = self::normalizeStorageKey($path);
        if ($key === null) {
            return null;
        }

        if (! self::isRemote()) {
            $local = self::disk()->path($key);

            return file_exists($local) ? $local : null;
        }

        if (! self::exists($key)) {
            return null;
        }

        $tempDir = storage_path('app/tmp/media-local');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $ext = pathinfo($key, PATHINFO_EXTENSION) ?: 'bin';
        $tempPath = $tempDir.'/'.uniqid('media_', true).'.'.$ext;
        $contents = self::disk()->get($key);
        if ($contents === null) {
            return null;
        }

        file_put_contents($tempPath, $contents);

        return $tempPath;
    }
}
