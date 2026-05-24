/**
 * Color × Size variant matrix inventory (product.variant_matrix).
 */

export function parseVariantMatrix(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const color = String(row.color ?? "").trim();
    const size = String(row.size ?? "").trim();
    const qty = Math.max(0, parseInt(String(row.qty ?? 0), 10) || 0);
    if (!color || !size) continue;
    const sku_barcode = String(row.sku_barcode ?? row.skuBarcode ?? row.barcode ?? "").trim();
    out.push({ color, size, qty, sku_barcode });
  }
  return out;
}

/** @returns {number | null} null = combo not listed in matrix */
export function matrixQtyForCombo(matrixRows, color, size) {
  const c = String(color ?? "").trim();
  const s = String(size ?? "").trim();
  if (!c || !s) return null;
  for (const r of matrixRows) {
    if (r.color.toLowerCase() === c.toLowerCase() && r.size.toLowerCase() === s.toLowerCase()) {
      return r.qty;
    }
  }
  return null;
}

/**
 * Max addable qty for this product + color + size (client-side; server still enforces label/product caps).
 */
export function clientVariantMaxQty(product, color, size) {
  if (!product) return 99;
  const rows = parseVariantMatrix(product.variant_matrix);
  if (rows.length > 0) {
    const mq = matrixQtyForCombo(rows, color, size);
    if (mq === null) return 0;
    const listing = Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : mq;
    return Math.min(mq, listing);
  }
  return Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 99;
}

export function variantMatrixPayloadFromUiRows(rows) {
  return rows
    .map((r) => ({
      color: String(r?.color ?? "").trim(),
      size: String(r?.size ?? "").trim(),
      qty: Math.max(0, parseInt(String(r?.qty ?? "0"), 10) || 0),
      sku_barcode: String(r?.sku_barcode ?? r?.skuBarcode ?? "").trim() || null,
    }))
    .filter((r) => r.color && r.size);
}

/**
 * Build UI rows for every color × size (Cartesian product). De-duplicates names case-insensitively.
 * Quantities from existing rows are kept when color + size match (case-insensitive).
 *
 * @param {unknown[]} colorNames
 * @param {unknown[]} sizes
 * @param {{ id?: string, color?: string, size?: string, qty?: string | number, sku_barcode?: string }[]} existingUiRows
 * @param {() => string} newRowId
 * @returns {{ rows: { id: string, color: string, size: string, qty: string | number, sku_barcode: string }[], error?: string }}
 */
export function buildVariantMatrixRowsFromGrid(colorNames, sizes, existingUiRows, newRowId) {
  const colors = [];
  const seenC = new Set();
  for (const raw of colorNames || []) {
    const c = String(raw ?? "").trim();
    if (!c) continue;
    const k = c.toLowerCase();
    if (seenC.has(k)) continue;
    seenC.add(k);
    colors.push(c);
  }

  const sizeList = [];
  const seenS = new Set();
  for (const raw of sizes || []) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seenS.has(k)) continue;
    seenS.add(k);
    sizeList.push(s);
  }

  if (!colors.length) {
    return {
      rows: existingUiRows || [],
      error: "Add at least one color name above, then try again.",
    };
  }
  if (!sizeList.length) {
    return {
      rows: existingUiRows || [],
      error: "Select or add at least one size under Available Sizes, then try again.",
    };
  }

  const qtyByKey = new Map();
  const skuBarcodeByKey = new Map();
  for (const r of existingUiRows || []) {
    const c = String(r?.color ?? "").trim();
    const s = String(r?.size ?? "").trim();
    if (!c || !s) continue;
    const key = `${c.toLowerCase()}\0${s.toLowerCase()}`;
    qtyByKey.set(key, r?.qty ?? "");
    skuBarcodeByKey.set(key, r?.sku_barcode ?? r?.skuBarcode ?? "");
  }

  const rows = [];
  for (const color of colors) {
    for (const size of sizeList) {
      const key = `${color.toLowerCase()}\0${size.toLowerCase()}`;
      const qty = qtyByKey.has(key) ? qtyByKey.get(key) : "";
      const sku_barcode = skuBarcodeByKey.has(key) ? skuBarcodeByKey.get(key) : "";
      rows.push({ id: newRowId(), color, size, qty, sku_barcode });
    }
  }

  return { rows };
}
