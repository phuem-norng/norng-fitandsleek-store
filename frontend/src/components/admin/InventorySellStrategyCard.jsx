import React, { useEffect, useState } from "react";
import api from "../../lib/api";

/**
 * Global website FIFO strategy — older vs newer stock first.
 */
export default function InventorySellStrategyCard({
  canEdit = false,
  sellOldFirst: sellOldFirstProp = true,
  onSaved,
  className = "",
  compact = false,
}) {
  const [sellOldFirst, setSellOldFirst] = useState(sellOldFirstProp);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setSellOldFirst(sellOldFirstProp !== false);
  }, [sellOldFirstProp]);

  const save = async (nextSellOldFirst) => {
    if (!canEdit || saving || nextSellOldFirst === sellOldFirst) return;
    setSaving(true);
    setErr("");
    try {
      const { data } = await api.put("/admin/inventory-settings", { sell_old_first: nextSellOldFirst });
      const saved = Boolean(data?.data?.sell_old_first);
      setSellOldFirst(saved);
      await onSaved?.(saved);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not save sell strategy.");
    } finally {
      setSaving(false);
    }
  };

  const toggleButtons = canEdit ? (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <button
        type="button"
        disabled={saving || sellOldFirst}
        onClick={() => save(true)}
        className={`inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold transition ${
          sellOldFirst
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
        }`}
      >
        Old first
      </button>
      <button
        type="button"
        disabled={saving || !sellOldFirst}
        onClick={() => save(false)}
        className={`inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold transition ${
          !sellOldFirst
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
        }`}
      >
        Newer first
      </button>
    </div>
  ) : (
    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
      {sellOldFirst ? "Old first" : "Newer first"}
    </p>
  );

  const fullToggleButtons = canEdit ? (
    <div className="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        disabled={saving || sellOldFirst}
        onClick={() => save(true)}
        className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition ${
          sellOldFirst
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "border border-slate-300 bg-transparent text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        Sell old stock first
      </button>
      <button
        type="button"
        disabled={saving || !sellOldFirst}
        onClick={() => save(false)}
        className={`inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition ${
          !sellOldFirst
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "border border-slate-300 bg-transparent text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        Sell newer stock first
      </button>
    </div>
  ) : (
    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
      {sellOldFirst ? "Sell old stock first" : "Sell newer stock first"}
    </p>
  );

  if (compact === "catalog") {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Each PO creates a lot with its own price &amp; qty. Website price follows the lot selling next.
          </p>
          {fullToggleButtons}
        </div>
        {err ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`.trim()}>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Sell strategy</span>
          {" · "}
          Website price = next sellable lot
        </p>
        {toggleButtons}
        {err ? <p className="w-full text-[11px] text-red-600 dark:text-red-400">{err}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Website sell strategy</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Customers see one product. Price follows the lot that would sell next. POS can still scan a specific lot
            barcode.
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || sellOldFirst}
              onClick={() => save(true)}
              className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition ${
                sellOldFirst
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              }`}
            >
              Sell old stock first
            </button>
            <button
              type="button"
              disabled={saving || !sellOldFirst}
              onClick={() => save(false)}
              className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition ${
                !sellOldFirst
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              }`}
            >
              Sell newer stock first
            </button>
          </div>
        ) : (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {sellOldFirst ? "Sell old stock first" : "Sell newer stock first"}
          </p>
        )}
      </div>
      {err ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{err}</p> : null}
    </div>
  );
}
