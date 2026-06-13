<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\CookiesPageContent;

class CookiesPageController extends Controller
{
    public function show()
    {
        $setting = Setting::query()
            ->where('group', 'homepage')
            ->where('key', 'cookies_page')
            ->first();

        $cookiesPage = $setting ? (array) $setting->value : CookiesPageContent::defaults();

        return response()->json([
            'cookies_page' => CookiesPageContent::normalize(is_array($cookiesPage) ? $cookiesPage : []),
        ]);
    }
}
