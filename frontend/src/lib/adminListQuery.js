/** Rows per page when list count reaches {@link ADMIN_LIST_PAGINATE_AT}. */
export const ADMIN_LIST_PAGE_SIZE = 15;

/** Below this count, show every row with no Previous/Next bar. */
export const ADMIN_LIST_PAGINATE_AT = 16;

/** SKU detail tables (Inventory Lots, Movements) — max visible rows per page. */
export const ADMIN_DETAIL_TABLE_PAGE_SIZE = 5;

export function sliceDetailTablePage(items, page) {
  const list = Array.isArray(items) ? items : [];
  const lastPage = Math.max(1, Math.ceil(list.length / ADMIN_DETAIL_TABLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), lastPage);
  const start = (safePage - 1) * ADMIN_DETAIL_TABLE_PAGE_SIZE;

  return {
    rows: list.slice(start, start + ADMIN_DETAIL_TABLE_PAGE_SIZE),
    lastPage,
    page: safePage,
    total: list.length,
    usePagination: list.length > ADMIN_DETAIL_TABLE_PAGE_SIZE,
  };
}

/** Page numbers for compact pagination: 1 2 3 4 5 … 10 */
export function buildPaginationPages(currentPage, lastPage) {
  if (lastPage <= 1) return [1];
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", lastPage];
  }

  if (currentPage >= lastPage - 3) {
    return ["ellipsis", lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage];
  }

  return ["ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", lastPage];
}

export function sliceAdminListPage(items, page) {
  const list = Array.isArray(items) ? items : [];
  if (list.length < ADMIN_LIST_PAGINATE_AT) {
    return { rows: list, lastPage: 1, usePagination: false };
  }
  const lastPage = Math.max(1, Math.ceil(list.length / ADMIN_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), lastPage);
  const start = (safePage - 1) * ADMIN_LIST_PAGE_SIZE;
  return {
    rows: list.slice(start, start + ADMIN_LIST_PAGE_SIZE),
    lastPage,
    usePagination: true,
    page: safePage,
  };
}

/** Shared admin list toolbar field styles (PO, Suppliers, Stock pages). */
export const ADMIN_LIST_FIELD_CLASS =
  "h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.18)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-[rgba(var(--admin-primary-rgb,59,130,246),0.25)]";

function compareValues(va, vb, dir) {
  const d = dir === "asc" ? 1 : -1;
  if (typeof va === "number" && typeof vb === "number") {
    return (va - vb) * d;
  }
  const a = String(va ?? "").toLowerCase();
  const b = String(vb ?? "").toLowerCase();
  if (a < b) return -1 * d;
  if (a > b) return 1 * d;
  return 0;
}

function sortRows(rows, sortBy, sortDir, getValue) {
  const list = [...rows];
  list.sort((a, b) => {
    const c = compareValues(getValue(a, sortBy), getValue(b, sortBy), sortDir);
    if (c !== 0) return c;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
  return list;
}

export const SUPPLIER_LIST_SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "supplier_code", label: "Supplier ID" },
  { id: "email", label: "Email" },
  { id: "city", label: "City" },
  { id: "status", label: "Status" },
];

export function filterAndSortSuppliers(rows, { search, statusFilter, sortBy, sortDir }) {
  let list = Array.isArray(rows) ? [...rows] : [];
  const q = String(search || "").trim().toLowerCase();

  if (statusFilter === "active") {
    list = list.filter((s) => s.is_active !== false);
  } else if (statusFilter === "inactive") {
    list = list.filter((s) => s.is_active === false);
  }

  if (q) {
    list = list.filter((s) => {
      const hay = [
        s.supplier_code,
        s.name,
        s.contact_person,
        s.email,
        s.phone,
        s.city,
        s.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return sortRows(list, sortBy || "name", sortDir, (row, key) => {
    switch (key) {
      case "supplier_code":
        return String(row.supplier_code ?? "").toLowerCase();
      case "email":
        return String(row.email ?? "").toLowerCase();
      case "city":
        return [row.city, row.country].filter(Boolean).join(" ").toLowerCase();
      case "status":
        return row.is_active === false ? "inactive" : "active";
      case "name":
      default:
        return String(row.name ?? "").toLowerCase();
    }
  });
}

export const STOCK_RECEIVED_LIST_SORT_OPTIONS = [
  { id: "date_received", label: "Date received" },
  { id: "po_number", label: "PO number" },
  { id: "supplier", label: "Supplier" },
  { id: "total_qty", label: "Total qty" },
  { id: "total_cost", label: "Total cost" },
  { id: "est_revenue", label: "Est. revenue" },
  { id: "status", label: "Status" },
];

export function stockReceivedMatchesSearch(row, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const products = Array.isArray(row.products) ? row.products.join(" ") : String(row.products_label || "");
  const hay = [
    row.po_number,
    row.supplier_name,
    row.supplier_code,
    row.received_by,
    row.status,
    products,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterAndSortStockReceived(rows, { search, statusFilter, supplierFilter, sortBy, sortDir }) {
  let list = Array.isArray(rows) ? [...rows] : [];

  if (statusFilter && statusFilter !== "all") {
    const want = statusFilter.toLowerCase();
    list = list.filter((r) => String(r.status || "").toLowerCase() === want);
  }

  if (supplierFilter && supplierFilter !== "all") {
    list = list.filter(
      (r) =>
        String(r.supplier_name || "").trim() === supplierFilter ||
        String(r.supplier_code || "").trim() === supplierFilter,
    );
  }

  if (String(search || "").trim()) {
    list = list.filter((r) => stockReceivedMatchesSearch(r, search));
  }

  return sortRows(list, sortBy || "date_received", sortDir, (row, key) => {
    switch (key) {
      case "po_number":
        return String(row.po_number ?? "").toLowerCase();
      case "supplier":
        return String(row.supplier_name ?? "").toLowerCase();
      case "total_qty":
        return Number(row.total_qty) || 0;
      case "total_cost":
        return Number(row.total_cost) || 0;
      case "est_revenue":
        return Number(row.est_revenue) || 0;
      case "status":
        return String(row.status ?? "").toLowerCase();
      case "date_received":
      default:
        return String(row.date_received ?? "");
    }
  });
}

export const STOCK_INVENTORY_SORT_OPTIONS = [
  { id: "name", label: "Name" },
  { id: "date_in", label: "Date" },
  { id: "stock", label: "Stock" },
  { id: "sku", label: "SKU" },
];

export const STOCK_INVENTORY_STOCK_FILTER_OPTIONS = [
  { id: "all", label: "All stock levels" },
  { id: "in", label: "In stock" },
  { id: "low", label: "Low stock" },
  { id: "out", label: "Out of stock" },
];

/** SKU-level Stock & Inventory list (`/admin/stock-inventory`). */
export const SKU_STOCK_LIST_SORT_OPTIONS = [
  { id: "sku", label: "SKU" },
  { id: "product", label: "Product" },
  { id: "activity_date", label: "Date" },
  { id: "in_stock", label: "In stock" },
  { id: "stock_value", label: "Stock value" },
  { id: "wac_cost", label: "WAC cost" },
  { id: "status", label: "Status" },
];

export function skuStockListBucket(row) {
  const s = String(row?.status ?? "").toLowerCase();
  if (s.includes("out")) return "out";
  if (s.includes("low")) return "low";
  return "in";
}

export function filterAndSortSkuStockList(rows, { search, stockFilter, sortBy, sortDir }) {
  let list = Array.isArray(rows) ? [...rows] : [];
  const q = String(search || "").trim().toLowerCase();

  if (stockFilter && stockFilter !== "all") {
    list = list.filter((r) => skuStockListBucket(r) === stockFilter);
  }

  if (q) {
    list = list.filter((r) => {
      const hay = [r.sku, r.product_name, r.size, r.color].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  return sortRows(list, sortBy || "sku", sortDir || "asc", (row, key) => {
    switch (key) {
      case "product":
        return String(row.product_name ?? "").toLowerCase();
      case "activity_date":
        return String(row.activity_date ?? "");
      case "in_stock":
        return Number(row.in_stock) || 0;
      case "stock_value":
        return Number(row.stock_value) || 0;
      case "wac_cost":
        return Number(row.wac_cost) || 0;
      case "status":
        return String(row.status ?? "").toLowerCase();
      case "sku":
      default:
        return String(row.sku ?? "").toLowerCase();
    }
  });
}

/** Classify row for quick stock filter (inventory + received log). */
export function stockInventoryQuickStockBucket(row, getStockQty) {
  if (!row?.manage_stock) return "in";
  const qty = getStockQty?.(row);
  if (qty == null) return "in";
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return "out";
  const min = Number(row.min_stock ?? row.min_qty ?? 1);
  const threshold = Number.isFinite(min) && min > 0 ? min : 1;
  if (n <= threshold) return "low";
  return "in";
}

export function sortStockInventoryRows(list, { sortBy, sortDir, getStockQty, isReceivedLogPage }) {
  return sortRows(list, sortBy || (isReceivedLogPage ? "date_in" : "name"), sortDir, (row, key) => {
    switch (key) {
      case "date_in":
        return String(row.date_in ?? row.created_at ?? "");
      case "stock": {
        const q = getStockQty?.(row);
        return q == null ? -1 : Number(q) || 0;
      }
      case "sku":
        return String(row.sku ?? "").toLowerCase();
      case "name":
      default:
        return String(row.name ?? "").toLowerCase();
    }
  });
}

export const PAYMENT_STATUS_FILTER_OPTIONS = [
  { id: "all", label: "All statuses" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

export const PAYMENT_METHOD_FILTER_OPTIONS = [
  { id: "all", label: "All methods" },
  { id: "bakong_khqr", label: "Bakong KHQR" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank transfer" },
  { id: "wallet", label: "Wallet" },
  { id: "crypto", label: "Crypto" },
];

export function rowMatchesDateRange(isoDate, fromDate, toDate) {
  const from = String(fromDate || "").trim();
  const to = String(toDate || "").trim();
  if (!from && !to) return true;
  const d = String(isoDate || "").slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function rowMatchesSearch(values, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return true;
  const hay = values
    .filter((v) => v != null && v !== "")
    .map((v) => String(v).toLowerCase())
    .join(" ");
  return hay.includes(q);
}

export function adminListFiltersActive({
  search,
  statusFilter,
  supplierFilter,
  stockFilter,
  methodFilter,
  hasDateRangeFilter,
}) {
  return (
    Boolean(String(search || "").trim()) ||
    (statusFilter && statusFilter !== "all") ||
    (supplierFilter && supplierFilter !== "all") ||
    (stockFilter && stockFilter !== "all") ||
    (methodFilter && methodFilter !== "all") ||
    Boolean(hasDateRangeFilter)
  );
}
