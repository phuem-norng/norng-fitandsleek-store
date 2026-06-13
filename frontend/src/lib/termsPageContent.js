import {
  PAGE_LOCALES,
  normalizeSharedOrder,
  reorderSharedOrderKeys,
  resolvePageLocale,
  syncBilingualLocales,
  updateBilingualLocale,
} from './pageLocaleContent.js';

export const DEFAULT_TERMS_SECTION_ORDER = [
  'introduction',
  'eligibility',
  'orders_payments',
  'shipping_delivery',
  'returns_refunds',
  'user_conduct',
  'intellectual_property',
  'limitation_liability',
  'changes_to_terms',
  'contact',
];

const DEFAULT_TERMS_EN = {
  title: 'Terms & Conditions',
  last_updated: 'Last updated: Feb 1, 2026',
  sections: {
    introduction: { title: '1. Introduction', body: 'These Terms & Conditions govern your use of FitandSleek’s website and services. By accessing or using our site, you agree to these terms.' },
    eligibility: { title: '2. Eligibility', body: 'You must be at least 18 years old or have permission from a parent/guardian to use our services.' },
    orders_payments: { title: '3. Orders & Payments', body: 'All orders are subject to acceptance and availability. Prices are listed in USD and may change without notice. Payment must be completed before shipment.' },
    shipping_delivery: { title: '4. Shipping & Delivery', body: 'Delivery times are estimates and may vary due to carrier delays or external factors. We are not responsible for delays beyond our control.' },
    returns_refunds: { title: '5. Returns & Refunds', body: 'Returns are accepted within 30 days for eligible items. Items must be unused and in original packaging. Refunds are processed after inspection.' },
    user_conduct: { title: '6. User Conduct', body: 'You agree not to misuse the site, interfere with services, or violate any laws. We may suspend accounts that breach these terms.' },
    intellectual_property: { title: '7. Intellectual Property', body: 'All content, branding, and assets are owned by FitandSleek or licensed partners. You may not copy or reuse without permission.' },
    limitation_liability: { title: '8. Limitation of Liability', body: 'FitandSleek is not liable for indirect or consequential damages arising from the use of our services.' },
    changes_to_terms: { title: '9. Changes to Terms', body: 'We may update these terms from time to time. Continued use of the site means you accept the updated terms.' },
    contact: { title: '10. Contact', body: 'If you have questions about these Terms & Conditions, please contact us via the Contact Us page.' },
  },
};

const DEFAULT_TERMS_KM = {
  title: 'លក្ខខណ្ឌ និងលិខិតបញ្ជាក់',
  last_updated: 'ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ៖ កុម្ភៈ 1, 2026',
  sections: {
    introduction: { title: '1. បើកកថា', body: 'លក្ខខណ្ឌនេះគ្រប់គ្រងការប្រើប្រាស់គេហទំព័រ និងសេវាកម្ម FitandSleek។ ដោយចូលប្រើ ឬប្រើប្រាស់ គេហទំព័រ អ្នកយល់ព្រមលើលក្ខខណ្ឌទាំងនេះ។' },
    eligibility: { title: '2. សិទ្ធិប្រើប្រាស់', body: 'អ្នកត្រូវមានអាយុយ៉ាងហោចណាស់ 18 ឆ្នាំ ឬមានការអនុញ្ញាតពីឪពុកម្តាយ/អាណាព្យាបាល ដើម្បីប្រើសេវាកម្ម។' },
    orders_payments: { title: '3. ការបញ្ជាទិញ & ការបង់ប្រាក់', body: 'ការបញ្ជាទិញទាំងអស់ពឹងផ្អែកលើការអនុម័ត និងស្តុក។ តម្លៃបង្ហាញជាប្រាក់ USD ហើយអាចផ្លាស់ប្តូរដោយមិនជូនដំណឹងជាមុន។ ត្រូវបង់ប្រាក់មុនការដឹកជញ្ជូន។' },
    shipping_delivery: { title: '4. ការដឹកជញ្ជូន', body: 'ពេលវេលាដឹកជញ្ជូនគ្រាន់តែជាការប៉ាន់ស្មាន ហើយអាចប្រែប្រួលដោយសារការពន្យារពេលពីក្រុមហ៊ុនដឹកជញ្ជូន ឬកត្តាខាងក្រៅ។ យើងមិនទទួលខុសត្រូវចំពោះការពន្យារពេលក្រៅការគ្រប់គ្រង។' },
    returns_refunds: { title: '5. ការត្រឡប់ & បង្វិលប្រាក់', body: 'ការត្រឡប់ទទួលបានក្នុងរយៈពេល 30 ថ្ងៃសម្រាប់ទំនិញដែលមានលក្ខណៈសម្បត្តិ។ ទំនិញត្រូវមិនបានប្រើ និងនៅក្នុងកញ្ចប់ដើម។ បង្វិលប្រាក់ធ្វើឡើងក្រោយពេលពិនិត្យ។' },
    user_conduct: { title: '6. ឥរិយាបថអ្នកប្រើប្រាស់', body: 'អ្នកយល់ព្រមមិនប្រើប្រាស់ខុស ប្រមាថ ឬរំខានសេវាកម្ម ឬលោភលន់ច្បាប់។ យើងអាចផ្អាកគណនីដែលរំលោភលក្ខខណ្ឌ។' },
    intellectual_property: { title: '7. កម្មសិទ្ធិបញ្ញា', body: 'ខ្លឹមសារ ម៉ាក និងទ្រព្យសម្បត្តិទាំងអស់ជាកម្មសិទ្ធិ FitandSleek ឬដៃគូ។ អ្នកមិនអាចចម្លង ឬប្រើឡើងវិញដោយគ្មានការអនុញ្ញាត។' },
    limitation_liability: { title: '8. ការកំណត់ទំនួលខុសត្រូវ', body: 'FitandSleek មិនទទួលខុសត្រូវចំពោះការខូចខាតដោយអព្យាក្រឹត ឬបន្តបន្ទាប់ដែលកើតពីការប្រើសេវាកម្ម។' },
    changes_to_terms: { title: '9. ការផ្លាស់ប្តូរលក្ខខណ្ឌ', body: 'យើងអាចធ្វើបច្ចុប្បន្នភាពលក្ខខណ្ឌពីពេលទៅពេល។ ការបន្តប្រើប្រាស់មានន័យថាអ្នកយល់ព្រមលើលក្ខខណ្ឌថ្មី។' },
    contact: { title: '10. ទំនាក់ទំនង', body: 'បើមានសំណួរអំពីលក្ខខណ្ឌនេះ សូមទំនាក់ទំនងតាមទំព័រទំនាក់ទំនង។' },
  },
};

export const DEFAULT_TERMS_PAGE = {
  ...DEFAULT_TERMS_EN,
  section_order: DEFAULT_TERMS_SECTION_ORDER,
};

export const DEFAULT_TERMS_BILINGUAL = {
  section_order: DEFAULT_TERMS_SECTION_ORDER,
  locales: { en: DEFAULT_TERMS_EN, km: DEFAULT_TERMS_KM },
};

function normalizeSection(section, fallbackTitle = 'Section') {
  if (!section || typeof section !== 'object') return { title: fallbackTitle, body: '' };
  return { title: String(section.title || fallbackTitle), body: String(section.body || '') };
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

export function normalizeTermsSectionOrder(order, sections) {
  return normalizeSharedOrder(order, Object.keys(sections || {}));
}

export function reorderTermsSectionKeys(order, sectionKey, direction) {
  return reorderSharedOrderKeys(order, sectionKey, direction);
}

export function orderTermsSectionEntries(sections, order) {
  return normalizeTermsSectionOrder(order, sections)
    .filter((key) => sections?.[key])
    .map((key) => [key, sections[key]]);
}

export function reorderTermsSectionsObject(sections, order) {
  const normalizedOrder = normalizeTermsSectionOrder(order, sections);
  const next = {};
  for (const key of normalizedOrder) {
    if (sections[key]) next[key] = sections[key];
  }
  return next;
}

export function normalizeTermsPagePayload(incoming) {
  if (incoming?.locales && typeof incoming.locales === 'object') {
    const en = normalizeLocale(incoming.locales.en, DEFAULT_TERMS_EN);
    const km = normalizeLocale(incoming.locales.km, DEFAULT_TERMS_KM);
    const mergedKeys = [...new Set([...Object.keys(en.sections), ...Object.keys(km.sections)])];
    const sectionOrder = normalizeSharedOrder(incoming.section_order, mergedKeys);
    const locales = syncBilingualLocales({ en, km }, sectionOrder, (locale) => ({
      title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
      body: '',
    }));
    for (const locale of PAGE_LOCALES) {
      locales[locale].sections = reorderTermsSectionsObject(locales[locale].sections, sectionOrder);
    }
    return { section_order: sectionOrder, locales };
  }

  const legacy = normalizeLocale(incoming, DEFAULT_TERMS_EN);
  const sectionOrder = normalizeSharedOrder(incoming?.section_order, Object.keys(legacy.sections));
  legacy.sections = reorderTermsSectionsObject(legacy.sections, sectionOrder);
  const locales = syncBilingualLocales({ en: legacy, km: normalizeLocale(DEFAULT_TERMS_KM, DEFAULT_TERMS_KM) }, sectionOrder, (locale) => ({
    title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
    body: '',
  }));
  for (const locale of PAGE_LOCALES) {
    locales[locale].sections = reorderTermsSectionsObject(locales[locale].sections, sectionOrder);
  }
  return { section_order: sectionOrder, locales };
}

export function getTermsLocaleView(page, locale = 'en') {
  const normalized = normalizeTermsPagePayload(page);
  const lang = resolvePageLocale(locale);
  const localeData = normalized.locales[lang];
  return {
    title: localeData.title,
    last_updated: localeData.last_updated,
    sections: localeData.sections,
    section_order: normalized.section_order,
  };
}

export function resolveTermsLocale(page, locale = 'en') {
  return getTermsLocaleView(page, locale);
}

export function updateTermsLocaleField(page, locale, field, value) {
  return updateBilingualLocale(page, locale, (current) => ({ ...current, [field]: value }));
}

export function updateTermsLocaleSection(page, locale, sectionKey, updater) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    sections: {
      ...current.sections,
      [sectionKey]: updater(current.sections?.[sectionKey] || { title: '', body: '' }),
    },
  }));
}

export function addTermsSection(page, sectionKey) {
  const normalized = normalizeTermsPagePayload(page);
  const sectionOrder = [...normalized.section_order, sectionKey];
  const locales = { ...normalized.locales };
  for (const locale of PAGE_LOCALES) {
    locales[locale] = {
      ...locales[locale],
      sections: {
        ...locales[locale].sections,
        [sectionKey]: { title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section', body: '' },
      },
    };
  }
  return { section_order: sectionOrder, locales };
}

export function removeTermsSection(page, sectionKey) {
  const normalized = normalizeTermsPagePayload(page);
  const sectionOrder = normalized.section_order.filter((key) => key !== sectionKey);
  const locales = { ...normalized.locales };
  for (const locale of PAGE_LOCALES) {
    const sections = { ...locales[locale].sections };
    delete sections[sectionKey];
    locales[locale] = { ...locales[locale], sections };
  }
  return { section_order: sectionOrder, locales };
}

export function moveTermsSection(page, sectionKey, direction) {
  const normalized = normalizeTermsPagePayload(page);
  return { ...normalized, section_order: reorderTermsSectionKeys(normalized.section_order, sectionKey, direction) };
}
