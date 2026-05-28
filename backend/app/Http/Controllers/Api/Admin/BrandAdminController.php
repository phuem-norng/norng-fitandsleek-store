<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Support\Media;
use Illuminate\Http\Request;
use App\Support\MediaDisk;

class BrandAdminController extends Controller
{
    private function isExternalUrl(?string $value): bool
    {
        return is_string($value) && preg_match('#^https?://#i', $value) === 1;
    }

    public function index()
    {
        $items = Brand::query()->orderBy('sort_order')->latest('id')->get()->map(function ($b) {
            return [
                'id' => $b->id,
                'name' => $b->name,
                'slug' => $b->slug,
                'logo_path' => $b->logo_path,
                'logo_url' => Media::publicUrl($b->logo_path),
                'sort_order' => $b->sort_order,
                'is_active' => (bool) $b->is_active,
                'created_at' => $b->created_at,
            ];
        });

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required','string','max:120'],
            'slug' => ['required','string','max:140','unique:brands,slug'],
            'sort_order' => ['nullable','integer','min:0'],
            'is_active' => ['nullable','boolean'],
            'logo' => ['nullable','image','mimes:jpg,jpeg,png,webp,svg','max:5120'],
            'logo_url' => ['nullable','url','max:2048'],
        ]);

        if (!$request->hasFile('logo') && empty($validated['logo_url'])) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => ['logo' => ['Please upload a logo or provide a logo URL.']],
            ], 422);
        }

        $path = $request->hasFile('logo')
            ? MediaDisk::storeUploadedFile($request->file('logo'), 'brands')
            : $validated['logo_url'];

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
                'logo_url' => Media::publicUrl($b->logo_path),
                'sort_order' => $b->sort_order,
                'is_active' => (bool) $b->is_active,
            ]
        ], 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'name' => ['sometimes','required','string','max:120'],
            'slug' => ['sometimes','required','string','max:140','unique:brands,slug,'.$brand->id],
            'sort_order' => ['sometimes','nullable','integer','min:0'],
            'is_active' => ['sometimes','nullable','boolean'],
            'logo' => ['sometimes','image','mimes:jpg,jpeg,png,webp,svg','max:5120'],
            'logo_url' => ['sometimes','nullable','url','max:2048'],
        ]);

        if ($request->hasFile('logo')) {
            if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
                MediaDisk::delete($brand->logo_path);
            }
            $brand->logo_path = MediaDisk::storeUploadedFile($request->file('logo'), 'brands');
        }

        if (array_key_exists('logo_url', $validated) && !empty($validated['logo_url'])) {
            if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
                MediaDisk::delete($brand->logo_path);
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
                'logo_url' => Media::publicUrl($brand->logo_path),
                'sort_order' => $brand->sort_order,
                'is_active' => (bool) $brand->is_active,
            ]
        ]);
    }

    public function destroy(Brand $brand)
    {
        if ($brand->logo_path && !$this->isExternalUrl($brand->logo_path)) {
            MediaDisk::delete($brand->logo_path);
        }

        $brand->delete();

        return response()->json(['message' => 'Brand deleted']);
    }
}
