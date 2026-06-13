import React from "react";
import { ExternalLink, Truck } from "lucide-react";
import { courierTrackLabel } from "../lib/courierTracking.js";

export default function ExternalCourierTrackButton({
  url,
  provider,
  className = "",
  label,
  compact = false,
}) {
  const href = String(url || "").trim();
  if (!href) return null;

  const courier = courierTrackLabel(provider);
  const text = label || `Track on ${courier}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
      }
    >
      <Truck className={compact ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"} />
      <span>{text}</span>
      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
    </a>
  );
}
