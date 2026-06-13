import React from "react";
import Barcode from "react-barcode";
import { reactBarcodeFormat } from "../../lib/variantBarcode.js";

/**
 * Scannable variant barcode with human-readable digits under the bars (EAN-13 / UPC-A / Code 128).
 */
export default function VariantBarcodePreview({
  value,
  format,
  isDark = false,
  compact = false,
  className = "",
}) {
  const code = String(value || "").trim();
  if (!code) return null;

  return (
    <div
      className={`inline-flex max-w-full justify-center overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950 ${className}`}
    >
      <Barcode
        value={code}
        format={reactBarcodeFormat(format)}
        width={compact ? 1.1 : 1.35}
        height={compact ? 40 : 48}
        fontSize={compact ? 12 : 14}
        margin={compact ? 6 : 8}
        textMargin={4}
        displayValue
        background="#ffffff"
        lineColor={isDark ? "#e2e8f0" : "#1e293b"}
      />
    </div>
  );
}
