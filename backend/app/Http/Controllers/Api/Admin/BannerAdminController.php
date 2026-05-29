<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Support\Media;
use Illuminate\Http\Request;

class BannerAdminController extends BaseAdminController
{
    private function formatBanner(Banner $b): array
    {
        return [
            'id' => $b->id,
            'page' => $b->page ?? 'home',
            'sort_order' => (int) ($b->sort_order ?? 0),
            'title' => $b->title,
            'subtitle' => $b->subtitle,
            'link_url' => $b->link_url,
            'position' => $b->position,
            'is_active' => (bool) $b->is_active,
            'order' => (int) ($b->order ?? 0),
            'show_badge' => $b->show_badge !== false,
            'show_title' => $b->show_title !== false,
            'show_subtitle' => $b->show_subtitle !== false,
            'show_cta' => $b->show_cta !== false,
            'image_url' => Media::url($b->image_url),
            'image_path' => $b->image_url,
        ];
    }

    private function textVisibilityRules(): array
    {
        return [
            'show_badge' => ['nullable', 'boolean'],
            'show_title' => ['nullable', 'boolean'],
            'show_subtitle' => ['nullable', 'boolean'],
            'show_cta' => ['nullable', 'boolean'],
        ];
    }

    private function textVisibilityFromRequest(Request $request): array
    {
        return [
            'show_badge' => $request->has('show_badge') ? $this->bool($request->input('show_badge')) : true,
            'show_title' => $request->has('show_title') ? $this->bool($request->input('show_title')) : true,
            'show_subtitle' => $request->has('show_subtitle') ? $this->bool($request->input('show_subtitle')) : true,
            'show_cta' => $request->has('show_cta') ? $this->bool($request->input('show_cta')) : true,
        ];
    }

    public function index()
    {
        $items = Banner::query()
            ->orderBy('page')
            ->orderBy('sort_order')
            ->orderBy('position')
            ->get()
            ->map(fn ($b) => $this->formatBanner($b));

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'page' => ['nullable','string','max:50'],          // home/women/men
            'sort_order' => ['nullable','integer','min:0'],    // ordering
            'title' => ['nullable','string','max:255'],
            'subtitle' => ['nullable','string','max:255'],
            'link_url' => ['nullable','string','max:500'],
            'position' => ['required','in:hero,mid,sidebar,popup,promo,discounts'],
            'media_url' => ['nullable','string','max:1000'],
            'is_active' => ['nullable','boolean'],
            'order' => ['nullable','integer','min:0'],
            'image' => ['nullable','file','mimes:jpg,jpeg,png,webp,avif,svg,gif,mp4,webm,ogg','max:51200'],
            ...$this->textVisibilityRules(),
        ]);

        $path = null;
        if ($request->hasFile('image')) {
            $path = $this->storeImage($request, 'image', 'banners');
        } elseif (!empty($validated['media_url'])) {
            $path = $validated['media_url'];
        }

        $b = Banner::create([
            'page' => $validated['page'] ?? 'home',
            'sort_order' => $validated['sort_order'] ?? 0,
            'title' => $validated['title'] ?? null,
            'subtitle' => $validated['subtitle'] ?? null,
            'link_url' => $validated['link_url'] ?? null,
            'position' => $validated['position'],
            'is_active' => $validated['is_active'] ?? true,
            'order' => $validated['order'] ?? 0,
            'image_url' => $path,
            ...$this->textVisibilityFromRequest($request),
        ]);

        return response()->json(['data' => $this->formatBanner($b)], 201);
    }

    public function show(Banner $banner)
    {
        return response()->json(['data' => $this->formatBanner($banner)]);
    }

    public function update(Request $request, Banner $banner)
    {
        $validated = $request->validate([
            'page' => ['nullable','string','max:50'],
            'sort_order' => ['nullable','integer','min:0'],
            'title' => ['nullable','string','max:255'],
            'subtitle' => ['nullable','string','max:255'],
            'link_url' => ['nullable','string','max:500'],
            'position' => ['required','in:hero,mid,sidebar,popup,promo,discounts'],
            'media_url' => ['nullable','string','max:1000'],
            'is_active' => ['nullable','boolean'],
            'order' => ['nullable','integer','min:0'],
            'image' => ['nullable','file','mimes:jpg,jpeg,png,webp,avif,svg,gif,mp4,webm,ogg','max:51200'],
            ...$this->textVisibilityRules(),
        ]);

        if ($request->hasFile('image')) {
            if ($banner->image_url && !preg_match('#^https?://#i', $banner->image_url)) {
                $this->deleteMediaPath($banner->image_url);
            }
            $banner->image_url = $this->storeImage($request, 'image', 'banners');
        } elseif (!empty($validated['media_url'])) {
            $banner->image_url = $validated['media_url'];
        }

        $banner->page = $validated['page'] ?? $banner->page ?? 'home';
        $banner->sort_order = $validated['sort_order'] ?? ($banner->sort_order ?? 0);
        $banner->title = $validated['title'] ?? $banner->title;
        $banner->subtitle = $validated['subtitle'] ?? $banner->subtitle;
        $banner->link_url = $validated['link_url'] ?? $banner->link_url;
        $banner->position = $validated['position'];
        $banner->is_active = $validated['is_active'] ?? $banner->is_active;
        $banner->order = $validated['order'] ?? ($banner->order ?? 0);

        if ($request->has('show_badge')) {
            $banner->show_badge = $this->bool($request->input('show_badge'));
        }
        if ($request->has('show_title')) {
            $banner->show_title = $this->bool($request->input('show_title'));
        }
        if ($request->has('show_subtitle')) {
            $banner->show_subtitle = $this->bool($request->input('show_subtitle'));
        }
        if ($request->has('show_cta')) {
            $banner->show_cta = $this->bool($request->input('show_cta'));
        }

        $banner->save();

        return response()->json(['data' => $this->formatBanner($banner)]);
    }

    public function destroy(Banner $banner)
    {
        $this->deleteMediaPath($banner->image_url);
        $banner->delete();
        return response()->json(['ok' => true]);
    }
}
