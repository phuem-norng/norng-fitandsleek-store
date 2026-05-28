<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\ImageSearchService;
use App\Support\ImageSearchImageFactory;
use App\Support\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Throwable;

class ImageSearchController extends Controller
{
    public function status(): JsonResponse
    {
        $vectorizeUrl = rtrim((string) config('services.image_search.vectorize_url', ''), '/');
        $qdrantUrl = rtrim((string) config('services.image_search.qdrant_url', ''), '/');
        $healthUrl = preg_replace('#/vectorize$#', '/health', $vectorizeUrl) ?: $vectorizeUrl.'/health';

        $vectorizeOk = false;
        $qdrantOk = false;
        $vectorizeDetail = null;
        $qdrantDetail = null;

        try {
            $health = Http::timeout(8)->get($healthUrl);
            $vectorizeOk = $health->successful();
            if (! $vectorizeOk) {
                $vectorizeDetail = 'HTTP '.$health->status();
            }
        } catch (Throwable $e) {
            $vectorizeDetail = $e->getMessage();
        }

        try {
            $collections = Http::timeout(8)->get($qdrantUrl.'/collections');
            $qdrantOk = $collections->successful();
            if (! $qdrantOk) {
                $qdrantDetail = 'HTTP '.$collections->status();
            }
        } catch (Throwable $e) {
            $qdrantDetail = $e->getMessage();
        }

        $collection = (string) config('services.image_search.qdrant_collection', 'products');
        $indexedProducts = Product::query()->where('is_vector_indexed', true)->where('is_active', true)->count();
        $activeWithImage = Product::query()
            ->where('is_active', true)
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            ->count();

        $ready = $vectorizeOk && $qdrantOk && $indexedProducts > 0;

        return response()->json([
            'ready' => $ready,
            'vectorize_ok' => $vectorizeOk,
            'qdrant_ok' => $qdrantOk,
            'collection' => $collection,
            'indexed_products' => $indexedProducts,
            'active_products_with_image' => $activeWithImage,
            'vectorize_url' => $vectorizeUrl,
            'qdrant_url' => $qdrantUrl,
            'vectorize_detail' => config('app.debug') ? $vectorizeDetail : null,
            'qdrant_detail' => config('app.debug') ? $qdrantDetail : null,
            'hint' => $ready
                ? null
                : 'Start Qdrant + ai-service (docker compose --profile ai up -d), then run: php artisan qdrant:setup && php artisan qdrant:index-products --only-missing',
        ]);
    }

    public function search(Request $request, ImageSearchService $imageSearchService): JsonResponse
    {
        $desired = 180;
        @ini_set('max_execution_time', (string) $desired);
        if (function_exists('set_time_limit')) {
            @set_time_limit($desired);
        }
        @ini_set('default_socket_timeout', (string) max($desired, (int) ini_get('default_socket_timeout')));

        $validated = $request->validate([
            'image' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,avif,gif', 'max:5120'],
            'url' => ['nullable', 'url', 'max:2048'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        if (! $request->hasFile('image') && empty($validated['url'])) {
            throw ValidationException::withMessages([
                'image' => ['Upload an image file or provide a valid image URL.'],
            ]);
        }

        $limit = (int) ($validated['limit'] ?? 12);
        $tempUpload = null;

        try {
            $image = $this->resolveQueryImage($request, $validated, $tempUpload);
            $fetchLimit = min(50, max($limit * 3, $limit));
            $productIds = $imageSearchService->searchSimilarProductIds($image, $fetchLimit);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Image similarity search failed.',
                'error' => config('app.debug') ? $e->getMessage() : 'Check that Qdrant and the vectorize service are running and products are indexed.',
                'hint' => 'Run: php artisan qdrant:setup && php artisan qdrant:index-products --only-missing',
            ], 502);
        } finally {
            if ($tempUpload instanceof UploadedFile && is_file($tempUpload->getRealPath())) {
                @unlink($tempUpload->getRealPath());
            }
        }

        if (empty($productIds)) {
            return response()->json([
                'products' => [],
                'total' => 0,
                'match_reason' => 'qdrant_similarity',
                'hint' => 'No similar products in the index. Index catalog images with: php artisan qdrant:index-products --only-missing',
            ]);
        }

        $products = Product::query()
            ->with(['category', 'brand', 'activeDiscount'])
            ->where('is_active', true)
            ->whereIn('id', $productIds)
            ->get();

        $topMatchId = $productIds[0] ?? null;
        $topMatch = $topMatchId ? $products->firstWhere('id', $topMatchId) : null;
        $lockedCategoryId = $topMatch?->category_id;
        if ($lockedCategoryId) {
            $products = $products->where('category_id', $lockedCategoryId)->values();
        }

        $rankedProducts = collect($productIds)
            ->map(function (int $id, int $index) use ($products) {
                $product = $products->firstWhere('id', $id);
                if (! $product) {
                    return null;
                }

                return [
                    'id' => $product->id,
                    'slug' => $product->slug,
                    'name' => $product->name,
                    'description' => $product->description,
                    'price' => (float) $product->price,
                    'final_price' => (float) $product->final_price,
                    'discount_price' => $product->discount_price,
                    'discount_percentage' => $product->discount_percentage,
                    'has_discount' => (bool) $product->has_discount,
                    'image_url' => Media::url($product->image_url) ?? $product->image_url,
                    'category' => $product->category ? [
                        'id' => $product->category->id,
                        'name' => $product->category->name,
                        'slug' => $product->category->slug,
                    ] : null,
                    'brand' => $product->brand ? [
                        'id' => $product->brand->id,
                        'name' => $product->brand->name,
                        'slug' => $product->brand->slug,
                    ] : null,
                    'similarity_rank' => $index + 1,
                ];
            })
            ->filter()
            ->values()
            ->take($limit);

        return response()->json([
            'match_reason' => 'qdrant_similarity',
            'products' => $rankedProducts,
            'total' => $rankedProducts->count(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function resolveQueryImage(Request $request, array $validated, ?UploadedFile &$tempUpload): UploadedFile
    {
        if ($request->hasFile('image')) {
            return $request->file('image');
        }

        $tempUpload = ImageSearchImageFactory::fromUrl((string) $validated['url']);

        return $tempUpload;
    }
}
