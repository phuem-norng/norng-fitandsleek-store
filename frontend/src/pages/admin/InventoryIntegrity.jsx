import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { errorAlert, loadingAlert, closeSwal, toastSuccess, warningConfirm } from "../../lib/swal";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import IntegrityBreakdownCard from "../../components/admin/IntegrityBreakdownCard.jsx";
import { useTheme } from "../../state/theme.jsx";

const STATUS_META = {
    ok: {
        label: "OK",
        pill: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
    },
    warning: {
        label: "Warning",
        pill: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
    },
    error: {
        label: "Error",
        pill: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/30",
    },
};

export default function InventoryIntegrity() {
    const { primaryColor } = useTheme();
    const [loading, setLoading] = useState(true);
    const [repairBusy, setRepairBusy] = useState(false);
    const [summary, setSummary] = useState({ total: 0, ok: 0, warning: 0, error: 0 });
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/admin/inventory-integrity");
            const payload = data?.data ?? data;
            setSummary(payload?.summary ?? { total: 0, ok: 0, warning: 0, error: 0 });
            setItems(Array.isArray(payload?.items) ? payload.items : []);
        } catch (e) {
            const msg = e?.response?.data?.message || "Could not load inventory integrity report.";
            await errorAlert({ enTitle: "Load failed", detail: msg });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((row) => {
            if (filter !== "all" && row.status !== filter) return false;
            if (!q) return true;
            return (
                String(row.name || "").toLowerCase().includes(q)
                || String(row.slug || "").toLowerCase().includes(q)
            );
        });
    }, [items, filter, search]);

    const selectedRow = useMemo(() => {
        if (!filtered.length) return null;
        const id = selectedId != null ? String(selectedId) : String(filtered[0].id);
        return filtered.find((r) => String(r.id) === id) ?? filtered[0];
    }, [filtered, selectedId]);

    useEffect(() => {
        if (!filtered.length) {
            setSelectedId(null);
            return;
        }
        const stillVisible = filtered.some((r) => String(r.id) === String(selectedId));
        if (!stillVisible) {
            setSelectedId(filtered[0].id);
        }
    }, [filtered, selectedId]);

    const runRepair = async (masterId = null) => {
        const confirmRes = await warningConfirm({
            enTitle: masterId ? "Recalculate this label?" : "Recalculate all labels?",
            enText: masterId
                ? "On-hand stock will be synced from Stock Received totals while preserving implied sold/issued units."
                : "All tracked labels with issues (or receive batches) will be recalculated.",
            enConfirm: "Recalculate",
            intent: "primary",
        });
        if (!confirmRes.isConfirmed) return;

        setRepairBusy(true);
        loadingAlert({
            enTitle: "Recalculating…",
            enText: "Please wait",
            khTitle: "កំពុងគណនា…",
            khText: "សូមរង់ចាំ",
        });
        try {
            const body = masterId != null ? { master_id: masterId } : {};
            await api.post("/admin/inventory-integrity/repair", body);
            closeSwal();
            await toastSuccess({
                enText: masterId ? "Label stock recalculated." : "Inventory stock recalculated.",
                khText: "បានគណនាស្តុកឡើងវិញ",
            });
            const { data } = await api.get("/admin/inventory-integrity");
            const payload = data?.data ?? data;
            setSummary(payload?.summary ?? { total: 0, ok: 0, warning: 0, error: 0 });
            setItems(Array.isArray(payload?.items) ? payload.items : []);
        } catch (e) {
            closeSwal();
            const msg = e?.response?.data?.message || "Recalculate failed.";
            await errorAlert({ enTitle: "Failed", detail: msg });
        } finally {
            setRepairBusy(false);
        }
    };

    if (loading) {
        return <AdminContentSkeleton rows={8} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                        Inventory Integrity Monitor
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                        Total received matches the Stock Received log (does not change when you sell).
                        Sold / issued = total received − on-hand (plus paid order history when linked).
                        If on-hand is higher than received, use Fix to correct sellable stock — not the receive log.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => load()}
                        disabled={repairBusy}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => runRepair()}
                        disabled={repairBusy}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Recalculate all
                    </button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { key: "total", label: "Tracked labels", value: summary.total, tone: "text-slate-900 dark:text-white" },
                    { key: "ok", label: "OK", value: summary.ok, tone: "text-emerald-700 dark:text-emerald-300" },
                    { key: "warning", label: "Warnings", value: summary.warning, tone: "text-amber-700 dark:text-amber-300" },
                    { key: "error", label: "Errors", value: summary.error, tone: "text-red-700 dark:text-red-300" },
                ].map((card) => (
                    <div
                        key={card.key}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {card.label}
                        </p>
                        <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.tone}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {["all", "error", "warning", "ok"].map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setFilter(key)}
                            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                                filter === key
                                    ? "bg-slate-900 text-white ring-slate-900 dark:bg-[#f0f6fc] dark:text-[#0f172a] dark:ring-[#f0f6fc]"
                                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
                            }`}
                        >
                            {key === "all" ? "All" : STATUS_META[key]?.label ?? key}
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or barcode…"
                    className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
                <div className="order-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:order-1">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                            <tr>
                                <th className="px-4 py-3">Label</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">On-hand</th>
                                <th className="px-4 py-3 text-right">Total received</th>
                                <th className="px-4 py-3 text-right">Sold / issued</th>
                                <th className="px-4 py-3 text-right">Batches</th>
                                <th className="px-4 py-3">Issues</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                                        No labels match this filter.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const meta = STATUS_META[row.status] ?? STATUS_META.ok;
                                    const isSelected = selectedRow && String(selectedRow.id) === String(row.id);
                                    return (
                                        <tr
                                            key={row.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedId(row.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setSelectedId(row.id);
                                                }
                                            }}
                                            className={`cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                                isSelected
                                                    ? "bg-slate-100/90 ring-1 ring-inset ring-slate-300 dark:bg-slate-800/80 dark:ring-slate-600"
                                                    : ""
                                            }`}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900 dark:text-white">{row.name}</div>
                                                <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.slug}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.pill}`}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums font-medium">{row.on_hand}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                                {row.total_received}
                                                {row.opening_receipt != null && (
                                                    <div className="text-xs text-slate-400">
                                                        opening {row.opening_receipt}
                                                        {row.batch_received_total > 0 ? ` + batches ${row.batch_received_total}` : ""}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">{row.implied_sold_or_issued}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{row.batch_count}</td>
                                            <td className="px-4 py-3">
                                                {row.issues?.length ? (
                                                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                                                        {row.issues.map((issue) => (
                                                            <li key={issue.code}>{issue.message}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        to={`/admin/stock-inventory/${row.id}/edit`}
                                                        className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                                    >
                                                        Inventory
                                                    </Link>
                                                    {row.can_repair && row.status !== "ok" && (
                                                        <button
                                                            type="button"
                                                            disabled={repairBusy}
                                                            onClick={() => runRepair(row.id)}
                                                            className="text-xs font-medium disabled:opacity-50"
                                                            style={{ color: primaryColor }}
                                                        >
                                                            Fix
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Click a row to view the stock breakdown chart.
                </p>
            </div>

                <div className="order-1 lg:sticky lg:top-4 lg:order-2 lg:self-start">
                    {selectedRow ? (
                        <IntegrityBreakdownCard row={selectedRow} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                            Select a label from the table to see the integrity breakdown.
                        </div>
                    )}
                </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
                Tip: after editing Stock Received rows, run Recalculate to sync Stock &amp; Inventory on-hand.
                {" "}
                <Link to="/admin/stock-received" className="underline hover:text-slate-700 dark:hover:text-slate-200">
                    Stock Received
                </Link>
                {" · "}
                <Link to="/admin/stock-inventory" className="underline hover:text-slate-700 dark:hover:text-slate-200">
                    Stock &amp; Inventory
                </Link>
            </p>
        </div>
    );
}
