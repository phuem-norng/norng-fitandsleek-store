import { parseVariantMatrix } from "./variantMatrix.js";
import { normalizeVariantBarcodeFormat } from "./variantBarcode.js";

/**
 * POS scannable codes for one product: variant matrix rows first, else product SKU.
 * @returns {{ productId: *, productName: string, color: string|null, size: string|null, barcode: string }[]}
 */
export function barcodeEntriesForProduct(product) {
  if (!product) return [];
  const name = String(product.name || "Product").trim();
  const matrix = parseVariantMatrix(product.variant_matrix);
  if (matrix.length > 0) {
    return matrix
      .filter((row) => row.sku_barcode)
      .map((row) => ({
        productId: product.id,
        productName: name,
        color: row.color,
        size: row.size,
        barcode: row.sku_barcode,
        barcodeFormat: normalizeVariantBarcodeFormat(row.barcode_format),
      }));
  }
  const sku = String(product.sku || "").trim();
  if (sku) {
    return [{
      productId: product.id,
      productName: name,
      color: null,
      size: null,
      barcode: sku,
    }];
  }
  return [];
}

/** Flat list of all variant / product barcodes for many products. */
export function barcodeEntriesForProducts(products) {
  const out = [];
  for (const product of products || []) {
    out.push(...barcodeEntriesForProduct(product));
  }
  return out;
}

/** Single-line summary for a table cell. */
export function formatProductBarcodeCell(product) {
  const entries = barcodeEntriesForProduct(product);
  if (entries.length === 0) return "";
  if (entries.length === 1) return entries[0].barcode;
  return entries.map((e) => e.barcode).join(", ");
}

export function productMatchesVariantBarcodeSearch(product, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  for (const entry of barcodeEntriesForProduct(product)) {
    if (entry.barcode.toLowerCase().includes(q)) return true;
  }
  return false;
}
