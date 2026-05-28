<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

abstract class BaseAdminController extends Controller
{
    protected function bool($v): bool
    {
        if (is_bool($v)) return $v;
        return in_array((string)$v, ['1','true','on','yes'], true);
    }

    protected function mediaDisk(): string
    {
        return (string) config('filesystems.default', 'public');
    }

    protected function storeImage(Request $request, string $field, string $dir): ?string
    {
        if (!$request->hasFile($field)) return null;
        return $request->file($field)->store($dir, $this->mediaDisk());
    }

    protected function deleteMediaPath(?string $path): void
    {
        $path = trim((string) $path);
        if ($path === '' || preg_match('#^https?://#i', $path)) {
            return;
        }

        foreach (array_unique([$this->mediaDisk(), 'cloudinary', 'public']) as $disk) {
            try {
                \Storage::disk($disk)->delete($path);
            } catch (\Throwable) {
                // Best effort cleanup across old/new storage backends.
            }
        }
    }
}
