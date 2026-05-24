import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { paymentMethodLabel } from "../../lib/posPaymentMethods";
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
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sellerId, setSellerId] = useState("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "20");
      if (searchDebounced) params.set("search", searchDebounced);
      if (sellerId && sellerId !== "all") params.set("seller_id", sellerId);

      const { data } = await api.get(`/admin/pos/sale-history?${params}`);
      const paginator = data?.data;
      setSales(paginator?.data || []);
      setLastPage(paginator?.last_page || 1);
      setTotal(paginator?.total ?? 0);
      setSummary(data?.summary || null);
      setSellers(data?.sellers || []);
    } catch (e) {
      console.error("Failed to load sale history", e);
      setSales([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, sellerId]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, sellerId]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const hasFilters = searchDebounced !== "" || sellerId !== "all";
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

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            disabled
            title="More filters coming soon"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter
          </button>

          <label className="relative inline-flex min-w-[10rem] items-center">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </span>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600"
            >
              <option value="all">All sellers</option>
              {sellers.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </label>
        </div>
      </div>

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
