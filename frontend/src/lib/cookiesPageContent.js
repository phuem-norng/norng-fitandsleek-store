import {
  PAGE_LOCALES,
  normalizeSharedOrder,
  reorderSharedOrderKeys,
  resolvePageLocale,
  syncBilingualLocales,
  updateBilingualLocale,
} from './pageLocaleContent.js';

export const DEFAULT_COOKIES_SECTION_ORDER = [
  'what_are_cookies',
  'how_we_use',
  'types_of_cookies',
  'managing_cookies',
  'policy_updates',
  'contact',
];

const DEFAULT_COOKIES_EN = {
  title: 'Cookies Policy',
  last_updated: 'Last updated: Feb 1, 2026',
  sections: {
    what_are_cookies: {
      title: '1. What Are Cookies?',
      body: 'Cookies are small text files stored on your device to improve your browsing experience and help us understand how our site is used.',
      items: [],
    },
    how_we_use: {
      title: '2. How We Use Cookies',
      body: '',
      items: [
        { label: '', text: 'Remembering your preferences and cart items' },
        { label: '', text: 'Analyzing site traffic and usage patterns' },
        { label: '', text: 'Improving site performance and user experience' },
        { label: '', text: 'Delivering relevant offers (where applicable)' },
      ],
    },
    types_of_cookies: {
      title: '3. Types of Cookies We Use',
      body: 'We may use essential cookies (necessary for site functionality), performance cookies (analytics), and preference cookies (remembering settings).',
      items: [],
    },
    managing_cookies: {
      title: '4. Managing Cookies',
      body: 'You can manage cookies in your browser settings. Disabling cookies may affect certain features like cart or checkout.',
      items: [],
    },
    policy_updates: {
      title: '5. Updates to This Policy',
      body: 'We may update this policy from time to time. Changes will be posted on this page with an updated revision date.',
      items: [],
    },
    contact: {
      title: '6. Contact',
      body: 'If you have questions about our Cookies Policy, please contact us via the Contact Us page.',
      items: [],
    },
  },
};

const DEFAULT_COOKIES_KM = {
  title: 'គោលនយោបាយខូគី',
  last_updated: 'ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ៖ កុម្ភៈ 1, 2026',
  sections: {
    what_are_cookies: {
      title: '1. ខូគីជាអ្វី?',
      body: 'ខូគីជាឯកសារអត្ថបទតូចៗដែលរក្សាទុកលើឧបករណ៍ ដើម្បីធ្វើឱ្យបទពិសោធន៍រុករកល្អប្រសើរ និងជួយយើងយល់ពីការប្រើប្រាស់គេហទំព័រ។',
      items: [],
    },
    how_we_use: {
      title: '2. របៀបយើងប្រើខូគី',
      body: '',
      items: [
        { label: '', text: 'ចងចាំចំណូលចិត្ត និងទំនិញក្នុងកន្ត្រក' },
        { label: '', text: 'វិភាគចរាចរណ៍គេហទំព័រ និងរបៀបប្រើប្រាស់' },
        { label: '', text: 'ធ្វើឱ្យប្រសើរនូវប្រសិទ្ធភាព និងបទពិសោធន៍អ្នកប្រើ' },
        { label: '', text: 'ផ្តល់ការផ្តល់ជូនពាក់ព័ន្ធ (បើមាន)' },
      ],
    },
    types_of_cookies: {
      title: '3. ប្រភេទខូគីដែលយើងប្រើ',
      body: 'យើងអាចប្រើខូគីចាំបាច់ (សម្រាប់មុខងារ), ខូគីប្រសិទ្ធភាព (វិភាគ), និងខូគីចំណូលចិត្ត (ចងចាំការកំណត់)។',
      items: [],
    },
    managing_cookies: {
      title: '4. ការគ្រប់គ្រងខូគី',
      body: 'អ្នកអាចគ្រប់គ្រងខូគីតាមការកំណត់កម្មវិធីរុករក។ ការបិទខូគីអាចប៉ះពាល់មុខងារដូចជា កន្ត្រក ឬការទូទាត់។',
      items: [],
    },
    policy_updates: {
      title: '5. ការធ្វើបច្ចុប្បន្នភាពគោលនយោបាយនេះ',
      body: 'យើងអាចធ្វើបច្ចុប្បន្នភាពគោលនយោបាយនេះពីពេលទៅពេល។ ការផ្លាស់ប្តូរនឹងត្រូវបានបង្ហាញនៅទំព័រនេះជាមួយកាលបរិច្ឆេទថ្មី។',
      items: [],
    },
    contact: {
      title: '6. ទំនាក់ទំនង',
      body: 'ប្រសិនបើមានសំណួរអំពីគោលនយោបាយខូគី សូមទំនាក់ទំនងតាមទំព័រទំនាក់ទំនង។',
      items: [],
    },
  },
};

export const DEFAULT_COOKIES_PAGE = {
  ...DEFAULT_COOKIES_EN,
  section_order: DEFAULT_COOKIES_SECTION_ORDER,
};

export const DEFAULT_COOKIES_BILINGUAL = {
  section_order: DEFAULT_COOKIES_SECTION_ORDER,
  locales: { en: DEFAULT_COOKIES_EN, km: DEFAULT_COOKIES_KM },
};

function normalizeSection(section, fallbackTitle = 'Section') {
  if (!section || typeof section !== 'object') {
    return { title: fallbackTitle, body: '', items: [] };
  }

  const items = Array.isArray(section.items)
    ? section.items.map((item) => ({
      label: String(item?.label || ''),
      text: String(item?.text || ''),
    }))
    : [];

  return {
    title: String(section.title || fallbackTitle),
    body: String(section.body || ''),
    items,
  };
}

function normalizeLocale(localeData, fallback) {
  const sections = {};
  const source = localeData?.sections && typeof localeData.sections === 'object' ? localeData.sections : fallback.sections;

  for (const [key, section] of Object.entries(source)) {
    sections[key] = normalizeSection(section, key);
  }

  return {
    title: String(localeData?.title || fallback.title),
    last_updated: String(localeData?.last_updated || fallback.last_updated),
    sections: Object.keys(sections).length ? sections : fallback.sections,
  };
}

function createEmptyCookiesSection(locale) {
  return {
    title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
    body: '',
    items: [],
  };
}

export function normalizeCookiesSectionOrder(order, sections) {
  return normalizeSharedOrder(order, Object.keys(sections || {}));
}

export function reorderCookiesSectionKeys(order, sectionKey, direction) {
  return reorderSharedOrderKeys(order, sectionKey, direction);
}

export function orderCookiesSectionEntries(sections, order) {
  return normalizeCookiesSectionOrder(order, sections)
    .filter((key) => sections?.[key])
    .map((key) => [key, sections[key]]);
}

export function reorderCookiesSectionsObject(sections, order) {
  const normalizedOrder = normalizeCookiesSectionOrder(order, sections);
  const next = {};

  for (const key of normalizedOrder) {
    if (sections[key]) next[key] = sections[key];
  }

  return next;
}

export function normalizeCookiesPagePayload(incoming) {
  if (incoming?.locales && typeof incoming.locales === 'object') {
    const en = normalizeLocale(incoming.locales.en, DEFAULT_COOKIES_EN);
    const km = normalizeLocale(incoming.locales.km, DEFAULT_COOKIES_KM);
    const mergedKeys = [...new Set([...Object.keys(en.sections), ...Object.keys(km.sections)])];
    const sectionOrder = normalizeSharedOrder(incoming.section_order, mergedKeys);
    const locales = syncBilingualLocales({ en, km }, sectionOrder, createEmptyCookiesSection);

    for (const locale of PAGE_LOCALES) {
      locales[locale].sections = reorderCookiesSectionsObject(locales[locale].sections, sectionOrder);
    }

    return { section_order: sectionOrder, locales };
  }

  const legacy = normalizeLocale(incoming, DEFAULT_COOKIES_EN);
  const sectionOrder = normalizeSharedOrder(incoming?.section_order, Object.keys(legacy.sections));
  legacy.sections = reorderCookiesSectionsObject(legacy.sections, sectionOrder);
  const locales = syncBilingualLocales(
    { en: legacy, km: normalizeLocale(DEFAULT_COOKIES_KM, DEFAULT_COOKIES_KM) },
    sectionOrder,
    createEmptyCookiesSection,
  );

  for (const locale of PAGE_LOCALES) {
    locales[locale].sections = reorderCookiesSectionsObject(locales[locale].sections, sectionOrder);
  }

  return { section_order: sectionOrder, locales };
}

export function getCookiesLocaleView(page, locale = 'en') {
  const normalized = normalizeCookiesPagePayload(page);
  const lang = resolvePageLocale(locale);
  const localeData = normalized.locales[lang];

  return {
    title: localeData.title,
    last_updated: localeData.last_updated,
    sections: localeData.sections,
    section_order: normalized.section_order,
  };
}

export function resolveCookiesLocale(page, locale = 'en') {
  return getCookiesLocaleView(page, locale);
}

export function updateCookiesLocaleField(page, locale, field, value) {
  return updateBilingualLocale(page, locale, (current) => ({ ...current, [field]: value }));
}

export function updateCookiesLocaleSection(page, locale, sectionKey, updater) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    sections: {
      ...current.sections,
      [sectionKey]: updater(current.sections?.[sectionKey] || { title: '', body: '', items: [] }),
    },
  }));
}

export function updateCookiesSectionItem(page, locale, sectionKey, itemIndex, field, value) {
  return updateCookiesLocaleSection(page, locale, sectionKey, (section) => {
    const items = [...(section.items || [])];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    return { ...section, items };
  });
}

export function addCookiesSectionItem(page, locale, sectionKey) {
  return updateCookiesLocaleSection(page, locale, sectionKey, (section) => ({
    ...section,
    items: [...(section.items || []), { label: '', text: '' }],
  }));
}

export function removeCookiesSectionItem(page, locale, sectionKey, itemIndex) {
  return updateCookiesLocaleSection(page, locale, sectionKey, (section) => ({
    ...section,
    items: (section.items || []).filter((_, index) => index !== itemIndex),
  }));
}

export function addCookiesSection(page, sectionKey) {
  const normalized = normalizeCookiesPagePayload(page);
  const sectionOrder = [...normalized.section_order, sectionKey];
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    locales[locale] = {
      ...locales[locale],
      sections: {
        ...locales[locale].sections,
        [sectionKey]: createEmptyCookiesSection(locale),
      },
    };
  }

  return { section_order: sectionOrder, locales };
}

export function removeCookiesSection(page, sectionKey) {
  const normalized = normalizeCookiesPagePayload(page);
  const sectionOrder = normalized.section_order.filter((key) => key !== sectionKey);
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    const sections = { ...locales[locale].sections };
    delete sections[sectionKey];
    locales[locale] = { ...locales[locale], sections };
  }

  return { section_order: sectionOrder, locales };
}

export function moveCookiesSection(page, sectionKey, direction) {
  const normalized = normalizeCookiesPagePayload(page);
  return { ...normalized, section_order: reorderCookiesSectionKeys(normalized.section_order, sectionKey, direction) };
}
