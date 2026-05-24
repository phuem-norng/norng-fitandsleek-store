import React, { useEffect, useId, useRef, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

/**
 * Dropdown offering PDF and Excel export for admin report actions.
 */
export default function AdminReportExportMenu({
  onExportPdf,
  onExportExcel,
  disabled = false,
  busy = false,
  label = "Export",
  className = "",
  accentColor,
  mode = "light",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const borderColor = accentColor || "var(--admin-primary)";
  const surfaceStyle =
    mode === "dark"
      ? { backgroundColor: "rgba(255,255,255,0.08)", color: borderColor, borderColor }
      : { backgroundColor: "transparent", color: borderColor, borderColor };

  const run = async (handler) => {
    setOpen(false);
    if (!handler || busy || disabled) return;
    await handler();
  };

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-slate-800"
        style={surfaceStyle}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v9m0 0l-3-3m3 3l3-3M6 18h12" />
        </svg>
        <span>{busy ? "Exporting…" : label}</span>
        <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
            onClick={() => run(onExportPdf)}
          >
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden />
            PDF
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
            onClick={() => run(onExportExcel)}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Excel
          </button>
        </div>
      ) : null}
    </div>
  );
}
