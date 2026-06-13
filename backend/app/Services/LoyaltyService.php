<?php

namespace App\Services;

use App\Models\LoyaltyEvent;
use App\Models\LoyaltyProfile;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class LoyaltyService
{
    /** @return array<string, array{min_points:int,discount_percent:int}> */
    public function tiers(): array
    {
        $defaults = [
            'bronze' => ['min_points' => 0, 'discount_percent' => 0],
            'silver' => ['min_points' => 200, 'discount_percent' => 5],
            'gold' => ['min_points' => 500, 'discount_percent' => 10],
            'vip' => ['min_points' => 1000, 'discount_percent' => 15],
        ];

        $setting = Setting::query()
            ->where('group', 'loyalty')
            ->where('key', 'tier_rules')
            ->first();
        $configured = is_array($setting?->value) ? $setting->value : null;
        if (!$configured) {
            return $defaults;
        }

        $out = [];
        foreach (['bronze', 'silver', 'gold', 'vip'] as $tier) {
            $rule = $configured[$tier] ?? null;
            $out[$tier] = [
                'min_points' => isset($rule['min_points']) ? max(0, (int) $rule['min_points']) : $defaults[$tier]['min_points'],
                'discount_percent' => isset($rule['discount_percent']) ? max(0, min(100, (int) $rule['discount_percent'])) : $defaults[$tier]['discount_percent'],
            ];
        }

        // Enforce ascending points
        $lastMin = 0;
        foreach (['bronze', 'silver', 'gold', 'vip'] as $tier) {
            $out[$tier]['min_points'] = max($lastMin, (int) $out[$tier]['min_points']);
            $lastMin = $out[$tier]['min_points'];
        }

        return $out;
    }

    public function currentTierForPoints(int $points): string
    {
        $tiers = $this->tiers();
        $resolved = 'bronze';
        foreach (['bronze', 'silver', 'gold', 'vip'] as $tier) {
            if ($points >= (int) ($tiers[$tier]['min_points'] ?? 0)) {
                $resolved = $tier;
            }
        }
        return $resolved;
    }

    public function discountPercentForUser(?User $user): int
    {
        if (!$user) return 0;

        $profile = LoyaltyProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['points' => 0, 'tier' => 'bronze', 'orders_count' => 0, 'lifetime_spend' => 0]
        );

        return (int) ($this->tiers()[$profile->tier]['discount_percent'] ?? 0);
    }

    public function applyPurchase(Order $order): void
    {
        if (!$order->user_id) {
            return;
        }

        $alreadyApplied = LoyaltyEvent::where('user_id', $order->user_id)
            ->where('order_id', $order->id)
            ->where('event_type', 'earn_purchase')
            ->exists();

        if ($alreadyApplied) {
            return;
        }

        DB::transaction(function () use ($order) {
            $pointsEarned = max(1, (int) floor((float) $order->total));

            $profile = LoyaltyProfile::firstOrCreate(
                ['user_id' => $order->user_id],
                ['points' => 0, 'tier' => 'bronze', 'orders_count' => 0, 'lifetime_spend' => 0]
            );

            $profile->points = (int) $profile->points + $pointsEarned;
            $profile->orders_count = (int) $profile->orders_count + 1;
            $profile->lifetime_spend = (float) $profile->lifetime_spend + (float) $order->total;
            $profile->tier = $this->currentTierForPoints((int) $profile->points);
            $profile->last_earned_at = now();
            $profile->save();

            LoyaltyEvent::create([
                'user_id' => $order->user_id,
                'order_id' => $order->id,
                'event_type' => 'earn_purchase',
                'points_delta' => $pointsEarned,
                'meta' => [
                    'order_total' => (float) $order->total,
                    'tier_after' => $profile->tier,
                ],
            ]);
        });
    }
}

