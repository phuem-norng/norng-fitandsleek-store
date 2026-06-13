<?php

namespace App\Services;

use App\Models\Product;
use App\Models\StorefrontEvent;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ProductRecommendationService
{
    public function recommendations(?int $userId, ?string $sessionId, int $perPage = 8): LengthAwarePaginator
    {
        $perPage = max(1, min($perPage, 24));
        $base = Product::query()
            ->with(['category', 'brand', 'activeDiscount'])
            ->where('is_active', true);

        $eventQuery = StorefrontEvent::query()
            ->whereIn('event_type', ['product_view', 'add_to_cart', 'purchase'])
            ->where('occurred_at', '>=', now()->subDays(90));

        if ($userId) {
            $eventQuery->where('user_id', $userId);
        } elseif ($sessionId) {
            $eventQuery->where('session_id', $sessionId);
        } else {
            return $base->orderByDesc('updated_at')->orderByDesc('id')->paginate($perPage);
        }

        $events = $eventQuery->get(['product_id', 'event_type']);
        if ($events->isEmpty()) {
            return $base->orderByDesc('updated_at')->orderByDesc('id')->paginate($perPage);
        }

        $weights = ['product_view' => 1, 'add_to_cart' => 3, 'purchase' => 8];
        $productWeights = [];
        foreach ($events as $event) {
            $productId = (int) ($event->product_id ?? 0);
            if ($productId <= 0) continue;
            $productWeights[$productId] = ($productWeights[$productId] ?? 0) + ($weights[$event->event_type] ?? 1);
        }

        if (!$productWeights) {
            return $base->orderByDesc('updated_at')->orderByDesc('id')->paginate($perPage);
        }

        $seedProducts = Product::query()
            ->whereIn('id', array_keys($productWeights))
            ->get(['id', 'category_id', 'brand_id']);

        $categoryScores = [];
        $brandScores = [];
        foreach ($seedProducts as $seed) {
            $score = $productWeights[(int) $seed->id] ?? 0;
            if ($seed->category_id) {
                $categoryScores[(int) $seed->category_id] = ($categoryScores[(int) $seed->category_id] ?? 0) + $score;
            }
            if ($seed->brand_id) {
                $brandScores[(int) $seed->brand_id] = ($brandScores[(int) $seed->brand_id] ?? 0) + $score;
            }
        }

        return $this->rankByAffinity($base, $categoryScores, $brandScores, array_keys($productWeights), $perPage);
    }

    /**
     * @param array<int,int> $categoryScores
     * @param array<int,int> $brandScores
     * @param array<int,int> $seenProductIds
     */
    private function rankByAffinity(
        Builder $base,
        array $categoryScores,
        array $brandScores,
        array $seenProductIds,
        int $perPage
    ): LengthAwarePaginator {
        $query = clone $base;

        if (!empty($seenProductIds)) {
            $query->whereNotIn('id', $seenProductIds);
        }

        $select = 'products.*';
        $scoreParts = [];
        foreach ($categoryScores as $categoryId => $score) {
            $score = (int) $score * 5;
            $scoreParts[] = "CASE WHEN products.category_id = {$categoryId} THEN {$score} ELSE 0 END";
        }
        foreach ($brandScores as $brandId => $score) {
            $score = (int) $score * 3;
            $scoreParts[] = "CASE WHEN products.brand_id = {$brandId} THEN {$score} ELSE 0 END";
        }

        $rawScore = $scoreParts ? implode(' + ', $scoreParts) : '0';
        $query->selectRaw("{$select}, ({$rawScore}) as recommendation_score")
            ->orderByDesc('recommendation_score')
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        return $query->paginate($perPage);
    }
}

