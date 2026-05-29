/** Demo / placeholder media shipped with migrations or seeders — not admin-uploaded content. */
const STOCK_MEDIA_RE = /images\.unsplash\.com|placeholder\.svg/i;

export function isStockMediaUrl(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  return STOCK_MEDIA_RE.test(value);
}

/** True when at least one item has a real uploaded or custom image URL. */
export function hasStorefrontMedia(items, imageKey = "image_url") {
  return (items || []).some((item) => !isStockMediaUrl(item?.[imageKey]));
}

export function filterStorefrontMedia(items, imageKey = "image_url") {
  return (items || []).filter((item) => !isStockMediaUrl(item?.[imageKey]));
}
