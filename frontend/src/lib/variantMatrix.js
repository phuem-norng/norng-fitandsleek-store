/**
 * Color × Size variant matrix inventory (product.variant_matrix).
 */

import { normalizeVariantBarcodeFormat } from "./variantBarcode.js";

function normalizeVariantLinePart(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function parseVariantMatrix(raw) {
  let rows = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      rows = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const color = String(row.color ?? "").trim();
    const size = String(row.size ?? "").trim();
    const qty = Math.max(0, parseInt(String(row.qty ?? 0), 10) || 0);
    if (!color || !size) continue;
    const sku_barcode = String(row.sku_barcode ?? row.skuBarcode ?? row.barcode ?? "").trim();
    const barcode_format = normalizeVariantBarcodeFormat(row.barcode_format ?? row.barcodeFormat);
    out.push({ color, size, qty, sku_barcode, barcode_format });
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

/** Sum of all variant_matrix row quantities. */
export function variantMatrixTotalQty(raw) {
  return parseVariantMatrix(raw).reduce((sum, r) => sum + Math.max(0, r.qty), 0);
}

function normalizeVariantKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function lotSellableQtyForVariant(product, color, size) {
  const rows = product?.variant_lot_prices;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const wantC = normalizeVariantKey(color);
  const wantS = normalizeVariantKey(size);
  const match = rows.find(
    (row) => normalizeVariantKey(row?.color) === wantC && normalizeVariantKey(row?.size) === wantS
  );
  if (!match || match.sellable_qty == null) return null;
  const qty = Number(match.sellable_qty);
  return Number.isFinite(qty) ? Math.max(0, qty) : null;
}

function capWithInventoryLots(product, cap, color, size) {
  const lotCap = lotSellableQtyForVariant(product, color, size);
  if (lotCap === null) return cap;
  return Math.min(cap, lotCap);
}

/**
 * Max units available for one color × size (ignores cart contents).
 */
export function sellableQtyForVariantLine(product, color, size) {
  if (!product) return 0;
  const rows = parseVariantMatrix(product.variant_matrix);
  if (rows.length > 0) {
    const c = String(color ?? "").trim();
    const s = String(size ?? "").trim();
    if (!c || !s) return 0;
    const mq = matrixQtyForCombo(rows, color, size);
    if (mq === null) return 0;
    let variantCap = Math.max(0, mq);
    const productStock = Number(product.stock);
    if (Number.isFinite(productStock) && productStock > 0) {
      variantCap = Math.min(variantCap, productStock);
    }
    return capWithInventoryLots(product, variantCap, color, size);
  }
  const stock = Number(product.stock);
  const base = Number.isFinite(stock) ? Math.max(0, stock) : 99;
  return capWithInventoryLots(product, base, color, size);
}

/** @deprecated use sellableQtyForVariantLine */
export function clientVariantMaxQty(product, color, size) {
  return sellableQtyForVariantLine(product, color, size);
}

/** How many of this variant are already in cart lines. */
export function cartQtyForVariantLine(cartItems, productId, color, size) {
  const pid = Number(productId);
  if (!Number.isFinite(pid)) return 0;
  const wantC = normalizeVariantLinePart(color);
  const wantS = normalizeVariantLinePart(size);
  return (cartItems || []).reduce((sum, it) => {
    const itemPid = Number(it?.product?.id ?? it?.product_id);
    if (itemPid !== pid) return sum;
    if (normalizeVariantLinePart(it?.color) !== wantC) return sum;
    if (normalizeVariantLinePart(it?.size) !== wantS) return sum;
    return sum + (Number(it?.quantity) || 0);
  }, 0);
}

/** Max quantity the shopper can still add for this variant. */
export function remainingSellableQty(product, color, size, cartItems) {
  const cap = sellableQtyForVariantLine(product, color, size);
  const inCart = cartQtyForVariantLine(cartItems, product?.id, color, size);
  return Math.max(0, cap - inCart);
}

/** Total units from admin variant grid rows (sum of Qty). */
export function stockTotalFromVariantUiRows(uiRows) {
  return variantMatrixPayloadFromUiRows(uiRows).reduce((sum, r) => sum + r.qty, 0);
}

export function variantMatrixPayloadFromUiRows(rows) {
  return rows
    .map((r) => ({
      color: String(r?.color ?? "").trim(),
      size: String(r?.size ?? "").trim(),
      qty: Math.max(0, parseInt(String(r?.qty ?? "0"), 10) || 0),
      sku_barcode: String(r?.sku_barcode ?? r?.skuBarcode ?? "").trim() || null,
      barcode_format: normalizeVariantBarcodeFormat(r?.barcode_format),
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
  const barcodeFormatByKey = new Map();
  for (const r of existingUiRows || []) {
    const c = String(r?.color ?? "").trim();
    const s = String(r?.size ?? "").trim();
    if (!c || !s) continue;
    const key = `${c.toLowerCase()}\0${s.toLowerCase()}`;
    qtyByKey.set(key, r?.qty ?? "");
    skuBarcodeByKey.set(key, r?.sku_barcode ?? r?.skuBarcode ?? "");
    barcodeFormatByKey.set(key, r?.barcode_format ?? "EAN13");
  }

  const rows = [];
  for (const color of colors) {
    for (const size of sizeList) {
      const key = `${color.toLowerCase()}\0${size.toLowerCase()}`;
      const qty = qtyByKey.has(key) ? qtyByKey.get(key) : "";
      const sku_barcode = skuBarcodeByKey.has(key) ? skuBarcodeByKey.get(key) : "";
      const barcode_format = barcodeFormatByKey.has(key) ? barcodeFormatByKey.get(key) : "EAN13";
      rows.push({ id: newRowId(), color, size, qty, sku_barcode, barcode_format });
    }
  }

  return { rows };
}
