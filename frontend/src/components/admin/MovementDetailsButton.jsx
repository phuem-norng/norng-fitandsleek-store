import React from "react";
import { ScrollText } from "lucide-react";

export default function MovementDetailsButton({ onClick, compact = false, label = "Details" }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Movement details"
        title="Details"
      >
        <ScrollText className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      title="Movement details"
    >
      <ScrollText className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
