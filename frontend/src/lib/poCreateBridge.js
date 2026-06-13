import { parseProductColors, parseProductSizes } from "./purchaseOrderHelpers.js";

export const PO_DRAFT_KEY = "fitandsleek-po-create-draft";
export const PO_RETURN_LINE_KEY = "fitandsleek-po-return-line-key";
export const PO_APPLY_KEY = "fitandsleek-po-apply-product";

export function savePoCreateDraft(draft) {
  try {
    sessionStorage.setItem(PO_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function loadPoCreateDraft() {
  try {
    const raw = sessionStorage.getItem(PO_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PO_DRAFT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadPoApplyProduct() {
  try {
    const raw = sessionStorage.getItem(PO_APPLY_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PO_APPLY_KEY);
    sessionStorage.removeItem(PO_RETURN_LINE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function buildPoLineDefaultsFromProductCreate(form, variantMatrixRows) {
  const rows = Array.isArray(variantMatrixRows) ? variantMatrixRows : [];
  const withQty = rows.find((r) => Number(r?.qty) > 0);
  const first = withQty || rows[0];
  const sizes = Array.isArray(form?.sizes) ? form.sizes : [];
  return {
    size: String(first?.size ?? sizes[0] ?? "").trim(),
    color: String(first?.color ?? "").trim(),
    qty: Math.max(1, Number(first?.qty) || 1),
    cost_per_unit:
      form?.cost_price === "" || form?.cost_price == null
        ? ""
        : String(Number(form.cost_price)),
    sell_price:
      form?.price === "" || form?.price == null ? "" : String(Number(form.price)),
  };
}

export function enrichProductForPoList(created, form, colorVariantRows) {
  const id = created?.id ?? created?.product_id;
  const sizes = Array.isArray(form?.sizes) ? form.sizes.filter(Boolean) : [];
  const colors = (Array.isArray(colorVariantRows) ? colorVariantRows : [])
    .map((row) => ({
      name: String(row?.name ?? "").trim(),
      image_url: String(row?.image_url ?? "").trim() || null,
    }))
    .filter((row) => row.name);

  return {
    ...created,
    id,
    name: created?.name || form?.name,
    sizes: parseProductSizes(created?.sizes).length ? created.sizes : sizes,
    colors: parseProductColors(created?.colors).length ? created.colors : colors,
    cost_price: created?.cost_price ?? form?.cost_price,
    price: created?.price ?? form?.price,
  };
}
