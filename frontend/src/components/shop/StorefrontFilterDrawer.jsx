import React, { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { STOREFRONT_SORT_OPTIONS } from "../../lib/storefrontProductFilters.js";
import { useTheme } from "../../state/theme.jsx";

function isLightPrimaryColor(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.82;
}

export function StorefrontFilterToolbarButton({ activeCount = 0, onClick, className = "" }) {
  const { primaryColor } = useTheme();
  const contrastDark = useMemo(() => isLightPrimaryColor(primaryColor), [primaryColor]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "fs-storefront-filter-btn relative shrink-0",
        contrastDark ? "fs-storefront-filter-btn--contrast-dark" : "",
        className,
      ].join(" ")}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      Filter
      {activeCount > 0 ? (
        <span className="fs-storefront-filter-btn__badge">{activeCount}</span>
      ) : null}
    </button>
  );
}

export default function StorefrontFilterDrawer({
  open,
  onClose,
  sections = [],
  selected = {},
  onToggle,
  onApply,
  onClearAll,
  applyLabel = "Apply filters",
  sortValue = "recommend",
  onSortChange,
  priceBounds = null,
  priceMin = "",
  priceMax = "",
  onPriceMinChange,
  onPriceMaxChange,
}) {
  const titleId = useId();
  const { primaryColor } = useTheme();
  const accent = primaryColor;
  const contrastDark = useMemo(() => isLightPrimaryColor(accent), [accent]);
  const accentText = contrastDark ? "#0b0b0f" : "#ffffff";

  const boundsMin = priceBounds?.min ?? 0;
  const boundsMax = priceBounds?.max ?? 100;
  const minVal = priceMin !== "" ? Number(priceMin) : boundsMin;
  const maxVal = priceMax !== "" ? Number(priceMax) : boundsMax;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleMinChange = (nextMin) => {
    const clamped = Math.min(Number(nextMin), maxVal);
    onPriceMinChange?.(String(clamped));
  };

  const handleMaxChange = (nextMax) => {
    const clamped = Math.max(Number(nextMax), minVal);
    onPriceMaxChange?.(String(clamped));
  };

  return createPortal(
    <div className="fs-filter-drawer fixed inset-0 z-[9998] flex justify-end">
      <div className="fs-filter-drawer__backdrop absolute inset-0" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fs-filter-drawer__panel relative flex h-full w-full max-w-[22rem] flex-col shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="fs-filter-drawer__header flex items-center justify-between px-5 py-4">
          <h2 id={titleId} className="fs-filter-drawer__title text-lg font-bold">
            Filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="fs-filter-drawer__close rounded-full p-2 transition"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <div>
              <h3 className="fs-filter-drawer__section-title mb-3 text-sm font-bold">Sort by</h3>
              <ul className="space-y-1">
                {STOREFRONT_SORT_OPTIONS.map((option) => (
                  <li key={option.value}>
                    <label className="fs-filter-drawer__option flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm transition">
                      <input
                        type="radio"
                        name="storefront-sort"
                        className="fs-filter-drawer__control h-4 w-4"
                        style={{ accentColor: accent }}
                        checked={sortValue === option.value}
                        onChange={() => onSortChange?.(option.value)}
                      />
                      <span className="flex-1 font-medium">{option.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {priceBounds && boundsMax > boundsMin ? (
              <div>
                <h3 className="fs-filter-drawer__section-title mb-2 text-sm font-bold">Price Range</h3>
                <p className="fs-filter-drawer__price-value mb-3 text-sm font-semibold">
                  ${Math.round(minVal)} – ${Math.round(maxVal)}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="fs-filter-drawer__hint mb-1 block text-xs">
                      Min ${Math.round(boundsMin)}
                    </label>
                    <input
                      type="range"
                      min={boundsMin}
                      max={boundsMax}
                      step={1}
                      value={minVal}
                      onChange={(e) => handleMinChange(e.target.value)}
                      className="fs-filter-drawer__range w-full"
                      style={{ accentColor: accent }}
                    />
                  </div>
                  <div>
                    <label className="fs-filter-drawer__hint mb-1 block text-xs">
                      Max ${Math.round(boundsMax)}
                    </label>
                    <input
                      type="range"
                      min={boundsMin}
                      max={boundsMax}
                      step={1}
                      value={maxVal}
                      onChange={(e) => handleMaxChange(e.target.value)}
                      className="fs-filter-drawer__range w-full"
                      style={{ accentColor: accent }}
                    />
                  </div>
                  <div className="fs-filter-drawer__hint flex items-center justify-between gap-2 text-xs font-medium">
                    <span>${Math.round(boundsMin)}</span>
                    <span>${Math.round(boundsMax)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {sections.map((section) => (
              <div key={section.id}>
                <h3 className="fs-filter-drawer__section-title mb-3 text-sm font-bold">{section.title}</h3>
                {section.options.length === 0 ? (
                  <p className="fs-filter-drawer__empty text-xs">No options yet</p>
                ) : section.id === "size" ? (
                  <div className="flex flex-wrap gap-2">
                    {section.options.map((option) => {
                      const checked = (selected[section.id] || []).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onToggle(section.id, option.value)}
                          className={`fs-filter-drawer__pill min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                            checked ? "fs-filter-drawer__pill--active" : ""
                          }`}
                          style={
                            checked
                              ? {
                                  backgroundColor: accent,
                                  borderColor: accent,
                                  color: accentText,
                                }
                              : undefined
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {section.options.map((option) => {
                      const checked = (selected[section.id] || []).includes(option.value);
                      return (
                        <li key={option.value}>
                          <label className="fs-filter-drawer__option flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-sm transition">
                            <input
                              type="checkbox"
                              className="fs-filter-drawer__control h-4 w-4 rounded"
                              style={{ accentColor: accent }}
                              checked={checked}
                              onChange={() => onToggle(section.id, option.value)}
                            />
                            <span className="flex-1 font-medium">{option.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="fs-filter-drawer__footer flex items-center justify-between gap-2 px-5 py-4">
          {onClearAll ? (
            <button type="button" onClick={onClearAll} className="fs-filter-drawer__clear text-sm font-semibold transition">
              Clear all
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onApply}
            className="fs-filter-drawer__apply rounded-full px-6 py-2.5 text-sm font-bold transition hover:brightness-110"
            style={{ backgroundColor: accent, color: accentText }}
          >
            {applyLabel}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
