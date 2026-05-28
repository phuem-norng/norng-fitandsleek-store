<?php

namespace App\Console\Commands;

use App\Jobs\SyncProductToQdrant;
use App\Models\Product;
use App\Services\ImageSearchService;
use App\Services\ProductQdrantIndexer;
use Illuminate\Console\Command;

class QdrantIndexProductsCommand extends Command
{
    protected $signature = 'qdrant:index-products
                            {--product_id= : Index a single product by id}
                            {--limit=0 : Max products to process (0 = no limit)}
                            {--only-missing : Only products with is_vector_indexed = false}
                            {--include-inactive : Include inactive products}
                            {--queue : Dispatch a SyncProductToQdrant job per product instead of indexing inline (requires queue worker)}';

    protected $description = 'Vectorize product images from PostgreSQL and upsert into Qdrant (see FITANDSLEEK_CLIP_ENDPOINT & QDRANT_URL in .env)';

    public function handle(ImageSearchService $imageSearchService, ProductQdrantIndexer $indexer): int
    {
        try {
            $imageSearchService->ensureCollectionExists();
        } catch (\Throwable $e) {
            $this->error('Qdrant collection check failed: '.$e->getMessage());

            return self::FAILURE;
        }

        $query = Product::query()
            ->whereNotNull('image_url')
            ->orderBy('id');

        if (! $this->option('include-inactive')) {
            $query->where('is_active', true);
        }

        if ($this->option('only-missing')) {
            $query->where('is_vector_indexed', false);
        }

        if ($this->option('product_id')) {
            $query->where('id', (int) $this->option('product_id'));
        }

        $limit = (int) $this->option('limit');
        if ($limit > 0) {
            $query->limit($limit);
        }

        $products = $query->get();

        if ($products->isEmpty()) {
            $this->warn('No products found to index.');

            return self::SUCCESS;
        }

        $useQueue = (bool) $this->option('queue');

        if ($useQueue) {
            foreach ($products as $product) {
                SyncProductToQdrant::dispatch($product->id)->afterCommit();
            }
            $this->info('Queued '.$products->count().' job(s). Run `php artisan queue:work` to process.');

            return self::SUCCESS;
        }

        $this->info('Indexing '.$products->count().' product(s) into Qdrant...');

        $indexed = 0;
        $failed = 0;

        foreach ($products as $product) {
            try {
                $indexer->index($product);
                $indexed++;
                $this->line("✔ Indexed product #{$product->id} ({$product->name})");
            } catch (\Throwable $e) {
                $failed++;
                $this->error("✘ Failed product #{$product->id}: ".$e->getMessage());
            }
        }

        $this->newLine();
        $this->info("Done. Indexed: {$indexed}, Failed: {$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
