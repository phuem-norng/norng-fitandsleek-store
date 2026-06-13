<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\LoyaltyProfile;
use App\Support\Media;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Throwable;

class BannerController extends Controller
{
    private const AUDIENCE_TARGETS = ['all', 'guest', 'bronze', 'silver', 'gold', 'vip'];
    private const PRIORITY_SEGMENTS = ['guest', 'bronze', 'silver', 'gold', 'vip'];

    private function normalizeAudienceTargets(mixed $targets): array
    {
        if (!is_array($targets) || empty($targets)) {
            return ['all'];
        }

        $normalized = collect($targets)
            ->map(fn ($value) => strtolower(trim((string) $value)))
            ->filter(fn ($value) => in_array($value, self::AUDIENCE_TARGETS, true))
            ->values()
            ->all();

        if (empty($normalized)) {
            return ['all'];
        }

        if (in_array('all', $normalized, true) && count($normalized) > 1) {
            return ['all'];
        }

        return array_values(array_unique($normalized));
    }

    private function viewerSegment(): string
    {
        $user = Auth::user();
        if (!$user) {
            return 'guest';
        }

        $tier = LoyaltyProfile::query()->where('user_id', $user->id)->value('tier');
        $tier = strtolower(trim((string) $tier));

        if (in_array($tier, ['bronze', 'silver', 'gold', 'vip'], true)) {
            return $tier;
        }

        return 'bronze';
    }

    private function filterForViewerSegment($items)
    {
        try {
            $segment = $this->viewerSegment();
            $priorityMap = [
                'vip' => ['vip', 'gold', 'silver', 'bronze', 'guest', 'all'],
                'gold' => ['gold', 'silver', 'bronze', 'guest', 'all'],
                'silver' => ['silver', 'bronze', 'guest', 'all'],
                'bronze' => ['bronze', 'guest', 'all'],
                'guest' => ['guest', 'all'],
            ];
            $priority = $priorityMap[$segment] ?? ['all'];
            $priorityIndex = array_flip($priority);

            $ranked = $items
                ->map(function (Banner $banner) use ($priorityIndex, $segment) {
                    $targets = $this->normalizeAudienceTargets($banner->audience_targets);
                    $priorityMap = $this->normalizeAudiencePriorityMap($banner->audience_priority_map);
                    $rank = null;
                    foreach ($targets as $target) {
                        if (array_key_exists($target, $priorityIndex)) {
                            $rank = $rank === null ? $priorityIndex[$target] : min($rank, $priorityIndex[$target]);
                        }
                    }
                    return [
                        'banner' => $banner,
                        'rank' => $rank,
                        'segment_priority' => $priorityMap[$segment] ?? 100,
                    ];
                })
                ->filter(fn (array $entry) => $entry['rank'] !== null)
                ->sort(function (array $a, array $b) {
                    if ($a['rank'] !== $b['rank']) {
                        return $a['rank'] <=> $b['rank'];
                    }
                    return $a['segment_priority'] <=> $b['segment_priority'];
                })
                ->values()
                ->map(fn (array $entry) => $entry['banner']);

            if ($ranked->isNotEmpty()) {
                return $ranked;
            }

            return $items->filter(function (Banner $banner) {
                $targets = $this->normalizeAudienceTargets($banner->audience_targets);
                return in_array('all', $targets, true);
            })->values();
        } catch (Throwable $e) {
            Log::warning('Banner personalization fallback used', [
                'message' => $e->getMessage(),
            ]);
            // Fail-safe: never break storefront hero/promo due to ranking logic.
            return $items->values();
        }
    }

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
            'audience_targets' => $this->normalizeAudienceTargets($b->audience_targets),
            'audience_priority_map' => $this->normalizeAudiencePriorityMap($b->audience_priority_map),
            'is_active' => (bool)$b->is_active,
            'show_badge' => $b->show_badge !== false,
            'show_title' => $b->show_title !== false,
            'show_subtitle' => $b->show_subtitle !== false,
            'show_cta' => $b->show_cta !== false,
        ];
    }

    private function normalizeAudiencePriorityMap(mixed $priorityMap): array
    {
        $map = is_array($priorityMap) ? $priorityMap : [];
        $normalized = [];

        foreach (self::PRIORITY_SEGMENTS as $segment) {
            $normalized[$segment] = isset($map[$segment]) ? max(0, min(9999, (int) $map[$segment])) : 100;
        }

        return $normalized;
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
            ->get();
        $items = $this->filterForViewerSegment($items)
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
        $items = $this->filterForViewerSegment($items);

        if ($items->isEmpty() && $positionKey === 'hero') {
            $items = $this->orderStorefront(
                $this->scopeStorefrontVisible(Banner::query())
            )->limit(12)->get();
            $items = $this->filterForViewerSegment($items);
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
            ->get();
        $items = $this->filterForViewerSegment($items)
            ->map(fn ($b) => $this->formatBanner($b));

        return response()->json(['data' => $items]);
    }
}
