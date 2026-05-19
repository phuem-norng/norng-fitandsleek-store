<?php

namespace App\Jobs;

use App\Models\Product;
use App\Services\ProductQdrantIndexer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Pushes a single product's primary image from PostgreSQL into Qdrant (async).
 */
class SyncProductToQdrant implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $timeout = 180;

    public function __construct(public int $productId) {}

    public function handle(ProductQdrantIndexer $indexer): void
    {
        $product = Product::query()->find($this->productId);
        if (! $product) {
            return;
        }

        if (! $product->is_active || ! filled($product->image_url)) {
            return;
        }

        $indexer->index($product);
    }
}
