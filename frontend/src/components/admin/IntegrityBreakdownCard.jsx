import React from "react";

/**
 * Visual proof card: batches → total received → in stock vs sold (matches integrity monitor mockup).
 */
export default function IntegrityBreakdownCard({ row, className = "" }) {
    if (!row) return null;

    const onHand = Math.max(0, Number(row.on_hand) || 0);
    const sold = Math.max(0, Number(row.implied_sold_or_issued) || 0);
    const total = Math.max(0, Number(row.total_received) || 0);
    const expectedOnHand =
        row.corrected_on_hand != null
            ? Math.max(0, Number(row.corrected_on_hand) || 0)
            : Math.max(0, total - sold);
    const onHandMismatch = onHand !== expectedOnHand;
    const breakdown = Array.isArray(row.receive_breakdown) ? row.receive_breakdown : [];
    const stackTotal = expectedOnHand + sold;
    const stockPct = stackTotal > 0 ? (expectedOnHand / stackTotal) * 100 : 50;
    const soldPct = stackTotal > 0 ? (sold / stackTotal) * 100 : 50;
    const minSectionPct = stackTotal > 0 ? 18 : 50;

    const adjustedStockPct = expectedOnHand > 0 && stockPct < minSectionPct ? minSectionPct : stockPct;
    const adjustedSoldPct = sold > 0 && soldPct < minSectionPct ? minSectionPct : soldPct;
    const sumPct = adjustedStockPct + adjustedSoldPct;
    const normStock = sumPct > 0 ? (adjustedStockPct / sumPct) * 100 : 50;
    const normSold = sumPct > 0 ? (adjustedSoldPct / sumPct) * 100 : 50;

    const batchLine = breakdown
        .map((b) => `${b.label}: +${b.quantity}`)
        .join(" | ");

    return (
        <div
            className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Inventory Integrity Monitor
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {row.name}
                        <span className="mx-1 text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-mono">{row.slug}</span>
                    </p>
                </div>
            </div>

            {batchLine ? (
                <p className="mt-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                    {batchLine}
                </p>
            ) : (
                <p className="mt-3 text-center text-xs text-slate-400">No receive batches recorded</p>
            )}

            <div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-inner dark:border-slate-600">
                <div
                    className="flex min-h-[140px] flex-col"
                    style={{ height: "168px" }}
                >
                    {expectedOnHand > 0 && (
                        <div
                            className="flex flex-1 flex-col items-center justify-center bg-emerald-100/90 px-3 text-center dark:bg-emerald-500/20"
                            style={{ flexBasis: `${normStock}%`, minHeight: expectedOnHand > 0 ? "3.5rem" : 0 }}
                        >
                            <span className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                                {expectedOnHand}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300/90">
                                In Stock
                            </span>
                        </div>
                    )}
                    {sold > 0 && (
                        <div
                            className="flex flex-1 flex-col items-center justify-center bg-orange-100/90 px-3 text-center dark:bg-orange-500/20"
                            style={{ flexBasis: `${normSold}%`, minHeight: sold > 0 ? "3.5rem" : 0 }}
                        >
                            <span className="text-2xl font-bold tabular-nums text-orange-800 dark:text-orange-200">
                                {sold}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-orange-700/90 dark:text-orange-300/90">
                                Sold
                            </span>
                        </div>
                    )}
                    {stackTotal === 0 && (
                        <div className="flex flex-1 items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            No stock movement
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-xs">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                        <span className="text-slate-600 dark:text-slate-300">Current Stock</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden />
                        <span className="text-slate-600 dark:text-slate-300">Sold Units</span>
                    </div>
                </div>
                <p className="text-right font-medium tabular-nums text-slate-700 dark:text-slate-200">
                    <span className="text-slate-900 dark:text-white">{total}</span>
                    {" "}
                    Total
                    <span className="mx-1 text-slate-400">−</span>
                    <span className="text-orange-600 dark:text-orange-400">{sold}</span>
                    {" "}
                    Sold
                    <span className="mx-1 text-slate-400">=</span>
                    <span className="text-emerald-700 dark:text-emerald-400">{expectedOnHand}</span>
                    {" "}
                    Stock
                </p>
                {onHandMismatch ? (
                    <p className="mt-2 text-center text-[11px] text-red-600 dark:text-red-400">
                        Current sellable on-hand is {onHand} (should be {expectedOnHand}). Use Fix to correct.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
