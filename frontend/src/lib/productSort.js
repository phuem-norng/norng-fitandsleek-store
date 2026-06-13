export const DEFAULT_PRODUCT_SORT = {
  sortBy: "name",
  sortDir: "asc",
  groupBy: "none",
};

export const PRIMARY_SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date modified" },
  { id: "type", label: "Type" },
];

export const MORE_SORT_OPTIONS = [
  { id: "price", label: "Price" },
  { id: "stock", label: "Stock" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "barcode", label: "Barcode" },
  { id: "supplier", label: "Supplier ID" },
];

export const GROUP_BY_OPTIONS = [
  { id: "none", label: "None" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
];

export function loadProductSortPrefs(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_PRODUCT_SORT };
    const parsed = JSON.parse(raw);
    return {
      sortBy: parsed.sortBy || DEFAULT_PRODUCT_SORT.sortBy,
      sortDir: parsed.sortDir === "desc" ? "desc" : "asc",
      groupBy: parsed.groupBy || DEFAULT_PRODUCT_SORT.groupBy,
    };
  } catch {
    return { ...DEFAULT_PRODUCT_SORT };
  }
}

export function saveProductSortPrefs(storageKey, prefs) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

function categoryTypeForProduct(product, catalogCategories = []) {
  const fromNested = String(product?.category?.type || "").trim();
  if (fromNested) return fromNested.toLowerCase();
  const catId = product?.category_id;
  if (catId == null || catId === "") return "";
  const cat = catalogCategories.find((c) => String(c.id) === String(catId));
  return String(cat?.type || "").trim().toLowerCase();
}

function compareStrings(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
}

function compareNumbers(a, b) {
  const na = Number(a);
  const nb = Number(b);
  const va = Number.isFinite(na) ? na : 0;
  const vb = Number.isFinite(nb) ? nb : 0;
  return va - vb;
}

function compareDates(a, b) {
  const ta = new Date(a || 0).getTime();
  const tb = new Date(b || 0).getTime();
  return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
}

export function compareProducts(a, b, sortBy, sortDir, { catalogCategories = [], supplierLabelFor } = {}) {
  let cmp = 0;
  switch (sortBy) {
    case "date":
      cmp = compareDates(a?.updated_at || a?.created_at, b?.updated_at || b?.created_at);
      break;
    case "type":
      cmp = compareStrings(categoryTypeForProduct(a, catalogCategories), categoryTypeForProduct(b, catalogCategories));
      break;
    case "price":
      cmp = compareNumbers(a?.price, b?.price);
      break;
    case "stock":
      cmp = compareNumbers(a?.stock, b?.stock);
      break;
    case "category":
      cmp = compareStrings(a?.category?.name, b?.category?.name);
      break;
    case "brand":
      cmp = compareStrings(a?.brand?.name, b?.brand?.name);
      break;
    case "barcode":
      cmp = compareStrings(a?.barcode_code || a?.sku, b?.barcode_code || b?.sku);
      break;
    case "supplier":
      cmp = compareStrings(
        supplierLabelFor?.(a) || a?.supplier?.supplier_code,
        supplierLabelFor?.(b) || b?.supplier?.supplier_code,
      );
      break;
    case "name":
    default:
      cmp = compareStrings(a?.name, b?.name);
      break;
  }
  if (cmp === 0) cmp = compareStrings(a?.name, b?.name);
  return sortDir === "desc" ? -cmp : cmp;
}

export function sortProducts(rows, sortBy, sortDir, context = {}) {
  return [...rows].sort((a, b) => compareProducts(a, b, sortBy, sortDir, context));
}

export function groupKeyForProduct(product, groupBy, context = {}) {
  const { catalogCategories = [] } = context;
  switch (groupBy) {
    case "category":
      return String(product?.category_id || product?.category?.id || "__none__");
    case "brand":
      return String(product?.brand_id || product?.brand?.id || "__none__");
    case "type":
      return categoryTypeForProduct(product, catalogCategories) || "__none__";
    case "status":
      return product?.is_active ? "active" : "inactive";
    default:
      return "__all__";
  }
}

export function groupLabelForProduct(product, groupBy, context = {}) {
  const { catalogCategories = [] } = context;
  switch (groupBy) {
    case "category":
      return product?.category?.name
        || catalogCategories.find((c) => String(c.id) === String(product?.category_id))?.name
        || "No category";
    case "brand":
      return product?.brand?.name || "No brand";
    case "type": {
      const type = categoryTypeForProduct(product, catalogCategories);
      if (!type) return "No type";
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
    case "status":
      return product?.is_active ? "Active" : "Inactive";
    default:
      return "All";
  }
}

export function buildProductGroups(rows, groupBy, context = {}) {
  if (!groupBy || groupBy === "none") return null;
  const map = new Map();
  for (const product of rows) {
    const key = groupKeyForProduct(product, groupBy, context);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: groupLabelForProduct(product, groupBy, context),
        items: [],
      });
    }
    map.get(key).items.push(product);
  }
  return [...map.values()].sort((a, b) => compareStrings(a.label, b.label));
}

export function sortOptionLabel(sortBy) {
  const all = [...PRIMARY_SORT_OPTIONS, ...MORE_SORT_OPTIONS];
  return all.find((o) => o.id === sortBy)?.label || "Name";
}
