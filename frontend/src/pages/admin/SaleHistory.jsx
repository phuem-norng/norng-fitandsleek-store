import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import api from "../../lib/api";
import { paymentMethodLabel } from "../../lib/posPaymentMethods";
import { countFilterSelections } from "../../lib/adminListFilters.js";
import { formatYearMonthLabel } from "../../lib/adminYearMonthFilter.js";
import { useAdminFilterDrawer } from "../../lib/useAdminFilterDrawer.js";
import { useAdminYearMonthFilter } from "../../lib/useAdminYearMonthFilter.js";
import AdminFilterDrawer, { AdminFilterToolbarButton } from "../../components/admin/AdminFilterDrawer.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatSaleCount(count) {
  const n = Number(count) || 0;
  return `${n} sale`;
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
      <div className="mb-8 text-slate-300 dark:text-slate-600" aria-hidden>
        <svg className="mx-auto h-36 w-44" viewBox="0 0 176 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="108" y="8" width="56" height="88" rx="6" stroke="currentColor" strokeWidth="2" />
          <rect x="116" y="20" width="40" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M116 56h40M116 64h28M116 72h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="12" y="32" width="88" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="20" y="42" width="72" height="36" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M20 86h72M28 94h56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">No sales yet</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Any question?</p>
      <a
        href="/support"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Click here and discover our Help Center
      </a>
    </div>
  );
}

export default function SaleHistory() {
  const listFilters = useAdminFilterDrawer(["seller", "payment_method"]);
  const yearMonthFilter = useAdminYearMonthFilter(2020);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filterFacets, setFilterFacets] = useState(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listTotals, setListTotals] = useState({
    sale_count: 0,
    total_items: 0,
    total_price: 0,
  });
  const appliedFiltersKey = JSON.stringify({
    drawer: listFilters.applied,
    yearMonth: yearMonthFilter.applied,
  });
  const prevQueryRef = useRef({ search: searchDebounced, appliedFiltersKey, page });

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const prev = prevQueryRef.current;
    const filtersChanged = prev.search !== searchDebounced || prev.appliedFiltersKey !== appliedFiltersKey;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    prevQueryRef.current = { search: searchDebounced, appliedFiltersKey, page };

    const ac = new AbortController();
    const applied = listFilters.applied;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/pos/sale-history", {
          params: {
            page,
            per_page: 20,
            ...(searchDebounced ? { search: searchDebounced } : {}),
            ...(applied.seller?.length ? { seller_ids: applied.seller } : {}),
            ...(applied.payment_method?.length ? { payment_methods: applied.payment_method } : {}),
            ...(yearMonthFilter.dateRange.from ? { from_date: yearMonthFilter.dateRange.from } : {}),
            ...(yearMonthFilter.dateRange.to ? { to_date: yearMonthFilter.dateRange.to } : {}),
          },
          signal: ac.signal,
        });
        const paginator = data?.data;
        setSales(paginator?.data || []);
        setLastPage(paginator?.last_page || 1);
        setTotal(paginator?.total ?? 0);
        setListTotals(
          data?.list_totals ?? { sale_count: 0, total_items: 0, total_price: 0 },
        );
        setSummary(data?.summary || null);
        setFilterFacets(data?.filter_facets || null);
      } catch (e) {
        if (axios.isCancel(e)) return;
        console.error("Failed to load sale history", e);
        setSales([]);
        setSummary(null);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [page, searchDebounced, appliedFiltersKey]);

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

  const toolbarFilterCount =
    countFilterSelections(listFilters.applied) + yearMonthFilter.activeCount;
  const drawerFilterCount = toolbarFilterCount;
  const hasFilters = searchDebounced !== "" || drawerFilterCount > 0;

  const openFilterDrawer = () => {
    yearMonthFilter.syncDraftFromApplied();
    listFilters.openDrawer();
  };

  const applyAllFilters = () => {
    yearMonthFilter.apply();
    listFilters.apply();
  };

  const clearAllFilters = () => {
    yearMonthFilter.clear();
    listFilters.clearAll();
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

  return (
    <div className="admin-page-pad mx-auto w-full max-w-6xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Sales history</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer name or product"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-600"
            />
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <AdminFilterToolbarButton activeCount={toolbarFilterCount} onClick={openFilterDrawer} />
        </div>

        {yearMonthFilter.activeCount > 0 || listFilters.activeCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium">Active filters:</span>
            {yearMonthFilter.activeCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                {formatYearMonthLabel(yearMonthFilter.applied)}
              </span>
            ) : null}
            {listFilters.applied.seller?.map((id) => {
              const name = filterFacets?.seller?.find((s) => s.value === id)?.label || id;
              return (
                <span key={`seller-${id}`} className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                  {name}
                </span>
              );
            })}
            {listFilters.applied.payment_method?.map((id) => (
              <span key={`pay-${id}`} className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                {paymentMethodLabel(id)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <AdminFilterDrawer
        open={listFilters.open}
        onClose={listFilters.closeDrawer}
        sections={saleFilterSections}
        selected={listFilters.draft}
        onToggle={listFilters.toggleDraft}
        onApply={applyAllFilters}
        onClearAll={clearAllFilters}
        yearMonth={{
          value: yearMonthFilter.draft,
          onChange: yearMonthFilter.setDraft,
          startYear: 2020,
          title: "Sale date",
        }}
      />

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-4">
        {summaryBlocks.map((block) => (
          <div
            key={block.key}
            className="flex flex-col justify-center bg-slate-50 px-4 py-4 dark:bg-slate-800/80 sm:px-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {block.label}: <span className="text-slate-600 dark:text-slate-300">{formatSaleCount(block.count)}</span>
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{formatMoney(block.total)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 min-h-[320px] rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
        {!loading && !showEmpty ? (
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {hasFilters ? "Filtered sales" : "All sales"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {hasFilters ? (
                    <>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {listTotals.sale_count} sale{listTotals.sale_count === 1 ? "" : "s"}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                      <span>
                        {listTotals.total_items} item{listTotals.total_items === 1 ? "" : "s"}
                      </span>
                      <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatMoney(listTotals.total_price)}
                      </span>
                    </>
                  ) : (
                    <>
                      {listTotals.sale_count} total sale{listTotals.sale_count === 1 ? "" : "s"}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="p-6">
            <AdminContentSkeleton />
          </div>
        ) : showEmpty ? (
          <EmptySalesState />
        ) : sales.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            No sales match your search or filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-4 py-3 sm:px-5">Sale</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium text-slate-900 dark:text-white">{sale.order_number}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(sale.created_at)}</p>
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
            {lastPage > 1 ? (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700 sm:px-5">
                <span className="text-slate-500 dark:text-slate-400">
                  {total} sale{total === 1 ? "" : "s"}
                  {drawerFilterCount > 0 ? " (filtered)" : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
