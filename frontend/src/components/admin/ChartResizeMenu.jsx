import React, { useEffect, useRef, useState } from "react";

/**
 * A small ≡▾ button that opens a dropdown with a visual column-span picker.
 * Drop it anywhere inside a chart card header as an `action` prop.
 *
 * Props:
 *   colSpan  – current column span (number)
 *   maxCols  – total columns in the parent grid (default 3)
 *   onChange – (newSpan: number) => void
 */
export default function ChartResizeMenu({ colSpan, maxCols = 3, onChange }) {
  const [open, setOpen] = useState(false);
  const [resizeExpanded, setResizeExpanded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setResizeExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const sizes = Array.from({ length: maxCols }, (_, i) => i + 1);

  return (
    <div className="relative shrink-0" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setResizeExpanded(false); }}
        className="inline-flex items-center gap-1 rounded-lg border admin-border bg-white/70 px-2 py-1.5 text-slate-500 transition-colors hover:bg-[rgba(var(--admin-primary-rgb),0.08)] dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)]"
        aria-label="Chart options"
        title="Chart options"
      >
        {/* hamburger */}
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 16 16" strokeWidth="1.8" strokeLinecap="round">
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
        {/* chevron-down */}
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-44 rounded-xl border admin-border admin-surface shadow-2xl">
          {/* Resize row */}
          <div
            className="flex cursor-pointer items-center justify-between gap-2 rounded-t-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-[rgba(var(--admin-primary-rgb),0.08)] dark:text-slate-200 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)] select-none"
            onClick={() => setResizeExpanded((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M8 9l4-4 4 4M8 15l4 4 4-4M5 12h14" />
              </svg>
              Resize
            </span>
            <svg
              className={`h-3 w-3 shrink-0 transition-transform ${resizeExpanded ? "rotate-90" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Size picker — expands in-place */}
          {resizeExpanded && (
            <div className="border-t admin-border px-3 pb-3 pt-2">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Columns width
              </p>
              <div className="flex gap-1.5">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    title={`${s} of ${maxCols} columns`}
                    onClick={() => { onChange(s); setOpen(false); setResizeExpanded(false); }}
                    className={`flex flex-1 flex-col items-stretch gap-1 rounded-md border p-1.5 transition-all ${
                      colSpan === s
                        ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.12)] shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-[color:var(--admin-primary)] hover:bg-[rgba(var(--admin-primary-rgb),0.06)]"
                    }`}
                  >
                    {/* Visual: filled cells = chosen span, empty = remainder */}
                    <div className="flex gap-0.5">
                      {sizes.map((cell) => (
                        <div
                          key={cell}
                          className={`h-2 flex-1 rounded-sm transition-colors ${
                            cell <= s
                              ? "bg-[color:var(--admin-primary)] opacity-90"
                              : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-center text-[9px] font-semibold leading-none text-slate-500 dark:text-slate-400">
                      {s}/{maxCols}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
