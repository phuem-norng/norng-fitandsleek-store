<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
/**
 * Build UploadedFile instances for image similarity search (upload, URL, or local path).
 */
class ImageSearchImageFactory
{
    public static function fromUrl(string $url): UploadedFile
    {
        $url = trim($url);
        if ($url === '' || ! filter_var($url, FILTER_VALIDATE_URL)) {
            throw new \InvalidArgumentException('Invalid image URL.');
        }

        $response = Http::timeout(30)
            ->withHeaders(['User-Agent' => 'FitandSleek-ImageSearch/1.0'])
            ->get($url);

        if ($response->failed()) {
            throw new \RuntimeException('Could not download image from URL (HTTP '.$response->status().').');
        }

        $content = $response->body();
        if ($content === '' || strlen($content) < 32) {
            throw new \RuntimeException('Downloaded image is empty or too small.');
        }

        if (strlen($content) > 5 * 1024 * 1024) {
            throw new \RuntimeException('Image from URL exceeds 5MB limit.');
        }

        $mime = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
        if ($mime !== '' && ! str_starts_with($mime, 'image/')) {
            throw new \RuntimeException('URL does not point to an image (content-type: '.$mime.').');
        }

        $filename = basename(parse_url($url, PHP_URL_PATH) ?: '') ?: 'image.jpg';
        if (! preg_match('/\.(jpe?g|png|webp|avif|gif)$/i', $filename)) {
            $filename = 'image.'.self::extensionFromMime($mime);
        }

        return self::writeTempFile($content, $filename, $mime ?: 'image/jpeg');
    }

    public static function writeTempFile(string $content, string $filename, string $mime): UploadedFile
    {
        $ext = pathinfo($filename, PATHINFO_EXTENSION) ?: self::extensionFromMime($mime);
        $tempDir = storage_path('app/tmp/image-search');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $tempPath = $tempDir.'/'.uniqid('query_', true).'.'.$ext;
        file_put_contents($tempPath, $content);

        return new UploadedFile($tempPath, $filename, $mime, null, true);
    }

    private static function extensionFromMime(string $mime): string
    {
        return match (strtolower(trim(explode(';', $mime)[0]))) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
            'image/gif' => 'gif',
            default => 'jpg',
        };
    }
}
