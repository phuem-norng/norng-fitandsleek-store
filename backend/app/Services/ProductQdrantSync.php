<?php

namespace App\Services;

use App\Jobs\SyncProductToQdrant;
use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Schedules PostgreSQL → Qdrant sync when products are created or updated.
 */
class ProductQdrantSync
{
    public static function isEnabled(): bool
    {
        return filter_var(config('services.image_search.auto_sync', true), FILTER_VALIDATE_BOOLEAN);
    }

    public static function isConfigured(): bool
    {
        $qdrant = strtolower(trim((string) config('services.image_search.qdrant_url', '')));
        $vectorize = strtolower(trim((string) config('services.image_search.vectorize_url', '')));

        if ($qdrant === '' || $vectorize === '') {
            return false;
        }

        // Invalid on Render/production (Docker-only hostname).
        if (Str::contains($qdrant, 'host.docker.internal')) {
            return false;
        }

        return true;
    }

    public static function shouldIndex(Product $product): bool
    {
        return $product->is_active && filled($product->image_url);
    }

    /**
     * @param  array<int, string>  $changedKeys
     */
    public static function shouldSyncAfterSave(Product $product, bool $wasCreated, array $changedKeys): bool
    {
        if (! static::isEnabled() || ! static::isConfigured()) {
            return false;
        }

        if (! static::shouldIndex($product)) {
            return false;
        }

        if ($wasCreated) {
            return true;
        }

        if (! $product->is_vector_indexed) {
            return true;
        }

        $watch = ['image_url', 'is_active', 'name', 'slug', 'category_id', 'brand_id'];

        return count(array_intersect($watch, $changedKeys)) > 0;
    }

    /**
     * @param  array<int, string>  $changedKeys
     */
    public static function shouldRemoveAfterSave(Product $product, bool $wasCreated, array $changedKeys): bool
    {
        if ($wasCreated || ! static::isConfigured()) {
            return false;
        }

        if (! static::shouldIndex($product)
            && ($product->is_vector_indexed || filled($product->vector_index_error))) {
            return true;
        }

        return array_key_exists('image_url', $changedKeys) && ! filled($product->image_url);
    }

    public static function scheduleIndex(Product $product): void
    {
        if (! static::shouldIndex($product)) {
            return;
        }

        $useInline = filter_var(config('services.image_search.sync_inline', false), FILTER_VALIDATE_BOOLEAN);

        if ($useInline) {
            SyncProductToQdrant::dispatchSync($product->id);

            return;
        }

        SyncProductToQdrant::dispatch($product->id)->afterCommit();
    }

    public static function scheduleRemove(Product $product): void
    {
        $productId = $product->id;

        $callback = static function () use ($productId) {
            $fresh = Product::query()->find($productId);
            if ($fresh) {
                $fresh->forceFill([
                    'is_vector_indexed' => false,
                    'vector_indexed_at' => null,
                    'vector_index_error' => null,
                ])->saveQuietly();
            }

            try {
                app(ImageSearchService::class)->deleteProductVector($productId);
            } catch (\Throwable) {
                // Qdrant may be down; DB flags are cleared so scheduler can retry index later.
            }
        };

        if (filter_var(config('services.image_search.sync_inline', false), FILTER_VALIDATE_BOOLEAN)) {
            $callback();

            return;
        }

        dispatch($callback)->afterCommit();
    }
}
