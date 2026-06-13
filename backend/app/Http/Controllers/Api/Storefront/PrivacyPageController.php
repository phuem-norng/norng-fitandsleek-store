<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\PrivacyPageContent;

class PrivacyPageController extends Controller
{
    public function show()
    {
        $setting = Setting::query()
            ->where('group', 'homepage')
            ->where('key', 'privacy_page')
            ->first();

        $privacyPage = $setting ? (array) $setting->value : PrivacyPageContent::defaults();

        return response()->json([
            'privacy_page' => PrivacyPageContent::normalize(is_array($privacyPage) ? $privacyPage : []),
        ]);
    }
}
