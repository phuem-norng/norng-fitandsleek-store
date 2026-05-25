/** Storefront product filters — browse, sort, and attribute sections. */

import { cloneFilterSet, countFilterSelections, matchesSection, toggleFilterSelection } from "./adminListFilters.js";

export { cloneFilterSet, countFilterSelections, matchesSection, toggleFilterSelection };

export const STOREFRONT_SORT_OPTIONS = [
  { value: "recommend", label: "Recommend" },
  { value: "new", label: "New items" },
  { value: "price_high", label: "Price (High First)" },
  { value: "price_low", label: "Price (Low First)" },
  { value: "discount_high", label: "Discount (High First)" },
  { value: "discount_low", label: "Discount (Low First)" },
];

export const STOREFRONT_GENDER_OPTIONS = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
];

export const STOREFRONT_FILTER_SECTION_IDS = [
  "gender",
  "section",
  "category",
  "brand",
  "color",
  "size",
];

export function sortSizes(sizes = []) {
  return [...sizes].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNum = Number.isFinite(na) && String(a).trim() !== "";
    const bNum = Number.isFinite(nb) && String(b).trim() !== "";
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  });
}

export function parseListParam(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function serializeListParam(values) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return list.length ? list.join(",") : "";
}

export function filtersFromSearchParams(searchParams) {
  return {
    gender: parseListParam(searchParams.get("gender")),
    section: parseListParam(searchParams.get("section")),
    category: parseListParam(searchParams.get("category_id")),
    brand: parseListParam(searchParams.get("brand_id")),
    color: parseListParam(searchParams.get("color")),
    size: parseListParam(searchParams.get("size")),
  };
}

export function browseFromSearchParams(searchParams) {
  return {
    sort: searchParams.get("sort") || "recommend",
    minPrice: searchParams.get("min_price") ?? "",
    maxPrice: searchParams.get("max_price") ?? "",
  };
}

export function applyFiltersToSearchParams(searchParams, applied) {
  const next = new URLSearchParams(searchParams);
  const setList = (key, values) => {
    const serialized = serializeListParam(values);
    if (serialized) next.set(key, serialized);
    else next.delete(key);
  };
  setList("gender", applied.gender);
  setList("section", applied.section);
  setList("category_id", applied.category);
  setList("brand_id", applied.brand);
  setList("color", applied.color);
  setList("size", applied.size);
  next.delete("page");
  return next;
}

export function applyBrowseToSearchParams(searchParams, browse, priceBounds = null) {
  const next = new URLSearchParams(searchParams);
  const sort = browse?.sort || "recommend";
  if (sort && sort !== "recommend") next.set("sort", sort);
  else next.delete("sort");

  const boundsMin = priceBounds?.min ?? null;
  const boundsMax = priceBounds?.max ?? null;
  const minVal = browse?.minPrice !== "" && browse?.minPrice != null ? Number(browse.minPrice) : null;
  const maxVal = browse?.maxPrice !== "" && browse?.maxPrice != null ? Number(browse.maxPrice) : null;

  const minActive = minVal != null && boundsMin != null && minVal > boundsMin;
  const maxActive = maxVal != null && boundsMax != null && maxVal < boundsMax;

  if (minActive) next.set("min_price", String(minVal));
  else next.delete("min_price");
  if (maxActive) next.set("max_price", String(maxVal));
  else next.delete("max_price");

  next.delete("page");
  return next;
}

export function buildProductApiParams({
  page = 1,
  q = "",
  tab = "",
  parentCategory = "",
  applied = {},
  browse = {},
  imageColors = null,
}) {
  const params = { page, per_page: 12 };

  if (q) params.q = q;
  if (tab && tab !== "wishlist") params.tab = tab;

  const sort = browse?.sort || "recommend";
  if (sort && sort !== "recommend") params.sort = sort;

  if (browse?.minPrice !== "" && browse?.minPrice != null) params.min_price = browse.minPrice;
  if (browse?.maxPrice !== "" && browse?.maxPrice != null) params.max_price = browse.maxPrice;

  if (parentCategory) {
    params.parent_category = parentCategory;
  } else if (applied.gender?.length) {
    params.gender = serializeListParam(applied.gender);
  }

  if (applied.section?.length) params.section = serializeListParam(applied.section);
  if (applied.category?.length) params.category_id = serializeListParam(applied.category);
  if (applied.brand?.length) params.brand_id = serializeListParam(applied.brand);
  if (applied.color?.length) params.color = serializeListParam(applied.color);
  if (applied.size?.length) params.size = serializeListParam(applied.size);

  if (imageColors) {
    params.colors = JSON.stringify(imageColors);
  }

  return params;
}

export function countStorefrontFilters(applied, browse = {}, priceBounds = null) {
  let count = countFilterSelections(applied);
  if (browse.sort && browse.sort !== "recommend") count += 1;

  const boundsMin = priceBounds?.min ?? null;
  const boundsMax = priceBounds?.max ?? null;
  const minVal = browse.minPrice !== "" && browse.minPrice != null ? Number(browse.minPrice) : null;
  const maxVal = browse.maxPrice !== "" && browse.maxPrice != null ? Number(browse.maxPrice) : null;
  if (minVal != null && boundsMin != null && minVal > boundsMin) count += 1;
  if (maxVal != null && boundsMax != null && maxVal < boundsMax) count += 1;

  return count;
}

export function sortLabel(value) {
  return STOREFRONT_SORT_OPTIONS.find((o) => o.value === value)?.label || value;
}

/** Active filter chips for Search / Shop (includes sort even when default). */
export function buildStorefrontFilterChips({
  applied = {},
  browse = {},
  priceBounds = null,
  filterSections = [],
  categories = [],
  brands = [],
  removeFilterValue,
  changeBrowseParams,
}) {
  const chips = [];
  const sort = browse.sort || "recommend";

  chips.push({
    key: "sort",
    label: `Sort by: ${sortLabel(sort)}`,
    onClear: sort !== "recommend" ? () => changeBrowseParams({ sort: "" }) : undefined,
  });

  const sectionTitle = (id, value) =>
    filterSections.find((s) => s.id === id)?.options?.find((o) => o.value === value)?.label || value;

  applied.gender?.forEach((v) =>
    chips.push({
      key: `gender-${v}`,
      label: sectionTitle("gender", v),
      onClear: () => removeFilterValue("gender", v),
    }),
  );
  applied.section?.forEach((v) =>
    chips.push({
      key: `section-${v}`,
      label: sectionTitle("section", v),
      onClear: () => removeFilterValue("section", v),
    }),
  );
  applied.category?.forEach((v) => {
    const name = categories.find((c) => String(c.id) === String(v))?.name || v;
    chips.push({
      key: `cat-${v}`,
      label: name,
      onClear: () => removeFilterValue("category", v),
    });
  });
  applied.brand?.forEach((v) => {
    const name = brands.find((b) => String(b.id) === String(v))?.name || v;
    chips.push({
      key: `brand-${v}`,
      label: name,
      onClear: () => removeFilterValue("brand", v),
    });
  });

  if (browse.minPrice !== "" && priceBounds && Number(browse.minPrice) > priceBounds.min) {
    chips.push({
      key: "min-price",
      label: `Min $${browse.minPrice}`,
      onClear: () => changeBrowseParams({ min_price: "" }),
    });
  }
  if (browse.maxPrice !== "" && priceBounds && Number(browse.maxPrice) < priceBounds.max) {
    chips.push({
      key: "max-price",
      label: `Max $${browse.maxPrice}`,
      onClear: () => changeBrowseParams({ max_price: "" }),
    });
  }

  applied.color?.forEach((v) =>
    chips.push({ key: `color-${v}`, label: v, onClear: () => removeFilterValue("color", v) }),
  );
  applied.size?.forEach((v) =>
    chips.push({ key: `size-${v}`, label: v, onClear: () => removeFilterValue("size", v) }),
  );

  return chips;
}

export function buildSectionOptionsFromHomepage(homepageSettings) {
  const raw = homepageSettings?.sections;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .filter(([key, val]) => key !== "discounts" && val?.enabled !== false)
    .sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99))
    .map(([key, val]) => ({
      value: key,
      label: val.title || key,
    }));
}
