<?php

namespace App\Support;

class ContactPageContent
{
    private const FORM_TEXT_FIELDS = [
        'name_label',
        'email_label',
        'phone_label',
        'subject_label',
        'message_label',
        'select_subject_label',
        'submit_label',
        'name_placeholder',
        'email_placeholder',
        'phone_placeholder',
        'message_placeholder',
    ];

    public static function defaults(): array
    {
        return self::defaultBilingual();
    }

    public static function defaultBilingual(): array
    {
        return [
            'form' => [
                'subject_order' => ['general', 'order', 'product', 'return', 'partnership', 'other'],
            ],
            'info_card_order' => ['email', 'phone', 'visit'],
            'locales' => [
                'en' => self::defaultEnglishLocale(),
                'km' => self::defaultKhmerLocale(),
            ],
        ];
    }

    private static function defaultEnglishLocale(): array
    {
        return [
            'title' => 'Contact Us',
            'subtitle' => "Have a question or need help? We'd love to hear from you.",
            'form' => [
                'name_label' => 'Your Name',
                'email_label' => 'Email Address',
                'phone_label' => 'Phone Number',
                'subject_label' => 'Subject',
                'message_label' => 'Message',
                'select_subject_label' => 'Select a subject',
                'submit_label' => 'Send Message',
                'name_placeholder' => 'John Doe',
                'email_placeholder' => 'john@example.com',
                'phone_placeholder' => '+855 12 345 678',
                'message_placeholder' => 'Tell us how we can help you...',
                'subjects' => [
                    'general' => ['label' => 'General Inquiry'],
                    'order' => ['label' => 'Order Status'],
                    'product' => ['label' => 'Product Question'],
                    'return' => ['label' => 'Returns & Refunds'],
                    'partnership' => ['label' => 'Partnership'],
                    'other' => ['label' => 'Other'],
                ],
            ],
            'info_cards' => [
                'email' => [
                    'title' => 'Email Us',
                    'line1' => 'kalapakgpt@gmail.com',
                    'line2' => 'We reply within 24h',
                    'href' => 'mailto:kalapakgpt@gmail.com',
                ],
                'phone' => [
                    'title' => 'Call Us',
                    'line1' => '+855 00 00 000',
                    'line2' => 'Mon-Fri 9am-6pm',
                    'href' => 'tel:+85500000000',
                ],
                'visit' => [
                    'title' => 'Visit Us',
                    'line1' => 'Phnom Penh, Cambodia',
                    'line2' => 'Come say hello!',
                    'href' => '',
                ],
            ],
        ];
    }

    private static function defaultKhmerLocale(): array
    {
        return [
            'title' => 'ទំនាក់ទំនងយើង',
            'subtitle' => 'មានសំណួរឬត្រូវការជំនួយ? យើងរីករាយស្តាប់ពីអ្នក។',
            'form' => [
                'name_label' => 'ឈ្មោះរបស់អ្នក',
                'email_label' => 'អាសយដ្ឋានអ៊ីមែល',
                'phone_label' => 'លេខទូរស័ព្ទ',
                'subject_label' => 'ប្រធានបទ',
                'message_label' => 'សារ',
                'select_subject_label' => 'ជ្រើសរើសប្រធានបទ',
                'submit_label' => 'ផ្ញើសារ',
                'name_placeholder' => 'ចន ដូ',
                'email_placeholder' => 'john@example.com',
                'phone_placeholder' => '+855 12 345 678',
                'message_placeholder' => 'ប្រាប់យើងពីអ្វីដែលយើងអាចជួយអ្នកបាន...',
                'subjects' => [
                    'general' => ['label' => 'សំណួរទូទៅ'],
                    'order' => ['label' => 'ស្ថានភាពការបញ្ជាទិញ'],
                    'product' => ['label' => 'សំណួរអំពីផលិតផល'],
                    'return' => ['label' => 'ការត្រឡប់ & បង្វិលប្រាក់'],
                    'partnership' => ['label' => 'សហការណ៍'],
                    'other' => ['label' => 'ផ្សេងៗ'],
                ],
            ],
            'info_cards' => [
                'email' => [
                    'title' => 'អ៊ីមែលមកយើង',
                    'line1' => 'kalapakgpt@gmail.com',
                    'line2' => 'ឆ្លើយតបក្នុងរយៈពេល 24 ម៉ោង',
                    'href' => 'mailto:kalapakgpt@gmail.com',
                ],
                'phone' => [
                    'title' => 'ទូរស័ព្ទមកយើង',
                    'line1' => '+855 00 00 000',
                    'line2' => 'ចន្ទ-សុក្រ 9ព្រឹក-6ល្ងាច',
                    'href' => 'tel:+85500000000',
                ],
                'visit' => [
                    'title' => 'មកជួបយើង',
                    'line1' => 'ភ្នំពេញ ប្រទេសកម្ពុជា',
                    'line2' => 'សូមមកជួបសួស្តី!',
                    'href' => '',
                ],
            ],
        ];
    }

    public static function normalize(array $contactPage): array
    {
        if (is_array($contactPage['locales'] ?? null)) {
            $en = self::normalizeLocale(
                is_array($contactPage['locales']['en'] ?? null) ? $contactPage['locales']['en'] : [],
                self::defaultEnglishLocale()
            );
            $km = self::normalizeLocale(
                is_array($contactPage['locales']['km'] ?? null) ? $contactPage['locales']['km'] : [],
                self::defaultKhmerLocale()
            );

            $mergedSubjectKeys = array_values(array_unique(array_merge(
                array_keys($en['form']['subjects']),
                array_keys($km['form']['subjects'])
            )));
            $mergedCardKeys = array_values(array_unique(array_merge(
                array_keys($en['info_cards']),
                array_keys($km['info_cards'])
            )));

            $subjectOrder = self::normalizeListOrder(
                is_array($contactPage['form']['subject_order'] ?? null)
                    ? $contactPage['form']['subject_order']
                    : (is_array($contactPage['subject_order'] ?? null) ? $contactPage['subject_order'] : []),
                $mergedSubjectKeys
            );
            $infoCardOrder = self::normalizeListOrder(
                is_array($contactPage['info_card_order'] ?? null) ? $contactPage['info_card_order'] : [],
                $mergedCardKeys
            );

            return [
                'form' => ['subject_order' => $subjectOrder],
                'info_card_order' => $infoCardOrder,
                'locales' => self::syncLocalesForOrder(['en' => $en, 'km' => $km], $subjectOrder, $infoCardOrder),
            ];
        }

        $legacyEn = self::normalizeLegacyLocale($contactPage);
        $subjectOrder = self::normalizeListOrder(
            is_array($contactPage['form']['subject_order'] ?? null)
                ? $contactPage['form']['subject_order']
                : (is_array($contactPage['subject_order'] ?? null) ? $contactPage['subject_order'] : []),
            array_keys($legacyEn['form']['subjects'])
        );
        $infoCardOrder = self::normalizeListOrder(
            is_array($contactPage['info_card_order'] ?? null) ? $contactPage['info_card_order'] : [],
            array_keys($legacyEn['info_cards'])
        );

        return [
            'form' => ['subject_order' => $subjectOrder],
            'info_card_order' => $infoCardOrder,
            'locales' => self::syncLocalesForOrder([
                'en' => $legacyEn,
                'km' => self::defaultKhmerLocale(),
            ], $subjectOrder, $infoCardOrder),
        ];
    }

    public static function resolveLocale(array $contactPage, string $locale = 'en'): array
    {
        $normalized = self::normalize($contactPage);
        $lang = $locale === 'km' ? 'km' : 'en';
        $localeData = $normalized['locales'][$lang];
        $subjectOrder = $normalized['form']['subject_order'];
        $infoCardOrder = $normalized['info_card_order'];

        $subjects = [];
        foreach ($subjectOrder as $key) {
            if (! isset($localeData['form']['subjects'][$key])) {
                continue;
            }
            $subjects[$key] = [
                'value' => $key,
                'label' => $localeData['form']['subjects'][$key]['label'],
            ];
        }

        return [
            'title' => $localeData['title'],
            'subtitle' => $localeData['subtitle'],
            'form' => array_merge($localeData['form'], [
                'subjects' => $subjects,
                'subject_order' => $subjectOrder,
            ]),
            'info_cards' => self::reorderKeyedItems($localeData['info_cards'], $infoCardOrder),
            'info_card_order' => $infoCardOrder,
        ];
    }

    private static function normalizeLegacyLocale(array $contactPage): array
    {
        $form = is_array($contactPage['form'] ?? null) ? $contactPage['form'] : [];
        $subjects = [];

        if (is_array($form['subjects'] ?? null)) {
            foreach ($form['subjects'] as $key => $subject) {
                if (! is_string($key) || $key === '' || ! is_array($subject)) {
                    continue;
                }
                $subjects[$key] = ['label' => (string) ($subject['label'] ?? $key)];
            }
        }

        return self::normalizeLocale([
            'title' => $contactPage['title'] ?? null,
            'subtitle' => $contactPage['subtitle'] ?? null,
            'form' => array_merge($form, ['subjects' => $subjects]),
            'info_cards' => $contactPage['info_cards'] ?? null,
        ], self::defaultEnglishLocale());
    }

    private static function normalizeLocale(array $localeData, array $fallback): array
    {
        $formSource = is_array($localeData['form'] ?? null) ? $localeData['form'] : [];
        $form = [];

        foreach (self::FORM_TEXT_FIELDS as $field) {
            $form[$field] = (string) ($formSource[$field] ?? $fallback['form'][$field] ?? '');
        }

        $subjects = [];
        $incomingSubjects = is_array($formSource['subjects'] ?? null) ? $formSource['subjects'] : $fallback['form']['subjects'];
        foreach ($incomingSubjects as $key => $subject) {
            if (! is_string($key) || $key === '' || ! is_array($subject)) {
                continue;
            }
            $subjects[$key] = ['label' => (string) ($subject['label'] ?? $key)];
        }
        if ($subjects === []) {
            $subjects = $fallback['form']['subjects'];
        }
        $form['subjects'] = $subjects;

        $infoCards = [];
        $incomingCards = is_array($localeData['info_cards'] ?? null) ? $localeData['info_cards'] : $fallback['info_cards'];
        foreach ($incomingCards as $key => $card) {
            if (! is_string($key) || $key === '' || ! is_array($card)) {
                continue;
            }
            $infoCards[$key] = [
                'title' => (string) ($card['title'] ?? $key),
                'line1' => (string) ($card['line1'] ?? ''),
                'line2' => (string) ($card['line2'] ?? ''),
                'href' => (string) ($card['href'] ?? ''),
            ];
        }
        if ($infoCards === []) {
            $infoCards = $fallback['info_cards'];
        }

        return [
            'title' => (string) ($localeData['title'] ?? $fallback['title']),
            'subtitle' => (string) ($localeData['subtitle'] ?? $fallback['subtitle']),
            'form' => $form,
            'info_cards' => $infoCards,
        ];
    }

    private static function syncLocalesForOrder(array $locales, array $subjectOrder, array $infoCardOrder): array
    {
        $synced = [];

        foreach (['en', 'km'] as $locale) {
            $localeData = $locales[$locale] ?? ['title' => '', 'subtitle' => '', 'form' => ['subjects' => []], 'info_cards' => []];
            $subjects = $localeData['form']['subjects'] ?? [];
            $infoCards = $localeData['info_cards'] ?? [];

            foreach ($subjectOrder as $key) {
                if (! isset($subjects[$key])) {
                    $subjects[$key] = ['label' => $locale === 'km' ? 'ប្រធានបទថ្មី' : 'New Subject'];
                }
            }

            foreach ($infoCardOrder as $key) {
                if (! isset($infoCards[$key])) {
                    $infoCards[$key] = [
                        'title' => $locale === 'km' ? 'កាតថ្មី' : 'New Card',
                        'line1' => '',
                        'line2' => '',
                        'href' => '',
                    ];
                }
            }

            $localeData['form']['subjects'] = self::reorderKeyedItems($subjects, $subjectOrder);
            $localeData['info_cards'] = self::reorderKeyedItems($infoCards, $infoCardOrder);
            $synced[$locale] = $localeData;
        }

        return $synced;
    }

    private static function normalizeListOrder(array $order, array $keys): array
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

    private static function reorderKeyedItems(array $items, array $order): array
    {
        $reordered = [];
        foreach (self::normalizeListOrder($order, array_keys($items)) as $key) {
            if (isset($items[$key])) {
                $reordered[$key] = $items[$key];
            }
        }

        return $reordered;
    }
}
