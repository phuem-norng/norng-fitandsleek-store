import { BARCODE_QR_TYPE } from "./stockLabelReceipts";

export const PRODUCT_CATALOG_COLUMNS = [
  { id: "select", label: "Select" },
  { id: "productName", label: "Product Name" },
  { id: "barcode", label: "Barcode" },
  { id: "category", label: "Category" },
  { id: "stockName", label: "Stock name" },
  { id: "supplierId", label: "Supplier ID" },
  { id: "price", label: "Price" },
  { id: "stock", label: "Stock" },
  { id: "status", label: "Status" },
  { id: "actions", label: "Actions" },
];

export const EMPTY_TABLE_CELL = "-";
export const FILTER_NONE = "__none__";

export const GENDER_OPTIONS = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
  { key: "boys", label: "Boys" },
  { key: "girls", label: "Girls" },
];

export const normalizeType = (value) => String(value || "").toLowerCase().trim();

export function matchesGender(slug, key) {
  const s = (slug || "").toLowerCase();
  if (key === "men") return s === "men" || s.startsWith("men-");
  if (key === "women") return s === "women" || s.startsWith("women-");
  if (key === "boys") return s === "boys" || s.startsWith("boys-") || s.includes("-boys");
  if (key === "girls") return s === "girls" || s.startsWith("girls-") || s.includes("-girls");
  return false;
}

export function formatSupplierOptionLabel(supplier) {
  const name = String(supplier?.name || "Supplier").trim();
  const code = String(supplier?.supplier_code || "").trim();
  return code ? `${name}. ${code}` : name;
}

export function tableCellTextClass(value, { mono = false } = {}) {
  const isEmpty = value === EMPTY_TABLE_CELL;
  if (isEmpty) return "text-xs text-slate-500 dark:text-slate-400 font-mono";
  return mono
    ? "text-xs font-mono text-slate-600 dark:text-slate-300"
    : "text-xs text-slate-600 dark:text-slate-300";
}

export function gridMetaTextClass(value, { mono = false } = {}) {
  const isEmpty = value === EMPTY_TABLE_CELL;
  if (isEmpty) return "text-[10px] font-mono text-slate-400 dark:text-slate-500";
  return mono
    ? "text-[10px] font-mono text-slate-500 dark:text-slate-400"
    : "text-[10px] text-slate-500 dark:text-slate-400";
}

export function buildCatalogCategories(categories) {
  return (categories || []).filter((c) => normalizeType(c.type) !== BARCODE_QR_TYPE);
}

export function stockNameForProduct(product, categories) {
  const id = product?.stock_label_id;
  if (id != null && id !== "") {
    const byId = categories.find(
      (c) => String(c.id) === String(id) && normalizeType(c.type) === BARCODE_QR_TYPE,
    );
    if (byId) {
      const name = String(byId.name || "").trim();
      return name || EMPTY_TABLE_CELL;
    }
  }
  return EMPTY_TABLE_CELL;
}

export function supplierIdForProduct(product, suppliers) {
  const code = product?.supplier?.supplier_code
    || suppliers.find((s) => String(s.id) === String(product?.supplier_id))?.supplier_code;
  return code ? String(code).trim() : EMPTY_TABLE_CELL;
}

export function stockLabelKeyForProduct(product, categories) {
  const id = product?.stock_label_id;
  if (id != null && id !== "") {
    const byId = categories.find(
      (c) => String(c.id) === String(id) && normalizeType(c.type) === BARCODE_QR_TYPE,
    );
    if (byId) return String(byId.id);
  }
  return "";
}

export function supplierKeyForProduct(product) {
  if (product?.supplier_id != null && product?.supplier_id !== "") {
    return String(product.supplier_id);
  }
  return "";
}

export function productMatchesSectionTab(product, sectionKey) {
  if (!sectionKey) return true;
  const key = String(sectionKey).toLowerCase();
  const catName = String(product?.category?.name || "").toLowerCase();
  const catSlug = String(product?.category?.slug || "").toLowerCase();
  const catType = String(product?.category?.type || "").toLowerCase();
  return catName.includes(key) || catSlug.includes(key) || catType === key;
}

export function deleteIconButtonStyle(isDark) {
  return {
    backgroundColor: isDark ? "rgba(127, 29, 29, 0.22)" : "#fef2f2",
    color: isDark ? "#fecdd3" : "#991b1b",
    borderRadius: "5px",
    padding: "0.5rem",
  };
}
