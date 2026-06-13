<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUiPreferenceController extends Controller
{
    private function settingKey(int $userId): string
    {
        return "admin_ui_preferences_user_{$userId}";
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $setting = Setting::query()
            ->where('key', $this->settingKey((int) $user->id))
            ->first();

        $value = is_array($setting?->value) ? $setting->value : [];

        return response()->json([
            'data' => $value,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'data' => ['required', 'array'],
        ]);

        $setting = Setting::query()
            ->where('key', $this->settingKey((int) $user->id))
            ->first();

        $current = is_array($setting?->value) ? $setting->value : [];
        $next = array_replace_recursive($current, $validated['data']);

        Setting::updateOrCreate(
            ['key' => $this->settingKey((int) $user->id)],
            [
                'group' => 'admin_ui',
                'type' => 'json',
                'value' => $next,
            ]
        );

        return response()->json(['data' => $next]);
    }
}
