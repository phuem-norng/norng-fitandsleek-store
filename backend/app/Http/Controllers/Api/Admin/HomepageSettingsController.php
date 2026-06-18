<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\ContactPageContent;
use App\Support\FaqContent;
use App\Support\PrivacyPageContent;
use App\Support\TermsPageContent;
use App\Support\CookiesPageContent;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class HomepageSettingsController extends Controller
{
    private function mediaDisk(): string
    {
        return Media::disk();
    }

    private function resolveAppLogoUrl(): string
    {
        $configured = (string) config('app.logo_url', '/logo.png');
        if ($configured === '') {
            return '/logo.png';
        }

        if (str_starts_with($configured, 'http://') || str_starts_with($configured, 'https://')) {
            $parts = parse_url($configured);
            $host = strtolower((string) ($parts['host'] ?? ''));
            if (in_array($host, ['localhost', '127.0.0.1', 'host.docker.internal', 'backend'], true)) {
                $path = '/' . ltrim((string) ($parts['path'] ?? ''), '/');
                return $path !== '/' ? $path : '/logo.png';
            }
            return $configured;
        }

        return '/' . ltrim($configured, '/');
    }

    /**
     * Get all homepage settings (extended with NEW IN, WOMEN, MEN, BOYS, etc)
     */
    public function getSettings()
    {
        try {
            $appLogoUrl = $this->resolveAppLogoUrl();

            // Get all homepage-related settings
            $settings = Setting::where('group', 'homepage')->get()->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->value];
            });

            $fontSettings = Setting::whereIn('key', ['font_en', 'font_km'])->get()->mapWithKeys(function ($setting) {
                return [$setting->key => $setting->value];
            });

            // Default extended settings - ALL sections
            $defaults = [
                'fonts' => [
                    'english' => 'Inter',
                    'khmer' => 'Kantumruy Pro',
                ],
                'hero' => [
                    'message' => '🚚 Free delivery on orders above $40',
                    'icon' => '🚚',
                    'enabled' => true,
                ],
                'sections' => [
                    'newIn' => ['title' => 'NEW IN', 'icon' => '📦', 'enabled' => true, 'order' => 1],
                    'discounts' => ['title' => 'Discounts', 'icon' => '', 'enabled' => true, 'order' => 2],
                    'women' => ['title' => 'WOMEN', 'icon' => '👗', 'enabled' => true, 'order' => 3],
                    'men' => ['title' => 'MEN', 'icon' => '👔', 'enabled' => true, 'order' => 4],
                    'boys' => ['title' => 'BOYS', 'icon' => '👦', 'enabled' => true, 'order' => 5],
                    'clothes' => ['title' => 'Clothes', 'icon' => '👕', 'enabled' => true, 'order' => 6],
                    'shoes' => ['title' => 'Shoes', 'icon' => '👠', 'enabled' => true, 'order' => 7],
                    'belts' => ['title' => 'Belts', 'icon' => '⏱️', 'enabled' => true, 'order' => 8],
                    'accessories' => ['title' => 'Accessories', 'icon' => '💍', 'enabled' => true, 'order' => 9],
                ],
                'header' => [
                    'logo_text' => 'Fitandsleek',
                    'logo_url' => $appLogoUrl,
                    'background_color' => '#6e8b7e',
                    'background_image' => '',
                    'text_color' => '#ffffff',
                    'search_placeholder' => 'Search products...',
                    'search_enabled' => true,
                    'cart_enabled' => true,
                    'wishlist_enabled' => true,
                    'language_enabled' => true,
                    'free_delivery_icon' => '🚚',
                    'free_delivery_text' => 'Free delivery on orders above $40',
                    'nav_visibility' => [
                        'newIn' => true,
                        'discounts' => true,
                        'women' => true,
                        'men' => true,
                        'sale' => true,
                    ],
                    'custom_nav' => [],
                    'left_menu' => [
                        [
                            'title' => 'New Product',
                            'items' => [
                                ['label' => 'New Arrivals', 'to' => '/search?tab=new', 'image' => '/placeholder.svg'],
                                ['label' => 'Trending Now', 'to' => '/search?tab=trending', 'image' => '/placeholder.svg'],
                                ['label' => 'This Week', 'to' => '/search?tab=this-week', 'image' => '/placeholder.svg'],
                                ['label' => 'Best Sellers', 'to' => '/search?q=Best%20Seller', 'image' => '/placeholder.svg'],
                                ['label' => 'Editor Picks', 'to' => '/search?q=Editors%20Pick', 'image' => '/placeholder.svg'],
                                ['label' => 'Limited Drop', 'to' => '/search?q=Limited%20Drop', 'image' => '/placeholder.svg'],
                                ['label' => 'Fresh Styles', 'to' => '/search?q=Fresh%20Style', 'image' => '/placeholder.svg'],
                                ['label' => 'Just Added', 'to' => '/search?q=Just%20Added', 'image' => '/placeholder.svg'],
                            ],
                        ],
                        [
                            'title' => 'Product Trending',
                            'items' => [
                                ['label' => 'Trending Now', 'to' => '/search?tab=trending', 'image' => '/placeholder.svg'],
                                ['label' => 'Top Rated', 'to' => '/search?sort=rating', 'image' => '/placeholder.svg'],
                                ['label' => 'Best Sellers', 'to' => '/search?sort=popular', 'image' => '/placeholder.svg'],
                                ['label' => 'Most Viewed', 'to' => '/search?q=Most%20Viewed', 'image' => '/placeholder.svg'],
                                ['label' => 'Popular Now', 'to' => '/search?q=Popular%20Now', 'image' => '/placeholder.svg'],
                                ['label' => 'Street Style', 'to' => '/search?q=Street%20Style', 'image' => '/placeholder.svg'],
                                ['label' => 'Viral Picks', 'to' => '/search?q=Viral', 'image' => '/placeholder.svg'],
                                ['label' => 'Trending This Week', 'to' => '/search?q=Trending%20This%20Week', 'image' => '/placeholder.svg'],
                            ],
                        ],
                        [
                            'title' => 'Product Discounts',
                            'items' => [
                                ['label' => 'All Discounts', 'to' => '/discounts', 'image' => '/placeholder.svg'],
                                ['label' => 'Clothes', 'to' => '/discounts/clothes', 'image' => '/placeholder.svg'],
                                ['label' => 'Shoes', 'to' => '/discounts/shoes', 'image' => '/placeholder.svg'],
                                ['label' => 'Under $20', 'to' => '/discounts?max_price=20', 'image' => '/placeholder.svg'],
                                ['label' => 'Top Deals', 'to' => '/discounts?sort=discount', 'image' => '/placeholder.svg'],
                                ['label' => 'Accessories', 'to' => '/discounts?q=Accessories', 'image' => '/placeholder.svg'],
                                ['label' => 'Bags', 'to' => '/discounts?q=Bags', 'image' => '/placeholder.svg'],
                                ['label' => 'Flash Sale', 'to' => '/discounts?q=Flash', 'image' => '/placeholder.svg'],
                            ],
                        ],
                        [
                            'title' => 'Brands',
                            'items' => [
                                ['label' => 'Nike', 'to' => '/search?q=Nike', 'image' => '/placeholder.svg'],
                                ['label' => 'Adidas', 'to' => '/search?q=Adidas', 'image' => '/placeholder.svg'],
                                ['label' => 'Puma', 'to' => '/search?q=Puma', 'image' => '/placeholder.svg'],
                                ['label' => 'Zara', 'to' => '/search?q=Zara', 'image' => '/placeholder.svg'],
                            ],
                        ],
                    ],
                    'nav_dropdowns' => [
                        'newIn' => [
                            ['label' => 'New Arrivals', 'to' => '/search?tab=new'],
                            ['label' => 'Trending Now', 'to' => '/search?tab=trending'],
                            ['label' => 'This Week', 'to' => '/search?tab=this-week'],
                        ],
                        'discounts' => [
                            ['label' => 'All Discounts', 'to' => '/discounts'],
                            ['label' => 'Clothes', 'to' => '/discounts/clothes'],
                            ['label' => 'Shoes', 'to' => '/discounts/shoes'],
                            ['label' => 'Bags', 'to' => '/discounts/bags'],
                            ['label' => 'Belts', 'to' => '/discounts/belts'],
                            ['label' => 'Accessories', 'to' => '/discounts/accessories'],
                        ],
                        'women' => [
                            [
                                'type' => 'section',
                                'label' => 'Clothing',
                                'items' => [
                                    ['label' => 'Tops', 'to' => '/search?gender=women&category=tops'],
                                    ['label' => 'Bottoms', 'to' => '/search?gender=women&category=bottoms'],
                                    ['label' => 'Dresses', 'to' => '/search?gender=women&category=dresses'],
                                    ['label' => 'Outerwear', 'to' => '/search?gender=women&category=outerwear'],
                                    ['label' => 'Activewear', 'to' => '/search?gender=women&category=activewear'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Shoes',
                                'items' => [
                                    ['label' => 'Sneakers', 'to' => '/search?gender=women&category=sneakers'],
                                    ['label' => 'Slides', 'to' => '/search?gender=women&category=slides'],
                                    ['label' => 'Heels', 'to' => '/search?gender=women&category=heels'],
                                    ['label' => 'Boots', 'to' => '/search?gender=women&category=boots'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Accessories',
                                'items' => [
                                    ['label' => 'Bags', 'to' => '/search?gender=women&category=bags'],
                                    ['label' => 'Belts', 'to' => '/search?gender=women&category=belts'],
                                    ['label' => 'Hats', 'to' => '/search?gender=women&category=hats'],
                                    ['label' => 'Jewelry', 'to' => '/search?gender=women&category=jewelry'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Featured',
                                'description' => 'Curated picks for her',
                                'items' => [
                                    ['label' => 'View All Women', 'to' => '/search?parent_category=Women'],
                                    ['label' => 'New Arrivals', 'to' => '/search?tab=new&gender=women'],
                                    ['label' => 'Trending Now', 'to' => '/search?tab=trending&gender=women'],
                                    ['label' => 'This Week', 'to' => '/search?tab=this-week&gender=women'],
                                ],
                            ],
                        ],
                        'men' => [
                            [
                                'type' => 'section',
                                'label' => 'Clothing',
                                'items' => [
                                    ['label' => 'T-Shirts', 'to' => '/search?gender=men&category=t-shirts'],
                                    ['label' => 'Shirts', 'to' => '/search?gender=men&category=shirts'],
                                    ['label' => 'Hoodies', 'to' => '/search?gender=men&category=hoodies'],
                                    ['label' => 'Jeans', 'to' => '/search?gender=men&category=jeans'],
                                    ['label' => 'Shorts', 'to' => '/search?gender=men&category=shorts'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Shoes',
                                'items' => [
                                    ['label' => 'Sneakers', 'to' => '/search?gender=men&category=sneakers'],
                                    ['label' => 'Running', 'to' => '/search?gender=men&category=running'],
                                    ['label' => 'Slides', 'to' => '/search?gender=men&category=slides'],
                                    ['label' => 'Boots', 'to' => '/search?gender=men&category=boots'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Accessories',
                                'items' => [
                                    ['label' => 'Bags', 'to' => '/search?gender=men&category=bags'],
                                    ['label' => 'Belts', 'to' => '/search?gender=men&category=belts'],
                                    ['label' => 'Caps & Hats', 'to' => '/search?gender=men&category=caps-hats'],
                                    ['label' => 'Watches', 'to' => '/search?gender=men&category=watches'],
                                ],
                            ],
                            [
                                'type' => 'section',
                                'label' => 'Featured',
                                'description' => 'Curated picks for him',
                                'items' => [
                                    ['label' => 'View All Men', 'to' => '/search?parent_category=Men'],
                                    ['label' => 'New Arrivals', 'to' => '/search?tab=new&gender=men'],
                                    ['label' => 'Trending Now', 'to' => '/search?tab=trending&gender=men'],
                                    ['label' => 'This Week', 'to' => '/search?tab=this-week&gender=men'],
                                ],
                            ],
                        ],
                        'sale' => [
                            ['label' => 'All Sale Items', 'to' => '/search?tab=sale'],
                            ['label' => "Women's Sale", 'to' => '/search?tab=sale&gender=women'],
                            ['label' => "Men's Sale", 'to' => '/search?tab=sale&gender=men'],
                        ],
                    ],
                    'nav_labels' => [
                        'newIn' => 'NEW IN',
                        'newArrivals' => 'New Arrivals',
                        'trendingNow' => 'Trending Now',
                        'thisWeek' => 'This Week',
                        'discounts' => 'Discounts',
                        'allDiscounts' => 'All Discounts',
                        'clothes' => 'Clothes',
                        'shoes' => 'Shoes',
                        'bags' => 'Bags',
                        'belts' => 'Belts',
                        'accessories' => 'Accessories',
                        'women' => 'WOMEN',
                        'tops' => 'Tops',
                        'bottoms' => 'Bottoms',
                        'dresses' => 'Dresses',
                        'outerwear' => 'Outerwear',
                        'activewear' => 'Activewear',
                        'sneakers' => 'Sneakers',
                        'slides' => 'Slides',
                        'heels' => 'Heels',
                        'boots' => 'Boots',
                        'hats' => 'Hats',
                        'jewelry' => 'Jewelry',
                        'girls' => 'Girls',
                        'freshDrops' => 'Fresh drops for everyday fits',
                        'viewAll' => 'View All',
                        'men' => 'MEN',
                        'tShirts' => 'T-Shirts',
                        'shirts' => 'Shirts',
                        'hoodies' => 'Hoodies',
                        'jeans' => 'Jeans',
                        'shorts' => 'Shorts',
                        'running' => 'Running',
                        'capsHats' => 'Caps & Hats',
                        'watches' => 'Watches',
                        'boys' => 'Boys',
                        'grabDeals' => 'Grab deals before they\'re gone',
                        'sale' => 'SALE',
                        'allSaleItems' => 'All Sale Items',
                        'womensSale' => 'Women\'s Sale',
                        'mensSale' => 'Men\'s Sale',
                    ],
                ],
                'footer' => [
                    'company_name' => 'Fitandsleek',
                    'company_description' => 'Modern fashion store for slick everyday outfits and streetwear.',
                    'contact_title' => 'CONTACT',
                    'contact_email' => 'kalapakgpt@gmail.com',
                    'contact_phone' => '+855 00 00 000',
                    'contact_address' => 'Phnom Penh, Cambodia',
                    'copyright_text' => '© 2026 Fitandsleek. All rights reserved.',
                    'background_color' => '#6e8b7e',
                    'background_image' => '',
                    'text_color' => '#ffffff',
                    'social_title' => 'FOLLOW US',
                    'social_enabled' => true,
                    'support_enabled' => true,
                    'tracking_enabled' => true,
                    'privacy_enabled' => true,
                    'contact_enabled' => true,
                    'payment_accept_enabled' => true,
                    'payment_accept_title' => 'We Accept',
                    'accepted_payment_methods' => [
                        'aba_pay', 'visa', 'mastercard', 'unionpay', 'jcb', 'wing', 'bank_transfer', 'cod',
                    ],
                ],
                'footer_socials' => [
                    ['platform' => 'facebook', 'url' => '#'],
                    ['platform' => 'instagram', 'url' => '#'],
                    ['platform' => 'twitter', 'url' => '#'],
                ],
                'footer_sections' => [
                    'support' => [
                        'title' => 'HELP',
                        'items' => [
                            ['label' => 'Help Center', 'link' => '/support'],
                            ['label' => 'FAQ', 'link' => '/faq'],
                            ['label' => 'Contact Us', 'link' => '/contact'],
                        ],
                    ],
                    'tracking' => [
                        'title' => 'TRACKING',
                        'items' => [
                            ['label' => 'Track Order', 'link' => '/profile?tab=track'],
                            ['label' => 'Returns', 'link' => '/returns'],
                            ['label' => 'Shipping Info', 'link' => '/shipping'],
                        ],
                    ],
                    'legal' => [
                        'title' => 'LEGAL',
                        'items' => [
                            ['label' => 'Privacy Policy', 'link' => '/privacy'],
                            ['label' => 'Terms & Conditions', 'link' => '/terms'],
                            ['label' => 'Cookies Policy', 'link' => '/cookies'],
                        ],
                    ],
                ],
                'footer_section_titles' => [
                    'support' => 'HELP',
                    'tracking' => 'TRACKING',
                    'legal' => 'LEGAL',
                ],
                'footer_section_order' => ['support', 'tracking', 'legal'],
                'faq' => FaqContent::defaults(),
                'contact_page' => ContactPageContent::defaults(),
                'privacy_page' => PrivacyPageContent::defaults(),
                'terms_page' => TermsPageContent::defaults(),
                'cookies_page' => CookiesPageContent::defaults(),
            ];

            // Merge with defaults
            if (empty($settings)) {
                $defaults['fonts'] = [
                    'english' => $fontSettings['font_en'] ?? $defaults['fonts']['english'],
                    'khmer' => $fontSettings['font_km'] ?? $defaults['fonts']['khmer'],
                ];
                $defaults['app_logo_url'] = $appLogoUrl;
                $defaults['header']['logo_url'] = $appLogoUrl;
                return response()->json($defaults, 200);
            }
            // Parse JSON settings - the Setting model's mutator already decodes JSON
            $parsedSettings = [];
            foreach ($defaults as $category => $defaultValue) {
                if (isset($settings[$category])) {
                    // $settings values are already decoded by Setting model mutator
                    $value = $settings[$category];
                    // If it's still a string (shouldn't happen), decode it. Otherwise use it as is.
                    $parsedSettings[$category] = is_string($value) ? (json_decode($value, true) ?? $defaultValue) : $value;
                } else {
                    $parsedSettings[$category] = $defaultValue;
                }
            }

            // Ensure header nav_labels contain latest defaults
            $defaultHeader = $defaults['header'] ?? [];
            $header = $parsedSettings['header'] ?? $defaultHeader;
            $defaultNavLabels = $defaultHeader['nav_labels'] ?? [];
            $currentNavLabels = is_array($header['nav_labels'] ?? null) ? $header['nav_labels'] : [];
            $mergedNavLabels = array_merge($defaultNavLabels, $currentNavLabels);
            $header['nav_labels'] = $mergedNavLabels;

            $defaultNavDropdowns = $defaultHeader['nav_dropdowns'] ?? [];
            $currentNavDropdowns = is_array($header['nav_dropdowns'] ?? null) ? $header['nav_dropdowns'] : [];
            $mergedNavDropdowns = [];
            foreach ($defaultNavDropdowns as $navKey => $defaultItems) {
                $stored = $currentNavDropdowns[$navKey] ?? null;
                $storedCount = $this->countNavDropdownLinks($stored);
                $defaultCount = $this->countNavDropdownLinks($defaultItems);
                $isSparseGender = in_array($navKey, ['women', 'men'], true)
                    && $storedCount > 0
                    && $storedCount < $defaultCount;
                $mergedNavDropdowns[$navKey] = (is_array($stored) && $stored !== [] && ! $isSparseGender)
                    ? $stored
                    : $defaultItems;
            }
            $header['nav_dropdowns'] = $mergedNavDropdowns;

            $header['logo_url'] = $appLogoUrl;
            $parsedSettings['header'] = $header;

            // Persist header defaults if missing (hard-save)
            Setting::updateOrCreate(
                ['key' => 'header', 'group' => 'homepage'],
                ['value' => $header, 'type' => 'json']
            );

            $parsedSettings['fonts'] = [
                'english' => $fontSettings['font_en'] ?? $defaults['fonts']['english'],
                'khmer' => $fontSettings['font_km'] ?? $defaults['fonts']['khmer'],
            ];

            // Normalize footer sections (support legacy list format and custom sections)
            $footerSectionTitles = $parsedSettings['footer_section_titles'] ?? $defaults['footer_section_titles'];
            $footerSections = $parsedSettings['footer_sections'] ?? $defaults['footer_sections'];

            if (is_array($footerSections)) {
                $parsedSettings['footer_sections'] = $this->normalizeFooterSections(
                    $footerSections,
                    $defaults,
                    is_array($footerSectionTitles) ? $footerSectionTitles : []
                );
            }

            $storedFooterSectionOrder = $parsedSettings['footer_section_order'] ?? $defaults['footer_section_order'];
            $parsedSettings['footer_section_order'] = $this->normalizeFooterSectionOrder(
                is_array($storedFooterSectionOrder) ? $storedFooterSectionOrder : [],
                is_array($parsedSettings['footer_sections'] ?? null) ? $parsedSettings['footer_sections'] : []
            );
            if (is_array($parsedSettings['footer_sections'] ?? null)) {
                $parsedSettings['footer_sections'] = $this->reorderFooterSections(
                    $parsedSettings['footer_sections'],
                    $parsedSettings['footer_section_order']
                );
            }

            $parsedSettings['footer_section_titles'] = $footerSectionTitles;
            if (empty($parsedSettings['footer_socials'])) {
                $parsedSettings['footer_socials'] = $defaults['footer_socials'];
            }

            $parsedSettings['faq'] = FaqContent::normalize(
                is_array($parsedSettings['faq'] ?? null) ? $parsedSettings['faq'] : FaqContent::defaults()
            );

            $parsedSettings['contact_page'] = ContactPageContent::normalize(
                is_array($parsedSettings['contact_page'] ?? null) ? $parsedSettings['contact_page'] : ContactPageContent::defaults()
            );

            $parsedSettings['privacy_page'] = PrivacyPageContent::normalize(
                is_array($parsedSettings['privacy_page'] ?? null) ? $parsedSettings['privacy_page'] : PrivacyPageContent::defaults()
            );

            $parsedSettings['terms_page'] = TermsPageContent::normalize(
                is_array($parsedSettings['terms_page'] ?? null) ? $parsedSettings['terms_page'] : TermsPageContent::defaults()
            );

            $parsedSettings['cookies_page'] = CookiesPageContent::normalize(
                is_array($parsedSettings['cookies_page'] ?? null) ? $parsedSettings['cookies_page'] : CookiesPageContent::defaults()
            );

            $parsedSettings['app_logo_url'] = $appLogoUrl;

            return response()->json($parsedSettings, 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update sections settings
     */
    public function updateSections(Request $request)
    {
        try {
            $validated = $request->validate([
                'sections' => 'required|array',
            ]);

            // Save sections as JSON
            Setting::updateOrCreate(
                ['key' => 'sections', 'group' => 'homepage'],
                ['value' => json_encode($validated['sections']), 'type' => 'json']
            );

            return response()->json([
                'message' => 'Homepage sections updated successfully',
                'sections' => $validated['sections']
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update header settings
     */
    public function updateHeader(Request $request)
    {
        try {
            $validated = $request->validate([
                'logo_text' => 'required|string|max:50',
                'search_enabled' => 'boolean',
                'cart_enabled' => 'boolean',
                'wishlist_enabled' => 'boolean',
                'language_enabled' => 'boolean',
            ]);

            // Save header settings as JSON
            Setting::updateOrCreate(
                ['key' => 'header', 'group' => 'homepage'],
                ['value' => json_encode($validated), 'type' => 'json']
            );

            return response()->json([
                'message' => 'Header settings updated successfully',
                'header' => $validated
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update footer settings
     */
    public function updateFooter(Request $request)
    {
        try {
            $validated = $request->validate([
                'company_name' => 'required|string|max:100',
                'company_description' => 'nullable|string',
                'copyright_text' => 'required|string|max:200',
                'support_enabled' => 'boolean',
                'tracking_enabled' => 'boolean',
                'privacy_enabled' => 'boolean',
                'contact_enabled' => 'boolean',
            ]);

            // Save footer settings as JSON
            Setting::updateOrCreate(
                ['key' => 'footer', 'group' => 'homepage'],
                ['value' => json_encode($validated), 'type' => 'json']
            );

            return response()->json([
                'message' => 'Footer settings updated successfully',
                'footer' => $validated
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Update footer sections (links)
     */
    public function updateFooterSections(Request $request)
    {
        try {
            $validated = $request->validate([
                'footer_sections' => 'required|array',
            ]);

            // Save footer sections as JSON
            Setting::updateOrCreate(
                ['key' => 'footer_sections', 'group' => 'homepage'],
                ['value' => json_encode($validated['footer_sections']), 'type' => 'json']
            );

            return response()->json([
                'message' => 'Footer sections updated successfully',
                'footer_sections' => $validated['footer_sections']
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Save all homepage settings at once
     */
    public function saveAll(Request $request)
    {
        try {
            $validated = $request->validate([
                'sections' => 'array',
                'header' => 'array',
                'footer' => 'array',
                'footer_sections' => 'array',
            ]);

            // Save each section
            if (!empty($validated['sections'])) {
                Setting::updateOrCreate(
                    ['key' => 'sections', 'group' => 'homepage'],
                    ['value' => json_encode($validated['sections']), 'type' => 'json']
                );
            }

            if (!empty($validated['header'])) {
                Setting::updateOrCreate(
                    ['key' => 'header', 'group' => 'homepage'],
                    ['value' => json_encode($validated['header']), 'type' => 'json']
                );
            }

            if (!empty($validated['footer'])) {
                Setting::updateOrCreate(
                    ['key' => 'footer', 'group' => 'homepage'],
                    ['value' => json_encode($validated['footer']), 'type' => 'json']
                );
            }

            if (!empty($validated['footer_sections'])) {
                Setting::updateOrCreate(
                    ['key' => 'footer_sections', 'group' => 'homepage'],
                    ['value' => json_encode($validated['footer_sections']), 'type' => 'json']
                );
            }

            return response()->json([
                'message' => 'All homepage settings saved successfully',
                'data' => $validated
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Save hero banner settings (extended)
     */
    public function updateHero(Request $request)
    {
        $validated = $request->validate([
            'message' => 'string|max:255',
            'icon' => 'string|max:10',
            'enabled' => 'boolean',
        ]);

        Setting::updateOrCreate(
            ['key' => 'hero', 'group' => 'homepage'],
            ['value' => $validated]
        );

        return response()->json(['message' => 'Hero banner updated', 'data' => $validated], 200);
    }

    /**
     * Save extended sections with subsections
     */
    public function updateSectionsExtended(Request $request)
    {
        $validated = $request->validate([
            'sections' => 'array|required',
            'subsections' => 'array',
        ]);

        Setting::updateOrCreate(
            ['key' => 'sections', 'group' => 'homepage'],
            ['value' => $validated['sections']]
        );

        if (!empty($validated['subsections'])) {
            Setting::updateOrCreate(
                ['key' => 'subsections', 'group' => 'homepage'],
                ['value' => $validated['subsections']]
            );
        }

        return response()->json(['message' => 'Sections updated', 'data' => $validated], 200);
    }

    /**
     * Save extended header settings
     */
    public function updateHeaderExtended(Request $request)
    {
        $validated = $request->validate([
            'logo_text' => 'string|max:100',
            'logo_url' => 'string|max:255',
            'background_color' => 'string|max:20',
            'background_image' => 'nullable|string|max:500',
            'text_color' => 'string|max:20',
            'search_placeholder' => 'string|max:100',
            'search_enabled' => 'boolean',
            'cart_enabled' => 'boolean',
            'wishlist_enabled' => 'boolean',
            'language_enabled' => 'boolean',
            'free_delivery_icon' => 'string|max:10',
            'free_delivery_text' => 'string|max:120',
            'nav_visibility' => 'array',
            'custom_nav' => 'array',
            'left_menu' => 'array',
            'nav_labels' => 'array',
            'nav_dropdowns' => 'array',
        ]);

        Setting::updateOrCreate(
            ['key' => 'header', 'group' => 'homepage'],
            ['value' => $validated]
        );

        return response()->json(['message' => 'Header updated', 'data' => $validated], 200);
    }

    /**
     * Save extended footer settings
     */
    public function updateFooterExtended(Request $request)
    {
        $validated = $request->validate([
            'footer' => 'array',
            'sections' => 'array',
            'footer_sections' => 'array',
            'footer_section_order' => 'array',
            'footer_section_titles' => 'array',
            'footer_socials' => 'array',
        ]);

        if (!empty($validated['footer'])) {
            Setting::updateOrCreate(
                ['key' => 'footer', 'group' => 'homepage'],
                ['value' => $validated['footer']]
            );
        }

        if (!empty($validated['sections'])) {
            Setting::updateOrCreate(
                ['key' => 'footer_sections', 'group' => 'homepage'],
                ['value' => $validated['sections']]
            );
        }

        if (!empty($validated['footer_sections'])) {
            Setting::updateOrCreate(
                ['key' => 'footer_sections', 'group' => 'homepage'],
                ['value' => $validated['footer_sections']]
            );
        }

        if (!empty($validated['footer_section_order'])) {
            Setting::updateOrCreate(
                ['key' => 'footer_section_order', 'group' => 'homepage'],
                ['value' => $validated['footer_section_order']]
            );
        }

        if (!empty($validated['footer_section_titles'])) {
            Setting::updateOrCreate(
                ['key' => 'footer_section_titles', 'group' => 'homepage'],
                ['value' => $validated['footer_section_titles']]
            );
        }

        if (!empty($validated['footer_socials'])) {
            Setting::updateOrCreate(
                ['key' => 'footer_socials', 'group' => 'homepage'],
                ['value' => $validated['footer_socials']]
            );
        }

        return response()->json(['message' => 'Footer updated', 'data' => $validated], 200);
    }

    /**
     * Save FAQ page content
     */
    public function updateFaq(Request $request)
    {
        $validated = $request->validate([
            'faq' => 'required|array',
            'faq.title' => 'nullable|string|max:255',
            'faq.subtitle' => 'nullable|string|max:500',
            'faq.sections' => 'nullable|array',
            'faq.section_order' => 'nullable|array',
            'faq.locales' => 'nullable|array',
            'faq.locales.en' => 'nullable|array',
            'faq.locales.km' => 'nullable|array',
        ]);

        $faq = FaqContent::normalize($validated['faq']);

        Setting::updateOrCreate(
            ['key' => 'faq', 'group' => 'homepage'],
            ['value' => $faq]
        );

        return response()->json([
            'message' => 'FAQ updated successfully',
            'faq' => $faq,
        ], 200);
    }

    /**
     * Save Contact page content
     */
    public function updateContactPage(Request $request)
    {
        $validated = $request->validate([
            'contact_page' => 'required|array',
            'contact_page.title' => 'nullable|string|max:255',
            'contact_page.subtitle' => 'nullable|string|max:500',
            'contact_page.form' => 'nullable|array',
            'contact_page.info_cards' => 'nullable|array',
            'contact_page.info_card_order' => 'nullable|array',
            'contact_page.locales' => 'nullable|array',
            'contact_page.locales.en' => 'nullable|array',
            'contact_page.locales.km' => 'nullable|array',
        ]);

        $contactPage = ContactPageContent::normalize($validated['contact_page']);

        Setting::updateOrCreate(
            ['key' => 'contact_page', 'group' => 'homepage'],
            ['value' => $contactPage]
        );

        return response()->json([
            'message' => 'Contact page updated successfully',
            'contact_page' => $contactPage,
        ], 200);
    }

    /**
     * Save Privacy page content
     */
    public function updatePrivacyPage(Request $request)
    {
        $validated = $request->validate([
            'privacy_page' => 'required|array',
            'privacy_page.title' => 'nullable|string|max:255',
            'privacy_page.last_updated' => 'nullable|string|max:255',
            'privacy_page.sections' => 'nullable|array',
            'privacy_page.section_order' => 'nullable|array',
            'privacy_page.inquiry' => 'nullable|array',
            'privacy_page.locales' => 'nullable|array',
            'privacy_page.locales.en' => 'nullable|array',
            'privacy_page.locales.km' => 'nullable|array',
        ]);

        $privacyPage = PrivacyPageContent::normalize($validated['privacy_page']);

        Setting::updateOrCreate(
            ['key' => 'privacy_page', 'group' => 'homepage'],
            ['value' => $privacyPage]
        );

        return response()->json([
            'message' => 'Privacy page updated successfully',
            'privacy_page' => $privacyPage,
        ], 200);
    }

    /**
     * Save Terms page content
     */
    public function updateTermsPage(Request $request)
    {
        $validated = $request->validate([
            'terms_page' => 'required|array',
            'terms_page.title' => 'nullable|string|max:255',
            'terms_page.last_updated' => 'nullable|string|max:255',
            'terms_page.sections' => 'nullable|array',
            'terms_page.section_order' => 'nullable|array',
            'terms_page.locales' => 'nullable|array',
            'terms_page.locales.en' => 'nullable|array',
            'terms_page.locales.km' => 'nullable|array',
        ]);

        $termsPage = TermsPageContent::normalize($validated['terms_page']);

        Setting::updateOrCreate(
            ['key' => 'terms_page', 'group' => 'homepage'],
            ['value' => $termsPage]
        );

        return response()->json([
            'message' => 'Terms page updated successfully',
            'terms_page' => $termsPage,
        ], 200);
    }

    /**
     * Save Cookies page content
     */
    public function updateCookiesPage(Request $request)
    {
        $validated = $request->validate([
            'cookies_page' => 'required|array',
            'cookies_page.title' => 'nullable|string|max:255',
            'cookies_page.last_updated' => 'nullable|string|max:255',
            'cookies_page.sections' => 'nullable|array',
            'cookies_page.section_order' => 'nullable|array',
            'cookies_page.locales' => 'nullable|array',
            'cookies_page.locales.en' => 'nullable|array',
            'cookies_page.locales.km' => 'nullable|array',
        ]);

        $cookiesPage = CookiesPageContent::normalize($validated['cookies_page']);

        Setting::updateOrCreate(
            ['key' => 'cookies_page', 'group' => 'homepage'],
            ['value' => $cookiesPage]
        );

        return response()->json([
            'message' => 'Cookies page updated successfully',
            'cookies_page' => $cookiesPage,
        ], 200);
    }

    /**
     * Upload header logo image
     */
    public function uploadChromeBackground(Request $request)
    {
        $validated = $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp,avif|max:8192',
            'target' => 'nullable|string|in:header,footer,both',
        ]);

        $target = $validated['target'] ?? 'header';
        $path = Media::storeUploaded($request->file('image'), 'chrome-backgrounds', $this->mediaDisk());
        $url = Media::url($path);

        if ($target === 'header' || $target === 'both') {
            $headerSetting = Setting::where('key', 'header')->where('group', 'homepage')->first();
            $header = $headerSetting ? (array) $headerSetting->value : [];
            $header['background_image'] = $url;
            Setting::updateOrCreate(
                ['key' => 'header', 'group' => 'homepage'],
                ['value' => $header]
            );
        }

        if ($target === 'footer' || $target === 'both') {
            $footerSetting = Setting::where('key', 'footer')->where('group', 'homepage')->first();
            $footer = $footerSetting ? (array) $footerSetting->value : [];
            $footer['background_image'] = $url;
            Setting::updateOrCreate(
                ['key' => 'footer', 'group' => 'homepage'],
                ['value' => $footer]
            );
        }

        return response()->json([
            'message' => 'Chrome background uploaded',
            'target' => $target,
            'background_image' => $url,
        ], 200);
    }

    public function uploadLogo(Request $request)
    {
        $validated = $request->validate([
            'logo' => 'required|file|mimes:jpg,jpeg,png,webp,svg,avif|max:5120',
        ]);

        $path = Media::storeUploaded($request->file('logo'), 'logos', $this->mediaDisk());
        $url = Media::url($path);

        $current = Setting::where('key', 'header')->where('group', 'homepage')->first();
        $header = $current ? (array) $current->value : [];
        $header['logo_url'] = $url;

        Setting::updateOrCreate(
            ['key' => 'header', 'group' => 'homepage'],
            ['value' => $header]
        );

        return response()->json([
            'message' => 'Logo uploaded',
            'logo_url' => $url,
        ], 200);
    }

    /**
     * Upload left menu item image
     */
    public function uploadMenuImage(Request $request)
    {
        $validated = $request->validate([
            'image' => 'required|file|mimes:jpg,jpeg,png,webp,svg,avif|max:5120',
        ]);

        $path = Media::storeUploaded($request->file('image'), 'menu-images', $this->mediaDisk());
        $url = Media::url($path);

        return response()->json([
            'message' => 'Image uploaded',
            'image_url' => $url,
        ], 200);
    }

    private function normalizeFooterSectionOrder(array $order, array $sections): array
    {
        $keys = array_keys($sections);
        $normalized = [];

        foreach ($order as $key) {
            if (is_string($key) && $key !== '' && in_array($key, $keys, true) && ! in_array($key, $normalized, true)) {
                $normalized[] = $key;
            }
        }

        foreach ($keys as $key) {
            if (! in_array($key, $normalized, true)) {
                $normalized[] = $key;
            }
        }

        return $normalized;
    }

    private function reorderFooterSections(array $sections, array $order): array
    {
        $normalizedOrder = $this->normalizeFooterSectionOrder($order, $sections);
        $reordered = [];

        foreach ($normalizedOrder as $key) {
            if (isset($sections[$key])) {
                $reordered[$key] = $sections[$key];
            }
        }

        return $reordered;
    }

    private function normalizeFooterSections(array $footerSections, array $defaults, array $footerSectionTitles = []): array
    {
        $knownKeys = ['support', 'tracking', 'legal'];
        $defaultSections = is_array($defaults['footer_sections'] ?? null) ? $defaults['footer_sections'] : [];
        $normalized = [];

        foreach ($knownKeys as $key) {
            $fallbackTitle = $footerSectionTitles[$key]
                ?? ($defaultSections[$key]['title'] ?? strtoupper($key));
            $entry = $footerSections[$key] ?? ($defaultSections[$key] ?? ['title' => $fallbackTitle, 'items' => []]);
            $normalized[$key] = $this->normalizeFooterSectionEntry($entry, $fallbackTitle);
        }

        foreach ($footerSections as $key => $entry) {
            if (! is_string($key) || $key === '' || in_array($key, $knownKeys, true)) {
                continue;
            }
            $normalized[$key] = $this->normalizeFooterSectionEntry($entry);
        }

        return $normalized;
    }

    private function normalizeFooterSectionEntry(mixed $entry, ?string $fallbackTitle = null): array
    {
        if (is_array($entry) && array_is_list($entry)) {
            return [
                'title' => $fallbackTitle ?? 'Links',
                'items' => $this->normalizeFooterSectionItems($entry),
            ];
        }

        if (! is_array($entry)) {
            return [
                'title' => $fallbackTitle ?? 'Links',
                'items' => [],
            ];
        }

        return [
            'title' => (string) ($entry['title'] ?? $fallbackTitle ?? 'Links'),
            'items' => $this->normalizeFooterSectionItems($entry['items'] ?? []),
        ];
    }

    private function normalizeFooterSectionItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $normalized[] = [
                'label' => (string) ($item['label'] ?? ''),
                'link' => (string) ($item['link'] ?? ''),
            ];
        }

        return $normalized;
    }

    private function countNavDropdownLinks(mixed $items): int
    {
        if (! is_array($items)) {
            return 0;
        }

        $count = 0;
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            if (($item['type'] ?? null) === 'section' && is_array($item['items'] ?? null)) {
                $count += count($item['items']);
            } elseif (! empty($item['to'])) {
                $count += 1;
            }
        }

        return $count;
    }
}
