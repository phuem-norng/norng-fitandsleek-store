<?php

namespace App\Support;

use Cloudinary\Cloudinary as CloudinarySdk;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

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

    private static function usesCloudinaryDisk(?string $disk): bool
    {
        return ($disk ?? self::disk()) === 'cloudinary';
    }

    /**
     * @return array{cloudName: string, apiKey: string, apiSecret: string, cloudinaryUrl: string, preset: string}
     */
    private static function cloudinaryCredentials(): array
    {
        $cloudName = trim((string) env('CLOUDINARY_CLOUD_NAME', ''));
        $apiKey = trim((string) env('CLOUDINARY_API_KEY', ''));
        $apiSecret = trim((string) env('CLOUDINARY_API_SECRET', ''));
        $cloudinaryUrl = trim((string) env('CLOUDINARY_URL', ''));
        $preset = trim((string) env('CLOUDINARY_UPLOAD_PRESET', ''));

        if ($cloudinaryUrl !== '') {
            $parts = parse_url($cloudinaryUrl);
            if ($cloudName === '') {
                $cloudName = trim((string) ($parts['host'] ?? ''));
            }
            if ($apiKey === '') {
                $apiKey = trim((string) ($parts['user'] ?? ''));
            }
            if ($apiSecret === '') {
                $apiSecret = trim((string) ($parts['pass'] ?? ''));
            }
        }

        return compact('cloudName', 'apiKey', 'apiSecret', 'cloudinaryUrl', 'preset');
    }

    /**
     * Reliable Cloudinary upload (unsigned preset or signed API). Returns secure HTTPS URL.
     */
    public static function uploadToCloudinary(UploadedFile $file, string $folder): string
    {
        $creds = self::cloudinaryCredentials();
        $folder = trim($folder, '/');

        if ($creds['cloudName'] === '') {
            throw new RuntimeException('Cloudinary cloud name is not configured.');
        }

        $uploadOptions = [
            'folder' => $folder,
            'resource_type' => 'image',
        ];

        $realPath = $file->getRealPath();
        if ($realPath === false || ! is_readable($realPath)) {
            throw new RuntimeException('Uploaded file is not readable.');
        }

        if ($creds['preset'] !== '') {
            $sdk = $creds['cloudinaryUrl'] !== ''
                ? new CloudinarySdk($creds['cloudinaryUrl'])
                : new CloudinarySdk([
                    'cloud' => ['cloud_name' => $creds['cloudName']],
                    'url' => ['secure' => true],
                ]);
            $result = $sdk->uploadApi()->unsignedUpload($realPath, $creds['preset'], $uploadOptions);
        } else {
            if ($creds['apiKey'] === '' || $creds['apiSecret'] === '') {
                throw new RuntimeException('Cloudinary API key/secret or CLOUDINARY_UPLOAD_PRESET is required.');
            }
            $sdk = new CloudinarySdk([
                'cloud' => ['cloud_name' => $creds['cloudName']],
                'api' => ['api_key' => $creds['apiKey'], 'api_secret' => $creds['apiSecret']],
                'url' => ['secure' => true],
            ]);
            $uploadOptions['public_id'] = $folder.'/'.Str::uuid();
            $result = $sdk->uploadApi()->upload($realPath, $uploadOptions);
        }

        $url = (string) ($result['secure_url'] ?? '');
        if ($url === '') {
            throw new RuntimeException('Cloudinary upload did not return secure_url.');
        }

        return $url;
    }

    private static function persistUploadedFile(
        UploadedFile $file,
        string $directory,
        ?string $filename,
        ?string $disk
    ): string {
        $disk = $disk ?? self::disk();
        $directory = trim($directory, '/');

        if (self::usesCloudinaryDisk($disk)) {
            return self::uploadToCloudinary($file, $directory);
        }

        $path = $filename !== null
            ? $file->storeAs($directory, $filename, $disk)
            : $file->store($directory, $disk);

        if (! is_string($path) || trim($path) === '') {
            throw new RuntimeException('Storage did not return a file path.');
        }

        return self::canonicalStoredReference($path, $disk);
    }

    /**
     * Store an uploaded file on the configured media disk (Cloudinary when FILESYSTEM_DISK=cloudinary).
     * Returns a disk key or absolute CDN URL suitable for persisting in the database.
     */
    public static function storeUploaded(UploadedFile $file, string $directory, ?string $disk = null): string
    {
        $disk = $disk ?? self::disk();

        try {
            return self::persistUploadedFile($file, $directory, null, $disk);
        } catch (\Throwable $e) {
            if (! self::fallbackToPublic() || $disk === 'public') {
                throw $e;
            }

            Log::warning('Media upload failed on preferred disk, falling back to public.', [
                'preferred_disk' => $disk,
                'directory' => $directory,
                'error' => $e->getMessage(),
            ]);

            return self::persistUploadedFile($file, $directory, null, 'public');
        }
    }

    public static function storeUploadedAs(
        UploadedFile $file,
        string $directory,
        string $filename,
        ?string $disk = null
    ): string {
        $disk = $disk ?? self::disk();

        try {
            return self::persistUploadedFile($file, $directory, $filename, $disk);
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

            return self::persistUploadedFile($file, $directory, $filename, 'public');
        }
    }

    public static function put(string $relativePath, string $contents, ?string $disk = null): string
    {
        $disk = $disk ?? self::disk();
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');

        try {
            if (self::usesCloudinaryDisk($disk)) {
                $ext = pathinfo($relativePath, PATHINFO_EXTENSION) ?: 'jpg';
                $folder = pathinfo($relativePath, PATHINFO_DIRNAME);
                $folder = $folder === '.' ? '' : $folder;
                $tmp = tempnam(sys_get_temp_dir(), 'cld_');
                if ($tmp === false) {
                    throw new RuntimeException('Could not create temporary file for Cloudinary upload.');
                }
                try {
                    file_put_contents($tmp, $contents);
                    $upload = new UploadedFile($tmp, basename($relativePath) ?: 'upload.'.$ext, null, null, true);

                    return self::uploadToCloudinary($upload, $folder);
                } finally {
                    @unlink($tmp);
                }
            }

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
