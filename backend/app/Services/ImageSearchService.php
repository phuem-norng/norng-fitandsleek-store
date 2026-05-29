<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ImageSearchService
{
    private string $clipEndpoint;

    private string $qdrantUrl;

    private string $collection;

    private int $timeout;

    private int $vectorSize;

    private ?string $aiServiceKey;

    private ?string $qdrantApiKey;

    /** Hugging Face /embed expects multipart field `file`; legacy /vectorize uses `image`. */
    private bool $clipUsesFileField;

    public function __construct()
    {
        $this->clipEndpoint = rtrim((string) config('services.image_search.clip_endpoint', 'http://localhost:9000/vectorize'), '/');
        $this->qdrantUrl = rtrim((string) config('services.image_search.qdrant_url', 'http://localhost:6333'), '/');
        $this->collection = (string) config('services.image_search.qdrant_collection', 'products_fitandsleek_512');
        $this->vectorSize = (int) config('services.image_search.vector_size', 512);
        $this->aiServiceKey = filled(config('services.image_search.ai_service_key'))
            ? (string) config('services.image_search.ai_service_key')
            : null;
        $this->qdrantApiKey = filled(config('services.image_search.qdrant_api_key'))
            ? (string) config('services.image_search.qdrant_api_key')
            : null;
        $this->clipUsesFileField = (bool) preg_match('#/embed/?$#i', $this->clipEndpoint);
        $this->timeout = max(1, (int) config('services.image_search.timeout', 25));

        $bufferSeconds = 15;
        $desiredLimit = $this->timeout + $bufferSeconds;
        $currentLimit = (int) ini_get('max_execution_time');

        if ($currentLimit !== 0 && $currentLimit < $desiredLimit) {
            @ini_set('max_execution_time', (string) $desiredLimit);
            if (function_exists('set_time_limit')) {
                @set_time_limit($desiredLimit);
            }
        }

        $socketTimeout = (int) ini_get('default_socket_timeout');
        if ($socketTimeout !== 0 && $socketTimeout < $this->timeout) {
            @ini_set('default_socket_timeout', (string) $this->timeout);
        }
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function vectorizeImage(UploadedFile $image): array
    {
        $fieldName = $this->clipUsesFileField ? 'file' : 'image';

        try {
            $response = $this->clipHttp()
                ->attach(
                    $fieldName,
                    file_get_contents($image->getRealPath()),
                    $image->getClientOriginalName() ?: 'image.jpg'
                )
                ->post($this->clipEndpoint);
        } catch (ConnectionException $e) {
            throw new RuntimeException('CLIP embedding service is unreachable: ' . $e->getMessage());
        }

        if ($response->failed()) {
            throw new RuntimeException('CLIP embedding service error: ' . $response->status() . ' ' . $response->body());
        }

        $vector = $this->parseVectorFromResponse($response);

        if (count($vector) !== $this->vectorSize) {
            throw new RuntimeException(
                'Invalid vector returned from CLIP service. Expected ' . $this->vectorSize . ' dimensions, got ' . count($vector) . '.'
            );
        }

        return $vector;
    }

    public function indexProductImage(int $productId, UploadedFile $image, array $metadata = []): void
    {
        $vector = $this->vectorizeImage($image);
        $this->upsertVector($productId, $vector, $metadata);
    }

    public function upsertVector(int $productId, array $vector, array $metadata = []): void
    {
        $this->ensureCollectionExists();

        $safeMetadata = collect($metadata)
            ->filter(static fn ($value) => is_scalar($value) || $value === null)
            ->toArray();

        $payload = [
            'points' => [
                [
                    'id' => $productId,
                    'vector' => $vector,
                    'payload' => array_merge($safeMetadata, [
                        'product_id' => $productId,
                    ]),
                ],
            ],
        ];

        try {
            $response = $this->qdrantHttp()
                ->put($this->qdrantUrl . '/collections/' . $this->collection . '/points?wait=true', $payload);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Qdrant is unreachable: ' . $e->getMessage());
        }

        if ($response->failed()) {
            throw new RuntimeException('Qdrant upsert failed: ' . $response->status() . ' ' . $response->body());
        }
    }

    public function searchSimilarProductIds(UploadedFile $image, int $limit = 12): array
    {
        $this->ensureCollectionExists();

        $vector = $this->vectorizeImage($image);

        try {
            $response = $this->qdrantHttp()
                ->post($this->qdrantUrl . '/collections/' . $this->collection . '/points/search', [
                    'vector' => $vector,
                    'limit' => $limit,
                    'with_payload' => true,
                    'with_vector' => false,
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Qdrant search failed: ' . $e->getMessage());
        }

        if ($response->failed()) {
            throw new RuntimeException('Qdrant search failed: ' . $response->status() . ' ' . $response->body());
        }

        $results = $response->json('result', []);

        return collect($results)
            ->map(function ($item) {
                $payloadId = data_get($item, 'payload.product_id');
                if (is_numeric($payloadId)) {
                    return (int) $payloadId;
                }

                $pointId = data_get($item, 'id');

                return is_numeric($pointId) ? (int) $pointId : null;
            })
            ->filter(static fn ($id) => $id !== null)
            ->unique()
            ->values()
            ->all();
    }

    public function deletePoint(int $pointId): void
    {
        try {
            $response = $this->qdrantHttp()
                ->post($this->qdrantUrl . '/collections/' . $this->collection . '/points/delete?wait=true', [
                    'points' => [$pointId],
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Qdrant is unreachable: ' . $e->getMessage());
        }

        if ($response->failed()) {
            throw new RuntimeException('Qdrant delete failed: ' . $response->status() . ' ' . $response->body());
        }
    }

    public function ensureCollectionExists(): void
    {
        try {
            $check = $this->qdrantHttp()
                ->get($this->qdrantUrl . '/collections/' . $this->collection);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Qdrant is unreachable: ' . $e->getMessage());
        }

        if ($check->successful()) {
            return;
        }

        if ($check->status() !== 404) {
            throw new RuntimeException('Failed to verify Qdrant collection: ' . $check->status() . ' ' . $check->body());
        }

        try {
            $create = $this->qdrantHttp()
                ->put($this->qdrantUrl . '/collections/' . $this->collection, [
                    'vectors' => [
                        'size' => $this->vectorSize,
                        'distance' => 'Cosine',
                    ],
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Failed to create Qdrant collection: ' . $e->getMessage());
        }

        if ($create->failed()) {
            throw new RuntimeException('Failed to create Qdrant collection: ' . $create->status() . ' ' . $create->body());
        }
    }

    private function clipHttp(): PendingRequest
    {
        $request = Http::timeout($this->timeout);

        if ($this->aiServiceKey !== null) {
            $request = $request->withHeaders(['x-api-key' => $this->aiServiceKey]);
        }

        return $request;
    }

    private function qdrantHttp(): PendingRequest
    {
        $request = Http::timeout($this->timeout);

        if ($this->qdrantApiKey !== null) {
            $request = $request->withHeaders(['api-key' => $this->qdrantApiKey]);
        }

        return $request;
    }

    /**
     * @return list<float>
     */
    private function parseVectorFromResponse(Response $response): array
    {
        $vector = $response->json('vector') ?? $response->json('embedding');

        if (! is_array($vector)) {
            throw new RuntimeException('Invalid vector returned from CLIP service. Expected a numeric array in `vector` or `embedding`.');
        }

        return array_map(static fn ($v) => (float) $v, $vector);
    }
}
