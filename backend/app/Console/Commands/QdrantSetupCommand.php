<?php

namespace App\Console\Commands;

use App\Services\ImageSearchService;
use Illuminate\Console\Command;

class QdrantSetupCommand extends Command
{
    protected $signature = 'qdrant:setup';

    protected $description = 'Initialize Qdrant products collection (size from QDRANT_VECTOR_SIZE, distance: Cosine)';

    public function handle(ImageSearchService $imageSearchService): int
    {
        $qdrantUrl = rtrim((string) config('services.image_search.qdrant_url', 'http://localhost:6333'), '/');
        $collection = (string) config('services.image_search.qdrant_collection', 'products_fitandsleek_512');
        $vectorSize = $imageSearchService->getVectorSize();

        $this->info("Ensuring Qdrant collection '{$collection}' at {$qdrantUrl} (vector size: {$vectorSize})...");

        try {
            $imageSearchService->ensureCollectionExists();
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Collection '{$collection}' is ready.");

        return self::SUCCESS;
    }
}
