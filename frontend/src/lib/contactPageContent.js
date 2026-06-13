import {
  PAGE_LOCALES,
  normalizeSharedOrder,
  reorderSharedOrderKeys,
  resolvePageLocale,
  updateBilingualLocale,
} from './pageLocaleContent.js';

export const DEFAULT_CONTACT_SUBJECT_ORDER = [
  'general',
  'order',
  'product',
  'return',
  'partnership',
  'other',
];

export const DEFAULT_CONTACT_INFO_CARD_ORDER = ['email', 'phone', 'visit'];

const DEFAULT_CONTACT_EN = {
  title: 'Contact Us',
  subtitle: "Have a question or need help? We'd love to hear from you.",
  form: {
    name_label: 'Your Name',
    email_label: 'Email Address',
    phone_label: 'Phone Number',
    subject_label: 'Subject',
    message_label: 'Message',
    select_subject_label: 'Select a subject',
    submit_label: 'Send Message',
    name_placeholder: 'John Doe',
    email_placeholder: 'john@example.com',
    phone_placeholder: '+855 12 345 678',
    message_placeholder: 'Tell us how we can help you...',
    subjects: {
      general: { label: 'General Inquiry' },
      order: { label: 'Order Status' },
      product: { label: 'Product Question' },
      return: { label: 'Returns & Refunds' },
      partnership: { label: 'Partnership' },
      other: { label: 'Other' },
    },
  },
  info_cards: {
    email: {
      title: 'Email Us',
      line1: 'kalapakgpt@gmail.com',
      line2: 'We reply within 24h',
      href: 'mailto:kalapakgpt@gmail.com',
    },
    phone: {
      title: 'Call Us',
      line1: '+855 00 00 000',
      line2: 'Mon-Fri 9am-6pm',
      href: 'tel:+85500000000',
    },
    visit: {
      title: 'Visit Us',
      line1: 'Phnom Penh, Cambodia',
      line2: 'Come say hello!',
      href: '',
    },
  },
};

const DEFAULT_CONTACT_KM = {
  title: 'ទំនាក់ទំនងយើង',
  subtitle: 'មានសំណួរឬត្រូវការជំនួយ? យើងរីករាយស្តាប់ពីអ្នក។',
  form: {
    name_label: 'ឈ្មោះរបស់អ្នក',
    email_label: 'អាសយដ្ឋានអ៊ីមែល',
    phone_label: 'លេខទូរស័ព្ទ',
    subject_label: 'ប្រធានបទ',
    message_label: 'សារ',
    select_subject_label: 'ជ្រើសរើសប្រធានបទ',
    submit_label: 'ផ្ញើសារ',
    name_placeholder: 'ចន ដូ',
    email_placeholder: 'john@example.com',
    phone_placeholder: '+855 12 345 678',
    message_placeholder: 'ប្រាប់យើងពីអ្វីដែលយើងអាចជួយអ្នកបាន...',
    subjects: {
      general: { label: 'សំណួរទូទៅ' },
      order: { label: 'ស្ថានភាពការបញ្ជាទិញ' },
      product: { label: 'សំណួរអំពីផលិតផល' },
      return: { label: 'ការត្រឡប់ & បង្វិលប្រាក់' },
      partnership: { label: 'សហការណ៍' },
      other: { label: 'ផ្សេងៗ' },
    },
  },
  info_cards: {
    email: {
      title: 'អ៊ីមែលមកយើង',
      line1: 'kalapakgpt@gmail.com',
      line2: 'ឆ្លើយតបក្នុងរយៈពេល 24 ម៉ោង',
      href: 'mailto:kalapakgpt@gmail.com',
    },
    phone: {
      title: 'ទូរស័ព្ទមកយើង',
      line1: '+855 00 00 000',
      line2: 'ចន្ទ-សុក្រ 9ព្រឹក-6ល្ងាច',
      href: 'tel:+85500000000',
    },
    visit: {
      title: 'មកជួបយើង',
      line1: 'ភ្នំពេញ ប្រទេសកម្ពុជា',
      line2: 'សូមមកជួបសួស្តី!',
      href: '',
    },
  },
};

/** @deprecated Use DEFAULT_CONTACT_BILINGUAL — kept for imports that expect flat English contact page */
export const DEFAULT_CONTACT_PAGE = {
  ...DEFAULT_CONTACT_EN,
  form: {
    ...DEFAULT_CONTACT_EN.form,
    subjects: Object.fromEntries(
      Object.entries(DEFAULT_CONTACT_EN.form.subjects).map(([key, subject]) => [
        key,
        { value: key, label: subject.label },
      ])
    ),
    subject_order: DEFAULT_CONTACT_SUBJECT_ORDER,
  },
  info_card_order: DEFAULT_CONTACT_INFO_CARD_ORDER,
};

export const DEFAULT_CONTACT_BILINGUAL = {
  form: {
    subject_order: DEFAULT_CONTACT_SUBJECT_ORDER,
  },
  info_card_order: DEFAULT_CONTACT_INFO_CARD_ORDER,
  locales: {
    en: DEFAULT_CONTACT_EN,
    km: DEFAULT_CONTACT_KM,
  },
};

const FORM_TEXT_FIELDS = [
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

function normalizeSubjectLabels(subjects, fallbackSubjects) {
  const normalized = {};
  const source = subjects && typeof subjects === 'object' ? subjects : fallbackSubjects;

  for (const [key, subject] of Object.entries(source)) {
    if (!subject || typeof subject !== 'object') continue;
    normalized[key] = {
      label: String(subject.label || (typeof subject === 'string' ? subject : key)),
    };
  }

  return Object.keys(normalized).length ? normalized : fallbackSubjects;
}

function normalizeInfoCards(cards, fallbackCards) {
  const normalized = {};
  const source = cards && typeof cards === 'object' ? cards : fallbackCards;

  for (const [key, card] of Object.entries(source)) {
    if (!card || typeof card !== 'object') continue;
    normalized[key] = {
      title: String(card.title || key),
      line1: String(card.line1 || ''),
      line2: String(card.line2 || ''),
      href: String(card.href || ''),
    };
  }

  return Object.keys(normalized).length ? normalized : fallbackCards;
}

function normalizeLocale(localeData, fallback) {
  const formSource = localeData?.form && typeof localeData.form === 'object' ? localeData.form : {};
  const form = {};

  for (const field of FORM_TEXT_FIELDS) {
    form[field] = String(formSource[field] || fallback.form[field] || '');
  }

  form.subjects = normalizeSubjectLabels(formSource.subjects, fallback.form.subjects);

  return {
    title: String(localeData?.title || fallback.title),
    subtitle: String(localeData?.subtitle || fallback.subtitle),
    form,
    info_cards: normalizeInfoCards(localeData?.info_cards, fallback.info_cards),
  };
}

function reorderKeyedItems(items, order) {
  const normalizedOrder = normalizeSharedOrder(order, Object.keys(items || {}));
  const next = {};

  for (const key of normalizedOrder) {
    if (items?.[key]) next[key] = items[key];
  }

  return next;
}

function syncLocalesForOrder(locales, subjectOrder, infoCardOrder) {
  const next = { ...locales };

  for (const locale of PAGE_LOCALES) {
    const localeData = next[locale] || DEFAULT_CONTACT_BILINGUAL.locales[locale];
    const subjects = { ...localeData.form.subjects };
    const infoCards = { ...localeData.info_cards };

    for (const key of subjectOrder) {
      if (!subjects[key]) {
        subjects[key] = { label: locale === 'km' ? 'ប្រធានបទថ្មី' : 'New Subject' };
      }
    }

    for (const key of infoCardOrder) {
      if (!infoCards[key]) {
        infoCards[key] = {
          title: locale === 'km' ? 'កាតថ្មី' : 'New Card',
          line1: '',
          line2: '',
          href: '',
        };
      }
    }

    next[locale] = {
      ...localeData,
      form: {
        ...localeData.form,
        subjects: reorderKeyedItems(subjects, subjectOrder),
      },
      info_cards: reorderKeyedItems(infoCards, infoCardOrder),
    };
  }

  return next;
}

function legacyToEnglishLocale(incoming) {
  const base = incoming && typeof incoming === 'object' ? incoming : {};
  const form = base.form && typeof base.form === 'object' ? base.form : {};
  const subjects = {};

  if (form.subjects && typeof form.subjects === 'object') {
    for (const [key, subject] of Object.entries(form.subjects)) {
      if (!subject || typeof subject !== 'object') continue;
      subjects[key] = { label: String(subject.label || key) };
    }
  }

  return normalizeLocale(
    {
      title: base.title,
      subtitle: base.subtitle,
      form: {
        ...form,
        subjects,
      },
      info_cards: base.info_cards,
    },
    DEFAULT_CONTACT_EN
  );
}

export function normalizeContactListOrder(order, keys) {
  return normalizeSharedOrder(order, keys);
}

export function reorderContactListKeys(order, key, direction) {
  return reorderSharedOrderKeys(order, key, direction);
}

export function orderContactSubjects(form) {
  const subjects = form?.subjects || {};
  const order = normalizeContactListOrder(form?.subject_order, Object.keys(subjects));
  return order
    .filter((key) => subjects[key])
    .map((key) => subjects[key]);
}

export function orderContactInfoCards(contactPage) {
  const cards = contactPage?.info_cards || {};
  const order = normalizeContactListOrder(contactPage?.info_card_order, Object.keys(cards));
  return order
    .filter((key) => cards[key])
    .map((key) => [key, cards[key]]);
}

function localeViewFromBilingual(normalized, locale = 'en') {
  const lang = resolvePageLocale(locale);
  const localeData = normalized.locales[lang];
  const subjectOrder = normalized.form.subject_order;
  const infoCardOrder = normalized.info_card_order;

  const subjects = {};
  for (const key of subjectOrder) {
    const subject = localeData.form.subjects[key];
    if (!subject) continue;
    subjects[key] = {
      value: key,
      label: subject.label,
    };
  }

  return {
    title: localeData.title,
    subtitle: localeData.subtitle,
    form: {
      ...localeData.form,
      subjects,
      subject_order: subjectOrder,
    },
    info_cards: reorderKeyedItems(localeData.info_cards, infoCardOrder),
    info_card_order: infoCardOrder,
  };
}

export function normalizeContactPagePayload(incoming) {
  if (incoming?.locales && typeof incoming.locales === 'object') {
    const en = normalizeLocale(incoming.locales.en, DEFAULT_CONTACT_EN);
    const km = normalizeLocale(incoming.locales.km, DEFAULT_CONTACT_KM);
    const mergedSubjectKeys = [
      ...new Set([...Object.keys(en.form.subjects), ...Object.keys(km.form.subjects)]),
    ];
    const mergedCardKeys = [
      ...new Set([...Object.keys(en.info_cards), ...Object.keys(km.info_cards)]),
    ];

    const subjectOrder = normalizeSharedOrder(
      incoming?.form?.subject_order ?? incoming?.subject_order,
      mergedSubjectKeys
    );
    const infoCardOrder = normalizeSharedOrder(incoming?.info_card_order, mergedCardKeys);
    const locales = syncLocalesForOrder({ en, km }, subjectOrder, infoCardOrder);

    return {
      form: { subject_order: subjectOrder },
      info_card_order: infoCardOrder,
      locales,
    };
  }

  const legacyEn = legacyToEnglishLocale(incoming);
  const subjectOrder = normalizeSharedOrder(
    incoming?.form?.subject_order ?? incoming?.subject_order,
    Object.keys(legacyEn.form.subjects)
  );
  const infoCardOrder = normalizeSharedOrder(
    incoming?.info_card_order,
    Object.keys(legacyEn.info_cards)
  );
  const locales = syncLocalesForOrder(
    { en: legacyEn, km: normalizeLocale(DEFAULT_CONTACT_KM, DEFAULT_CONTACT_KM) },
    subjectOrder,
    infoCardOrder
  );

  return {
    form: { subject_order: subjectOrder },
    info_card_order: infoCardOrder,
    locales,
  };
}

export function getContactLocaleView(page, locale = 'en') {
  const normalized = normalizeContactPagePayload(page);
  return localeViewFromBilingual(normalized, locale);
}

export function resolveContactLocale(page, locale = 'en') {
  return getContactLocaleView(page, locale);
}

export function updateContactLocaleField(page, locale, field, value) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    [field]: value,
  }));
}

export function updateContactFormField(page, locale, field, value) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    form: {
      ...(current.form || {}),
      [field]: value,
    },
  }));
}

export function updateContactSubject(page, locale, subjectKey, updater) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    form: {
      ...(current.form || {}),
      subjects: {
        ...(current.form?.subjects || {}),
        [subjectKey]: updater(current.form?.subjects?.[subjectKey] || { label: '' }),
      },
    },
  }));
}

export function updateContactInfoCard(page, locale, cardKey, updater) {
  return updateBilingualLocale(page, locale, (current) => ({
    ...current,
    info_cards: {
      ...(current.info_cards || {}),
      [cardKey]: updater(current.info_cards?.[cardKey] || { title: '', line1: '', line2: '', href: '' }),
    },
  }));
}

export function addContactSubject(page, subjectKey) {
  const normalized = normalizeContactPagePayload(page);
  const subjectOrder = [...normalized.form.subject_order, subjectKey];
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    locales[locale] = {
      ...locales[locale],
      form: {
        ...locales[locale].form,
        subjects: {
          ...locales[locale].form.subjects,
          [subjectKey]: { label: locale === 'km' ? 'ប្រធានបទថ្មី' : 'New Subject' },
        },
      },
    };
  }

  return {
    form: { subject_order: subjectOrder },
    info_card_order: normalized.info_card_order,
    locales: syncLocalesForOrder(locales, subjectOrder, normalized.info_card_order),
  };
}

export function removeContactSubject(page, subjectKey) {
  const normalized = normalizeContactPagePayload(page);
  const subjectOrder = normalized.form.subject_order.filter((key) => key !== subjectKey);
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    const subjects = { ...locales[locale].form.subjects };
    delete subjects[subjectKey];
    locales[locale] = {
      ...locales[locale],
      form: {
        ...locales[locale].form,
        subjects,
      },
    };
  }

  return {
    form: { subject_order: subjectOrder },
    info_card_order: normalized.info_card_order,
    locales: syncLocalesForOrder(locales, subjectOrder, normalized.info_card_order),
  };
}

export function moveContactSubject(page, subjectKey, direction) {
  const normalized = normalizeContactPagePayload(page);
  return {
    ...normalized,
    form: {
      subject_order: reorderContactListKeys(normalized.form.subject_order, subjectKey, direction),
    },
  };
}

export function addContactInfoCard(page, cardKey) {
  const normalized = normalizeContactPagePayload(page);
  const infoCardOrder = [...normalized.info_card_order, cardKey];
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    locales[locale] = {
      ...locales[locale],
      info_cards: {
        ...locales[locale].info_cards,
        [cardKey]: {
          title: locale === 'km' ? 'កាតថ្មី' : 'New Card',
          line1: '',
          line2: '',
          href: '',
        },
      },
    };
  }

  return {
    form: normalized.form,
    info_card_order: infoCardOrder,
    locales: syncLocalesForOrder(locales, normalized.form.subject_order, infoCardOrder),
  };
}

export function removeContactInfoCard(page, cardKey) {
  const normalized = normalizeContactPagePayload(page);
  const infoCardOrder = normalized.info_card_order.filter((key) => key !== cardKey);
  const locales = { ...normalized.locales };

  for (const locale of PAGE_LOCALES) {
    const infoCards = { ...locales[locale].info_cards };
    delete infoCards[cardKey];
    locales[locale] = {
      ...locales[locale],
      info_cards: infoCards,
    };
  }

  return {
    form: normalized.form,
    info_card_order: infoCardOrder,
    locales: syncLocalesForOrder(locales, normalized.form.subject_order, infoCardOrder),
  };
}

export function moveContactInfoCard(page, cardKey, direction) {
  const normalized = normalizeContactPagePayload(page);
  return {
    ...normalized,
    info_card_order: reorderContactListKeys(normalized.info_card_order, cardKey, direction),
  };
}
