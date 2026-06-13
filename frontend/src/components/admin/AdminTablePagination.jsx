import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPaginationPages } from "../../lib/adminListQuery.js";

const btnBase =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const btnDefault =
  `${btnBase} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`;
const pageBtn =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums transition";
const pageIdle =
  `${pageBtn} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`;
const pageActive =
  `${pageBtn} bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100`;

/**
 * Compact numbered pagination — Previous · 1 2 3 4 5 … 10 · Next
 */
export default function AdminTablePagination({ page, lastPage, onPageChange, className = "" }) {
  const items = useMemo(() => buildPaginationPages(page, lastPage), [page, lastPage]);

  if (lastPage <= 1) return null;

  return (
    <nav
      aria-label="Table pagination"
      className={`flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row md:px-6 md:py-4 dark:border-slate-800 ${className}`.trim()}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={btnDefault}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Previous
      </button>

      <div className="flex flex-wrap items-center justify-center gap-0.5">
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm font-semibold text-slate-400 dark:text-slate-500"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={item === page ? pageActive : pageIdle}
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
        className={btnDefault}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </button>
    </nav>
  );
}
