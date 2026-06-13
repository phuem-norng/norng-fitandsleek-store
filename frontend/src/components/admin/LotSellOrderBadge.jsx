import React from "react";

export function SellsNextBadge({ className = "" }) {
  return (
    <span
      className={`mt-1.5 inline-flex rounded-md border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-300 ${className}`.trim()}
    >
      Website price
    </span>
  );
}

export function SellQueueBadge({ order }) {
  if (!order || order < 2) return null;
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Queue #{order}
    </span>
  );
}

export function SoldOutBadge() {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      Sold out
    </span>
  );
}
