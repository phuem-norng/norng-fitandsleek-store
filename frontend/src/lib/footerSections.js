export const DEFAULT_FOOTER_SECTION_ORDER = ['support', 'tracking', 'legal'];

export function normalizeFooterSectionOrder(order, sections) {
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

export function orderFooterSectionEntries(sections, order) {
  return normalizeFooterSectionOrder(order, sections)
    .filter((key) => sections?.[key])
    .map((key) => [key, sections[key]]);
}

export function reorderFooterSectionKeys(order, sectionKey, direction) {
  const next = [...order];
  const index = next.indexOf(sectionKey);
  if (index === -1) return order;

  const target = index + direction;
  if (target < 0 || target >= next.length) return order;

  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderFooterSectionsObject(sections, order) {
  const normalizedOrder = normalizeFooterSectionOrder(order, sections);
  const next = {};

  for (const key of normalizedOrder) {
    if (sections[key]) {
      next[key] = sections[key];
    }
  }

  return next;
}
