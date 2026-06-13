<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\TermsPageContent;

class TermsPageController extends Controller
{
    public function show()
    {
        $setting = Setting::query()
            ->where('group', 'homepage')
            ->where('key', 'terms_page')
            ->first();

        $termsPage = $setting ? (array) $setting->value : TermsPageContent::defaults();

        return response()->json([
            'terms_page' => TermsPageContent::normalize(is_array($termsPage) ? $termsPage : []),
        ]);
    }
}
