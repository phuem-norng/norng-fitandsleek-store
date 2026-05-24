import React, { useMemo } from "react";
import {
  buildYearOptions,
  MONTH_ALL,
  MONTH_OPTIONS,
  YEAR_ALL,
} from "../../lib/adminYearMonthFilter.js";

const SELECT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-600";

/**
 * @param {{ value: { year: string, month: string }, onChange: (next: { year: string, month: string }) => void, startYear?: number, title?: string, hint?: string }} props
 */
export default function AdminYearMonthFilter({
  value,
  onChange,
  startYear = 2020,
  title = "Date",
  hint = "Choose a year to see all records in that year, or pick a specific month.",
}) {
  const yearOptions = useMemo(() => buildYearOptions(startYear), [startYear]);
  const monthDisabled = !value?.year || value.year === YEAR_ALL;

  return (
    <div>
      <h3 className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {hint ? (
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Year
          </span>
          <select
            value={value?.year ?? YEAR_ALL}
            onChange={(e) => {
              const year = e.target.value;
              onChange({
                year,
                month: year === YEAR_ALL ? MONTH_ALL : value?.month ?? MONTH_ALL,
              });
            }}
            className={SELECT_CLASS}
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Month
          </span>
          <select
            value={value?.month ?? MONTH_ALL}
            disabled={monthDisabled}
            onChange={(e) => onChange({ ...value, month: e.target.value })}
            className={`${SELECT_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {MONTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
