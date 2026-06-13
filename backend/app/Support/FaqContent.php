<?php

namespace App\Support;

class FaqContent
{
    public static function defaults(): array
    {
        return self::defaultBilingual();
    }

    public static function defaultBilingual(): array
    {
        return [
            'section_order' => ['orders_shipping', 'returns_refunds', 'payments', 'account_support'],
            'locales' => [
                'en' => self::defaultEnglishLocale(),
                'km' => self::defaultKhmerLocale(),
            ],
        ];
    }

    private static function defaultEnglishLocale(): array
    {
        return [
            'title' => 'Frequently Asked Questions',
            'subtitle' => 'Find quick answers to common questions.',
            'sections' => [
                'orders_shipping' => [
                    'title' => 'Orders & Shipping',
                    'items' => [
                        [
                            'question' => 'How can I track my order?',
                            'answer' => "Sign in, then open Profile → Track Order or check My Orders. Enter your order number to view status. You'll also receive email updates when your order ships.",
                        ],
                        [
                            'question' => 'How long does shipping take?',
                            'answer' => 'Most deliveries arrive in 3–5 business days across Cambodia. Phnom Penh orders are often faster (about 1–3 days). Free delivery applies on orders over $40.',
                        ],
                        [
                            'question' => 'Do you ship internationally?',
                            'answer' => "We currently ship within Cambodia only. We're working to expand to more locations.",
                        ],
                    ],
                ],
                'returns_refunds' => [
                    'title' => 'Returns & Refunds',
                    'items' => [
                        [
                            'question' => 'What is your return policy?',
                            'answer' => 'We accept returns and replacement requests within 30 days for unused items in original condition with tags and packaging intact.',
                        ],
                        [
                            'question' => 'How do I start a return?',
                            'answer' => 'Go to My Orders or Profile → Order History, select the order, and click Request Replacement. Track progress under Profile → Replacements.',
                        ],
                        [
                            'question' => 'When will I receive my refund?',
                            'answer' => "Refunds are processed within 5–7 business days after we receive and approve your returned item. You'll get an email confirmation once it's complete.",
                        ],
                    ],
                ],
                'payments' => [
                    'title' => 'Payments',
                    'items' => [
                        [
                            'question' => 'Which payment methods are accepted?',
                            'answer' => 'Checkout supports KHQR / Bakong (ABA, Wing, ACLEDA, Canadia, and most Cambodian bank apps) and credit / debit cards (Visa, Mastercard, Amex, UnionPay).',
                        ],
                        [
                            'question' => 'Is my payment information secure?',
                            'answer' => 'Yes. All payment transactions are encrypted and processed securely. We never store full card details.',
                        ],
                    ],
                ],
                'account_support' => [
                    'title' => 'Account & Support',
                    'items' => [
                        [
                            'question' => 'How do I create an account?',
                            'answer' => "Click Login in the header, then choose Create Account. You'll need a valid email address.",
                        ],
                        [
                            'question' => 'I forgot my password. What should I do?',
                            'answer' => 'Use the Forgot Password link on the login page and follow the instructions sent to your email.',
                        ],
                        [
                            'question' => 'How can I contact support?',
                            'answer' => 'Visit Contact Us or Help & Support, or email kalapakgpt@gmail.com. We typically reply within 24 hours.',
                        ],
                    ],
                ],
            ],
        ];
    }

    private static function defaultKhmerLocale(): array
    {
        return [
            'title' => 'សំណួរញឹកញាប់',
            'subtitle' => 'ស្វែងរកចម្លើយរហ័សសម្រាប់សំណួរទូទៅ។',
            'sections' => [
                'orders_shipping' => [
                    'title' => 'ការបញ្ជាទិញ & ការដឹកជញ្ជូន',
                    'items' => [
                        [
                            'question' => 'តើខ្ញុំអាចតាមដានការបញ្ជាទិញបានយ៉ាងដូចម្តេច?',
                            'answer' => 'ចូលគណនី បន្ទាប់មកទៅ Profile → Track Order ឬមើល My Orders។ បញ្ចូលលេខការបញ្ជាទិញដើម្បីមើលស្ថានភាព។ អ្នកនឹងទទួលអ៊ីមែលជូនដំណឹងនៅពេលការបញ្ជាទិញត្រូវបានដឹកចេញ។',
                        ],
                        [
                            'question' => 'ការដឹកជញ្ជូនចំណាយពេលប៉ុន្មាន?',
                            'answer' => 'ការដឹកជញ្ជូនភាគច្រើនចំណាយពេល 3–5 ថ្ងៃធ្វើការទូទាំងប្រទេសកម្ពុជា។ ការបញ្ជាទិញនៅភ្នំពេញភាគច្រើនលឿនជាង (ប្រហែល 1–3 ថ្ងៃ)។ ដឹកជញ្ជូនឥតគិតថ្លៃសម្រាប់ការបញ្ជាទិញលើស $40។',
                        ],
                        [
                            'question' => 'តើអ្នកដឹកជញ្ជូនអន្តរជាតិទេ?',
                            'answer' => 'បច្ចុប្បន្ន យើងដឹកជញ្ជូនក្នុងប្រទេសកម្ពុជា ប៉ុណ្ណោះ។ យើងកំពុងពង្រីកទៅតំបន់ផ្សេងៗ។',
                        ],
                    ],
                ],
                'returns_refunds' => [
                    'title' => 'ការត្រឡប់ & បង្វិលប្រាក់',
                    'items' => [
                        [
                            'question' => 'គោលនយោបាយត្រឡប់ទំនិញជាអ្វី?',
                            'answer' => 'យើងទទួលការត្រឡប់ និងស្នើសុំជំនួសក្នុងរយៈពេល 30 ថ្ងៃសម្រាប់ទំនិញមិនប្រើ និងនៅក្នុងសភាពដើម ជាមួយស្លាក និងកញ្ចប់គ្រប់ជ្រុងជ្រោម។',
                        ],
                        [
                            'question' => 'តើខ្ញុំចាប់ផ្តើមការត្រឡប់ដូចម្តេច?',
                            'answer' => 'ទៅ My Orders ឬ Profile → Order History ជ្រើសរើសការបញ្ជាទិញ ហើយចុច Request Replacement។ តាមដានស្ថានភាពនៅ Profile → Replacements។',
                        ],
                        [
                            'question' => 'ពេលណាខ្ញុំនឹងទទួលបានការបង្វិលប្រាក់?',
                            'answer' => 'ការបង្វិលប្រាក់ធ្វើឡើងក្នុង 5–7 ថ្ងៃធ្វើការ បន្ទាប់ពីយើងទទួល និងអនុម័តទំនិញត្រឡប់។ អ្នកនឹងទទួលអ៊ីមែលបញ្ជាក់។',
                        ],
                    ],
                ],
                'payments' => [
                    'title' => 'ការបង់ប្រាក់',
                    'items' => [
                        [
                            'question' => 'វិធីបង់ប្រាក់ណាខ្លះដែលទទួលយក?',
                            'answer' => 'ការទូទាត់អនឡាញគាំទ្រ KHQR / Bakong (ABA, Wing, ACLEDA, Canadia និងកម្មវិធីធនាគារកម្ពុជាភាគច្រើន) និងកាតឥណទាន / ឥណពន្ធ (Visa, Mastercard, Amex, UnionPay)។',
                        ],
                        [
                            'question' => 'តើព័ត៌មានបង់ប្រាក់មានសុវត្ថិភាពទេ?',
                            'answer' => 'បាទ/ចាស។ ប្រតិបត្តិការបង់ប្រាក់ទាំងអស់ត្រូវបានអ៊ិនគ្រីប និងដំណើរការប្រកបដោយសុវត្ថិភាព។ យើងមិនរក្សាទុកព័ត៌មានកាតពេញលេញទេ។',
                        ],
                    ],
                ],
                'account_support' => [
                    'title' => 'គណនី & គាំទ្រ',
                    'items' => [
                        [
                            'question' => 'តើខ្ញុំបង្កើតគណនីបានយ៉ាងដូចម្តេច?',
                            'answer' => 'ចុច Login នៅផ្នែកខាងលើ បន្ទាប់មកជ្រើស Create Account។ ត្រូវការអ៊ីមែលត្រឹមត្រូវ។',
                        ],
                        [
                            'question' => 'ខ្ញុំភ្លេចពាក្យសម្ងាត់ តើត្រូវធ្វើដូចម្តេច?',
                            'answer' => 'ប្រើតំណ Forgot Password នៅទំព័រចូល និងអនុវត្តតាមសេចក្តីណែនាំក្នុងអ៊ីមែល។',
                        ],
                        [
                            'question' => 'តើខ្ញុំអាចទំនាក់ទំនងគាំទ្របានយ៉ាងដូចម្តេច?',
                            'answer' => 'ទៅទំព័រ Contact Us ឬ Help & Support ឬផ្ញើអ៊ីមែលទៅ kalapakgpt@gmail.com។ យើងធម្មតាឆ្លើយតបក្នុង 24 ម៉ោង។',
                        ],
                    ],
                ],
            ],
        ];
    }

    public static function normalize(array $faq): array
    {
        if (is_array($faq['locales'] ?? null)) {
            $en = self::normalizeLocale(
                is_array($faq['locales']['en'] ?? null) ? $faq['locales']['en'] : [],
                self::defaultEnglishLocale()
            );
            $km = self::normalizeLocale(
                is_array($faq['locales']['km'] ?? null) ? $faq['locales']['km'] : [],
                self::defaultKhmerLocale()
            );

            $mergedSections = array_merge($en['sections'], $km['sections']);
            $sectionOrder = self::normalizeSectionOrder(
                is_array($faq['section_order'] ?? null) ? $faq['section_order'] : [],
                array_keys($mergedSections)
            );

            return [
                'section_order' => $sectionOrder,
                'locales' => self::syncLocalesForOrder(['en' => $en, 'km' => $km], $sectionOrder),
            ];
        }

        $legacyLocale = self::normalizeLocale($faq, self::defaultEnglishLocale());
        $sectionOrder = self::normalizeSectionOrder(
            is_array($faq['section_order'] ?? null) ? $faq['section_order'] : [],
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

            $items = [];
            foreach ($section['items'] ?? [] as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $items[] = [
                    'question' => (string) ($item['question'] ?? ''),
                    'answer' => (string) ($item['answer'] ?? ''),
                ];
            }

            $normalizedSections[$key] = [
                'title' => (string) ($section['title'] ?? $key),
                'items' => $items,
            ];
        }

        if ($normalizedSections === []) {
            $normalizedSections = $fallback['sections'];
        }

        return [
            'title' => (string) ($localeData['title'] ?? $fallback['title']),
            'subtitle' => (string) ($localeData['subtitle'] ?? $fallback['subtitle']),
            'sections' => $normalizedSections,
        ];
    }

    private static function syncLocalesForOrder(array $locales, array $sectionOrder): array
    {
        $synced = [];

        foreach (['en', 'km'] as $locale) {
            $localeData = $locales[$locale] ?? ['title' => '', 'subtitle' => '', 'sections' => []];
            $sections = $localeData['sections'];

            foreach ($sectionOrder as $key) {
                if (! isset($sections[$key])) {
                    $sections[$key] = [
                        'title' => $locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
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
