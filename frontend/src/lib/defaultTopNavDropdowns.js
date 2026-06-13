import { storefrontSearchUrl } from "./storefrontNavLinks.js";

/** Default desktop top-nav dropdowns (admin can override via Homepage → Header). */
export const DEFAULT_TOP_NAV_DROPDOWNS = {
  newIn: [
    { label: "New Arrivals", to: storefrontSearchUrl({ tab: "new" }) },
    { label: "Trending Now", to: storefrontSearchUrl({ tab: "trending" }) },
    { label: "This Week", to: storefrontSearchUrl({ tab: "this-week" }) },
  ],
  discounts: [
    { label: "All Discounts", to: "/discounts" },
    { label: "Clothes", to: "/discounts/clothes" },
    { label: "Shoes", to: "/discounts/shoes" },
    { label: "Bags", to: "/discounts/bags" },
    { label: "Belts", to: "/discounts/belts" },
    { label: "Accessories", to: "/discounts/accessories" },
  ],
  women: [
    {
      type: "section",
      label: "Clothing",
      items: [
        { label: "Tops", to: storefrontSearchUrl({ gender: "women", category: "tops" }) },
        { label: "Bottoms", to: storefrontSearchUrl({ gender: "women", category: "bottoms" }) },
        { label: "Dresses", to: storefrontSearchUrl({ gender: "women", category: "dresses" }) },
        { label: "Outerwear", to: storefrontSearchUrl({ gender: "women", category: "outerwear" }) },
        { label: "Activewear", to: storefrontSearchUrl({ gender: "women", category: "activewear" }) },
      ],
    },
    {
      type: "section",
      label: "Shoes",
      items: [
        { label: "Sneakers", to: storefrontSearchUrl({ gender: "women", category: "sneakers" }) },
        { label: "Slides", to: storefrontSearchUrl({ gender: "women", category: "slides" }) },
        { label: "Heels", to: storefrontSearchUrl({ gender: "women", category: "heels" }) },
        { label: "Boots", to: storefrontSearchUrl({ gender: "women", category: "boots" }) },
      ],
    },
    {
      type: "section",
      label: "Accessories",
      items: [
        { label: "Bags", to: storefrontSearchUrl({ gender: "women", category: "bags" }) },
        { label: "Belts", to: storefrontSearchUrl({ gender: "women", category: "belts" }) },
        { label: "Hats", to: storefrontSearchUrl({ gender: "women", category: "hats" }) },
        { label: "Jewelry", to: storefrontSearchUrl({ gender: "women", category: "jewelry" }) },
      ],
    },
    {
      type: "section",
      label: "Featured",
      description: "Curated picks for her",
      items: [
        { label: "View All Women", to: storefrontSearchUrl({ parentCategory: "Women" }) },
        { label: "New Arrivals", to: storefrontSearchUrl({ tab: "new", gender: "women" }) },
        { label: "Trending Now", to: storefrontSearchUrl({ tab: "trending", gender: "women" }) },
        { label: "This Week", to: storefrontSearchUrl({ tab: "this-week", gender: "women" }) },
      ],
    },
  ],
  men: [
    {
      type: "section",
      label: "Clothing",
      items: [
        { label: "T-Shirts", to: storefrontSearchUrl({ gender: "men", category: "t-shirts" }) },
        { label: "Shirts", to: storefrontSearchUrl({ gender: "men", category: "shirts" }) },
        { label: "Hoodies", to: storefrontSearchUrl({ gender: "men", category: "hoodies" }) },
        { label: "Jeans", to: storefrontSearchUrl({ gender: "men", category: "jeans" }) },
        { label: "Shorts", to: storefrontSearchUrl({ gender: "men", category: "shorts" }) },
      ],
    },
    {
      type: "section",
      label: "Shoes",
      items: [
        { label: "Sneakers", to: storefrontSearchUrl({ gender: "men", category: "sneakers" }) },
        { label: "Running", to: storefrontSearchUrl({ gender: "men", category: "running" }) },
        { label: "Slides", to: storefrontSearchUrl({ gender: "men", category: "slides" }) },
        { label: "Boots", to: storefrontSearchUrl({ gender: "men", category: "boots" }) },
      ],
    },
    {
      type: "section",
      label: "Accessories",
      items: [
        { label: "Bags", to: storefrontSearchUrl({ gender: "men", category: "bags" }) },
        { label: "Belts", to: storefrontSearchUrl({ gender: "men", category: "belts" }) },
        { label: "Caps & Hats", to: storefrontSearchUrl({ gender: "men", category: "caps-hats" }) },
        { label: "Watches", to: storefrontSearchUrl({ gender: "men", category: "watches" }) },
      ],
    },
    {
      type: "section",
      label: "Featured",
      description: "Curated picks for him",
      items: [
        { label: "View All Men", to: storefrontSearchUrl({ parentCategory: "Men" }) },
        { label: "New Arrivals", to: storefrontSearchUrl({ tab: "new", gender: "men" }) },
        { label: "Trending Now", to: storefrontSearchUrl({ tab: "trending", gender: "men" }) },
        { label: "This Week", to: storefrontSearchUrl({ tab: "this-week", gender: "men" }) },
      ],
    },
  ],
  sale: [
    { label: "All Sale Items", to: storefrontSearchUrl({ tab: "sale" }) },
    { label: "Women's Sale", to: storefrontSearchUrl({ tab: "sale", saleGender: "women" }) },
    { label: "Men's Sale", to: storefrontSearchUrl({ tab: "sale", saleGender: "men" }) },
  ],
};

/** Count leaf links in a flat or sectioned dropdown. */
export function countNavDropdownLinks(items) {
  if (!Array.isArray(items)) return 0;
  let n = 0;
  for (const item of items) {
    if (item?.type === "section" && Array.isArray(item.items)) {
      n += item.items.length;
    } else if (item?.to) {
      n += 1;
    }
  }
  return n;
}

export function mergeTopNavDropdowns(stored) {
  const src = stored && typeof stored === "object" ? stored : {};
  const out = {};
  for (const key of Object.keys(DEFAULT_TOP_NAV_DROPDOWNS)) {
    const defaults = DEFAULT_TOP_NAV_DROPDOWNS[key];
    const saved = src[key];
    const savedCount = countNavDropdownLinks(saved);
    const defaultCount = countNavDropdownLinks(defaults);
    const isSparseGenderMenu =
      (key === "women" || key === "men") && savedCount > 0 && savedCount < defaultCount;
    const useDefaults =
      !Array.isArray(saved) || saved.length === 0 || isSparseGenderMenu;
    out[key] = useDefaults ? defaults : saved;
  }
  return out;
}
