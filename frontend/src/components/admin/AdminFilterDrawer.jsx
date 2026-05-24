import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { pushAdminModalChrome, popAdminModalChrome } from "../../lib/adminDarkChrome.js";

/**
 * @typedef {{ id: string, title: string, options: Array<{ value: string, label: string, count?: number }> }} FilterSection
 */

export function AdminFilterToolbarButton({
    activeCount = 0,
    onClick,
    className = "",
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 ${className}`}
        >
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M10 12h4M12 16h0" />
            </svg>
            Filter
            {activeCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--admin-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {activeCount}
                </span>
            ) : null}
        </button>
    );
}

export default function AdminFilterDrawer({
    open,
    onClose,
    sections = [],
    selected = {},
    onToggle,
    onApply,
    onClearAll,
    applyLabel = "Filter",
}) {
    const titleId = useId();

    useEffect(() => {
        if (!open) return undefined;
        pushAdminModalChrome();
        const onKey = (ev) => {
            if (ev.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            popAdminModalChrome();
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex justify-end">
            <div
                className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
                onClick={onClose}
                aria-hidden
            />
            <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative flex h-full w-full max-w-[22rem] flex-col border-l border-slate-200/90 bg-white shadow-2xl dark:border-slate-700/90 dark:bg-slate-900"
                onClick={(ev) => ev.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4 dark:border-slate-700/90">
                    <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-50">
                        Filters
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Close filters"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {sections.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No filters for this page.</p>
                    ) : (
                        <div className="space-y-6">
                            {sections.map((section) => (
                                <div key={section.id}>
                                    <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {section.title}
                                    </h3>
                                    {section.options.length === 0 ? (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">No options yet</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {section.options.map((option) => {
                                                const checked = (selected[section.id] || []).includes(option.value);
                                                return (
                                                    <li key={option.value}>
                                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-slate-300 text-[color:var(--admin-primary)] focus:ring-[color:var(--admin-primary)] dark:border-slate-600"
                                                                checked={checked}
                                                                onChange={() => onToggle(section.id, option.value)}
                                                            />
                                                            <span className="flex-1 font-medium">{option.label}</span>
                                                            {option.count != null ? (
                                                                <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                                                                    {option.count}
                                                                </span>
                                                            ) : null}
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200/90 px-5 py-4 dark:border-slate-700/90">
                    {onClearAll ? (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="text-sm font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            Clear all
                        </button>
                    ) : (
                        <span />
                    )}
                    <button
                        type="button"
                        onClick={onApply}
                        className="rounded-lg bg-[color:var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(var(--admin-primary-rgb),0.35)] transition hover:brightness-110"
                    >
                        {applyLabel}
                    </button>
                </div>
            </aside>
        </div>,
        document.body,
    );
}
