export const FAQ_LOCALES = ['en', 'km'];

export const DEFAULT_FAQ_SECTION_ORDER = [
  'orders_shipping',
  'returns_refunds',
  'payments',
  'account_support',
];

const DEFAULT_FAQ_EN_LOCALE = {
  title: 'Frequently Asked Questions',
  subtitle: 'Find quick answers to common questions.',
  sections: {
    orders_shipping: {
      title: 'Orders & Shipping',
      items: [
        {
          question: 'How can I track my order?',
          answer:
            "Sign in, then open Profile → Track Order or check My Orders. Enter your order number to view status. You'll also receive email updates when your order ships.",
        },
        {
          question: 'How long does shipping take?',
          answer:
            'Most deliveries arrive in 3–5 business days across Cambodia. Phnom Penh orders are often faster (about 1–3 days). Free delivery applies on orders over $40.',
        },
        {
          question: 'Do you ship internationally?',
          answer:
            "We currently ship within Cambodia only. We're working to expand to more locations.",
        },
      ],
    },
    returns_refunds: {
      title: 'Returns & Refunds',
      items: [
        {
          question: 'What is your return policy?',
          answer:
            'We accept returns and replacement requests within 30 days for unused items in original condition with tags and packaging intact.',
        },
        {
          question: 'How do I start a return?',
          answer:
            'Go to My Orders or Profile → Order History, select the order, and click Request Replacement. Track progress under Profile → Replacements.',
        },
        {
          question: 'When will I receive my refund?',
          answer:
            "Refunds are processed within 5–7 business days after we receive and approve your returned item. You'll get an email confirmation once it's complete.",
        },
      ],
    },
    payments: {
      title: 'Payments',
      items: [
        {
          question: 'Which payment methods are accepted?',
          answer:
            'Checkout supports KHQR / Bakong (ABA, Wing, ACLEDA, Canadia, and most Cambodian bank apps) and credit / debit cards (Visa, Mastercard, Amex, UnionPay).',
        },
        {
          question: 'Is my payment information secure?',
          answer:
            'Yes. All payment transactions are encrypted and processed securely. We never store full card details.',
        },
      ],
    },
    account_support: {
      title: 'Account & Support',
      items: [
        {
          question: 'How do I create an account?',
          answer:
            "Click Login in the header, then choose Create Account. You'll need a valid email address.",
        },
        {
          question: 'I forgot my password. What should I do?',
          answer:
            'Use the Forgot Password link on the login page and follow the instructions sent to your email.',
        },
        {
          question: 'How can I contact support?',
          answer:
            'Visit Contact Us or Help & Support, or email kalapakgpt@gmail.com. We typically reply within 24 hours.',
        },
      ],
    },
  },
};

const DEFAULT_FAQ_KM_LOCALE = {
  title: 'សំណួរញឹកញាប់',
  subtitle: 'ស្វែងរកចម្លើយរហ័សសម្រាប់សំណួរទូទៅ។',
  sections: {
    orders_shipping: {
      title: 'ការបញ្ជាទិញ & ការដឹកជញ្ជូន',
      items: [
        {
          question: 'តើខ្ញុំអាចតាមដានការបញ្ជាទិញបានយ៉ាងដូចម្តេច?',
          answer:
            'ចូលគណនី បន្ទាប់មកទៅ Profile → Track Order ឬមើល My Orders។ បញ្ចូលលេខការបញ្ជាទិញដើម្បីមើលស្ថានភាព។ អ្នកនឹងទទួលអ៊ីមែលជូនដំណឹងនៅពេលការបញ្ជាទិញត្រូវបានដឹកចេញ។',
        },
        {
          question: 'ការដឹកជញ្ជូនចំណាយពេលប៉ុន្មាន?',
          answer:
            'ការដឹកជញ្ជូនភាគច្រើនចំណាយពេល 3–5 ថ្ងៃធ្វើការទូទាំងប្រទេសកម្ពុជា។ ការបញ្ជាទិញនៅភ្នំពេញភាគច្រើនលឿនជាង (ប្រហែល 1–3 ថ្ងៃ)។ ដឹកជញ្ជូនឥតគិតថ្លៃសម្រាប់ការបញ្ជាទិញលើស $40។',
        },
        {
          question: 'តើអ្នកដឹកជញ្ជូនអន្តរជាតិទេ?',
          answer: 'បច្ចុប្បន្ន យើងដឹកជញ្ជូនក្នុងប្រទេសកម្ពុជា ប៉ុណ្ណោះ។ យើងកំពុងពង្រីកទៅតំបន់ផ្សេងៗ។',
        },
      ],
    },
    returns_refunds: {
      title: 'ការត្រឡប់ & បង្វិលប្រាក់',
      items: [
        {
          question: 'គោលនយោបាយត្រឡប់ទំនិញជាអ្វី?',
          answer:
            'យើងទទួលការត្រឡប់ និងស្នើសុំជំនួសក្នុងរយៈពេល 30 ថ្ងៃសម្រាប់ទំនិញមិនប្រើ និងនៅក្នុងសភាពដើម ជាមួយស្លាក និងកញ្ចប់គ្រប់ជ្រុងជ្រោម។',
        },
        {
          question: 'តើខ្ញុំចាប់ផ្តើមការត្រឡប់ដូចម្តេច?',
          answer:
            'ទៅ My Orders ឬ Profile → Order History ជ្រើសរើសការបញ្ជាទិញ ហើយចុច Request Replacement។ តាមដានស្ថានភាពនៅ Profile → Replacements។',
        },
        {
          question: 'ពេលណាខ្ញុំនឹងទទួលបានការបង្វិលប្រាក់?',
          answer:
            'ការបង្វិលប្រាក់ធ្វើឡើងក្នុង 5–7 ថ្ងៃធ្វើការ បន្ទាប់ពីយើងទទួល និងអនុម័តទំនិញត្រឡប់។ អ្នកនឹងទទួលអ៊ីមែលបញ្ជាក់។',
        },
      ],
    },
    payments: {
      title: 'ការបង់ប្រាក់',
      items: [
        {
          question: 'វិធីបង់ប្រាក់ណាខ្លះដែលទទួលយក?',
          answer:
            'ការទូទាត់អនឡាញគាំទ្រ KHQR / Bakong (ABA, Wing, ACLEDA, Canadia និងកម្មវិធីធនាគារកម្ពុជាភាគច្រើន) និងកាតឥណទាន / ឥណពន្ធ (Visa, Mastercard, Amex, UnionPay)។',
        },
        {
          question: 'តើព័ត៌មានបង់ប្រាក់មានសុវត្ថិភាពទេ?',
          answer:
            'បាទ/ចាស។ ប្រតិបត្តិការបង់ប្រាក់ទាំងអស់ត្រូវបានអ៊ិនគ្រីប និងដំណើរការប្រកបដោយសុវត្ថិភាព។ យើងមិនរក្សាទុកព័ត៌មានកាតពេញលេញទេ។',
        },
      ],
    },
    account_support: {
      title: 'គណនី & គាំទ្រ',
      items: [
        {
          question: 'តើខ្ញុំបង្កើតគណនីបានយ៉ាងដូចម្តេច?',
          answer: 'ចុច Login នៅផ្នែកខាងលើ បន្ទាប់មកជ្រើស Create Account។ ត្រូវការអ៊ីមែលត្រឹមត្រូវ។',
        },
        {
          question: 'ខ្ញុំភ្លេចពាក្យសម្ងាត់ តើត្រូវធ្វើដូចម្តេច?',
          answer: 'ប្រើតំណ Forgot Password នៅទំព័រចូល និងអនុវត្តតាមសេចក្តីណែនាំក្នុងអ៊ីមែល។',
        },
        {
          question: 'តើខ្ញុំអាចទំនាក់ទំនងគាំទ្របានយ៉ាងដូចម្តេច?',
          answer:
            'ទៅទំព័រ Contact Us ឬ Help & Support ឬផ្ញើអ៊ីមែលទៅ kalapakgpt@gmail.com។ យើងធម្មតាឆ្លើយតបក្នុង 24 ម៉ោង។',
        },
      ],
    },
  },
};

/** @deprecated Use DEFAULT_FAQ_BILINGUAL — kept for imports that expect flat English FAQ */
export const DEFAULT_FAQ = {
  ...DEFAULT_FAQ_EN_LOCALE,
  section_order: DEFAULT_FAQ_SECTION_ORDER,
};

export const DEFAULT_FAQ_BILINGUAL = {
  section_order: DEFAULT_FAQ_SECTION_ORDER,
  locales: {
    en: DEFAULT_FAQ_EN_LOCALE,
    km: DEFAULT_FAQ_KM_LOCALE,
  },
};

function normalizeLocaleSections(sections, fallbackSections = {}) {
  const normalized = {};
  const source = sections && typeof sections === 'object' ? sections : {};

  for (const [key, section] of Object.entries(source)) {
    if (!section || typeof section !== 'object') continue;
    const items = Array.isArray(section.items) ? section.items : [];
    normalized[key] = {
      title: String(section.title || key),
      items: items.map((item) => ({
        question: String(item?.question || ''),
        answer: String(item?.answer || ''),
      })),
    };
  }

  if (Object.keys(normalized).length === 0) {
    for (const [key, section] of Object.entries(fallbackSections)) {
      normalized[key] = {
        title: String(section.title || key),
        items: (section.items || []).map((item) => ({
          question: String(item.question || ''),
          answer: String(item.answer || ''),
        })),
      };
    }
  }

  return normalized;
}

function normalizeLocale(localeData, fallbackLocale) {
  const fallbackSections = fallbackLocale?.sections || {};
  const sections = normalizeLocaleSections(localeData?.sections, fallbackSections);

  return {
    title: String(localeData?.title || fallbackLocale?.title || ''),
    subtitle: String(localeData?.subtitle || fallbackLocale?.subtitle || ''),
    sections,
  };
}

function syncLocaleSectionsForOrder(locales, sectionOrder) {
  const next = { ...locales };

  for (const locale of FAQ_LOCALES) {
    const localeData = next[locale] || { title: '', subtitle: '', sections: {} };
    const sections = { ...localeData.sections };

    for (const key of sectionOrder) {
      if (!sections[key]) {
        sections[key] = { title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section', items: [] };
      }
    }

    next[locale] = {
      ...localeData,
      sections: reorderFaqSectionsObject(sections, sectionOrder),
    };
  }

  return next;
}

export function normalizeFaqSectionOrder(order, sections) {
  const keys = Object.keys(sections || {});
  const next = [];
  const source = Array.isArray(order) ? order : [];

  for (const key of source) {
    if (typeof key === 'string' && keys.includes(key) && !next.includes(key)) {
      next.push(key);
    }
  }

  for (const key of keys) {
    if (!next.includes(key)) {
      next.push(key);
    }
  }

  return next;
}

export function orderFaqSectionEntries(sections, order) {
  return normalizeFaqSectionOrder(order, sections)
    .filter((key) => sections?.[key])
    .map((key) => [key, sections[key]]);
}

export function reorderFaqSectionKeys(order, sectionKey, direction) {
  const next = [...order];
  const index = next.indexOf(sectionKey);
  if (index === -1) return order;

  const target = index + direction;
  if (target < 0 || target >= next.length) return order;

  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderFaqSectionsObject(sections, order) {
  const normalizedOrder = normalizeFaqSectionOrder(order, sections);
  const next = {};

  for (const key of normalizedOrder) {
    if (sections[key]) {
      next[key] = sections[key];
    }
  }

  return next;
}

export function normalizeFaqPayload(incoming) {
  if (incoming?.locales && typeof incoming.locales === 'object') {
    const en = normalizeLocale(incoming.locales.en, DEFAULT_FAQ_EN_LOCALE);
    const km = normalizeLocale(incoming.locales.km, DEFAULT_FAQ_KM_LOCALE);
    const mergedSections = { ...en.sections, ...km.sections };
    const sectionOrder = normalizeFaqSectionOrder(incoming.section_order, mergedSections);
    const locales = syncLocaleSectionsForOrder({ en, km }, sectionOrder);

    return {
      section_order: sectionOrder,
      locales,
    };
  }

  const legacy = {
    title: incoming?.title,
    subtitle: incoming?.subtitle,
    sections: incoming?.sections,
    section_order: incoming?.section_order,
  };

  const en = normalizeLocale(legacy, DEFAULT_FAQ_EN_LOCALE);
  const km = normalizeLocale(DEFAULT_FAQ_KM_LOCALE, DEFAULT_FAQ_KM_LOCALE);
  const sectionOrder = normalizeFaqSectionOrder(legacy.section_order, en.sections);
  const locales = syncLocaleSectionsForOrder({ en, km }, sectionOrder);

  return {
    section_order: sectionOrder,
    locales,
  };
}

export function resolveFaqLocale(faq, locale = 'en') {
  const normalized = normalizeFaqPayload(faq);
  const lang = locale === 'km' ? 'km' : 'en';

  return {
    title: normalized.locales[lang].title,
    subtitle: normalized.locales[lang].subtitle,
    sections: normalized.locales[lang].sections,
    section_order: normalized.section_order,
  };
}

export function getFaqLocaleView(faq, locale = 'en') {
  const lang = locale === 'km' ? 'km' : 'en';
  const normalized = normalizeFaqPayload(faq);
  const localeData = normalized.locales[lang];

  return {
    title: localeData.title,
    subtitle: localeData.subtitle,
    sections: localeData.sections,
    section_order: normalized.section_order,
  };
}

export function updateFaqLocaleField(faq, locale, field, value) {
  const normalized = normalizeFaqPayload(faq);
  const lang = locale === 'km' ? 'km' : 'en';

  return {
    ...normalized,
    locales: {
      ...normalized.locales,
      [lang]: {
        ...normalized.locales[lang],
        [field]: value,
      },
    },
  };
}

export function updateFaqLocaleSection(faq, locale, sectionKey, updater) {
  const normalized = normalizeFaqPayload(faq);
  const lang = locale === 'km' ? 'km' : 'en';
  const currentSection = normalized.locales[lang].sections[sectionKey] || { title: '', items: [] };

  return {
    ...normalized,
    locales: {
      ...normalized.locales,
      [lang]: {
        ...normalized.locales[lang],
        sections: {
          ...normalized.locales[lang].sections,
          [sectionKey]: updater(currentSection),
        },
      },
    },
  };
}

export function addFaqSection(faq, sectionKey) {
  const normalized = normalizeFaqPayload(faq);
  const sectionOrder = [...normalized.section_order, sectionKey];
  const locales = { ...normalized.locales };

  for (const locale of FAQ_LOCALES) {
    locales[locale] = {
      ...locales[locale],
      sections: {
        ...locales[locale].sections,
        [sectionKey]: {
          title: locale === 'km' ? 'ផ្នែកថ្មី' : 'New Section',
          items: [{ question: '', answer: '' }],
        },
      },
    };
  }

  return {
    section_order: sectionOrder,
    locales: syncLocaleSectionsForOrder(locales, sectionOrder),
  };
}

export function removeFaqSection(faq, sectionKey) {
  const normalized = normalizeFaqPayload(faq);
  const sectionOrder = normalized.section_order.filter((key) => key !== sectionKey);
  const locales = { ...normalized.locales };

  for (const locale of FAQ_LOCALES) {
    const sections = { ...locales[locale].sections };
    delete sections[sectionKey];
    locales[locale] = {
      ...locales[locale],
      sections,
    };
  }

  return {
    section_order: sectionOrder,
    locales: syncLocaleSectionsForOrder(locales, sectionOrder),
  };
}

export function moveFaqSection(faq, sectionKey, direction) {
  const normalized = normalizeFaqPayload(faq);

  return {
    ...normalized,
    section_order: reorderFaqSectionKeys(normalized.section_order, sectionKey, direction),
  };
}

export function faqToPageSections(faq, locale = 'en') {
  const resolved = resolveFaqLocale(faq, locale);

  return orderFaqSectionEntries(resolved.sections, resolved.section_order)
    .map(([, section]) => ({
      title: section.title,
      items: (section.items || [])
        .filter((item) => item.question || item.answer)
        .map((item) => ({ q: item.question, a: item.answer })),
    }))
    .filter((section) => section.title && section.items.length);
}
