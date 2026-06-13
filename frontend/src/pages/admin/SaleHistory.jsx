import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import api from "../../lib/api";
import { paymentMethodLabel } from "../../lib/posPaymentMethods";
import { countFilterSelections } from "../../lib/adminListFilters.js";
import { useAdminFilterDrawer } from "../../lib/useAdminFilterDrawer.js";
import AdminFilterDrawer, { AdminFilterToolbarButton } from "../../components/admin/AdminFilterDrawer.jsx";
import AdminListQueryToolbar from "../../components/admin/AdminListQueryToolbar.jsx";
import AdminListPaginationBar from "../../components/admin/AdminListPaginationBar.jsx";
import { AdminContentSkeleton, AdminSectionLoader } from "@/components/admin/AdminLoading";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { getFirstAccessibleAdminPath } from "../../lib/adminPermissions.js";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatSaleCount(count) {
  const n = Number(count) || 0;
  return `${n} sale${n === 1 ? "" : "s"}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const SUMMARY_PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
];

function EmptySalesState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 text-slate-300 dark:text-slate-600" aria-hidden>
        <svg className="mx-auto h-28 w-36" viewBox="0 0 176 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="108" y="8" width="56" height="88" rx="6" stroke="currentColor" strokeWidth="2" />
          <rect x="116" y="20" width="40" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M116 56h40M116 64h28M116 72h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="12" y="32" width="88" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="42" width="72" height="36" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M20 86h72M28 94h56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No sales yet</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">POS sales will appear here once you complete checkout.</p>
    </div>
  );
}

export default function SaleHistory() {
  const { user, can, permissionsReady } = useAdminPermissions();
  const canViewSaleHistory = can("sale_history", "view");
  const listFilters = useAdminFilterDrawer(["seller", "payment_method"]);

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterFacets, setFilterFacets] = useState(null);
  const [search, setSearch] = useAdminUiPreference("saleHistory.list.search", "");
  const [fromDate, setFromDate] = useAdminUiPreference("saleHistory.list.fromDate", "");
  const [toDate, setToDate] = useAdminUiPreference("saleHistory.list.toDate", "");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [listTotals, setListTotals] = useState({
    sale_count: 0,
    total_items: 0,
    total_price: 0,
  });

  const appliedFiltersKey = JSON.stringify({
    drawer: listFilters.applied,
    fromDate,
    toDate,
  });
  const prevQueryRef = useRef({ search: searchDebounced, appliedFiltersKey, page });

  const hasDateRangeFilter = Boolean(fromDate || toDate);
  const drawerFilterCount = countFilterSelections(listFilters.applied);
  const hasFilters = searchDebounced !== "" || drawerFilterCount > 0 || hasDateRangeFilter;

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchSales = useCallback(async (signal) => {
    if (!canViewSaleHistory) {
      setSales([]);
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const applied = listFilters.applied;
      const { data } = await api.get("/admin/pos/sale-history", {
        params: {
          page,
          per_page: 20,
          ...(searchDebounced ? { search: searchDebounced } : {}),
          ...(applied.seller?.length ? { seller_ids: applied.seller } : {}),
          ...(applied.payment_method?.length ? { payment_methods: applied.payment_method } : {}),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        },
        signal,
      });
      const paginator = data?.data;
      setSales(paginator?.data || []);
      setLastPage(paginator?.last_page || 1);
      setTotal(paginator?.total ?? 0);
      setListTotals(data?.list_totals ?? { sale_count: 0, total_items: 0, total_price: 0 });
      setSummary(data?.summary || null);
      setFilterFacets(data?.filter_facets || null);
    } catch (e) {
      if (axios.isCancel(e)) return;
      console.error("Failed to load sale history", e);
      setSales([]);
      setSummary(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [
    canViewSaleHistory,
    page,
    searchDebounced,
    appliedFiltersKey,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    if (!permissionsReady) return;
    const prev = prevQueryRef.current;
    const filtersChanged = prev.search !== searchDebounced || prev.appliedFiltersKey !== appliedFiltersKey;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevQueryRef.current = { search: searchDebounced, appliedFiltersKey, page };

    const ac = new AbortController();
    fetchSales(ac.signal);
    return () => ac.abort();
  }, [page, searchDebounced, appliedFiltersKey, reloadKey, fetchSales, permissionsReady]);

  const saleFilterSections = useMemo(() => {
    const facets = filterFacets || {};
    const sections = [];

    if (facets.seller?.length) {
      sections.push({
        id: "seller",
        title: "Seller",
        options: facets.seller,
      });
    }

    if (facets.payment_method?.length) {
      sections.push({
        id: "payment_method",
        title: "Payment method",
        options: facets.payment_method.map((opt) => ({
          ...opt,
          label: paymentMethodLabel(opt.value) || opt.label,
        })),
      });
    }

    return sections;
  }, [filterFacets]);

  const openFilterDrawer = () => {
    listFilters.openDrawer();
  };

  const applyAllFilters = () => {
    listFilters.apply();
  };

  const clearAllFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    listFilters.clearAll();
  };

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) return `${fromDate} – ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `Until ${toDate}`;
    return "";
  }, [fromDate, toDate]);

  const refreshList = () => {
    setReloadKey((k) => k + 1);
  };

  const showEmpty = !loading && sales.length === 0 && !hasFilters;

  const summaryBlocks = useMemo(() => {
    if (!summary) {
      return SUMMARY_PERIODS.map((p) => ({
        ...p,
        count: 0,
        total: 0,
      }));
    }
    return SUMMARY_PERIODS.map((p) => ({
      ...p,
      count: summary[p.key]?.count ?? 0,
      total: summary[p.key]?.total ?? 0,
    }));
  }, [summary]);

  if (!permissionsReady || (loading && sales.length === 0 && !hasFilters)) {
    return <AdminContentSkeleton title="Sales history" />;
  }

  if (!canViewSaleHistory) {
    return <Navigate to={getFirstAccessibleAdminPath(user)} replace />;
  }

  if (loading && sales.length === 0 && !hasFilters) {
    return <AdminContentSkeleton title="Sales history" />;
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sales history</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          POS sales with seller, payment method, and period summaries.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
        {summaryBlocks.map((block) => (
          <div
            key={block.key}
            className="flex flex-col justify-center bg-white px-4 py-4 dark:bg-slate-900 sm:px-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {block.label}:{" "}
              <span className="text-slate-600 dark:text-slate-300">{formatSaleCount(block.count)}</span>
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatMoney(block.total)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">All sales</h2>
            <div className="flex flex-wrap items-center gap-2">
              <AdminFilterToolbarButton activeCount={drawerFilterCount} onClick={openFilterDrawer} />
              <button
                type="button"
                onClick={refreshList}
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
            searchPlaceholder="Customer name or product…"
            showingCount={sales.length}
            totalCount={total}
            hasDateRangeFilter={hasDateRangeFilter || listFilters.activeCount > 0}
            fromDate={fromDate}
            onFromDateChange={setFromDate}
            toDate={toDate}
            onToDateChange={setToDate}
            onClearFilters={clearAllFilters}
          />

          {hasFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {hasDateRangeFilter ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20">
                  {dateRangeLabel}
                </span>
              ) : null}
              {listFilters.applied.seller?.map((id) => {
                const name = filterFacets?.seller?.find((s) => s.value === id)?.label || id;
                return (
                  <span
                    key={`seller-${id}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  >
                    Seller: {name}
                  </span>
                );
              })}
              {listFilters.applied.payment_method?.map((id) => (
                <span
                  key={`pay-${id}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
                >
                  {paymentMethodLabel(id)}
                </span>
              ))}
            </div>
          ) : null}

          <AdminFilterDrawer
            open={listFilters.open}
            onClose={listFilters.closeDrawer}
            sections={saleFilterSections}
            selected={listFilters.draft}
            onToggle={listFilters.toggleDraft}
            onApply={applyAllFilters}
            onClearAll={clearAllFilters}
          />
        </div>

        <div className="relative min-h-[280px]">
          {loading ? (
            <AdminSectionLoader className="absolute inset-0 z-10 min-h-[280px] bg-white/75 dark:bg-slate-900/75" />
          ) : null}

          {showEmpty ? (
            <EmptySalesState />
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {hasFilters ? "Filtered sales" : "Recent sales"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {listTotals.sale_count} sale{listTotals.sale_count === 1 ? "" : "s"}
                    </span>
                    <span className="mx-1.5">·</span>
                    {listTotals.total_items} item{listTotals.total_items === 1 ? "" : "s"}
                    <span className="mx-1.5">·</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {formatMoney(listTotals.total_price)}
                    </span>
                  </p>
                </div>
              </div>

              {sales.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                  <p>No sales match your search or filters.</p>
                  {hasDateRangeFilter ? (
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Only sales within the selected date range are listed. Clear dates to see all sales.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-3 font-semibold text-[color:var(--admin-primary)] hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/95 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-400">
                          <th className="px-4 py-3 sm:px-6">Sale</th>
                          <th className="px-4 py-3">Products</th>
                          <th className="px-4 py-3">Seller</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sales.map((sale) => (
                          <tr
                            key={sale.id}
                            className="text-slate-800 transition hover:bg-slate-50/80 dark:text-slate-200 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-3 sm:px-6">
                              <p className="font-medium text-slate-900 dark:text-white">{sale.order_number}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {formatDateTime(sale.created_at)}
                              </p>
                            </td>
                            <td className="max-w-[220px] px-4 py-3">
                              <p className="truncate" title={sale.products_label}>
                                {sale.products_label}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {sale.items_count} item{sale.items_count === 1 ? "" : "s"}
                              </p>
                            </td>
                            <td className="px-4 py-3">{sale.seller?.name || "—"}</td>
                            <td className="px-4 py-3">{paymentMethodLabel(sale.payment_method)}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(sale.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <AdminListPaginationBar
                    page={page}
                    lastPage={lastPage}
                    total={total}
                    onPageChange={setPage}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
