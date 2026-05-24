<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves public-disk files under /api/media/* so Flutter web (and other cross-origin
 * clients) receive CORS headers. Direct /storage/... is static and has no CORS.
 */
class PublicMediaController extends Controller
{
    public function show(string $path): Response
    {
        $path = ltrim(str_replace(['..', '\\'], '', $path), '/');
        if ($path === '' || ! Storage::disk('public')->exists($path)) {
            abort(404);
        }

        $full = Storage::disk('public')->path($path);
        $mime = @mime_content_type($full) ?: 'application/octet-stream';

        return response()->file($full, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
