import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, ChevronRight } from "lucide-react";
import {
  GROUP_BY_OPTIONS,
  MORE_SORT_OPTIONS,
  PRIMARY_SORT_OPTIONS,
} from "../../lib/productSort.js";

function SortDot({ active }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${active ? "" : "opacity-0"}`}
      aria-hidden
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[color:var(--admin-primary)] dark:bg-[color:var(--admin-primary)]"
      />
    </span>
  );
}

function MenuItem({ active, label, onClick, hasSubmenu = false, className = "" }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
    >
      <SortDot active={active} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hasSubmenu ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      ) : null}
    </button>
  );
}

function SubmenuPanel({ title, children, className = "" }) {
  return (
    <div
      className={`absolute left-full top-0 z-10 ml-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10 ${className}`}
      role="menu"
    >
      {title ? (
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export default function AdminSortMenu({
  sortBy,
  sortDir,
  groupBy,
  onSortByChange,
  onSortDirChange,
  onGroupByChange,
  className = "",
}) {
  const menuId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const isMoreSort = MORE_SORT_OPTIONS.some((o) => o.id === sortBy);
  const isCustomSort = sortBy !== "name" || sortDir !== "asc" || (groupBy && groupBy !== "none");

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setMoreOpen(false);
        setGroupOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMoreOpen(false);
        setGroupOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickSort = (id) => {
    onSortByChange(id);
    setOpen(false);
    setMoreOpen(false);
    setGroupOpen(false);
  };

  const pickGroup = (id) => {
    onGroupByChange(id);
    setOpen(false);
    setMoreOpen(false);
    setGroupOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${isCustomSort ? "ring-1 ring-[rgba(var(--admin-primary-rgb),0.25)]" : ""}`}
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden />
        Sort
        {isCustomSort ? (
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--admin-primary)]" aria-hidden />
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[15rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
        >
          {PRIMARY_SORT_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.id}
              active={sortBy === opt.id}
              label={opt.label}
              onClick={() => pickSort(opt.id)}
            />
          ))}

          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <MenuItem
              active={isMoreSort}
              label="More"
              hasSubmenu
              onClick={() => setMoreOpen((v) => !v)}
            />
            {moreOpen ? (
              <SubmenuPanel title="Sort by">
                {MORE_SORT_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.id}
                    active={sortBy === opt.id}
                    label={opt.label}
                    onClick={() => pickSort(opt.id)}
                  />
                ))}
              </SubmenuPanel>
            ) : null}
          </div>

          <div className="my-1 border-t border-slate-200 dark:border-slate-700" role="separator" />

          <MenuItem
            active={sortDir === "asc"}
            label="Ascending"
            onClick={() => onSortDirChange("asc")}
          />
          <MenuItem
            active={sortDir === "desc"}
            label="Descending"
            onClick={() => onSortDirChange("desc")}
          />

          <div className="my-1 border-t border-slate-200 dark:border-slate-700" role="separator" />

          <div
            className="relative"
            onMouseEnter={() => setGroupOpen(true)}
            onMouseLeave={() => setGroupOpen(false)}
          >
            <MenuItem
              active={groupBy && groupBy !== "none"}
              label="Group by"
              hasSubmenu
              onClick={() => setGroupOpen((v) => !v)}
            />
            {groupOpen ? (
              <SubmenuPanel title="Group by">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.id}
                    active={groupBy === opt.id}
                    label={opt.label}
                    onClick={() => pickGroup(opt.id)}
                  />
                ))}
              </SubmenuPanel>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
