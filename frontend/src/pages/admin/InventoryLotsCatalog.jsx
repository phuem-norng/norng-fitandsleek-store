import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../../lib/api";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import InventoryLotsQueryToolbar from "../../components/admin/InventoryLotsQueryToolbar.jsx";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import {
  LISTING_STATUSES,
  listingStatusLabel,
  shortLotNumber,
  stockInventorySkuDetailPath,
} from "../../lib/inventoryLotHelpers.js";
import { SellsNextBadge } from "../../components/admin/LotSellOrderBadge.jsx";
import LotSellPriceCell from "../../components/admin/LotSellPriceCell.jsx";
import InventorySellStrategyCard from "../../components/admin/InventorySellStrategyCard.jsx";

const STATUS_FILTERS = [{ value: "all", label: "All" }, ...LISTING_STATUSES];

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function summaryNumberTone(status) {
  switch (status) {
    case "active":
      return "text-emerald-600 dark:text-emerald-400";
    case "on_hold":
      return "text-amber-600 dark:text-amber-400";
    case "clearance":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-slate-900 dark:text-slate-50";
  }
}

function SummaryCard({ status, label, stats, active, onClick }) {
  const onHand = Number(stats?.on_hand) || 0;
  const sold = Number(stats?.sold) || 0;
  const lotCount = Number(stats?.lot_count) || 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition hover:brightness-[0.98] dark:hover:brightness-110 ${
        active
          ? "ring-2 ring-[color:var(--admin-primary)] ring-offset-2 dark:ring-offset-slate-950"
          : ""
      } border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/80`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums leading-none ${summaryNumberTone(status)}`}>
        {formatCount(onHand)}
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {lotCount} lot{lotCount !== 1 ? "s" : ""}
        {sold > 0 ? (
          <>
            {" "}
            · Sold {formatCount(sold)}
          </>
        ) : null}
      </p>
    </button>
  );
}

function CatalogTierPill({ tier }) {
  const isOlder = tier === "older";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        isOlder
          ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          : "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
      }`}
    >
      {isOlder ? "Older stock" : "Newer stock"}
    </span>
  );
}

function CatalogStatusPill({ status }) {
  const label =
    status === "on_hold"
      ? "On hold"
      : status === "active"
        ? "Active"
        : listingStatusLabel(status);

  const tone =
    status === "on_hold"
      ? "border-amber-500/35 bg-amber-500/5 text-amber-800 dark:border-amber-500/40 dark:text-amber-300"
      : status === "active"
        ? "border-emerald-500/35 bg-emerald-500/5 text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-300"
        : status === "clearance"
          ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:border-amber-500/40 dark:text-amber-300"
          : "border-slate-400/35 bg-slate-500/5 text-slate-600 dark:border-slate-500/40 dark:text-slate-300";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
  );
}

function CatalogLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Newer stock = latest PO
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        Older stock = received earlier
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
        Website price = active sell price
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-slate-500 opacity-50" aria-hidden />
        On hold rows are dimmed
      </span>
    </div>
  );
}

export default function InventoryLotsCatalog() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewStock = can("stock", "view");
  const canEditStock = can("stock", "edit");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 50, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useAdminUiPreference("inventoryLotsCatalog.search", "");
  const [statusFilter, setStatusFilter] = useAdminUiPreference("inventoryLotsCatalog.status", "all");
  const [page, setPage] = useState(1);
  const [searchDebounced, setSearchDebounced] = useState(search);
  const [sellOldFirst, setSellOldFirst] = useState(true);
  const [inStockOnly, setInStockOnly] = useAdminUiPreference("inventoryLotsCatalog.inStockOnly", true);
  const [fromDate, setFromDate] = useAdminUiPreference("inventoryLotsCatalog.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("inventoryLotsCatalog.toDate", "");
  const [lotTierFilter, setLotTierFilter] = useAdminUiPreference("inventoryLotsCatalog.lotTier", "all");

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
      const params = {
        page,
        per_page: 50,
        listing_status: statusFilter || "all",
        in_stock_only: inStockOnly ? 1 : 0,
      };
      const q = String(searchDebounced || "").trim();
      if (q) params.search = q;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (lotTierFilter && lotTierFilter !== "all") params.lot_tier = lotTierFilter;
      const { data } = await api.get("/admin/inventory-lots/catalog", { params });
      setRows(Array.isArray(data?.data) ? data.data : []);
      setSummary(data?.meta?.summary ?? {});
      setPagination(data?.meta?.pagination ?? { current_page: 1, last_page: 1, per_page: 50, total: 0 });
      if (data?.meta?.sell_old_first !== undefined) {
        setSellOldFirst(Boolean(data.meta.sell_old_first));
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load inventory lots.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canViewStock, page, statusFilter, searchDebounced, inStockOnly, fromDate, toDate, lotTierFilter]);

  useEffect(() => {
    if (!permissionsReady) return;
    load();
  }, [load, permissionsReady]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchDebounced, inStockOnly, fromDate, toDate, lotTierFilter]);

  const metaSummary = useMemo(
    () => summary[statusFilter] || summary.all || {},
    [summary, statusFilter],
  );

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setInStockOnly(true);
    setFromDate("");
    setToDate("");
    setLotTierFilter("all");
  };

  if (!permissionsReady) {
    return <AdminContentSkeleton />;
  }

  if (!canViewStock) {
    const fallback = getFirstAccessibleAdminPath(user);
    return <Navigate to={fallback} replace />;
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Inventory Lots</h1>
        <Link
          to="/admin/stock-inventory"
          className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Stock &amp; Inventory (SKU)
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4 border-b border-slate-100 p-4 dark:border-slate-800">
          <InventorySellStrategyCard
            compact="catalog"
            canEdit={canEditStock}
            sellOldFirst={sellOldFirst}
            onSaved={async (saved) => {
              setSellOldFirst(saved);
              await load();
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {STATUS_FILTERS.map((f) => (
              <SummaryCard
                key={f.value}
                status={f.value}
                label={f.label}
                stats={summary[f.value]}
                active={statusFilter === f.value}
                onClick={() => setStatusFilter(f.value)}
              />
            ))}
          </div>

          <InventoryLotsQueryToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            lotTierFilter={lotTierFilter}
            onLotTierFilterChange={setLotTierFilter}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            inStockOnly={inStockOnly}
            onInStockOnlyChange={setInStockOnly}
            showingCount={rows.length}
            totalCount={pagination.total}
            onHand={metaSummary.on_hand}
            sold={metaSummary.sold}
            loading={loading}
            onClearFilters={clearAllFilters}
          />
        </div>

        {err ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {err}
            <button type="button" onClick={load} className="ml-3 font-semibold underline">
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading inventory lots…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No inventory lots match your filters.
            {statusFilter === "all" ? (
              <p className="mt-2 text-sm">Receive stock from a Purchase Order or add lots from Stock &amp; Inventory.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-400">
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Variant</th>
                    <th className="px-4 py-3 text-left">Lot number</th>
                    <th className="px-4 py-3 text-left">Lot tier</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">On hand</th>
                    <th className="px-4 py-3 text-right">Sold</th>
                    <th className="px-4 py-3 text-right">Unit price</th>
                    <th className="px-4 py-3 text-right">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lot) => {
                    const onHold = lot.listing_status === "on_hold";
                    const skuPath = stockInventorySkuDetailPath({
                      productId: lot.product_id,
                      size: lot.size,
                      color: lot.color,
                      tab: "lots",
                    });

                    return (
                      <tr
                        key={lot.id}
                        className={`border-b border-slate-100 dark:border-slate-800/80 ${
                          onHold
                            ? "bg-slate-50/30 opacity-45 dark:bg-slate-900/20"
                            : lot.is_sold_out
                              ? "opacity-60"
                              : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={skuPath}
                            className="group block rounded-md outline-none transition hover:text-[color:var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--admin-primary)]"
                          >
                            <div className="font-semibold text-slate-900 group-hover:underline dark:text-slate-50">
                              {lot.product_name || "—"}
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {lot.sku || "—"}
                            </div>
                            {lot.sells_next ? <SellsNextBadge /> : null}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          <Link
                            to={skuPath}
                            className="font-medium underline-offset-2 transition hover:text-[color:var(--admin-primary)] hover:underline"
                          >
                            {[lot.size, lot.color].filter(Boolean).join(" / ") || "—"}
                          </Link>
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300"
                          title={lot.lot_number}
                        >
                          {shortLotNumber(lot.lot_number)}
                        </td>
                        <td className="px-4 py-3">
                          <CatalogTierPill tier={lot.lot_tier} />
                        </td>
                        <td className="px-4 py-3">
                          <CatalogStatusPill status={lot.listing_status} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900 dark:text-slate-50">
                          {formatCount(lot.quantity_on_hand)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {formatCount(lot.quantity_sold ?? 0)}
                        </td>
                        <td className="px-4 py-3">
                          <LotSellPriceCell lot={lot} mode="catalog" />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {formatCount(lot.quantity_received)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <CatalogLegend />

            <div className="border-t border-slate-100 px-2 py-2 dark:border-slate-800">
              <AdminListPaginationBar
                page={pagination.current_page}
                lastPage={pagination.last_page}
                total={pagination.total}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
