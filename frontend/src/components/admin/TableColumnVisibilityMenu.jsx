import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 240;

export function TableColumnVisibilityMenu({
    columns,
    visibility,
    onToggle,
    onShowAll,
    onHideAll,
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0 });

    const isVisible = (columnId) => visibility[columnId] !== false;
    const visibleCount = columns.filter((col) => isVisible(col.id)).length;

    const updateMenuPosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const left = Math.min(
            Math.max(8, rect.right - MENU_WIDTH),
            window.innerWidth - MENU_WIDTH - 8,
        );
        setMenuStyle({
            top: rect.bottom + 8,
            left,
        });
    };

    useLayoutEffect(() => {
        if (!open) return undefined;
        updateMenuPosition();
        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (event) => {
            if (
                triggerRef.current?.contains(event.target)
                || menuRef.current?.contains(event.target)
            ) {
                return;
            }
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-9"
                aria-expanded={open}
                aria-haspopup="true"
                aria-label="Toggle column visibility"
            >
                <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Columns
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {visibleCount}/{columns.length}
                </span>
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
                    style={{ top: menuStyle.top, left: menuStyle.left, width: MENU_WIDTH }}
                    role="menu"
                    aria-label="Column visibility"
                >
                    <div className="border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Column visibility</p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                        {columns.map((col) => (
                            <label
                                key={col.id}
                                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                            >
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 dark:border-slate-600"
                                    checked={isVisible(col.id)}
                                    onChange={() => onToggle(col.id)}
                                />
                                {col.label}
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-2 border-t border-slate-100 p-2 dark:border-white/10">
                        <button
                            type="button"
                            onClick={() => {
                                onShowAll();
                            }}
                            className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                        >
                            Show all
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onHideAll();
                            }}
                            className="flex-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                        >
                            Hide all
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}

export function loadTableColumnVisibility(storageKey, columns) {
    const defaults = Object.fromEntries(columns.map((col) => [col.id, true]));
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return defaults;
        return { ...defaults, ...parsed };
    } catch {
        return defaults;
    }
}

export function buildAllColumnsVisibility(columns, visible, pinnedColumnId) {
    return Object.fromEntries(
        columns.map((col) => [col.id, visible || col.id === pinnedColumnId]),
    );
}
