<?php

namespace App\Services;

use App\Models\Product;
use App\Support\Media;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Reads product image URLs from PostgreSQL-backed models, vectorizes them,
 * and upserts vectors into Qdrant for image similarity search.
 */
class ProductQdrantIndexer
{
    public function __construct(
        private readonly ImageSearchService $imageSearchService
    ) {}

    /**
     * @throws \Throwable
     */
    public function index(Product $product): void
    {
        $imageUrl = $product->image_url;
        if ($imageUrl === null || trim((string) $imageUrl) === '') {
            throw new \InvalidArgumentException('Product has no image_url to index.');
        }

        $tempPath = null;

        try {
            [$uploadedFile, $tempPath] = $this->toUploadedImage((string) $imageUrl);

            $this->imageSearchService->indexProductImage(
                $product->id,
                $uploadedFile,
                [
                    'name' => $product->name,
                    'slug' => $product->slug,
                    'category_id' => $product->category_id,
                    'brand_id' => $product->brand_id,
                ]
            );

            $product->forceFill([
                'is_vector_indexed' => true,
                'vector_indexed_at' => now(),
                'vector_index_error' => null,
            ])->save();
        } catch (\Throwable $e) {
            $message = Str::limit($e->getMessage(), 1000, '...');

            $product->forceFill([
                'is_vector_indexed' => false,
                'vector_index_error' => $message,
            ])->save();

            throw $e;
        } finally {
            if ($tempPath && file_exists($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    /**
     * @return array{0: UploadedFile, 1: string} file and temp path for cleanup
     */
    private function toUploadedImage(string $imageUrl): array
    {
        $content = null;
        $mime = null;
        $filename = 'image.jpg';

        if (str_starts_with($imageUrl, 'data:image/')) {
            [$content, $mime, $filename] = $this->decodeDataUrl($imageUrl);
        } elseif (str_starts_with($imageUrl, 'http://') || str_starts_with($imageUrl, 'https://')) {
            $filename = basename(parse_url($imageUrl, PHP_URL_PATH) ?: 'image.jpg');

            $response = Http::timeout(30)->get($imageUrl);
            if ($response->failed()) {
                throw new \RuntimeException('Cannot download image: '.$imageUrl);
            }

            $content = $response->body();
            $mime = $response->header('Content-Type');
        } else {
            $filename = basename(parse_url($imageUrl, PHP_URL_PATH) ?: 'image.jpg');
            $content = Media::readBytes($imageUrl);

            if ($content === null) {
                $localPath = Media::resolveLocalPath($imageUrl);
                if (! $localPath || ! file_exists($localPath)) {
                    throw new \RuntimeException('Image file not found: '.$imageUrl);
                }

                $content = file_get_contents($localPath);
                $mime = mime_content_type($localPath) ?: 'image/jpeg';
                $filename = basename($localPath);
            } else {
                $mime = 'image/jpeg';
            }
        }

        if ($content === false || $content === null) {
            throw new \RuntimeException('Failed reading image bytes for: '.$imageUrl);
        }

        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        if (! $ext) {
            $ext = $this->extensionFromMime((string) $mime);
            $filename .= '.'.$ext;
        }

        $tempDir = storage_path('app/tmp/qdrant-index');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0775, true);
        }

        $tempPath = $tempDir.'/'.uniqid('img_', true).'.'.$ext;
        file_put_contents($tempPath, $content);

        return [
            new UploadedFile($tempPath, $filename, $mime ?: 'image/jpeg', null, true),
            $tempPath,
        ];
    }

    private function extensionFromMime(string $mime): string
    {
        return match (strtolower(trim(explode(';', $mime)[0]))) {
            'image/png' => 'png',
            'image/avif' => 'avif',
            'image/gif' => 'gif',
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/webp' => 'webp',
            default => 'jpg',
        };
    }

    private function decodeDataUrl(string $dataUrl): array
    {
        if (! preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', $dataUrl, $matches)) {
            throw new \RuntimeException('Invalid data URL format for image');
        }

        $mime = strtolower(trim($matches[1]));
        $raw = preg_replace('/\s+/', '', $matches[2]);
        $content = base64_decode($raw, true);

        if ($content === false) {
            throw new \RuntimeException('Invalid base64 image data');
        }

        $ext = $this->extensionFromMime($mime);
        $filename = 'image.'.$ext;

        return [$content, $mime, $filename];
    }
}
