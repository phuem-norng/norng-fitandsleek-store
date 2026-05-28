<?php

namespace App\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class QdrantHttp
{
    public static function client(int $timeout = 20): PendingRequest
    {
        $request = Http::timeout($timeout);
        $apiKey = trim((string) config('services.image_search.qdrant_api_key', ''));

        if ($apiKey !== '') {
            $request = $request->withHeaders(['api-key' => $apiKey]);
        }

        return $request;
    }
}
