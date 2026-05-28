<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class QdrantDiagnoseCommand extends Command
{
    protected $signature = 'qdrant:diagnose';

    protected $description = 'Check CLIP embed + Qdrant connectivity, collection point counts, and product indexing stats';

    public function handle(): int
    {
        $clip = rtrim((string) config('services.image_search.clip_endpoint', ''), '/');
        $qdrant = rtrim((string) config('services.image_search.qdrant_url', ''), '/');
        $collection = (string) config('services.image_search.qdrant_collection', 'products_fitandsleek_512');
        $vectorSize = (int) config('services.image_search.vector_size', 512);
        $timeout = (int) config('services.image_search.timeout', 25);
        $hasClipKey = filled(config('services.image_search.ai_service_key'));
        $hasQdrantKey = filled(config('services.image_search.qdrant_api_key'));

        $this->info('Resolved configuration');
        $this->line('  FITANDSLEEK_CLIP_ENDPOINT → '.$clip);
        $this->line('  QDRANT_URL → '.$qdrant);
        $this->line('  QDRANT_COLLECTION → '.$collection);
        $this->line('  QDRANT_VECTOR_SIZE → '.$vectorSize);
        $this->line('  IMAGE_SEARCH_TIMEOUT → '.$timeout.' s');
        $this->line('  AI_SERVICE_KEY configured → '.($hasClipKey ? 'yes' : 'no'));
        $this->line('  QDRANT_API_KEY configured → '.($hasQdrantKey ? 'yes' : 'no'));

        $healthUrl = preg_replace('#/embed/?$#i', '', $clip);
        if ($healthUrl === $clip) {
            $healthUrl = preg_replace('#/vectorize/?$#i', '/health', $clip);
            if ($healthUrl === $clip) {
                $healthUrl = rtrim(dirname($clip), '/').'/health';
            }
        }
        if ($healthUrl === '') {
            $healthUrl = $clip;
        }

        $clipHeaders = $hasClipKey
            ? ['x-api-key' => (string) config('services.image_search.ai_service_key')]
            : [];
        $qdrantHeaders = $hasQdrantKey
            ? ['api-key' => (string) config('services.image_search.qdrant_api_key')]
            : [];

        $this->newLine();
        $this->info('CLIP embedding service');
        $this->line('  GET '.$healthUrl);
        try {
            $h = Http::timeout(min(15, $timeout))->withHeaders($clipHeaders)->get($healthUrl);
            if ($h->successful()) {
                $this->line('  OK '.$h->status().' — '.Str::limit(trim($h->body()), 180));
            } else {
                $this->warn('  HTTP '.$h->status().' — '.Str::limit(trim($h->body()), 300));
            }
        } catch (\Throwable $e) {
            $this->error('  Unreachable: '.$e->getMessage());
        }

        $this->newLine();
        $this->info('Qdrant collection');
        $metaUrl = $qdrant.'/collections/'.rawurlencode($collection);
        $this->line('  GET '.$metaUrl);
        try {
            $c = Http::timeout(min(15, $timeout))->withHeaders($qdrantHeaders)->get($metaUrl);
            if ($c->successful()) {
                $result = $c->json('result', []);
                $this->line('  points_count: '.(string) (data_get($result, 'points_count') ?? 'n/a'));
                $this->line('  status: '.(string) (data_get($result, 'status') ?? 'n/a'));
                $configuredSize = data_get($result, 'config.params.vectors.size');
                if ($configuredSize !== null) {
                    $this->line('  vector size: '.(string) $configuredSize.(($configuredSize != $vectorSize) ? ' (expected '.$vectorSize.')' : ''));
                }
            } elseif ($c->status() === 404) {
                $this->warn('  Collection missing (404). Run: php artisan qdrant:setup');
            } else {
                $this->warn('  HTTP '.$c->status().' — '.Str::limit(trim($c->body()), 300));
            }
        } catch (\Throwable $e) {
            $this->error('  Unreachable: '.$e->getMessage());
        }

        $this->newLine();
        $this->info('PostgreSQL (products)');
        try {
            $eligible = Product::query()
                ->where('is_active', true)
                ->whereNotNull('image_url')
                ->where('image_url', '!=', '')
                ->count();
            $indexed = Product::query()->where('is_vector_indexed', true)->count();
            $withErrors = Product::query()
                ->whereNotNull('vector_index_error')
                ->where('is_vector_indexed', false)
                ->count();

            $this->line('  Active with non-empty image_url: '.$eligible);
            $this->line('  is_vector_indexed = true: '.$indexed);
            $this->line('  is_vector_indexed = false with vector_index_error: '.$withErrors);

            $samples = Product::query()
                ->whereNotNull('vector_index_error')
                ->where('is_vector_indexed', false)
                ->orderByDesc('updated_at')
                ->limit(5)
                ->get(['id', 'name', 'vector_index_error']);

            foreach ($samples as $p) {
                $this->warn('  #'.$p->id.' '.$p->name.': '.Str::limit((string) $p->vector_index_error, 240));
            }
        } catch (\Throwable $e) {
            $this->error('  '.$e->getMessage());
        }

        $driver = (string) config('queue.default');
        $this->newLine();
        $this->info('Queue driver: '.$driver);
        try {
            if ($driver === 'database' && Schema::hasTable('jobs')) {
                try {
                    $pending = (int) DB::table('jobs')->count();
                    $this->line('  jobs table rows (pending): '.$pending);
                } catch (\Throwable $e) {
                    $this->warn('  Could not read jobs: '.$e->getMessage());
                }
            } elseif ($driver !== 'database') {
                $this->line('  (Pending job counts are not shown for driver "'.$driver.'".)');
            }

            if (Schema::hasTable('failed_jobs')) {
                try {
                    $failed = (int) DB::table('failed_jobs')->count();
                    if ($failed > 0) {
                        $this->warn('  failed_jobs table rows: '.$failed.' — run: php artisan queue:failed');
                    }
                } catch (\Throwable $e) {
                    // ignore
                }
            }
        } catch (\Throwable $e) {
            $this->warn('  Queue / schema checks skipped (database unreachable): '.Str::limit($e->getMessage(), 200));
        }

        $this->newLine();
        $this->comment('Run this command inside the backend container if DB_HOST=db (Docker network):');
        $this->comment('  docker compose exec backend php artisan qdrant:diagnose');
        $this->comment('Then index a few products:');
        $this->comment('  docker compose exec backend php artisan qdrant:index-products --limit=5 -v');

        return self::SUCCESS;
    }
}
