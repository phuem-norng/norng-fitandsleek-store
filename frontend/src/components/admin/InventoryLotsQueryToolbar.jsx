import React from "react";
import { ADMIN_LIST_FIELD_CLASS, adminListFiltersActive } from "../../lib/adminListQuery.js";
import {
  LOT_LISTING_STATUS_FILTER_OPTIONS,
  LOT_TIER_FILTER_OPTIONS,
} from "../../lib/inventoryLotHelpers.js";
import { useAdminSidebarPinned } from "../../lib/useAdminSidebarPinned.js";

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

/**
 * Aligned filter row for Inventory Lots catalog — all controls share h-10 baseline.
 */
export default function InventoryLotsQueryToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  lotTierFilter,
  onLotTierFilterChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  inStockOnly,
  onInStockOnlyChange,
  showingCount = 0,
  totalCount = 0,
  onHand = 0,
  sold = 0,
  loading = false,
  onClearFilters,
}) {
  const hasDateRangeFilter = Boolean(fromDate || toDate);
  const filtersActive = adminListFiltersActive({
    search,
    statusFilter,
    stockFilter: lotTierFilter,
    hasDateRangeFilter,
  }) || !inStockOnly;

  const field = ADMIN_LIST_FIELD_CLASS;
  const sidebarPinned = useAdminSidebarPinned();
  // Unpinned sidebar = wider content area — keep search compact so filters stay on one row.
  const searchClass = sidebarPinned
    ? `${field} h-10 min-w-[11rem] max-w-[16rem] flex-1 basis-[11rem]`
    : `${field} h-10 w-[10.5rem] min-w-[9rem] max-w-[10.5rem] shrink-0`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={sidebarPinned ? "Search product, SKU, lot, barcode, season…" : "Search product, SKU, lot…"}
          className={searchClass}
          aria-label="Search inventory lots"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={`${field} h-10 w-full min-w-[8.5rem] sm:w-[9.5rem]`}
          aria-label="Filter by listing status"
        >
          {LOT_LISTING_STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={lotTierFilter}
          onChange={(e) => onLotTierFilterChange(e.target.value)}
          className={`${field} h-10 w-full min-w-[8.5rem] sm:w-[9.5rem]`}
          aria-label="Filter by lot tier"
        >
          {LOT_TIER_FILTER_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          max={toDate || undefined}
          className={`${field} h-10 w-full min-w-[9.5rem] sm:w-[10.5rem]`}
          aria-label="From date"
          title="From date"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          min={fromDate || undefined}
          className={`${field} h-10 w-full min-w-[9.5rem] sm:w-[10.5rem]`}
          aria-label="To date"
          title="To date"
        />
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            className="rounded border-slate-300 dark:border-slate-600"
            checked={inStockOnly}
            onChange={(e) => onInStockOnlyChange(e.target.checked)}
          />
          Hide sold-out lots
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>
            Showing{" "}
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {loading ? "…" : formatCount(showingCount)}
            </span>{" "}
            of <span className="font-semibold tabular-nums">{formatCount(totalCount)}</span>
            {filtersActive ? " (filtered)" : ""}
          </span>
          <span className="hidden text-slate-300 sm:inline dark:text-slate-600">·</span>
          <span>
            On hand <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatCount(onHand)}</span>
            {" · "}
            Sold <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatCount(sold)}</span>
          </span>
          {hasDateRangeFilter ? (
            <>
              <span className="hidden text-slate-300 sm:inline dark:text-slate-600">·</span>
              <span>
                Received{" "}
                {fromDate && toDate
                  ? `${fromDate} – ${toDate}`
                  : fromDate
                    ? `from ${fromDate}`
                    : `to ${toDate}`}
              </span>
            </>
          ) : null}
          {!inStockOnly ? (
            <>
              <span className="hidden text-slate-300 sm:inline dark:text-slate-600">·</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">Including sold-out</span>
            </>
          ) : null}
        </p>
        {filtersActive && onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="shrink-0 font-semibold text-[color:var(--admin-primary)] hover:underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
