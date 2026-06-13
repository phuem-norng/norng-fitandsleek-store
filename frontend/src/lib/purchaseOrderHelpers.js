import { rowMatchesDateRange } from "./adminListQuery.js";

export function parseProductSizes(rawSizes) {
  if (Array.isArray(rawSizes)) {
    return rawSizes.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof rawSizes === "string" && rawSizes.trim()) {
    return rawSizes.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function parseProductColors(rawColors) {
  if (rawColors == null || rawColors === "") return [];
  if (typeof rawColors === "string") {
    return rawColors.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(rawColors)) return [];
  const seen = new Set();
  const names = [];
  for (const item of rawColors) {
    const n =
      typeof item === "string"
        ? item.trim()
        : String(item?.name ?? item?.label ?? "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(n);
  }
  return names;
}

/** Map API purchase order lines into Add/Edit purchase order form rows. */
export function poFormItemsFromOrder(order) {
  const lines = Array.isArray(order?.items) ? order.items : [];
  if (!lines.length) return [createEmptyPoItem()];
  return lines.map((row, index) => {
    const key =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `po-line-${row.id ?? index}-${Date.now()}`;
    return {
      key,
      product_id: row.product_id != null ? String(row.product_id) : "",
      isNewProduct: false,
      new_product_name: "",
      new_product_category_id: "",
      size: row.size != null ? String(row.size) : "",
      color: row.color != null ? String(row.color) : "",
      qty: Math.max(1, Number(row.qty) || 1),
      cost_per_unit:
        row.cost_per_unit != null && row.cost_per_unit !== ""
          ? String(Number(row.cost_per_unit))
          : "",
      sell_price:
        row.sell_price != null && row.sell_price !== ""
          ? String(Number(row.sell_price))
          : "",
    };
  });
}

export function createEmptyPoItem() {
  const key =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    key,
    product_id: "",
    isNewProduct: false,
    new_product_name: "",
    new_product_category_id: "",
    size: "",
    color: "",
    qty: 1,
    cost_per_unit: "",
    sell_price: "",
    pricingLockedFromTemplate: false,
  };
}

/** New PO line: same product + cost/sell as source; pick size, color, qty only. */
export function createPoItemVariantFromLine(sourceLine) {
  const base = createEmptyPoItem();
  const productId = String(sourceLine?.product_id ?? "").trim();
  if (!productId) return base;

  return {
    ...base,
    product_id: productId,
    isNewProduct: false,
    size: "",
    color: "",
    qty: 1,
    cost_per_unit:
      sourceLine.cost_per_unit != null && sourceLine.cost_per_unit !== ""
        ? String(sourceLine.cost_per_unit)
        : "",
    sell_price:
      sourceLine.sell_price != null && sourceLine.sell_price !== ""
        ? String(sourceLine.sell_price)
        : "",
    pricingLockedFromTemplate: true,
  };
}

export function lineMoney(qty, unit) {
  const q = Math.max(0, Number(qty) || 0);
  const u = Math.max(0, Number(unit) || 0);
  return q * u;
}

export function formatPoMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Low-stock threshold for PO line-item filters. */
export const PO_LOW_STOCK_THRESHOLD = 5;

export function productStockQty(product) {
  if (!product) return 0;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

/** Minimum stock level shown on PO lines (default 1). */
export function productMinStock(product) {
  if (!product) return 1;
  const attrs = product.attributes;
  if (attrs && typeof attrs === "object" && attrs.min_stock != null && attrs.min_stock !== "") {
    const n = Number(attrs.min_stock);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const labelMin = product.stock_label?.min_stock ?? product.stock_label_min;
  if (labelMin != null && labelMin !== "") {
    const n = Number(labelMin);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 1;
}

export function productPartSku(product) {
  if (!product) return "";
  const sku = String(product.sku ?? "").trim();
  if (sku) return sku;
  const barcode = String(product.barcode_code ?? "").trim();
  if (barcode) return barcode;
  return product.id != null ? `SP-${product.id}` : "";
}

export function productPartOptionLabel(product) {
  if (!product) return "";
  const onHand = productStockQty(product);
  const min = productMinStock(product);
  const sku = productPartSku(product);
  const name = String(product.name ?? "").trim() || "Part";
  return `${name}${sku ? ` (${sku})` : ""} — stock ${onHand}/${min}`;
}

export function productPartStockHint(product) {
  if (!product) return "";
  return `On hand: ${productStockQty(product)} · Min: ${productMinStock(product)}`;
}

export function productMatchesPoStockFilter(product, filter) {
  const onHand = productStockQty(product);
  const min = productMinStock(product);
  if (filter === "low") return onHand > 0 && onHand <= min;
  if (filter === "out") return onHand <= 0;
  return true;
}

export function productMatchesPoSearch(product, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [product?.name, product?.sku, product?.barcode_code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Product ids already chosen on other PO lines (for Add item — use Add same product for variants). */
export function poProductIdsOnOtherLines(items, exceptLineKey) {
  const taken = new Set();
  for (const row of items || []) {
    if (row.key === exceptLineKey) continue;
    const pid = String(row.product_id ?? "").trim();
    if (pid) taken.add(pid);
  }
  return taken;
}

/** Dropdown options for one PO line (search + stock filters). Products on other lines are hidden. */
export function poCatalogOptionsForLine(localProducts, items, lineKey, partsSearch, partsFilter) {
  const currentId = String(items.find((r) => r.key === lineKey)?.product_id || "").trim();
  const takenProductIds = poProductIdsOnOtherLines(items, lineKey);

  const base = (localProducts || []).filter(
    (p) =>
      productMatchesPoSearch(p, partsSearch) &&
      productMatchesPoStockFilter(p, partsFilter) &&
      !takenProductIds.has(String(p.id)),
  );

  if (currentId && !base.some((b) => String(b.id) === currentId)) {
    const selected = (localProducts || []).find((p) => String(p.id) === currentId);
    if (selected) return [selected, ...base];
  }
  return base;
}

export function poVariantKey(size, color) {
  return `${String(size ?? "").trim().toLowerCase()}|${String(color ?? "").trim().toLowerCase()}`;
}

/** Show "Add same product" only on the last consecutive row for a product. */
export function poIsLastSameProductLine(items, lineKey) {
  const idx = (items || []).findIndex((row) => row.key === lineKey);
  if (idx < 0) return false;

  const productId = String(items[idx].product_id ?? "").trim();
  if (!productId) return false;

  const next = items[idx + 1];
  if (!next) return true;

  return String(next.product_id ?? "").trim() !== productId;
}

/** First consecutive row for a product — where total qty limit is set. */
export function poIsFirstSameProductLine(items, lineKey) {
  const idx = (items || []).findIndex((row) => row.key === lineKey);
  if (idx < 0) return false;

  const productId = String(items[idx].product_id ?? "").trim();
  if (!productId) return false;

  const prev = items[idx - 1];
  if (!prev) return true;

  return String(prev.product_id ?? "").trim() !== productId;
}

export function poProductQtyLimitsFromOrder(order) {
  const limits = {};
  for (const row of order?.product_limits || []) {
    const pid = String(row.product_id ?? "").trim();
    const max = Number(row.max_qty);
    if (pid && Number.isFinite(max) && max >= 1) {
      limits[pid] = String(Math.floor(max));
    }
  }
  return limits;
}

export function poMaxQtyForProduct(productQtyLimits, productId) {
  const raw = productQtyLimits?.[String(productId ?? "").trim()];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

export function poQtyUsedForProduct(items, productId, exceptLineKey = null) {
  const pid = String(productId ?? "").trim();
  if (!pid) return 0;

  let sum = 0;
  for (const row of items || []) {
    if (exceptLineKey && row.key === exceptLineKey) continue;
    if (String(row.product_id ?? "") !== pid) continue;
    sum += Math.max(0, Number(row.qty) || 0);
  }
  return sum;
}

export function poRemainingQtyForLine(items, lineKey, productQtyLimits) {
  const row = (items || []).find((r) => r.key === lineKey);
  if (!row?.product_id) return null;

  const limit = poMaxQtyForProduct(productQtyLimits, row.product_id);
  if (limit == null) return null;

  const usedOthers = poQtyUsedForProduct(items, row.product_id, lineKey);
  return Math.max(0, limit - usedOthers);
}

export function poMaxQtyForLineInput(items, lineKey, productQtyLimits) {
  const remaining = poRemainingQtyForLine(items, lineKey, productQtyLimits);
  return remaining == null ? null : remaining;
}

/** Products whose variant lines use more qty than the PO limit. */
export function poProductsOverQtyLimit(items, productById, productQtyLimits) {
  const issues = [];
  const seen = new Set();

  for (const row of items || []) {
    const pid = String(row.product_id ?? "").trim();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);

    const limit = poMaxQtyForProduct(productQtyLimits, pid);
    if (limit == null) continue;

    const used = poQtyUsedForProduct(items, pid);
    if (used > limit) {
      const product = productById?.get?.(pid);
      issues.push({
        productId: pid,
        name: product?.name || `Product #${pid}`,
        used,
        limit,
        overBy: used - limit,
      });
    }
  }

  return issues;
}

export function poPruneProductQtyLimits(items, productQtyLimits) {
  const activeIds = new Set();
  for (const row of items || []) {
    const pid = String(row.product_id ?? "").trim();
    if (pid) activeIds.add(pid);
  }

  const pruned = {};
  for (const [pid, val] of Object.entries(productQtyLimits || {})) {
    if (activeIds.has(pid)) pruned[pid] = val;
  }
  return pruned;
}

export function poProductQtyLimitPayload(productQtyLimits, items) {
  const activeIds = new Set();
  for (const row of items || []) {
    const pid = String(row.product_id ?? "").trim();
    if (pid) activeIds.add(pid);
  }

  return Array.from(activeIds)
    .map((productId) => {
      const maxQty = poMaxQtyForProduct(productQtyLimits, productId);
      if (maxQty == null) return null;
      return { product_id: Number(productId), max_qty: maxQty };
    })
    .filter(Boolean);
}

/** Size+color pairs already used on other lines for the same product. */
export function poTakenVariantKeysForProduct(items, productId, exceptLineKey) {
  const pid = String(productId ?? "").trim();
  if (!pid) return new Set();

  const taken = new Set();
  for (const row of items || []) {
    if (row.key === exceptLineKey) continue;
    if (String(row.product_id ?? "") !== pid) continue;
    const size = String(row.size ?? "").trim();
    const color = String(row.color ?? "").trim();
    if (size && color) taken.add(poVariantKey(size, color));
  }
  return taken;
}

/** Sizes that still have at least one unused color for this product on other lines. */
export function poAvailableSizesForLine(items, lineKey, product) {
  const row = (items || []).find((r) => r.key === lineKey) || {};
  const currentSize = String(row.size ?? "").trim();
  if (!product) return currentSize ? [currentSize] : [];

  const allSizes = parseProductSizes(product.sizes);
  const allColors = parseProductColors(product.colors);
  const taken = poTakenVariantKeysForProduct(items, product.id, lineKey);

  const available = allSizes.filter((size) =>
    allColors.some((color) => !taken.has(poVariantKey(size, color))),
  );

  if (currentSize && !available.includes(currentSize)) {
    return [currentSize, ...available];
  }
  return available;
}

/** Colors available for the current line (respects selected size and taken combos). */
export function poAvailableColorsForLine(items, lineKey, product) {
  const row = (items || []).find((r) => r.key === lineKey) || {};
  const currentSize = String(row.size ?? "").trim();
  const currentColor = String(row.color ?? "").trim();
  if (!product) return currentColor ? [currentColor] : [];

  const allSizes = parseProductSizes(product.sizes);
  const allColors = parseProductColors(product.colors);
  const taken = poTakenVariantKeysForProduct(items, product.id, lineKey);

  let available;
  if (!currentSize) {
    available = allColors.filter((color) =>
      allSizes.some((size) => !taken.has(poVariantKey(size, color))),
    );
  } else {
    available = allColors.filter((color) => !taken.has(poVariantKey(currentSize, color)));
  }

  if (currentColor && !available.includes(currentColor)) {
    return [currentColor, ...available];
  }
  return available;
}

export function poHasDuplicateVariantLines(items) {
  const seen = new Set();
  for (const row of items || []) {
    const pid = String(row.product_id ?? "").trim();
    const size = String(row.size ?? "").trim();
    const color = String(row.color ?? "").trim();
    if (!pid || !size || !color) continue;
    const key = `${pid}|${poVariantKey(size, color)}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Validate PO line items — product, size, color, and qty must be complete on every line. */
export function validatePoFormItems(items, productById, productQtyLimits = {}) {
  const lines = Array.isArray(items) ? items : [];
  const errors = [];
  if (!lines.length) {
    errors.push("Add at least one order line.");
    return errors;
  }

  lines.forEach((row, index) => {
    const line = index + 1;
    if (!row.product_id) {
      errors.push(`Line ${line}: select a product.`);
      return;
    }

    const product = productById?.get?.(String(row.product_id));
    const sizes = product ? parseProductSizes(product.sizes) : [];
    const colors = product ? parseProductColors(product.colors) : [];

    if (sizes.length === 0) {
      errors.push(`Line ${line}: product has no sizes — add sizes on the product first.`);
    } else if (!String(row.size ?? "").trim()) {
      errors.push(`Line ${line}: select a size.`);
    }

    if (colors.length === 0) {
      errors.push(`Line ${line}: product has no colors — add colors on the product first.`);
    } else if (!String(row.color ?? "").trim()) {
      errors.push(`Line ${line}: select a color.`);
    }

    const qty = Number(row.qty);
    if (!Number.isFinite(qty) || qty < 1) {
      errors.push(`Line ${line}: enter quantity (at least 1).`);
    }

    const cost = Number(row.cost_per_unit);
    if (String(row.cost_per_unit ?? "").trim() === "" || !Number.isFinite(cost)) {
      errors.push(`Line ${line}: enter cost per unit.`);
    } else if (cost < 0) {
      errors.push(`Line ${line}: cost per unit cannot be negative.`);
    }
  });

  if (poHasDuplicateVariantLines(lines)) {
    errors.push("Each product can only use the same size and color once. Pick a different size or color.");
  }

  const productIds = new Set();
  for (const row of lines) {
    const pid = String(row.product_id ?? "").trim();
    if (pid) productIds.add(pid);
  }

  for (const pid of productIds) {
    const limit = poMaxQtyForProduct(productQtyLimits, pid);
    const product = productById?.get?.(pid);
    const name = product?.name || `Product #${pid}`;

    if (limit == null) {
      errors.push(`${name}: set total qty limit for all sizes and colors.`);
      continue;
    }

    const total = poQtyUsedForProduct(lines, pid);
    if (total > limit) {
      errors.push(`${name}: total qty ${total} exceeds limit ${limit} across all variant lines.`);
    }
  }

  return errors;
}

export const PO_STATUS_LABELS = {
  draft: "Draft",
  pending: "Pending",
  received: "Received",
};

export const PO_LIST_SORT_OPTIONS = [
  { id: "order_date", label: "Order date" },
  { id: "po_number", label: "PO number" },
  { id: "supplier", label: "Supplier" },
  { id: "status", label: "Status" },
  { id: "total", label: "Total" },
  { id: "purchaser", label: "Created by" },
];

function poListSortValue(row, sortBy) {
  switch (sortBy) {
    case "po_number":
      return String(row.po_number ?? "").toLowerCase();
    case "supplier":
      return String(row.supplier?.name ?? "").toLowerCase();
    case "status":
      return String(row.status ?? "draft").toLowerCase();
    case "total":
      return Number(row.total_cost) || 0;
    case "purchaser":
      return String(row.purchaser ?? "").toLowerCase();
    case "order_date":
    default:
      return String(row.order_date ?? "");
  }
}

export function purchaseOrderMatchesListSearch(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.po_number,
    row.supplier?.name,
    row.supplier?.supplier_code,
    row.purchaser,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Client-side filter + sort for the admin PO table. */
export function filterAndSortPurchaseOrders(
  rows,
  { search, statusFilter, supplierFilter, sortBy, sortDir, fromDate, toDate },
) {
  let list = Array.isArray(rows) ? [...rows] : [];

  if (statusFilter && statusFilter !== "all") {
    list = list.filter((r) => (r.status || "draft") === statusFilter);
  }

  if (supplierFilter && supplierFilter !== "all") {
    list = list.filter((r) => String(r.supplier_id ?? r.supplier?.id ?? "") === String(supplierFilter));
  }

  if (String(fromDate || "").trim() || String(toDate || "").trim()) {
    list = list.filter((r) => rowMatchesDateRange(r.order_date, fromDate, toDate));
  }

  if (String(search || "").trim()) {
    list = list.filter((r) => purchaseOrderMatchesListSearch(r, search));
  }

  const dir = sortDir === "asc" ? 1 : -1;
  const key = sortBy || "order_date";
  list.sort((a, b) => {
    const va = poListSortValue(a, key);
    const vb = poListSortValue(b, key);
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * dir;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  return list;
}

export function poStatusBadgeClass(status) {
  const s = status || "draft";
  if (s === "received") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
  }
  if (s === "pending") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}
