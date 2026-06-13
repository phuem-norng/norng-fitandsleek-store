import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Download, Pencil } from "lucide-react";
import api from "../../lib/api";
import { downloadCsv } from "../../lib/adminCsvExport.js";
import { toastSuccess } from "../../lib/swal";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";
import StockSkuDetailModal from "../../components/admin/StockSkuDetailModal.jsx";
import MovementDetailsButton from "../../components/admin/MovementDetailsButton.jsx";
import MovementRowDetailModal from "../../components/admin/MovementRowDetailModal.jsx";
import { alignMovementRows } from "../../lib/movementRows.js";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import {
  STOCK_INVENTORY_STOCK_FILTER_OPTIONS,
  SKU_STOCK_LIST_SORT_OPTIONS,
  filterAndSortSkuStockList,
  sliceAdminListPage,
} from "../../lib/adminListQuery.js";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { matchesStockVariantRow, normalizeVariantPart } from "../../lib/inventoryLotHelpers.js";

const LOW_STOCK_MAX = 5;
const MOVEMENT_PREVIEW_COUNT = 3;
const TABLE_COL_COUNT = 13;

function formatDateIso(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function stockStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("out")) {
    return {
      label: status,
      bar: "bg-slate-300 dark:bg-slate-600",
      pill: "border-red-200/90 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200",
    };
  }
  if (s.includes("low")) {
    return {
      label: status,
      bar: "bg-amber-400",
      pill: "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200",
    };
  }
  return {
    label: status || "In stock",
    bar: "bg-emerald-500",
    pill: "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200",
  };
}

function InStockCell({ qty, maxHint = 20 }) {
  const n = Math.max(0, Number(qty) || 0);
  const pct = maxHint > 0 ? Math.min(100, (n / maxHint) * 100) : 0;
  const meta = stockStatusMeta(n <= 0 ? "Out of stock" : n <= LOW_STOCK_MAX ? "Low stock" : "In stock");

  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="h-1.5 w-[4.5rem] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="min-w-[1.5rem] text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{n}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = stockStatusMeta(status);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.pill}`}>
      {meta.label}
    </span>
  );
}

/** Table rows need bg on cells — styling `<tr>` alone looks uneven in browsers. */
function stockRowCellBg({ rowIndex, isChecked, isDetailOpen }) {
  if (isChecked || isDetailOpen) return "";
  return rowIndex % 2 === 1 ? "bg-[#faf8f4] dark:bg-slate-900/30" : "bg-white dark:bg-slate-900";
}

function MovementTypeCell({ type }) {
  const isPurchase = String(type).toLowerCase() === "purchase";
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
      <span
        className={`h-1.5 w-1.5 rounded-full ${isPurchase ? "bg-emerald-500" : "bg-red-500"}`}
        aria-hidden
      />
      {type}
    </span>
  );
}

function ExpandedMovementsPreview({ movements, loading, hasDateRange, onShowDetails, skuRow }) {
  const [movementDetailRow, setMovementDetailRow] = useState(null);
  const alignedMovements = alignMovementRows(movements);
  if (loading) {
    return (
      <td colSpan={TABLE_COL_COUNT} className="bg-[#f7f5f0] px-6 py-8 dark:bg-slate-900/50">
        <p className="text-sm text-slate-500">Loading movement history…</p>
      </td>
    );
  }

  const preview = alignedMovements.slice(0, MOVEMENT_PREVIEW_COUNT);
  const total = alignedMovements.length;
  const thClass =
    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap";
  const tdClass = "px-4 py-2.5 whitespace-nowrap";

  return (
    <td colSpan={TABLE_COL_COUNT} className="bg-[#f7f5f0] p-0 dark:bg-slate-900/50">
      <div className="border-t border-slate-200/60 px-4 py-4 dark:border-slate-700/60">
        <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/40">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50/95 dark:bg-slate-800/90">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={`${thClass} text-left`}>Date</th>
                <th className={`${thClass} text-left`}>Type</th>
                <th className={`${thClass} text-right text-emerald-700 dark:text-emerald-400`}>Qty in</th>
                <th className={`${thClass} text-right text-red-600 dark:text-red-400`}>Qty out</th>
                <th className={`${thClass} text-right`}>Cost/unit</th>
                <th className={`${thClass} text-right`}>Sell/unit</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={`${thClass} w-0 max-w-[11rem] text-left`}>Ref</th>
                <th className={`${thClass} w-14 px-2 text-center`}>Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {total === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                    {hasDateRange
                      ? "No purchase or sale movements in the selected date range."
                      : "No movements recorded for this SKU yet."}
                  </td>
                </tr>
              ) : (
                preview.map((m, idx) => (
                  <tr key={`${m.date}-${m.type}-${m.ref}-${idx}`} className="bg-white dark:bg-slate-950/20">
                    <td className={`${tdClass} tabular-nums text-slate-600 dark:text-slate-300`}>
                      {formatDateIso(m.date)}
                    </td>
                    <td className={tdClass}>
                      <MovementTypeCell type={m.type} />
                    </td>
                    <td className={`${tdClass} text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400`}>
                      {m.qty_in != null ? `+${m.qty_in}` : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums font-medium text-red-600 dark:text-red-400`}>
                      {m.qty_out != null ? `-${m.qty_out}` : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                      {m.cost_per_unit != null ? formatPoMoney(m.cost_per_unit) : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                      {m.sell_per_unit != null ? formatPoMoney(m.sell_per_unit) : "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums font-bold text-slate-900 dark:text-slate-100`}>
                      {m.balance ?? "—"}
                    </td>
                    <td
                      className={`${tdClass} w-0 max-w-[11rem] truncate font-mono text-xs text-slate-500 dark:text-slate-400`}
                      title={m.ref || undefined}
                    >
                      {m.ref || "—"}
                    </td>
                    <td className={`${tdClass} w-14 px-2 text-center`}>
                      <MovementDetailsButton compact onClick={() => setMovementDetailRow(m)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 ? (
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
      <MovementRowDetailModal
        open={Boolean(movementDetailRow)}
        onClose={() => setMovementDetailRow(null)}
        skuRow={skuRow}
        movement={movementDetailRow}
      />
    </td>
  );
}

function stockRowTdClass(tdBg, isChecked, isDetailOpen, extra = "") {
  const hover =
    isChecked || isDetailOpen
      ? ""
      : "group-hover:bg-slate-50/95 dark:group-hover:bg-slate-800/70";
  return `${extra} transition-colors ${tdBg} ${hover}`.trim();
}

const STOCK_CSV_HEADERS = [
  "SKU",
  "Product",
  "Size",
  "Color",
  "Date",
  "In stock",
  "WAC cost",
  "Sell price",
  "Stock value",
  "Status",
];

function stockRowsToCsvData(dataRows) {
  return (Array.isArray(dataRows) ? dataRows : []).map((r) => [
    r.sku ?? "",
    r.product_name ?? "",
    r.size ?? "",
    r.color ?? "",
    r.activity_date ? formatDateIso(r.activity_date).replace("—", "") : "",
    Math.max(0, Number(r.in_stock) || 0),
    Number(r.wac_cost) || 0,
    Number(r.sell_price) || 0,
    Number(r.stock_value) || 0,
    r.status ?? "",
  ]);
}

function parseSkuDetailOpenRequest(searchParams) {
  if (searchParams.get("open") !== "sku") return null;
  const productId = searchParams.get("product_id");
  if (!productId) return null;
  const section = searchParams.get("section") || searchParams.get("tab") || "lots";
  return {
    productId,
    size: normalizeVariantPart(searchParams.get("size")),
    color: normalizeVariantPart(searchParams.get("color")),
    section: ["overview", "lots", "movements"].includes(section) ? section : "lots",
  };
}

export default function StockInventoryList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewStock = can("stock", "view");
  const canEditStock = can("stock", "edit");
  const canEditProducts = can("products", "edit");
  const canViewPurchaseOrders =
    can("purchase_orders", "view") || can("stock_received", "view") || can("stock_received", "create");
  const canViewProducts = can("products", "view");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useAdminUiPreference("stockInventorySku.list.search", "");
  const [stockFilter, setStockFilter] = useAdminUiPreference("stockInventorySku.list.stockFilter", "all");
  const [sortBy, setSortBy] = useAdminUiPreference("stockInventorySku.list.sortBy", "sku");
  const [sortDir, setSortDir] = useAdminUiPreference("stockInventorySku.list.sortDir", "asc");
  const [fromDate, setFromDate] = useAdminUiPreference("stockInventorySku.list.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("stockInventorySku.list.toDate", "");
  /** Inline expand below the row (preview of movements). */
  const [expandedId, setExpandedId] = useState(null);
  /** Full SKU Details sheet — opened via Show in the expanded panel. */
  const [detailRow, setDetailRow] = useState(null);
  const [detailInitialSection, setDetailInitialSection] = useState("overview");
  const [pendingSkuOpen, setPendingSkuOpen] = useState(null);
  const skuOpenWithoutDatesRef = useRef(false);
  const [movementFromDate, setMovementFromDate] = useAdminUiPreference(
    "stockInventorySku.detail.movementFromDate",
    "",
  );
  const [movementToDate, setMovementToDate] = useAdminUiPreference(
    "stockInventorySku.detail.movementToDate",
    "",
  );
  const [movementSearch, setMovementSearch] = useAdminUiPreference(
    "stockInventorySku.detail.movementSearch",
    "",
  );
  const [lotsSearch, setLotsSearch] = useAdminUiPreference("stockInventorySku.detail.lotsSearch", "");
  const [lotsFromDate, setLotsFromDate] = useAdminUiPreference("stockInventorySku.detail.lotsFromDate", "");
  const [lotsToDate, setLotsToDate] = useAdminUiPreference("stockInventorySku.detail.lotsToDate", "");
  const [movementsCache, setMovementsCache] = useState({});
  const [movementsLoading, setMovementsLoading] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [searchDebounced, setSearchDebounced] = useState(search);
  const pageSelectRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!canViewStock) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const params = {};
      const q = String(searchDebounced || "").trim();
      if (q) params.search = q;
      if (!skuOpenWithoutDatesRef.current) {
        if (fromDate) params.from_date = fromDate;
        if (toDate) params.to_date = toDate;
      }
      const { data } = await api.get("/admin/stock-inventory", { params });
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load stock inventory.");
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, fromDate, toDate, canViewStock]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  const displayRows = useMemo(
    () => filterAndSortSkuStockList(rows, { search: "", stockFilter, sortBy, sortDir }),
    [rows, stockFilter, sortBy, sortDir],
  );

  const listPage = useMemo(() => sliceAdminListPage(displayRows, page), [displayRows, page]);
  const { rows: paginatedRows, lastPage, usePagination } = listPage;

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setExpandedId(null);
  }, [search, stockFilter, sortBy, sortDir, fromDate, toDate]);

  const selectedRows = useMemo(
    () => displayRows.filter((r) => selectedIds.has(r.id)),
    [displayRows, selectedIds],
  );

  const exportTargetRows = selectedIds.size > 0 ? selectedRows : displayRows;

  const pageIds = useMemo(() => paginatedRows.map((r) => r.id), [paginatedRows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const allFilteredSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));

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
    setSelectedIds(new Set(displayRows.map((r) => r.id)));
  };

  useEffect(() => {
    if (!detailRow) return;
    const match = displayRows.find((r) => r.id === detailRow.id);
    if (!match) return;
    const changed =
      match.in_stock !== detailRow.in_stock ||
      match.stock_value !== detailRow.stock_value ||
      match.activity_date !== detailRow.activity_date ||
      match.status !== detailRow.status ||
      match.wac_cost !== detailRow.wac_cost ||
      match.sell_price !== detailRow.sell_price;
    if (changed) setDetailRow(match);
  }, [displayRows, detailRow]);

  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const displayMeta = useMemo(
    () => ({
      sku_count: displayRows.length,
      total_units: displayRows.reduce((sum, r) => sum + (Number(r.in_stock) || 0), 0),
      total_stock_value: Math.round(
        displayRows.reduce((sum, r) => sum + (Number(r.stock_value) || 0), 0) * 100,
      ) / 100,
    }),
    [displayRows],
  );

  const hasDateRangeFilter = Boolean(fromDate || toDate);

  const clearToolbarFilters = () => {
    setSearch("");
    setStockFilter("all");
    setFromDate("");
    setToDate("");
    setSelectedIds(new Set());
  };

  const listMovementCacheKey = (row) => `${row.id}|${fromDate || ""}|${toDate || ""}`;
  const modalMovementCacheKey = (row) =>
    `${row.id}|${movementFromDate || ""}|${movementToDate || ""}`;

  const fetchMovements = async (row, cacheKey, rangeFrom, rangeTo) => {
    if (movementsCache[cacheKey]) return;
    setMovementsLoading(cacheKey);
    try {
      const params = {};
      if (row.size) params.size = row.size;
      if (row.color) params.color = row.color;
      if (rangeFrom) params.from_date = rangeFrom;
      if (rangeTo) params.to_date = rangeTo;
      const { data } = await api.get(`/admin/stock-inventory/${row.product_id}/movements`, { params });
      setMovementsCache((c) => ({ ...c, [cacheKey]: Array.isArray(data?.data) ? data.data : [] }));
    } catch {
      setMovementsCache((c) => ({ ...c, [cacheKey]: [] }));
    } finally {
      setMovementsLoading(null);
    }
  };

  useEffect(() => {
    if (!expandedId) return;
    const row = displayRows.find((r) => r.id === expandedId);
    if (row) void fetchMovements(row, listMovementCacheKey(row), fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when expand target or list date range changes
  }, [expandedId, fromDate, toDate, displayRows]);

  useEffect(() => {
    if (!detailRow) return;
    void fetchMovements(detailRow, modalMovementCacheKey(detailRow), movementFromDate, movementToDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when SKU or modal movement date range changes
  }, [detailRow?.id, movementFromDate, movementToDate]);

  const openDetailSheet = (row, { section = "overview" } = {}) => {
    setMovementFromDate(fromDate);
    setMovementToDate(toDate);
    setLotsFromDate(fromDate);
    setLotsToDate(toDate);
    setDetailInitialSection(section);
    setDetailRow({ ...row });
  };

  useEffect(() => {
    const request = parseSkuDetailOpenRequest(searchParams);
    if (!request) return;
    setPendingSkuOpen(request);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!pendingSkuOpen || loading) return;

    const match = rows.find((row) => matchesStockVariantRow(row, pendingSkuOpen));
    if (match) {
      openDetailSheet(match, { section: pendingSkuOpen.section });
      setPendingSkuOpen(null);
      skuOpenWithoutDatesRef.current = false;
      return;
    }

    if (!pendingSkuOpen.retried && (fromDate || toDate)) {
      setPendingSkuOpen({ ...pendingSkuOpen, retried: true });
      skuOpenWithoutDatesRef.current = true;
      void load();
      return;
    }

    setPendingSkuOpen(null);
    skuOpenWithoutDatesRef.current = false;
  }, [pendingSkuOpen, rows, loading, fromDate, toDate, load]);

  const toggleExpand = (row, e) => {
    if (e?.target?.closest?.("a, button, input, label")) return;
    const id = row.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
  };

  const closeDetail = () => setDetailRow(null);

  const detailMovements = detailRow ? movementsCache[modalMovementCacheKey(detailRow)] : [];
  const detailMovementsBusy = detailRow && movementsLoading === modalMovementCacheKey(detailRow);
  const detailHasDateRange = Boolean(movementFromDate || movementToDate);
  const listHasDateRange = Boolean(fromDate || toDate);

  const maxStockForBar = useMemo(() => {
    const m = Math.max(0, ...displayRows.map((r) => Number(r.in_stock) || 0));
    return Math.max(m, 10);
  }, [displayRows]);

  const exportCsv = () => {
    if (exportTargetRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = selectedIds.size > 0 ? "selected" : "all";
    downloadCsv({
      filename: `stock-inventory-${suffix}-${stamp}.csv`,
      headers: STOCK_CSV_HEADERS,
      rows: stockRowsToCsvData(exportTargetRows),
    });
    void toastSuccess({
      enText:
        selectedIds.size > 0
          ? `Exported ${exportTargetRows.length} selected SKU${exportTargetRows.length !== 1 ? "s" : ""} to CSV.`
          : `Exported all ${exportTargetRows.length} matching SKU${exportTargetRows.length !== 1 ? "s" : ""} to CSV.`,
    });
  };

  if (!permissionsReady || (loading && rows.length === 0)) {
    return <AdminContentSkeleton rows={10} />;
  }

  if (!canViewStock) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Stock &amp; Inventory</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            SKU-level on-hand stock. Click a row to expand purchase and sale history below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/inventory-lots"
            className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100"
          >
            Inventory Lots (all)
          </Link>
          {canViewPurchaseOrders ? (
            <Link
              to="/admin/purchase-orders"
              className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100"
            >
              Receive stock (PO)
            </Link>
          ) : null}
          {canViewProducts ? (
            <Link
              to="/admin/products"
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              Manage products
            </Link>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40">
          {err}
          <button type="button" onClick={load} className="ml-3 font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">All stock &amp; inventory</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={exportTargetRows.length === 0 || loading}
                title={
                  selectedIds.size > 0
                    ? `Export ${selectedIds.size} selected SKU(s)`
                    : `Export all ${displayRows.length} SKU(s) matching current filters`
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
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
          <AdminListQueryToolbar
            controlsAlign="right"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search SKU, product, size, color… (with date range)"
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
            stockOptions={STOCK_INVENTORY_STOCK_FILTER_OPTIONS}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOptions={SKU_STOCK_LIST_SORT_OPTIONS}
            sortDir={sortDir}
            onSortDirChange={setSortDir}
            showingCount={usePagination ? paginatedRows.length : displayRows.length}
            totalCount={displayRows.length}
            hasDateRangeFilter={hasDateRangeFilter}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            onClearFilters={clearToolbarFilters}
          />
          {displayRows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-700/80">
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                <input
                  ref={pageSelectRef}
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-[color:var(--admin-primary)] dark:border-slate-600"
                  aria-label="Select all SKUs on this page"
                />
                Select page
              </label>
              <button
                type="button"
                onClick={toggleAllFilteredSelection}
                className="font-semibold text-[color:var(--admin-primary)] hover:underline"
              >
                {allFilteredSelected ? "Clear all matching" : `Select all matching (${displayRows.length})`}
              </button>
              <span className="text-slate-500 dark:text-slate-400">
                Selected: <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{selectedIds.size}</span>
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
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">No inventory SKUs found.</div>
        ) : displayRows.length === 0 ? (
          <div className="p-10 text-center text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">No SKUs match your filters</p>
            {hasDateRangeFilter ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                With a date range, only SKUs with a purchase or sale in that period are listed. Clear dates to see all
                on-hand stock.
              </p>
            ) : null}
            <button
              type="button"
              onClick={clearToolbarFilters}
              className="mt-3 font-semibold text-[color:var(--admin-primary)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-stock-inventory-table w-full min-w-[1320px] table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-9" />
                  <col style={{ width: "228px" }} />
                  <col style={{ width: "140px" }} />
                  <col style={{ width: "64px" }} />
                  <col style={{ width: "88px" }} />
                  <col style={{ width: "96px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "84px" }} />
                  <col style={{ width: "92px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "44px" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-950/90">
                    <th className="px-2 py-3" aria-label="Select">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-2 py-3" aria-hidden />
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-left">Product</th>
                    <th className="px-3 py-3 text-center">Size</th>
                    <th className="px-3 py-3 text-left">Color</th>
                    <th
                      className="px-3 py-3 text-left"
                      title="Latest purchase or sale; within filter range when From/To dates are set"
                    >
                      Date
                    </th>
                    <th className="px-3 py-3 text-right">In stock</th>
                    <th className="px-3 py-3 text-right">WAC cost</th>
                    <th className="px-3 py-3 text-right">Sell price</th>
                    <th className="px-3 py-3 text-right">Stock value</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, rowIndex) => {
                    const isChecked = selectedIds.has(row.id);
                    const isExpanded = expandedId === row.id;
                    const isSheetOpen = detailRow?.id === row.id;
                    const isRowActive = isExpanded || isSheetOpen;
                    const tdBg = stockRowCellBg({ rowIndex, isChecked, isDetailOpen: isRowActive });
                    const rowHighlighted = isChecked || isRowActive;
                    const listCacheKey = listMovementCacheKey(row);
                    const listMovements = movementsCache[listCacheKey];
                    const listMovementsBusy = movementsLoading === listCacheKey;

                    return (
                      <React.Fragment key={row.id}>
                      <tr
                        data-selected={isChecked ? "" : undefined}
                        data-detail-open={isRowActive ? "" : undefined}
                        className={`group cursor-pointer border-b transition-colors dark:border-slate-800/60 ${rowHighlighted ? "border-b-slate-200 dark:border-slate-700" : "border-slate-100"
                          }`}
                        onClick={(e) => toggleExpand(row, e)}
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
                            onChange={() => toggleRowSelection(row.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-[color:var(--admin-primary)] dark:border-slate-600"
                            aria-label={`Select ${row.sku}`}
                          />
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-2 py-3.5 text-slate-400")}>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 align-top")}>
                          <span
                            className={`inline-block max-w-full break-all rounded border px-2 py-1 font-mono text-[11px] font-semibold leading-snug tracking-tight text-slate-700 dark:text-slate-200 ${rowHighlighted
                                ? "border-slate-200/70 bg-white dark:border-slate-600/80 dark:bg-slate-800/80"
                                : "border-slate-200/90 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                              }`}
                          >
                            {row.sku}
                          </span>
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 font-bold text-slate-900 dark:text-slate-50")}>
                          <span className="line-clamp-2 leading-snug">{row.product_name}</span>
                          {row.lot_summary && (row.lot_summary.clearance > 0 || row.lot_summary.newer > 0) ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {row.lot_summary.newer > 0 ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                                  Newer {row.lot_summary.newer}
                                </span>
                              ) : null}
                              {row.lot_summary.clearance > 0 ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                                  CLR {row.lot_summary.clearance}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5 text-center")}>
                          {row.size ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/90 bg-white text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                              {row.size}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                          {row.color ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                              {row.color}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td
                          className={stockRowTdClass(
                            tdBg,
                            isChecked,
                            isRowActive,
                            "px-3 py-3.5 tabular-nums text-slate-600 dark:text-slate-300",
                          )}
                        >
                          {formatDateIso(row.activity_date)}
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-3 py-3.5")}>
                          <InStockCell qty={row.in_stock} maxHint={maxStockForBar} />
                        </td>
                        <td
                          className={stockRowTdClass(
                            tdBg,
                            isChecked,
                            isRowActive,
                            "px-3 py-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300",
                          )}
                        >
                          {formatPoMoney(row.wac_cost)}
                        </td>
                        <td
                          className={stockRowTdClass(
                            tdBg,
                            isChecked,
                            isRowActive,
                            "px-3 py-3.5 text-right tabular-nums font-medium text-teal-700 dark:text-teal-400",
                          )}
                        >
                          <div>
                            {row.sell_price_source === "unsellable_lots"
                              ? "—"
                              : formatPoMoney(row.next_sell_price ?? row.sell_price)}
                          </div>
                          {row.sell_price_source === "inventory_lot" && row.next_lot_tier ? (
                            <p className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                              FIFO lot
                            </p>
                          ) : null}
                        </td>
                        <td
                          className={stockRowTdClass(
                            tdBg,
                            isChecked,
                            isRowActive,
                            "px-3 py-3.5 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400",
                          )}
                        >
                          {formatPoMoney(row.stock_value)}
                        </td>
                        <td className={stockRowTdClass(tdBg, isChecked, isRowActive, "min-w-[7.5rem] px-3 py-3.5")}>
                          <StatusPill status={row.status} />
                        </td>
                        <td
                          className={stockRowTdClass(tdBg, isChecked, isRowActive, "px-2 py-3.5")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {canEditProducts ? (
                          <Link
                            to={`/admin/products?edit=${row.product_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Edit product"
                            aria-label="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          ) : null}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <ExpandedMovementsPreview
                            movements={listMovements || []}
                            loading={listMovementsBusy}
                            hasDateRange={listHasDateRange}
                            onShowDetails={() => openDetailSheet(row)}
                            skuRow={row}
                          />
                        </tr>
                      ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/95 text-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <td colSpan={7} className="px-4 py-3.5 text-slate-500">
                      <>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{displayMeta.sku_count}</span> SKU
                        {displayMeta.sku_count !== 1 ? "s" : ""} total
                        {displayMeta.sku_count !== rows.length ? (
                          <span className="text-slate-400"> (filtered)</span>
                        ) : null}
                      </>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="text-slate-500">
                        Total units:{" "}
                        <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {displayMeta.total_units}
                        </span>
                      </span>
                    </td>
                    <td colSpan={2} />
                    <td className="px-3 py-3.5 text-right">
                      <span className="text-slate-500">
                        Stock value:{" "}
                        <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {formatPoMoney(displayMeta.total_stock_value)}
                        </span>
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <AdminListPaginationBar
              page={page}
              lastPage={lastPage}
              total={displayRows.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <StockSkuDetailModal
        row={detailRow}
        open={Boolean(detailRow)}
        onClose={closeDetail}
        initialSection={detailInitialSection}
        movements={detailMovements || []}
        movementsLoading={Boolean(detailMovementsBusy)}
        hasDateRange={detailHasDateRange}
        movementFromDate={movementFromDate}
        onMovementFromDateChange={setMovementFromDate}
        movementToDate={movementToDate}
        onMovementToDateChange={setMovementToDate}
        movementSearch={movementSearch}
        onMovementSearchChange={setMovementSearch}
        lotsSearch={lotsSearch}
        onLotsSearchChange={setLotsSearch}
        lotsFromDate={lotsFromDate}
        onLotsFromDateChange={setLotsFromDate}
        lotsToDate={lotsToDate}
        onLotsToDateChange={setLotsToDate}
        canEditLots={canEditStock}
        canEditStock={canEditStock}
        onLotsChanged={async () => {
          await load();
        }}
      />
    </div>
  );
}
