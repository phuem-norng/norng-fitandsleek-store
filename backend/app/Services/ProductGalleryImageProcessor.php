<?php

namespace App\Services;

use App\Support\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductGalleryImageProcessor
{
    public const WIDTH = 1215;

    public const HEIGHT = 1620;

    private function mediaDisk(): string
    {
        return Media::disk();
    }

    /**
     * Center-crop and resize to {@see WIDTH}×{@see HEIGHT}, store on the configured media disk.
     * Non-raster types (e.g. SVG) are stored unchanged.
     */
    public function storeNormalized(UploadedFile $file): string
    {
        $disk = $this->mediaDisk();
        $mime = strtolower((string) $file->getMimeType());
        if (! $this->canProcessWithGd($mime, $file)) {
            return $file->store('product-gallery', $disk);
        }

        $src = $this->loadImage($file->getRealPath(), $mime, $file);
        if ($src === null) {
            return $file->store('product-gallery', $disk);
        }

        $dest = imagecreatetruecolor(self::WIDTH, self::HEIGHT);
        if ($dest === false) {
            imagedestroy($src);

            return $file->store('product-gallery', $disk);
        }

        $this->fillBackground($dest);
        $this->copyCover($dest, $src);
        imagedestroy($src);

        $relative = 'product-gallery/'.Str::uuid().'.jpg';

        if ($disk === 'public') {
            $absolute = Storage::disk('public')->path($relative);
            $dir = dirname($absolute);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $ok = imagejpeg($dest, $absolute, 90);
            imagedestroy($dest);

            if (! $ok) {
                return $file->store('product-gallery', $disk);
            }

            return $relative;
        }

        ob_start();
        $ok = imagejpeg($dest, null, 90);
        imagedestroy($dest);
        $bytes = $ok ? ob_get_clean() : ob_end_clean();

        if (! $ok || $bytes === false || $bytes === '') {
            return $file->store('product-gallery', $disk);
        }

        return Media::put($relative, $bytes, $disk);
    }

    private function canProcessWithGd(string $mime, UploadedFile $file): bool
    {
        if (! extension_loaded('gd')) {
            return false;
        }
        if (str_contains($mime, 'svg') || str_contains($mime, 'xml')) {
            return false;
        }
        $ext = strtolower((string) $file->getClientOriginalExtension());
        if ($ext === 'svg') {
            return false;
        }

        return true;
    }

    /**
     * @return \GdImage|resource|null
     */
    private function loadImage(string $path, string $mime, UploadedFile $file)
    {
        if (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg') || $mime === 'image/pjpeg') {
            return @imagecreatefromjpeg($path) ?: null;
        }
        if (str_contains($mime, 'png') || $mime === 'image/x-png') {
            $img = @imagecreatefrompng($path);
            if ($img !== false) {
                imagealphablending($img, true);
                imagesavealpha($img, true);
            }

            return $img ?: null;
        }
        if (str_contains($mime, 'webp') && function_exists('imagecreatefromwebp')) {
            return @imagecreatefromwebp($path) ?: null;
        }
        if (str_contains($mime, 'gif')) {
            return @imagecreatefromgif($path) ?: null;
        }
        if (str_contains($mime, 'bmp') || str_contains($mime, 'bitmap')) {
            return function_exists('imagecreatefrombmp') ? (@imagecreatefrombmp($path) ?: null) : null;
        }

        $ext = strtolower((string) $file->getClientOriginalExtension());
        return match ($ext) {
            'jpg', 'jpeg', 'jfif', 'pjpeg' => @imagecreatefromjpeg($path) ?: null,
            'png', 'apng' => @imagecreatefrompng($path) ?: null,
            'webp' => function_exists('imagecreatefromwebp') ? (@imagecreatefromwebp($path) ?: null) : null,
            'gif' => @imagecreatefromgif($path) ?: null,
            default => null,
        };
    }

    /**
     * @param \GdImage|resource $dest
     */
    private function fillBackground($dest): void
    {
        $white = imagecolorallocate($dest, 255, 255, 255);
        if ($white !== false) {
            imagefilledrectangle($dest, 0, 0, self::WIDTH, self::HEIGHT, $white);
        }
    }

    /**
     * @param \GdImage|resource $dest
     * @param \GdImage|resource $src
     */
    private function copyCover($dest, $src): void
    {
        $srcW = imagesx($src);
        $srcH = imagesy($src);
        if ($srcW < 1 || $srcH < 1) {
            return;
        }

        $targetRatio = self::WIDTH / self::HEIGHT;
        $srcRatio = $srcW / $srcH;

        if ($srcRatio > $targetRatio) {
            $cropH = $srcH;
            $cropW = (int) round($srcH * $targetRatio);
            $srcX = (int) round(($srcW - $cropW) / 2);
            $srcY = 0;
        } else {
            $cropW = $srcW;
            $cropH = (int) round($srcW / $targetRatio);
            $srcX = 0;
            $srcY = (int) round(($srcH - $cropH) / 2);
        }

        imagecopyresampled(
            $dest,
            $src,
            0,
            0,
            $srcX,
            $srcY,
            self::WIDTH,
            self::HEIGHT,
            $cropW,
            $cropH
        );
    }
}
