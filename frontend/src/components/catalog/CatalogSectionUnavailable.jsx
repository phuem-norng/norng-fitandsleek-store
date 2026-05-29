import React from "react";
import { useLanguage } from "../../lib/i18n.jsx";

/**
 * Standard empty / unavailable block for homepage catalog sections.
 * Used when the API is down, DB is empty, or assets cannot be loaded.
 */
export default function CatalogSectionUnavailable({
  message,
  hint,
  className = "",
  minHeight = "min-h-[120px] sm:min-h-[140px]",
}) {
  const { t } = useLanguage();
  const text = message ?? t("sectionDegradedVisibleHint");
  const subtext = hint ?? null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-dashed border-zinc-200/80 bg-zinc-50/40 ${minHeight} flex flex-col items-center justify-center gap-2.5 px-4 py-5 ${className}`}
    >
      <span className="sr-only">{text}</span>
      <span
        className="inline-block h-1 w-10 rounded-full bg-zinc-300/90 animate-pulse"
        aria-hidden
      />
      <p className="text-center text-xs sm:text-sm text-zinc-500 max-w-md">{text}</p>
      {subtext ? (
        <p className="text-center text-[11px] sm:text-xs text-zinc-400 max-w-md">{subtext}</p>
      ) : null}
    </div>
  );
}
