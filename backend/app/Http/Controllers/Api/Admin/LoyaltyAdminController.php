<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LoyaltyProfile;
use App\Models\Setting;
use App\Services\LoyaltyService;
use App\Services\SecurityAuditService;
use Illuminate\Http\Request;

class LoyaltyAdminController extends Controller
{
    public function __construct(
        private LoyaltyService $loyaltyService,
        private SecurityAuditService $securityAudit
    )
    {
    }

    public function topFans(Request $request)
    {
        $limit = max(5, min((int) $request->input('limit', 20), 100));

        $rows = LoyaltyProfile::query()
            ->with('user:id,name,email')
            ->orderByDesc('points')
            ->orderByDesc('lifetime_spend')
            ->limit($limit)
            ->get();

        return response()->json([
            'tiers' => $this->loyaltyService->tiers(),
            'rules_meta' => $this->rulesMeta(),
            'data' => $rows,
        ]);
    }

    public function getRules()
    {
        return response()->json([
            'data' => $this->loyaltyService->tiers(),
            'meta' => $this->rulesMeta(),
        ]);
    }

    public function updateRules(Request $request)
    {
        $validated = $request->validate([
            'rules' => ['required', 'array'],
            'rules.bronze' => ['required', 'array'],
            'rules.silver' => ['required', 'array'],
            'rules.gold' => ['required', 'array'],
            'rules.vip' => ['required', 'array'],
            'rules.bronze.min_points' => ['required', 'integer', 'min:0'],
            'rules.silver.min_points' => ['required', 'integer', 'min:0'],
            'rules.gold.min_points' => ['required', 'integer', 'min:0'],
            'rules.vip.min_points' => ['required', 'integer', 'min:0'],
            'rules.bronze.discount_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'rules.silver.discount_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'rules.gold.discount_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'rules.vip.discount_percent' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $rules = $validated['rules'];
        $lastMin = 0;
        foreach (['bronze', 'silver', 'gold', 'vip'] as $tier) {
            $rules[$tier]['min_points'] = max($lastMin, (int) $rules[$tier]['min_points']);
            $lastMin = $rules[$tier]['min_points'];
        }

        Setting::updateOrCreate(
            ['group' => 'loyalty', 'key' => 'tier_rules'],
            ['type' => 'json', 'value' => $rules]
        );
        Setting::updateOrCreate(
            ['group' => 'loyalty', 'key' => 'tier_rules_meta'],
            [
                'type' => 'json',
                'value' => [
                    'updated_at' => now()->toIso8601String(),
                    'updated_by' => [
                        'id' => (int) $request->user()->id,
                        'name' => (string) ($request->user()->name ?? ''),
                        'email' => (string) ($request->user()->email ?? ''),
                    ],
                ],
            ]
        );
        $this->securityAudit->record($request, 'admin.loyalty.rules_updated', $request->user(), [
            'rules' => $rules,
        ]);

        return response()->json([
            'data' => $this->loyaltyService->tiers(),
            'meta' => $this->rulesMeta(),
            'message' => 'Loyalty rules updated.',
        ]);
    }

    private function rulesMeta(): array
    {
        $setting = Setting::query()
            ->where('group', 'loyalty')
            ->where('key', 'tier_rules_meta')
            ->first();
        return is_array($setting?->value) ? $setting->value : [];
    }
}

