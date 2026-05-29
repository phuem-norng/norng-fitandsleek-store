<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Support\Media;
use Illuminate\Http\Request;

abstract class BaseAdminController extends Controller
{
    protected function bool($v): bool
    {
        if (is_bool($v)) {
            return $v;
        }

        return in_array((string) $v, ['1', 'true', 'on', 'yes'], true);
    }

    protected function mediaDisk(): string
    {
        return Media::disk();
    }

    protected function storeImage(Request $request, string $field, string $dir): ?string
    {
        if (! $request->hasFile($field)) {
            return null;
        }

        return Media::storeUploaded($request->file($field), $dir, $this->mediaDisk());
    }

    protected function deleteMediaPath(?string $path): void
    {
        Media::delete($path);
    }
}
