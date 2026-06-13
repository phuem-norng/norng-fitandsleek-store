/** Query param carrying a safe in-app return path after admin product flows. */
export const ADMIN_RETURN_PARAM = "returnTo";

/** @param {string | null | undefined} raw */
export function parseAdminReturnTo(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const path = decodeURIComponent(raw.trim());
    if (!path.startsWith("/admin/")) return null;
    if (path.includes("://") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}

/** @param {string | null | undefined} search */
export function adminReturnToFromSearch(search) {
  const params = new URLSearchParams(search || "");
  return parseAdminReturnTo(params.get(ADMIN_RETURN_PARAM));
}

/**
 * @param {{
 *   edit?: string | number;
 *   newProduct?: boolean;
 *   categoryId?: string | number;
 *   brandId?: string | number;
 *   stockLabelId?: string | number;
 *   returnTo?: string | null;
 * }} opts
 */
export function buildAdminProductsUrl(opts = {}) {
  const params = new URLSearchParams();
  if (opts.edit != null && opts.edit !== "") params.set("edit", String(opts.edit));
  if (opts.newProduct) params.set("new", "1");
  if (opts.categoryId) params.set("category_id", String(opts.categoryId));
  if (opts.brandId) params.set("brand_id", String(opts.brandId));
  if (opts.stockLabelId) params.set("stock_label_id", String(opts.stockLabelId));
  if (opts.returnTo) params.set(ADMIN_RETURN_PARAM, opts.returnTo);
  const q = params.toString();
  return `/admin/products${q ? `?${q}` : ""}`;
}

/** Stock inventory chosen-products view (e.g. Clothes). */
export function stockInventoryChosenReturnPath(stockBase, labelId) {
  const base = String(stockBase || "/admin/stock-inventory").replace(/\/$/, "");
  if (labelId == null || labelId === "") return base;
  return `${base}?linked=${encodeURIComponent(String(labelId))}`;
}
