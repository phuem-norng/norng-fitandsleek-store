export const PAGE_LOCALES = ['en', 'km'];

export function resolvePageLocale(locale) {
  return locale === 'km' ? 'km' : 'en';
}

export function normalizeSharedOrder(order, keys) {
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

export function reorderSharedOrderKeys(order, itemKey, direction) {
  const next = [...order];
  const index = next.indexOf(itemKey);
  if (index === -1) return order;

  const target = index + direction;
  if (target < 0 || target >= next.length) return order;

  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function updateBilingualLocale(page, locale, updater) {
  const lang = resolvePageLocale(locale);
  const locales = page?.locales || {};

  return {
    ...page,
    locales: {
      ...locales,
      [lang]: updater(locales[lang] || {}),
    },
  };
}

export function syncBilingualLocales(locales, sectionOrder, createEmptySection) {
  const next = { ...locales };

  for (const locale of PAGE_LOCALES) {
    const localeData = next[locale] || {};
    const sections = { ...(localeData.sections || {}) };

    for (const key of sectionOrder) {
      if (!sections[key]) {
        sections[key] = createEmptySection(locale);
      }
    }

    next[locale] = {
      ...localeData,
      sections,
    };
  }

  return next;
}
