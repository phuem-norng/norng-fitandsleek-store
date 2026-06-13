import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";
import api from "../../lib/api";
import { downloadCsv } from "../../lib/adminCsvExport.js";
import { toastSuccess } from "../../lib/swal";
import { useTheme } from "../../state/theme.jsx";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";
import PurchaseOrderDetailDrawer from "../../components/admin/PurchaseOrderDetailDrawer.jsx";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { useAdminSidebarPinned } from "../../lib/useAdminSidebarPinned.js";
import {
  filterAndSortStockReceived,
  sliceAdminListPage,
  STOCK_RECEIVED_LIST_SORT_OPTIONS,
} from "../../lib/adminListQuery.js";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import { formatPoMoney, lineMoney } from "../../lib/purchaseOrderHelpers.js";

const LINE_PREVIEW_COUNT = 3;
const TABLE_COL_COUNT = 11;

const RECEIVED_CSV_HEADERS = [
  "PO number",
  "Date received",
  "Supplier",
  "Products",
  "Total qty",
  "Total cost",
  "Est. revenue",
  "Status",
  "Received by",
];

function rowKey(row) {
  return row.purchase_order_id ?? row.id;
}

function receivedRowsToCsvData(dataRows) {
  return (Array.isArray(dataRows) ? dataRows : []).map((r) => [
    r.po_number ?? "",
    r.date_received ? formatDateIso(r.date_received).replace("—", "") : "",
    r.supplier_name ?? "",
    (Array.isArray(r.products) ? r.products : []).join("; "),
    Number(r.total_qty) || 0,
    Number(r.total_cost) || 0,
    Number(r.est_revenue) || 0,
    r.status ?? "",
    r.received_by ?? "",
  ]);
}

function stockRowCellBg({ rowIndex, isChecked, isExpanded }) {
  if (isChecked || isExpanded) return "";
  return rowIndex % 2 === 1 ? "bg-[#faf8f4] dark:bg-slate-900/30" : "bg-white dark:bg-slate-900";
}

function stockRowTdClass(tdBg, isChecked, isExpanded, extra = "") {
  const hover =
    isChecked || isExpanded ? "" : "group-hover:bg-slate-50/95 dark:group-hover:bg-slate-800/70";
  return `${extra} transition-colors ${tdBg} ${hover}`.trim();
}

function formatDateIso(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function marginPercent(cost, sell) {
  const s = Number(sell) || 0;
  const c = Number(cost) || 0;
  if (s <= 0) return null;
  return Math.round(((s - c) / s) * 100);
}

function shortProductLabel(name) {
  const n = String(name || "").trim();
  if (!n) return "—";
  const parts = n.split(/\s+/);
  if (parts.length <= 2) return n;
  return parts.slice(-2).join(" ");
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const received = normalized === "received";
  const pending = normalized === "pending";
  const draft = normalized === "draft";
  const label = status ? String(status).toLowerCase() : "—";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${received
          ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200"
          : pending
            ? "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200"
            : draft
              ? "border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600/50 dark:bg-slate-900/50 dark:text-slate-300"
              : "border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-600/50 dark:bg-slate-900/50 dark:text-slate-300"
        }`}
    >
      {received ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
      {label}
    </span>
  );
}

function ProductPills({ products }) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.slice(0, 4).map((name) => (
        <span
          key={name}
          className="inline-flex max-w-[8rem] truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          title={name}
        >
          {shortProductLabel(name)}
        </span>
      ))}
      {list.length > 4 ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">+{list.length - 4}</span>
      ) : null}
    </div>
  );
}

function ExpandedReceivePreview({ items, loading, onShowDetails, canShowDetails = true }) {
  if (loading) {
    return (
      <td colSpan={TABLE_COL_COUNT} className="bg-[#f7f5f0] px-6 py-8 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading line items…</p>
      </td>
    );
  }

  const preview = items.slice(0, LINE_PREVIEW_COUNT);
  const total = items.length;
  const thClass =
    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap";
  const tdClass = "px-4 py-2.5 whitespace-nowrap";

  return (
    <td colSpan={TABLE_COL_COUNT} className="bg-[#f7f5f0] p-0 dark:bg-slate-900/50">
      <div className="border-t border-slate-200/60 px-4 py-4 dark:border-slate-700/60">
        <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/40">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead className="bg-slate-50/95 dark:bg-slate-800/90">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={`${thClass} text-left`}>Batch ID</th>
                <th className={`${thClass} text-left`}>Product</th>
                <th className={`${thClass} text-center`}>Size</th>
                <th className={`${thClass} text-left`}>Color</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={`${thClass} text-right`}>Cost/unit</th>
                <th className={`${thClass} text-right`}>Sell/unit</th>
                <th className={`${thClass} text-right`}>Total cost</th>
                <th className={`${thClass} text-right`}>Est. revenue</th>
                <th className={`${thClass} text-right`}>Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {total === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No line items
                  </td>
                </tr>
              ) : (
                preview.map((item, idx) => {
                  const lineCost = Number(item.line_total_cost) || lineMoney(item.qty, item.cost_per_unit);
                  const lineSell = Number(item.line_subtotal_sell) || lineMoney(item.qty, item.sell_price);
                  const m = marginPercent(lineCost, lineSell);
                  return (
                    <tr key={item.id ?? idx} className="bg-white dark:bg-slate-950/20">
                      <td className={`${tdClass} font-mono text-xs text-slate-500 dark:text-slate-400`}>
                        BTH-{String(item.id ?? idx + 1).padStart(3, "0")}
                      </td>
                      <td className={`${tdClass} truncate font-medium text-slate-900 dark:text-slate-100`} title={item.product_name || undefined}>
                        {item.product_name || "—"}
                      </td>
                      <td className={`${tdClass} text-center`}>
                        {item.size ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                            {item.size}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={tdClass}>
                        {item.color ? (
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium dark:border-slate-600 dark:bg-slate-800">
                            {item.color}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{item.qty ?? 0}</td>
                      <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                        {formatPoMoney(item.cost_per_unit)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                        {formatPoMoney(item.sell_price)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums font-medium text-blue-600 dark:text-blue-400`}>
                        {formatPoMoney(lineCost)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-slate-700 dark:text-slate-200`}>
                        {formatPoMoney(lineSell)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400`}>
                        {m != null ? `${m}%` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && canShowDetails ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowDetails();
              }}
              className="rounded-lg border border-[color:var(--admin-primary)]/30 bg-white px-4 py-1.5 text-xs font-semibold text-[color:var(--admin-primary)] shadow-sm transition hover:bg-[rgba(var(--admin-primary-rgb,59,130,246),0.06)] dark:border-[color:var(--admin-primary)]/40 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Show Details
            </button>
          </div>
        ) : null}
      </div>
    </td>
  );
}

const COLS = [
  { key: "select", label: "", w: "w-10" },
  { key: "expand", label: "", w: "w-10" },
  { key: "po", label: "PO number", w: "w-[148px]" },
  { key: "date", label: "Date received", w: "w-[120px]" },
  { key: "supplier", label: "Supplier", w: "min-w-[160px]" },
  { key: "products", label: "Products", w: "min-w-[140px]" },
  { key: "qty", label: "Total qty", w: "w-[88px]", align: "right" },
  { key: "cost", label: "Total cost", w: "w-[100px]", align: "right" },
  { key: "revenue", label: "Est. revenue", w: "w-[110px]", align: "right" },
  { key: "status", label: "Status", w: "w-[110px]" },
  { key: "by", label: "Received by", w: "min-w-[120px]" },
];

export default function StockReceived() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewStockReceived = can("stock_received", "view");
  const canReceiveStock = can("stock_received", "create");
  const canViewPoDetail =
    canViewStockReceived || can("purchase_orders", "view");
  const canOpenPurchaseOrders =
    can("purchase_orders", "view") || can("purchase_orders", "create");
  const canAddViaPurchaseOrder = canReceiveStock && canOpenPurchaseOrders;
  const { primaryColor, mode } = useTheme();
  const accentColor = primaryColor;
  const accentIsWhite = (accentColor || "").toUpperCase() === "#FFFFFF";

  const sidebarPinned = useAdminSidebarPinned();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useAdminUiPreference("stockReceived.list.search", "");
  const [statusFilter, setStatusFilter] = useAdminUiPreference("stockReceived.list.statusFilter", "all");
  const [supplierFilter, setSupplierFilter] = useAdminUiPreference("stockReceived.list.supplierFilter", "all");
  const [sortBy, setSortBy] = useAdminUiPreference("stockReceived.list.sortBy", "date_received");
  const [fromDate, setFromDate] = useAdminUiPreference("stockReceived.list.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("stockReceived.list.toDate", "");
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const pageSelectRef = useRef(null);

  const load = useCallback(async () => {
    if (!canViewStockReceived) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const params = { per_page: 200 };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const { data } = await api.get("/admin/stock-received", { params });
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load stock received.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, canViewStockReceived]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  const supplierFilterOptions = useMemo(() => {
    const names = new Set();
    for (const row of rows) {
      const name = String(row.supplier_name || "").trim();
      if (name) names.add(name);
    }
    return [{ id: "all", label: "All suppliers" }, ...Array.from(names).sort().map((name) => ({ id: name, label: name }))];
  }, [rows]);

  const stockReceivedStatusOptions = [
    { id: "all", label: "All statuses" },
    { id: "draft", label: "Draft" },
    { id: "pending", label: "Pending" },
    { id: "received", label: "Received" },
  ];

  const filteredRows = useMemo(
    () =>
      filterAndSortStockReceived(rows, {
        search,
        statusFilter,
        supplierFilter,
        sortBy,
        sortDir: "desc",
      }),
    [rows, search, statusFilter, supplierFilter, sortBy],
  );

  const listPage = useMemo(() => sliceAdminListPage(filteredRows, page), [filteredRows, page]);
  const { rows: paginatedRows, lastPage, usePagination } = listPage;

  const hasDateRangeFilter = Boolean(fromDate || toDate);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
    setSelectedIds(new Set());
  }, [search, statusFilter, supplierFilter, sortBy, fromDate, toDate]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  useEffect(() => {
    setExpandedId(null);
  }, [page]);

  const clearListFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setFromDate("");
    setToDate("");
    setSelectedIds(new Set());
  };

  const pageIds = useMemo(() => paginatedRows.map((r) => rowKey(r)), [paginatedRows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(rowKey(r)));

  const selectedRows = useMemo(
    () => filteredRows.filter((r) => selectedIds.has(rowKey(r))),
    [filteredRows, selectedIds],
  );

  const exportTargetRows = selectedIds.size > 0 ? selectedRows : filteredRows;

  useEffect(() => {
    if (pageSelectRef.current) {
      pageSelectRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const togglePageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRowSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFilteredSelection = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredRows.map((r) => rowKey(r))));
  };

  const exportCsv = () => {
    if (!canViewStockReceived || exportTargetRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = selectedIds.size > 0 ? "selected" : "all";
    downloadCsv({
      filename: `stock-received-${suffix}-${stamp}.csv`,
      headers: RECEIVED_CSV_HEADERS,
      rows: receivedRowsToCsvData(exportTargetRows),
    });
    void toastSuccess({
      enText:
        selectedIds.size > 0
          ? `Exported ${exportTargetRows.length} selected receipt${exportTargetRows.length !== 1 ? "s" : ""} to CSV.`
          : `Exported all ${exportTargetRows.length} matching receipt${exportTargetRows.length !== 1 ? "s" : ""} to CSV.`,
    });
  };

  const loadDetail = async (rowId) => {
    if (!canViewPoDetail) return null;
    if (detailCache[rowId]) return detailCache[rowId];
    setDetailLoading(rowId);
    try {
      const { data } = await api.get(`/admin/purchase-orders/${rowId}`);
      const order = data?.data ?? data;
      setDetailCache((c) => ({ ...c, [rowId]: order }));
      return order;
    } catch {
      return null;
    } finally {
      setDetailLoading(null);
    }
  };

  const toggleExpand = async (row, e) => {
    if (e?.target?.closest?.("a, button, input, label")) return;
    if (!canViewPoDetail) return;
    const id = rowKey(row);
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailCache[id]) await loadDetail(id);
  };

  const openViewPo = async (row) => {
    if (!canViewPoDetail) return;
    const id = rowKey(row);
    let order = detailCache[id];
    if (!order) order = await loadDetail(id);
    setViewOrder(order);
  };

  const handleOrderUpdated = (updated) => {
    if (!updated?.id) return;
    setViewOrder(updated);
    setDetailCache((cache) => ({ ...cache, [updated.id]: updated }));
    void load();
  };

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => ({
          qty: acc.qty + (Number(r.total_qty) || 0),
          cost: acc.cost + (Number(r.total_cost) || 0),
          revenue: acc.revenue + (Number(r.est_revenue) || 0),
        }),
        { qty: 0, cost: 0, revenue: 0 },
      ),
    [filteredRows],
  );

  if (!permissionsReady || (loading && rows.length === 0)) {
    return <AdminContentSkeleton rows={8} />;
  }

  if (!canViewStockReceived) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Stock Received</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Incoming stock from purchase orders. Click a row to expand line items below.
          </p>
        </div>
        {canAddViaPurchaseOrder ? (
        <Link
          to="/admin/purchase-orders"
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${accentIsWhite ? "border border-slate-300 text-slate-900" : "text-white"
            }`}
          style={{ backgroundColor: accentIsWhite ? "#FFFFFF" : accentColor }}
        >
          Add via purchase order
        </Link>
        ) : null}
      </div>

      {err ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          <span className="flex-1">{err}</span>
          <button type="button" onClick={load} className="font-semibold hover:underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">All receipts</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={exportTargetRows.length === 0 || loading}
                title={
                  selectedIds.size > 0
                    ? `Export ${selectedIds.size} selected receipt(s)`
                    : `Export all ${filteredRows.length} receipt(s) matching current filters`
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {selectedIds.size > 0
                  ? `Export CSV (${selectedIds.size})`
                  : "Export CSV (all)"}
              </button>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
          <AdminListQueryToolbar
            singleRow
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={sidebarPinned ? "Search PO, supplier…" : "Search PO, supplier, product…"}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusOptions={stockReceivedStatusOptions}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
            supplierOptions={supplierFilterOptions}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOptions={STOCK_RECEIVED_LIST_SORT_OPTIONS}
            showSortDir={false}
            showingCount={usePagination ? paginatedRows.length : filteredRows.length}
            totalCount={filteredRows.length}
            hasDateRangeFilter={hasDateRangeFilter}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            onClearFilters={clearListFilters}
          />
          {filteredRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-700/80">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                <input
                  ref={pageSelectRef}
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-[color:var(--admin-primary)] dark:border-slate-600"
                  aria-label="Select all receipts on this page"
                />
                Select page
              </label>
              <button
                type="button"
                onClick={toggleAllFilteredSelection}
                className="font-semibold text-[color:var(--admin-primary)] hover:underline"
              >
                {allFilteredSelected ? "Clear all matching" : `Select all matching (${filteredRows.length})`}
              </button>
              <span className="text-slate-500 dark:text-slate-400">
                Selected:{" "}
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{selectedIds.size}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium text-slate-700 dark:text-slate-200">No stock received yet</p>
            {canAddViaPurchaseOrder ? (
            <Link
              to="/admin/purchase-orders"
              className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Create a purchase order
            </Link>
            ) : null}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">No receipts match your filters</p>
            {hasDateRangeFilter ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Only receipts within the selected date range are listed. Clear dates to see all receipts.
              </p>
            ) : null}
            <button
              type="button"
              onClick={clearListFilters}
              className="mt-2 font-semibold text-[color:var(--admin-primary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-stock-inventory-table w-full min-w-[1200px] table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-10" />
                  <col style={{ width: "148px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "180px" }} />
                  <col style={{ width: "160px" }} />
                  <col style={{ width: "88px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "130px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
                    {COLS.map((col) => (
                      <th
                        key={col.key}
                        className={`px-3 py-3 ${col.align === "right" ? "text-right" : "text-left"} ${col.w}`}
                      >
                        {col.key === "select" ? <span className="sr-only">Select</span> : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedRows.map((row, rowIndex) => {
                    const id = rowKey(row);
                    const isExpanded = expandedId === id;
                    const isChecked = selectedIds.has(id);
                    const isRowActive = isExpanded;
                    const tdBg = stockRowCellBg({ rowIndex, isChecked, isExpanded: isRowActive });
                    const rowHighlighted = isChecked || isRowActive;
                    const orderDetail = detailCache[id];
                    const items = orderDetail?.items ?? [];

                    return (
                      <React.Fragment key={id}>
                        <tr
                          data-selected={isChecked ? "" : undefined}
                          data-detail-open={isRowActive ? "" : undefined}
                          className={`group border-b transition-colors dark:border-slate-800/60 ${rowHighlighted ? "border-b-slate-200 dark:border-slate-700" : "border-slate-100"
                            } ${canViewPoDetail ? "cursor-pointer" : ""}`}
                          onClick={canViewPoDetail ? (e) => toggleExpand(row, e) : undefined}
                          aria-selected={isChecked}
                          aria-expanded={isExpanded}
                        >
                          <td
                            className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-2 py-3.5 text-center")}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRowSelection(id)}
                              className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-[color:var(--admin-primary)] dark:border-slate-600"
                              aria-label={`Select ${row.po_number || "receipt"}`}
                            />
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-2 py-3.5 text-slate-400")}>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            )}
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                            <span className="inline-block rounded-md border border-slate-200 bg-slate-100/90 px-2 py-1 font-mono text-xs font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                              {row.po_number || "—"}
                            </span>
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300")}>
                            {formatDateIso(row.date_received)}
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                            <span className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                              {row.supplier_name || "—"}
                            </span>
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                            <ProductPills products={row.products} />
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100")}>
                            {row.total_qty ?? 0}
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400")}>
                            {formatPoMoney(row.total_cost)}
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 text-right tabular-nums text-slate-800 dark:text-slate-100")}>
                            {formatPoMoney(row.est_revenue)}
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                            <StatusBadge status={row.status} />
                          </td>
                          <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 text-slate-700 dark:text-slate-200")}>
                            {row.received_by || "—"}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <ExpandedReceivePreview
                              items={items}
                              loading={detailLoading === id}
                              canShowDetails={canViewPoDetail}
                              onShowDetails={() => openViewPo(row)}
                            />
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                    <td className="px-3 py-3" colSpan={6}>
                      {filteredRows.length} record{filteredRows.length !== 1 ? "s" : ""}
                      {filteredRows.length !== rows.length ? ` (of ${rows.length})` : ""}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">{totals.qty}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {formatPoMoney(totals.cost)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {formatPoMoney(totals.revenue)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <AdminListPaginationBar
              page={page}
              lastPage={lastPage}
              total={filteredRows.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <PurchaseOrderDetailDrawer
        order={viewOrder}
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        onUpdated={handleOrderUpdated}
        allowStatusActions={false}
      />
    </div>
  );
}
