<?php

namespace Database\Seeders;

use App\Models\LoyaltyEvent;
use App\Models\LoyaltyProfile;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;

class TopFansMiniSeeder extends Seeder
{
    public function run(): void
    {
        $rules = [
            'bronze' => ['min_points' => 0, 'discount_percent' => 0],
            'silver' => ['min_points' => 200, 'discount_percent' => 5],
            'gold' => ['min_points' => 500, 'discount_percent' => 10],
            'vip' => ['min_points' => 1000, 'discount_percent' => 15],
        ];

        Setting::query()->updateOrCreate(
            ['group' => 'loyalty', 'key' => 'tier_rules'],
            ['type' => 'json', 'value' => $rules]
        );

        $profiles = [
            [
                'name' => 'Bronze Fan',
                'email' => 'topfan.bronze@example.com',
                'points' => 120,
                'tier' => 'bronze',
                'orders_count' => 3,
                'lifetime_spend' => 120.50,
            ],
            [
                'name' => 'Silver Fan',
                'email' => 'topfan.silver@example.com',
                'points' => 340,
                'tier' => 'silver',
                'orders_count' => 8,
                'lifetime_spend' => 386.75,
            ],
            [
                'name' => 'Gold Fan',
                'email' => 'topfan.gold@example.com',
                'points' => 760,
                'tier' => 'gold',
                'orders_count' => 14,
                'lifetime_spend' => 987.20,
            ],
            [
                'name' => 'VIP Fan',
                'email' => 'topfan.vip@example.com',
                'points' => 1450,
                'tier' => 'vip',
                'orders_count' => 24,
                'lifetime_spend' => 2230.40,
            ],
        ];

        foreach ($profiles as $seed) {
            $user = User::query()->updateOrCreate(
                ['email' => $seed['email']],
                [
                    'name' => $seed['name'],
                    'password' => 'password123',
                    'role' => 'customer',
                    'status' => 'active',
                ]
            );

            LoyaltyProfile::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'points' => $seed['points'],
                    'tier' => $seed['tier'],
                    'orders_count' => $seed['orders_count'],
                    'lifetime_spend' => $seed['lifetime_spend'],
                    'last_earned_at' => now()->subDays(random_int(1, 30)),
                ]
            );

            LoyaltyEvent::query()->create([
                'user_id' => $user->id,
                'order_id' => null,
                'event_type' => 'seed_adjustment',
                'points_delta' => (int) $seed['points'],
                'meta' => [
                    'source' => 'TopFansMiniSeeder',
                    'tier' => $seed['tier'],
                ],
            ]);
        }

        $this->command?->info('TopFansMiniSeeder complete: tier rules + top fan profiles seeded.');
    }
}

