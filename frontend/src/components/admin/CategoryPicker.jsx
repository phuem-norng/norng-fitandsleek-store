import React, { useEffect, useId, useMemo, useRef, useState } from "react";

function filterCategories(categories, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const slug = String(c.slug || "").toLowerCase();
        return name.includes(q) || slug.includes(q);
    });
}

export default function CategoryPicker({
    categories = [],
    value = "",
    onChange,
    labelCls,
    inputCls,
    disabled = false,
    emptyMessage = "No catalog categories yet. Add categories under Admin → Categories.",
    placeholder = "Search category…",
}) {
    const listId = useId();
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    const selected = value
        ? categories.find((c) => String(c.id) === String(value))
        : null;

    const options = useMemo(() => {
        const filtered = filterCategories(categories, query);
        if (!value || !selected || filtered.some((c) => String(c.id) === String(value))) {
            return filtered;
        }
        return [selected, ...filtered];
    }, [categories, query, value, selected]);

    useEffect(() => {
        const onPointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    useEffect(() => {
        setActiveIndex(0);
    }, [query, open]);

    const openList = () => {
        if (disabled) return;
        setOpen(true);
        setQuery(selected?.name || "");
        requestAnimationFrame(() => inputRef.current?.select());
    };

    const pick = (id) => {
        onChange(id ? String(id) : "");
        setOpen(false);
        setQuery("");
    };

    const onKeyDown = (e) => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            e.preventDefault();
            openList();
            return;
        }
        if (!open) return;

        if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQuery("");
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, options.length - 1));
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === "Enter" && options[activeIndex]) {
            e.preventDefault();
            pick(options[activeIndex].id);
        }
    };

    const displayValue = open ? query : (selected?.name || "");

    if (categories.length === 0) {
        return (
            <div ref={rootRef}>
                <label className={labelCls}>Category</label>
                <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {emptyMessage}
                </p>
            </div>
        );
    }

    return (
        <div ref={rootRef} className="relative">
            <label className={labelCls} htmlFor={listId}>
                Category
            </label>
            <div className="relative">
                <input
                    ref={inputRef}
                    id={listId}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    aria-controls={`${listId}-listbox`}
                    disabled={disabled}
                    value={displayValue}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        if (!e.target.value.trim()) onChange("");
                    }}
                    onFocus={openList}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    className={inputCls}
                    autoComplete="off"
                />
                {value && !open && (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pick("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                        aria-label="Clear category"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                {open && (
                    <ul
                        id={`${listId}-listbox`}
                        role="listbox"
                        className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-950/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10"
                    >
                        {options.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No categories found</li>
                        ) : (
                            options.map((c, idx) => (
                                <li key={c.id} role="option" aria-selected={String(value) === String(c.id)}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => pick(c.id)}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                                            idx === activeIndex
                                                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100"
                                                : String(value) === String(c.id)
                                                    ? "bg-slate-50 font-semibold text-slate-900 dark:bg-white/5 dark:text-slate-100"
                                                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                                        }`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                        {c.slug ? (
                                            <span className="shrink-0 text-xs font-mono text-slate-400">/{c.slug}</span>
                                        ) : null}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Type to search · {options.length} shown
            </p>
        </div>
    );
}
