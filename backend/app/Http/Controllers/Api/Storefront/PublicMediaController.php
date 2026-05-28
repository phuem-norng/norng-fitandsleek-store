<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Support\MediaDisk;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves public-disk files under /api/media/* so Flutter web (and other cross-origin
 * clients) receive CORS headers. When media is on R2/S3, redirects to the public CDN URL.
 */
class PublicMediaController extends Controller
{
    public function show(string $path): Response
    {
        $path = ltrim(str_replace(['..', '\\'], '', $path), '/');
        if ($path === '') {
            abort(404);
        }

        if (MediaDisk::isRemote()) {
            if (! MediaDisk::exists($path)) {
                abort(404);
            }

            return redirect(MediaDisk::url($path));
        }

        if (! MediaDisk::disk()->exists($path)) {
            abort(404);
        }

        $full = MediaDisk::disk()->path($path);
        $mime = @mime_content_type($full) ?: 'application/octet-stream';

        return response()->file($full, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
