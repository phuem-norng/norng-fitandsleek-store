<?php

namespace App\Support;

class CookiesPageContent
{
    public static function defaults(): array
    {
        return self::defaultBilingual();
    }

    public static function defaultBilingual(): array
    {
        return [
            'section_order' => [
                'what_are_cookies', 'how_we_use', 'types_of_cookies', 'managing_cookies', 'policy_updates', 'contact',
            ],
            'locales' => [
                'en' => self::defaultEnglishLocale(),
                'km' => self::defaultKhmerLocale(),
            ],
        ];
    }

    private static function defaultEnglishLocale(): array
    {
        return [
            'title' => 'Cookies Policy',
            'last_updated' => 'Last updated: Feb 1, 2026',
            'sections' => [
                'what_are_cookies' => [
                    'title' => '1. What Are Cookies?',
                    'body' => 'Cookies are small text files stored on your device to improve your browsing experience and help us understand how our site is used.',
                    'items' => [],
                ],
                'how_we_use' => [
                    'title' => '2. How We Use Cookies',
                    'body' => '',
                    'items' => [
                        ['label' => '', 'text' => 'Remembering your preferences and cart items'],
                        ['label' => '', 'text' => 'Analyzing site traffic and usage patterns'],
                        ['label' => '', 'text' => 'Improving site performance and user experience'],
                        ['label' => '', 'text' => 'Delivering relevant offers (where applicable)'],
                    ],
                ],
                'types_of_cookies' => [
                    'title' => '3. Types of Cookies We Use',
                    'body' => 'We may use essential cookies (necessary for site functionality), performance cookies (analytics), and preference cookies (remembering settings).',
                    'items' => [],
                ],
                'managing_cookies' => [
                    'title' => '4. Managing Cookies',
                    'body' => 'You can manage cookies in your browser settings. Disabling cookies may affect certain features like cart or checkout.',
                    'items' => [],
                ],
                'policy_updates' => [
                    'title' => '5. Updates to This Policy',
                    'body' => 'We may update this policy from time to time. Changes will be posted on this page with an updated revision date.',
                    'items' => [],
                ],
                'contact' => [
                    'title' => '6. Contact',
                    'body' => 'If you have questions about our Cookies Policy, please contact us via the Contact Us page.',
                    'items' => [],
                ],
            ],
        ];
    }

    private static function defaultKhmerLocale(): array
    {
        return [
            'title' => 'គោលនយោបាយខូគី',
            'last_updated' => 'ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ៖ កុម្ភៈ 1, 2026',
            'sections' => [
                'what_are_cookies' => [
                    'title' => '1. ខូគីជាអ្វី?',
                    'body' => 'ខូគីជាឯកសារអត្ថបទតូចៗដែលរក្សាទុកលើឧបករណ៍ ដើម្បីធ្វើឱ្យបទពិសោធន៍រុករកល្អប្រសើរ និងជួយយើងយល់ពីការប្រើប្រាស់គេហទំព័រ។',
                    'items' => [],
                ],
                'how_we_use' => [
                    'title' => '2. របៀបយើងប្រើខូគី',
                    'body' => '',
                    'items' => [
                        ['label' => '', 'text' => 'ចងចាំចំណូលចិត្ត និងទំនិញក្នុងកន្ត្រក'],
                        ['label' => '', 'text' => 'វិភាគចរាចរណ៍គេហទំព័រ និងរបៀបប្រើប្រាស់'],
                        ['label' => '', 'text' => 'ធ្វើឱ្យប្រសើរនូវប្រសិទ្ធភាព និងបទពិសោធន៍អ្នកប្រើ'],
                        ['label' => '', 'text' => 'ផ្តល់ការផ្តល់ជូនពាក់ព័ន្ធ (បើមាន)'],
                    ],
                ],
                'types_of_cookies' => [
                    'title' => '3. ប្រភេទខូគីដែលយើងប្រើ',
                    'body' => 'យើងអាចប្រើខូគីចាំបាច់ (សម្រាប់មុខងារ), ខូគីប្រសិទ្ធភាព (វិភាគ), និងខូគីចំណូលចិត្ត (ចងចាំការកំណត់)។',
                    'items' => [],
                ],
                'managing_cookies' => [
                    'title' => '4. ការគ្រប់គ្រងខូគី',
                    'body' => 'អ្នកអាចគ្រប់គ្រងខូគីតាមការកំណត់កម្មវិធីរុករក។ ការបិទខូគីអាចប៉ះពាល់មុខងារដូចជា កន្ត្រក ឬការទូទាត់។',
                    'items' => [],
                ],
                'policy_updates' => [
                    'title' => '5. ការធ្វើបច្ចុប្បន្នភាពគោលនយោបាយនេះ',
                    'body' => 'យើងអាចធ្វើបច្ចុប្បន្នភាពគោលនយោបាយនេះពីពេលទៅពេល។ ការផ្លាស់ប្តូរនឹងត្រូវបានបង្ហាញនៅទំព័រនេះជាមួយកាលបរិច្ឆេទថ្មី។',
                    'items' => [],
                ],
                'contact' => [
                    'title' => '6. ទំនាក់ទំនង',
                    'body' => 'ប្រសិនបើមានសំណួរអំពីគោលនយោបាយខូគី សូមទំនាក់ទំនងតាមទំព័រទំនាក់ទំនង។',
                    'items' => [],
                ],
            ],
        ];
    }

    public static function normalize(array $cookiesPage): array
    {
        if (is_array($cookiesPage['locales'] ?? null)) {
            $en = self::normalizeLocale(
                is_array($cookiesPage['locales']['en'] ?? null) ? $cookiesPage['locales']['en'] : [],
                self::defaultEnglishLocale()
            );
            $km = self::normalizeLocale(
                is_array($cookiesPage['locales']['km'] ?? null) ? $cookiesPage['locales']['km'] : [],
                self::defaultKhmerLocale()
            );

            $mergedSections = array_merge($en['sections'], $km['sections']);
            $sectionOrder = self::normalizeSectionOrder(
                is_array($cookiesPage['section_order'] ?? null) ? $cookiesPage['section_order'] : [],
                array_keys($mergedSections)
            );

            return [
                'section_order' => $sectionOrder,
                'locales' => self::syncLocalesForOrder(['en' => $en, 'km' => $km], $sectionOrder),
            ];
        }

        $legacyLocale = self::normalizeLocale($cookiesPage, self::defaultEnglishLocale());
        $sectionOrder = self::normalizeSectionOrder(
            is_array($cookiesPage['section_order'] ?? null) ? $cookiesPage['section_order'] : [],
            array_keys($legacyLocale['sections'])
        );

        return [
            'section_order' => $sectionOrder,
            'locales' => self::syncLocalesForOrder([
                'en' => $legacyLocale,
                'km' => self::defaultKhmerLocale(),
            ], $sectionOrder),
        ];
    }

    private static function normalizeLocale(array $localeData, array $fallback): array
    {
        $sections = is_array($localeData['sections'] ?? null) ? $localeData['sections'] : $fallback['sections'];
        $normalizedSections = [];

        foreach ($sections as $key => $section) {
            if (! is_string($key) || $key === '' || ! is_array($section)) {
                continue;
            }

            $normalizedSections[$key] = self::normalizeSection($section, $key);
        }

        if ($normalizedSections === []) {
            $normalizedSections = $fallback['sections'];
        }

        return [
            'title' => (string) ($localeData['title'] ?? $fallback['title']),
            'last_updated' => (string) ($localeData['last_updated'] ?? $fallback['last_updated']),
            'sections' => $normalizedSections,
        ];
    }

    private static function normalizeSection(array $section, string $fallbackTitle): array
    {
        $items = [];
        foreach ($section['items'] ?? [] as $item) {
            if (! is_array($item)) {
                continue;
            }
            $items[] = [
                'label' => (string) ($item['label'] ?? ''),
                'text' => (string) ($item['text'] ?? ''),
            ];
        }

        return [
            'title' => (string) ($section['title'] ?? $fallbackTitle),
            'body' => (string) ($section['body'] ?? ''),
            'items' => $items,
        ];
    }

    private static function syncLocalesForOrder(array $locales, array $sectionOrder): array
    {
        $synced = [];

        foreach (['en', 'km'] as $locale) {
            $localeData = $locales[$locale] ?? ['title' => '', 'last_updated' => '', 'sections' => []];
            $sections = $localeData['sections'];

            foreach ($sectionOrder as $key) {
                if (! isset($sections[$key])) {
                    $sections[$key] = [
                        'title' => $locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
                        'body' => '',
                        'items' => [],
                    ];
                }
            }

            $localeData['sections'] = self::reorderSections($sections, $sectionOrder);
            $synced[$locale] = $localeData;
        }

        return $synced;
    }

    private static function normalizeSectionOrder(array $order, array $keys): array
    {
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

    private static function reorderSections(array $sections, array $order): array
    {
        $reordered = [];
        foreach (self::normalizeSectionOrder($order, array_keys($sections)) as $key) {
            if (isset($sections[$key])) {
                $reordered[$key] = $sections[$key];
            }
        }

        return $reordered;
    }
}
