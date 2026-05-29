<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BrandAdminController extends BaseAdminController
{
    private function isExternalUrl(?string $value): bool
    {
        return is_string($value) && preg_match('#^https?://#i', $value) === 1;
    }

    private function normalizeBrandRequest(Request $request): void
    {
        if (! $request->filled('slug') && $request->filled('name')) {
            $request->merge(['slug' => Str::slug((string) $request->input('name'))]);
        }

        if ($request->has('is_active')) {
            $request->merge(['is_active' => $this->bool($request->input('is_active'))]);
        }
    }

    private function logoFileRules(bool $required = false): array
    {
        $rules = ['file', 'mimes:jpg,jpeg,png,webp,svg', 'max:5120'];

        return $required ? array_merge(['required'], $rules) : array_merge(['nullable'], $rules);
    }

    private function resolveLogoUrl(?string $path): ?string
    {
        $path = trim((string) $path);
        if ($path === '') {
            return null;
        }

        if ($this->isExternalUrl($path)) {
            return $path;
        }

        if (str_starts_with($path, '/storage/')) {
            return $path;
        }

        if (str_starts_with($path, 'storage/')) {
            return '/'.$path;
        }

        $key = Media::storageKey($path);
        if ($key) {
            try {
                if (Storage::disk('public')->exists($key)) {
                    return '/storage/'.$key;
                }
            } catch (\Throwable) {
                // Fall through to Media::publicUrl.
            }
        }

        try {
            return Media::publicUrl($path);
        } catch (\Throwable) {
            return null;
        }
    }

    private function storeLogoFromRequest(Request $request): string|\Illuminate\Http\JsonResponse
    {
        if (! $request->hasFile('logo')) {
            return '';
        }

        try {
            $stored = $this->storeImage($request, 'logo', 'brands');
            if ($stored === null || trim($stored) === '') {
                return response()->json([
                    'message' => 'Logo upload failed.',
                    'errors' => ['logo' => ['Storage did not return a file path.']],
                ], 503);
            }

            return $stored;
        } catch (\Throwable $e) {
            Log::error('Brand logo upload failed.', [
                'disk' => $this->mediaDisk(),
                'error' => $e->getMessage(),
            ]);

            $debugEnabled = filter_var(env('ADMIN_PROFILE_IMAGE_DEBUG', false), FILTER_VALIDATE_BOOL);
            $message = 'Could not upload logo to media storage. Please retry.';
            if ($debugEnabled) {
                $message .= ' ('.$e->getMessage().')';
            }

            return response()->json([
                'message' => 'Logo upload failed.',
                'errors' => ['logo' => [$message]],
                'debug_message' => $debugEnabled ? $e->getMessage() : null,
            ], 503);
        }
    }

    public function index()
    {
        $items = Brand::query()->orderBy('sort_order')->latest('id')->get()->map(function ($b) {
            return [
                'id' => $b->id,
                'name' => $b->name,
                'slug' => $b->slug,
                'logo_path' => $b->logo_path,
                'logo_url' => $this->resolveLogoUrl($b->logo_path),
                'sort_order' => $b->sort_order,
                'is_active' => (bool) $b->is_active,
                'created_at' => $b->created_at,
            ];
        });

        return response()->json(['data' => $items]);
    }

    public function show(Brand $brand)
    {
        return response()->json([
            'data' => [
                'id' => $brand->id,
                'name' => $brand->name,
                'slug' => $brand->slug,
                'logo_path' => $brand->logo_path,
                'logo_url' => $this->resolveLogoUrl($brand->logo_path),
                'sort_order' => $brand->sort_order,
                'is_active' => (bool) $brand->is_active,
                'created_at' => $brand->created_at,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $this->normalizeBrandRequest($request);

        $validated = $request->validate([
            'name' => ['required','string','max:120'],
            'slug' => ['required','string','max:140','unique:brands,slug'],
            'sort_order' => ['nullable','integer','min:0'],
            'is_active' => ['nullable','boolean'],
            'logo' => $this->logoFileRules(),
            'logo_url' => ['nullable','url','max:2048'],
        ]);

        $path = null;

        if ($request->hasFile('logo')) {
            $stored = $this->storeLogoFromRequest($request);
            if ($stored instanceof \Illuminate\Http\JsonResponse) {
                return $stored;
            }
            $path = $stored !== '' ? $stored : null;
        } elseif (! empty($validated['logo_url'] ?? null)) {
            $path = $validated['logo_url'];
        }

        $b = Brand::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
            'logo_path' => $path,
        ]);

        return response()->json([
            'data' => [
                'id' => $b->id,
                'name' => $b->name,
                'slug' => $b->slug,
                'logo_path' => $b->logo_path,
                'logo_url' => $this->resolveLogoUrl($b->logo_path),
                'sort_order' => $b->sort_order,
                'is_active' => (bool) $b->is_active,
            ]
        ], 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $this->normalizeBrandRequest($request);

        $validated = $request->validate([
            'name' => ['sometimes','required','string','max:120'],
            'slug' => ['sometimes','required','string','max:140','unique:brands,slug,'.$brand->id],
            'sort_order' => ['sometimes','nullable','integer','min:0'],
            'is_active' => ['sometimes','nullable','boolean'],
            'logo' => array_merge(['sometimes'], $this->logoFileRules()),
            'logo_url' => ['sometimes','nullable','url','max:2048'],
        ]);

        if ($request->hasFile('logo')) {
            if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
                $this->deleteMediaPath($brand->logo_path);
            }
            $stored = $this->storeLogoFromRequest($request);
            if ($stored instanceof \Illuminate\Http\JsonResponse) {
                return $stored;
            }
            $brand->logo_path = $stored;
        }

        if (array_key_exists('logo_url', $validated) && !empty($validated['logo_url'])) {
            if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
                $this->deleteMediaPath($brand->logo_path);
            }
            $brand->logo_path = $validated['logo_url'];
        }

        foreach (['name','slug','sort_order','is_active'] as $f) {
            if (array_key_exists($f, $validated)) $brand->{$f} = $validated[$f];
        }

        $brand->save();

        return response()->json([
            'data' => [
                'id' => $brand->id,
                'name' => $brand->name,
                'slug' => $brand->slug,
                'logo_path' => $brand->logo_path,
                'logo_url' => $this->resolveLogoUrl($brand->logo_path),
                'sort_order' => $brand->sort_order,
                'is_active' => (bool) $brand->is_active,
            ]
        ]);
    }

    public function destroy(Brand $brand)
    {
        if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
            $this->deleteMediaPath($brand->logo_path);
        }

        $brand->delete();

        return response()->json(['message' => 'Brand deleted']);
    }
}
