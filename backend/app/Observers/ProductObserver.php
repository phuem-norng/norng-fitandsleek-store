<?php

namespace App\Observers;

use App\Models\Product;
use App\Services\ProductQdrantIndexer;
use Illuminate\Support\Facades\Log;

class ProductObserver
{
    /** @var list<string> */
    private const QDRANT_SYNC_ATTRIBUTES = [
        'image_url',
        'is_active',
        'name',
        'slug',
        'category_id',
        'brand_id',
    ];

    /** @var list<string> */
    private const VECTOR_STATUS_ATTRIBUTES = [
        'is_vector_indexed',
        'vector_indexed_at',
        'vector_index_error',
    ];

    public function __construct(
        private readonly ProductQdrantIndexer $indexer
    ) {}

    public function created(Product $product): void
    {
        $this->syncToQdrant($product);
    }

    public function updated(Product $product): void
    {
        if ($this->isVectorStatusOnlyUpdate($product)) {
            return;
        }

        if (! $this->hasRelevantQdrantChanges($product)) {
            return;
        }

        $this->syncToQdrant($product);
    }

    public function deleted(Product $product): void
    {
        try {
            $this->indexer->removeById($product->id);
        } catch (\Throwable $e) {
            Log::warning('Qdrant vector delete failed after product deletion', [
                'product_id' => $product->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function syncToQdrant(Product $product): void
    {
        try {
            if ($this->shouldIndexInQdrant($product)) {
                $this->indexer->index($product);

                return;
            }

            if ($product->is_vector_indexed || $product->wasChanged(['image_url', 'is_active'])) {
                $this->indexer->remove($product);
            }
        } catch (\Throwable $e) {
            Log::warning('Qdrant product vector sync failed', [
                'product_id' => $product->id,
                'event' => $product->wasRecentlyCreated ? 'created' : 'updated',
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function shouldIndexInQdrant(Product $product): bool
    {
        return $product->is_active && filled($product->image_url);
    }

    private function hasRelevantQdrantChanges(Product $product): bool
    {
        return $product->wasChanged(self::QDRANT_SYNC_ATTRIBUTES);
    }

    private function isVectorStatusOnlyUpdate(Product $product): bool
    {
        $changed = array_keys($product->getChanges());

        return $changed !== []
            && array_diff($changed, array_merge(self::VECTOR_STATUS_ATTRIBUTES, ['updated_at'])) === [];
    }
}
