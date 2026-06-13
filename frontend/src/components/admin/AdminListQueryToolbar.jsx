import React from "react";
import { ADMIN_LIST_FIELD_CLASS, adminListFiltersActive } from "../../lib/adminListQuery.js";
import { useAdminSidebarPinned } from "../../lib/useAdminSidebarPinned.js";

/**
 * Search + optional filter selects + sort (matches Purchase Orders list toolbar).
 */
export default function AdminListQueryToolbar({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  statusFilter,
  onStatusFilterChange,
  statusOptions = null,
  supplierFilter,
  onSupplierFilterChange,
  supplierOptions = null,
  stockFilter,
  onStockFilterChange,
  stockOptions = null,
  stockFilterAriaLabel = "Filter by stock",
  methodFilter,
  onMethodFilterChange,
  methodOptions = null,
  sortBy,
  onSortByChange,
  sortOptions = [],
  sortDir,
  onSortDirChange,
  showSortDir = true,
  showingCount = 0,
  totalCount = 0,
  onClearFilters,
  hasDateRangeFilter = false,
  fromDate = "",
  onFromDateChange = null,
  toDate = "",
  onToDateChange = null,
  controlsAlign = "default",
  /** One horizontal row: search, filters, dates, and count (scrolls on narrow viewports). */
  singleRow = false,
  /** No outer card border — use inside a section header (e.g. SKU detail movement block). */
  embedded = false,
}) {
  const sidebarPinned = useAdminSidebarPinned();
  const compact = singleRow && sidebarPinned;
  const fieldClass = compact
    ? `${ADMIN_LIST_FIELD_CLASS} h-10 px-2.5 text-sm`
    : ADMIN_LIST_FIELD_CLASS;
  const showDateRange = typeof onFromDateChange === "function" && typeof onToDateChange === "function";
  const shellClass = embedded
    ? ""
    : "rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40";

  const dateLabelClass = "text-xs font-medium text-slate-600 dark:text-slate-400";
  const inlineFieldClass = singleRow ? "shrink-0 w-auto" : "w-full sm:w-auto";
  const dateInputWidth = compact ? "w-[9.5rem]" : "sm:w-[10.5rem]";
  const searchMinWidth = compact ? "min-w-[9rem]" : "min-w-[11rem]";
  const searchMaxWidth = compact ? "max-w-[12rem]" : "max-w-[16rem]";
  const selectMin = (wide, narrow) => (compact ? narrow : wide);

  const sortOptionLabel = (opt) => {
    if (compact) return opt.label;
    return `Sort: ${opt.label}`;
  };

  const dateRangeFields = showDateRange ? (
    <>
      <label className={`flex flex-col gap-1 ${singleRow ? "shrink-0" : "w-full sm:w-auto"}`}>
        <span className={dateLabelClass}>From date</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          max={toDate || undefined}
          className={`${fieldClass} w-full min-w-0 ${dateInputWidth}`}
          aria-label="From date"
        />
      </label>
      <label className={`flex flex-col gap-1 ${singleRow ? "shrink-0" : "w-full sm:w-auto"}`}>
        <span className={dateLabelClass}>To date</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          min={fromDate || undefined}
          className={`${fieldClass} w-full min-w-0 ${dateInputWidth}`}
          aria-label="To date"
        />
      </label>
    </>
  ) : null;

  const filtersActive = adminListFiltersActive({
    search,
    statusFilter,
    supplierFilter,
    stockFilter,
    methodFilter,
    hasDateRangeFilter,
  });
  const showSort = Array.isArray(sortOptions) && sortOptions.length > 0;

  const controlSelects = (
    <>
      {statusOptions?.length ? (
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[9.5rem]", "min-w-[8rem] max-w-[9rem]")}`}
          aria-label="Filter by status"
        >
          {statusOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      {supplierOptions?.length ? (
        <select
          value={supplierFilter}
          onChange={(e) => onSupplierFilterChange(e.target.value)}
          className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[10rem]", "min-w-[8.5rem] max-w-[9.5rem]")}`}
          aria-label="Filter by supplier"
        >
          {supplierOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      {stockOptions?.length ? (
        <select
          value={stockFilter}
          onChange={(e) => onStockFilterChange(e.target.value)}
          className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[9.5rem]", "min-w-[8rem] max-w-[9rem]")}`}
          aria-label={stockFilterAriaLabel}
        >
          {stockOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      {methodOptions?.length ? (
        <select
          value={methodFilter}
          onChange={(e) => onMethodFilterChange(e.target.value)}
          className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[10rem]", "min-w-[8.5rem] max-w-[9.5rem]")}`}
          aria-label="Filter by method"
        >
          {methodOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}
      {showSort ? (
        <>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[10.5rem]", "min-w-[9rem] max-w-[10rem]")}`}
            aria-label="Sort by"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {sortOptionLabel(opt)}
              </option>
            ))}
          </select>
          {showSortDir ? (
            <select
              value={sortDir}
              onChange={(e) => onSortDirChange(e.target.value)}
              className={`${fieldClass} ${inlineFieldClass} ${selectMin("sm:min-w-[5.5rem]", "min-w-[5rem] max-w-[5.5rem]")}`}
              aria-label="Sort direction"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          ) : null}
        </>
      ) : null}
      {dateRangeFields}
    </>
  );

  const metaRow = (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 ${controlsAlign === "right" ? "justify-end" : "justify-between"
        }`}
    >
      <span>
        Showing {showingCount} of {totalCount}
        {filtersActive ? " (filtered)" : ""}
      </span>
      {filtersActive && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="font-semibold text-[color:var(--admin-primary)] hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );

  if (singleRow) {
    return (
      <div className={shellClass}>
        <div className={`flex flex-nowrap items-end overflow-x-auto pb-0.5 ${compact ? "gap-2" : "gap-2"}`}>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${fieldClass} shrink-0 ${searchMinWidth} ${searchMaxWidth}`}
            aria-label="Search list"
          />
          {controlSelects}
        </div>
        <div className="mt-2">{metaRow}</div>
      </div>
    );
  }

  if (controlsAlign === "right") {
    return (
      <div className={shellClass}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${ADMIN_LIST_FIELD_CLASS} min-w-0 flex-1`}
            aria-label="Search list"
          />
          <div
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end lg:shrink-0"
          >
            {controlSelects}
          </div>
        </div>
        {metaRow}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-4`}
          aria-label="Search list"
        />
        {statusOptions?.length ? (
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-2`}
            aria-label="Filter by status"
          >
            {statusOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {supplierOptions?.length ? (
          <select
            value={supplierFilter}
            onChange={(e) => onSupplierFilterChange(e.target.value)}
            className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-3`}
            aria-label="Filter by supplier"
          >
            {supplierOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {stockOptions?.length ? (
          <select
            value={stockFilter}
            onChange={(e) => onStockFilterChange(e.target.value)}
            className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-2`}
            aria-label={stockFilterAriaLabel}
          >
            {stockOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {methodOptions?.length ? (
          <select
            value={methodFilter}
            onChange={(e) => onMethodFilterChange(e.target.value)}
            className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-2`}
            aria-label="Filter by method"
          >
            {methodOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : null}
        {showSort ? (
          <>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-2`}
              aria-label="Sort by"
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            {showSortDir ? (
              <select
                value={sortDir}
                onChange={(e) => onSortDirChange(e.target.value)}
                className={`${ADMIN_LIST_FIELD_CLASS} lg:col-span-1`}
                aria-label="Sort direction"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            ) : null}
          </>
        ) : null}
        {showDateRange ? (
          <>
            <label className="flex flex-col gap-1 lg:col-span-2">
              <span className={dateLabelClass}>From date</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                max={toDate || undefined}
                className={`${ADMIN_LIST_FIELD_CLASS} min-w-0 w-full`}
                aria-label="From date"
              />
            </label>
            <label className="flex flex-col gap-1 lg:col-span-2">
              <span className={dateLabelClass}>To date</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                min={fromDate || undefined}
                className={`${ADMIN_LIST_FIELD_CLASS} min-w-0 w-full`}
                aria-label="To date"
              />
            </label>
          </>
        ) : null}
      </div>
      <div className="mt-2">{metaRow}</div>
    </div>
  );
}
