<?php

namespace App\Support;

class TermsPageContent
{
    public static function defaults(): array
    {
        return self::defaultBilingual();
    }

    public static function defaultBilingual(): array
    {
        return [
            'section_order' => [
                'introduction', 'eligibility', 'orders_payments', 'shipping_delivery', 'returns_refunds',
                'user_conduct', 'intellectual_property', 'limitation_liability', 'changes_to_terms', 'contact',
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
            'title' => 'Terms & Conditions',
            'last_updated' => 'Last updated: Feb 1, 2026',
            'sections' => [
                'introduction' => ['title' => '1. Introduction', 'body' => 'These Terms & Conditions govern your use of FitandSleek’s website and services. By accessing or using our site, you agree to these terms.'],
                'eligibility' => ['title' => '2. Eligibility', 'body' => 'You must be at least 18 years old or have permission from a parent/guardian to use our services.'],
                'orders_payments' => ['title' => '3. Orders & Payments', 'body' => 'All orders are subject to acceptance and availability. Prices are listed in USD and may change without notice. Payment must be completed before shipment.'],
                'shipping_delivery' => ['title' => '4. Shipping & Delivery', 'body' => 'Delivery times are estimates and may vary due to carrier delays or external factors. We are not responsible for delays beyond our control.'],
                'returns_refunds' => ['title' => '5. Returns & Refunds', 'body' => 'Returns are accepted within 30 days for eligible items. Items must be unused and in original packaging. Refunds are processed after inspection.'],
                'user_conduct' => ['title' => '6. User Conduct', 'body' => 'You agree not to misuse the site, interfere with services, or violate any laws. We may suspend accounts that breach these terms.'],
                'intellectual_property' => ['title' => '7. Intellectual Property', 'body' => 'All content, branding, and assets are owned by FitandSleek or licensed partners. You may not copy or reuse without permission.'],
                'limitation_liability' => ['title' => '8. Limitation of Liability', 'body' => 'FitandSleek is not liable for indirect or consequential damages arising from the use of our services.'],
                'changes_to_terms' => ['title' => '9. Changes to Terms', 'body' => 'We may update these terms from time to time. Continued use of the site means you accept the updated terms.'],
                'contact' => ['title' => '10. Contact', 'body' => 'If you have questions about these Terms & Conditions, please contact us via the Contact Us page.'],
            ],
        ];
    }

    private static function defaultKhmerLocale(): array
    {
        return [
            'title' => 'លក្ខខណ្ឌ និងលិខិតបញ្ជាក់',
            'last_updated' => 'ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ៖ កុម្ភៈ 1, 2026',
            'sections' => [
                'introduction' => ['title' => '1. បើកកថា', 'body' => 'លក្ខខណ្ឌនេះគ្រប់គ្រងការប្រើប្រាស់គេហទំព័រ និងសេវាកម្ម FitandSleek។ ដោយចូលប្រើ ឬប្រើប្រាស់ គេហទំព័រ អ្នកយល់ព្រមលើលក្ខខណ្ឌទាំងនេះ។'],
                'eligibility' => ['title' => '2. សិទ្ធិប្រើប្រាស់', 'body' => 'អ្នកត្រូវមានអាយុយ៉ាងហោចណាស់ 18 ឆ្នាំ ឬមានការអនុញ្ញាតពីឪពុកម្តាយ/អាណាព្យាបាល ដើម្បីប្រើសេវាកម្ម។'],
                'orders_payments' => ['title' => '3. ការបញ្ជាទិញ & ការបង់ប្រាក់', 'body' => 'ការបញ្ជាទិញទាំងអស់ពឹងផ្អែកលើការអនុម័ត និងស្តុក។ តម្លៃបង្ហាញជាប្រាក់ USD ហើយអាចផ្លាស់ប្តូរដោយមិនជូនដំណឹងជាមុន។ ត្រូវបង់ប្រាក់មុនការដឹកជញ្ជូន។'],
                'shipping_delivery' => ['title' => '4. ការដឹកជញ្ជូន', 'body' => 'ពេលវេលាដឹកជញ្ជូនគ្រាន់តែជាការប៉ាន់ស្មាន ហើយអាចប្រែប្រួលដោយសារការពន្យារពេលពីក្រុមហ៊ុនដឹកជញ្ជូន ឬកត្តាខាងក្រៅ។ យើងមិនទទួលខុសត្រូវចំពោះការពន្យារពេលក្រៅការគ្រប់គ្រង។'],
                'returns_refunds' => ['title' => '5. ការត្រឡប់ & បង្វិលប្រាក់', 'body' => 'ការត្រឡប់ទទួលបានក្នុងរយៈពេល 30 ថ្ងៃសម្រាប់ទំនិញដែលមានលក្ខណៈសម្បត្តិ។ ទំនិញត្រូវមិនបានប្រើ និងនៅក្នុងកញ្ចប់ដើម។ បង្វិលប្រាក់ធ្វើឡើងក្រោយពេលពិនិត្យ។'],
                'user_conduct' => ['title' => '6. ឥរិយាបថអ្នកប្រើប្រាស់', 'body' => 'អ្នកយល់ព្រមមិនប្រើប្រាស់ខុស ប្រមាថ ឬរំខានសេវាកម្ម ឬលោភលន់ច្បាប់។ យើងអាចផ្អាកគណនីដែលរំលោភលក្ខខណ្ឌ។'],
                'intellectual_property' => ['title' => '7. កម្មសិទ្ធិបញ្ញា', 'body' => 'ខ្លឹមសារ ម៉ាក និងទ្រព្យសម្បត្តិទាំងអស់ជាកម្មសិទ្ធិ FitandSleek ឬដៃគូ។ អ្នកមិនអាចចម្លង ឬប្រើឡើងវិញដោយគ្មានការអនុញ្ញាត។'],
                'limitation_liability' => ['title' => '8. ការកំណត់ទំនួលខុសត្រូវ', 'body' => 'FitandSleek មិនទទួលខុសត្រូវចំពោះការខូចខាតដោយអព្យាក្រឹត ឬបន្តបន្ទាប់ដែលកើតពីការប្រើសេវាកម្ម។'],
                'changes_to_terms' => ['title' => '9. ការផ្លាស់ប្តូរលក្ខខណ្ឌ', 'body' => 'យើងអាចធ្វើបច្ចុប្បន្នភាពលក្ខខណ្ឌពីពេលទៅពេល។ ការបន្តប្រើប្រាស់មានន័យថាអ្នកយល់ព្រមលើលក្ខខណ្ឌថ្មី។'],
                'contact' => ['title' => '10. ទំនាក់ទំនង', 'body' => 'បើមានសំណួរអំពីលក្ខខណ្ឌនេះ សូមទំនាក់ទំនងតាមទំព័រទំនាក់ទំនង។'],
            ],
        ];
    }

    public static function normalize(array $termsPage): array
    {
        if (is_array($termsPage['locales'] ?? null)) {
            $en = self::normalizeLocale(
                is_array($termsPage['locales']['en'] ?? null) ? $termsPage['locales']['en'] : [],
                self::defaultEnglishLocale()
            );
            $km = self::normalizeLocale(
                is_array($termsPage['locales']['km'] ?? null) ? $termsPage['locales']['km'] : [],
                self::defaultKhmerLocale()
            );

            $mergedSections = array_merge($en['sections'], $km['sections']);
            $sectionOrder = self::normalizeSectionOrder(
                is_array($termsPage['section_order'] ?? null) ? $termsPage['section_order'] : [],
                array_keys($mergedSections)
            );

            return [
                'section_order' => $sectionOrder,
                'locales' => self::syncLocalesForOrder(['en' => $en, 'km' => $km], $sectionOrder),
            ];
        }

        $legacyLocale = self::normalizeLocale($termsPage, self::defaultEnglishLocale());
        $sectionOrder = self::normalizeSectionOrder(
            is_array($termsPage['section_order'] ?? null) ? $termsPage['section_order'] : [],
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
                    ];
                }
            }

            $localeData['sections'] = self::reorderSections($sections, $sectionOrder);
            $synced[$locale] = $localeData;
        }

        return $synced;
    }

    private static function normalizeSection(array $section, string $fallbackTitle): array
    {
        return [
            'title' => (string) ($section['title'] ?? $fallbackTitle),
            'body' => (string) ($section['body'] ?? ''),
        ];
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
