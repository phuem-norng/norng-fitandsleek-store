<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Support\Media;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves public-disk files under /api/media/* so Flutter web (and other cross-origin
 * clients) receive CORS headers. When FILESYSTEM_DISK=cloudinary, redirects to the CDN URL.
 */
class PublicMediaController extends Controller
{
    public function show(string $path): Response
    {
        $path = ltrim(str_replace(['..', '\\'], '', $path), '/');
        if ($path === '') {
            abort(404);
        }

        $defaultDisk = Media::disk();
        if ($defaultDisk !== 'public') {
            try {
                if (Storage::disk($defaultDisk)->exists($path)) {
                    $remoteUrl = Storage::disk($defaultDisk)->url($path);
                    if (Media::isExternalUrl($remoteUrl)) {
                        return redirect()->away($remoteUrl);
                    }
                }
            } catch (\Throwable) {
                // Fall through to local public disk for legacy files.
            }
        }

        if (! Storage::disk('public')->exists($path)) {
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
