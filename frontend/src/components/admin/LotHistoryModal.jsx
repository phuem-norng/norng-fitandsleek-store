import React, { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import api from "../../lib/api";
import AdminModal from "./AdminModal.jsx";
import AdminListQueryToolbar from "./AdminListQueryToolbar.jsx";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import {
  formatLotDetailChangeLine,
  formatLotDetailEventSummary,
  formatLotPriceEventAt,
  formatLotPriceEventSummary,
} from "../../lib/inventoryLotHelpers.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pricing", label: "Pricing" },
  { id: "details", label: "Details" },
];

function FilterTabs({ value, onChange, counts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            value === tab.id
              ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          {tab.label}
          <span className="ml-1.5 tabular-nums opacity-80">({counts[tab.id] ?? 0})</span>
        </button>
      ))}
    </div>
  );
}

function KindBadge({ kind }) {
  const isPricing = kind === "pricing";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isPricing
          ? "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {isPricing ? "Pricing" : "Details"}
    </span>
  );
}

export default function LotHistoryModal({ open, onClose, lot }) {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [priceEvents, setPriceEvents] = useState([]);
  const [detailEvents, setDetailEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSearchDebounced("");
      setFromDate("");
      setToDate("");
      setFilter("all");
      setPriceEvents([]);
      setDetailEvents([]);
      setErr("");
    }
  }, [open]);

  const load = useCallback(async () => {
    if (!lot?.id) return;
    setLoading(true);
    setErr("");
    try {
      const params = {};
      const q = String(searchDebounced || "").trim();
      if (q) params.search = q;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const [priceRes, detailRes] = await Promise.all([
        api.get(`/admin/inventory-lots/${lot.id}/price-events`, { params }),
        api.get(`/admin/inventory-lots/${lot.id}/detail-events`, { params }),
      ]);

      setPriceEvents(Array.isArray(priceRes.data?.data) ? priceRes.data.data : []);
      setDetailEvents(Array.isArray(detailRes.data?.data) ? detailRes.data.data : []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load lot history.");
      setPriceEvents([]);
      setDetailEvents([]);
    } finally {
      setLoading(false);
    }
  }, [lot?.id, searchDebounced, fromDate, toDate]);

  useEffect(() => {
    if (!open || !lot?.id) return;
    void load();
  }, [open, lot?.id, load]);

  const mergedEvents = useMemo(() => {
    const pricing = priceEvents.map((event) => ({ kind: "pricing", event }));
    const details = detailEvents.map((event) => ({ kind: "details", event }));
    return [...pricing, ...details].sort((a, b) => {
      const ta = new Date(a.event?.created_at || 0).getTime();
      const tb = new Date(b.event?.created_at || 0).getTime();
      return tb - ta;
    });
  }, [priceEvents, detailEvents]);

  const filteredEvents = useMemo(() => {
    if (filter === "pricing") return mergedEvents.filter((row) => row.kind === "pricing");
    if (filter === "details") return mergedEvents.filter((row) => row.kind === "details");
    return mergedEvents;
  }, [mergedEvents, filter]);

  const counts = useMemo(
    () => ({
      all: mergedEvents.length,
      pricing: priceEvents.length,
      details: detailEvents.length,
    }),
    [mergedEvents.length, priceEvents.length, detailEvents.length],
  );

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setFilter("all");
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Lot history"
      titleIcon={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <History className="h-4 w-4" aria-hidden />
        </span>
      }
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {lot?.lot_number ? (
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{lot.lot_number}</p>
        ) : null}

        <FilterTabs value={filter} onChange={setFilter} counts={counts} />

        <AdminListQueryToolbar
          embedded
          singleRow
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search action, field, or admin…"
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
          showingCount={filteredEvents.length}
          totalCount={mergedEvents.length}
          onClearFilters={clearFilters}
        />

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading lot history…</p>
        ) : filteredEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No history for this lot.</p>
        ) : (
          <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto pr-1">
            {filteredEvents.map(({ kind, event }) => {
              const changes = Array.isArray(event.changes) ? event.changes : [];
              const summary =
                kind === "pricing"
                  ? formatLotPriceEventSummary(event)
                  : formatLotDetailEventSummary(event);

              return (
                <li
                  key={`${kind}-${event.id}`}
                  className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <KindBadge kind={kind} />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{summary}</span>
                    </div>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                      {formatLotPriceEventAt(event.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    By {event.admin?.name || event.admin?.email || "System"}
                    {kind === "pricing" &&
                    event.unit_price_before != null &&
                    event.unit_price_after != null ? (
                      <span className="ml-1 tabular-nums">
                        ({formatPoMoney(event.unit_price_before)} → {formatPoMoney(event.unit_price_after)})
                      </span>
                    ) : null}
                  </p>
                  {kind === "details" && changes.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-slate-600 dark:text-slate-300">
                      {changes.map((change) => (
                        <li key={`${event.id}-${change.field}`}>{formatLotDetailChangeLine(change)}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminModal>
  );
}
