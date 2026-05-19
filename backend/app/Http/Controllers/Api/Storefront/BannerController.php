<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;

class BannerController extends Controller
{
    /** Treat unset / legacy rows as visible on the storefront (imported DBs often leave NULL). */
    private function scopeStorefrontVisible($query)
    {
        return $query->where(function ($q) {
            $q->where('is_active', true)->orWhereNull('is_active');
        });
    }

    private function orderStorefront(Builder $query): Builder
    {
        $g = $query->getGrammar();
        $sortOrder = $g->wrap('sort_order');
        $orderCol = $g->wrap('order');

        return $query
            ->orderByRaw("COALESCE({$sortOrder}, {$orderCol}, 0)")
            ->orderBy('id');
    }

    private function formatBanner(Banner $b): array
    {
        return [
            'id' => $b->id,
            'page' => $b->page ?? 'home',
            'sort_order' => (int)($b->sort_order ?? 0),
            'title' => $b->title,
            'subtitle' => $b->subtitle,
            'image_url' => Media::url($b->image_url),
            'link_url' => $b->link_url,
            'position' => $b->position ?? 'hero',
            'is_active' => (bool)$b->is_active,
        ];
    }

    /**
     * Match banners for a storefront position (case-insensitive; hero includes NULL/blank legacy positions).
     */
    private function scopeMatchingPosition($query, string $positionKey)
    {
        return $query->where(function ($q) use ($positionKey) {
            $q->whereRaw('LOWER(TRIM(COALESCE(position, ?))) = ?', ['', $positionKey]);
            if ($positionKey === 'hero') {
                $q->orWhereNull('position')
                    ->orWhereRaw("TRIM(COALESCE(position, '')) = ''");
            }
        });
    }

    /**
     * Get all active banners (for admin/preview)
     */
    public function all()
    {
        $base = $this->scopeStorefrontVisible(Banner::query())->orderBy('page');
        $g = $base->getGrammar();
        $items = $base
            ->orderByRaw('COALESCE('.$g->wrap('sort_order').', '.$g->wrap('order').', 0)')
            ->orderBy('id')
            ->get()
            ->map(fn ($b) => $this->formatBanner($b));

        return response()->json(['data' => $items]);
    }

    /**
    * Get banners by position (hero, mid, sidebar, popup, promo)
     */
    public function index(string $position)
    {
        $positionKey = strtolower(trim($position));

        $q = $this->scopeStorefrontVisible(Banner::query());
        $this->scopeMatchingPosition($q, $positionKey);
        $items = $this->orderStorefront($q)->get();

        if ($items->isEmpty() && $positionKey === 'hero') {
            $items = $this->orderStorefront(
                $this->scopeStorefrontVisible(Banner::query())
            )->limit(12)->get();
        }

        return response()->json(['data' => $items->map(fn ($b) => $this->formatBanner($b))]);
    }

    /**
     * Get banners by page
     */
    public function page(string $page)
    {
        $pageKey = strtolower(trim($page));
        $base = $this->scopeStorefrontVisible(Banner::query())
            ->whereRaw('LOWER(TRIM(COALESCE(page, ?))) = ?', ['', $pageKey]);
        $g = $base->getGrammar();
        $items = $base
            ->orderByRaw('COALESCE('.$g->wrap('sort_order').', '.$g->wrap('order').', 0)')
            ->orderBy('id')
            ->get()
            ->map(fn ($b) => $this->formatBanner($b));

        return response()->json(['data' => $items]);
    }
}
