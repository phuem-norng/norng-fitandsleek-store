import React from "react";
import {
  DEFAULT_VARIANT_BARCODE_FORMAT,
  VARIANT_BARCODE_FORMAT_OPTIONS,
  generateVariantBarcode,
  normalizeVariantBarcodeFormat,
  sanitizeVariantBarcodeInput,
  variantBarcodeMaxLength,
  variantBarcodePlaceholder,
} from "../../lib/variantBarcode.js";

const selectClass =
  "w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

const inputClass =
  "min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-[color:var(--admin-primary)] focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

const btnClass =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

const inputErrClass =
  "border-red-500 focus:border-red-500 focus:ring-red-200/60 dark:border-red-500 dark:focus:ring-red-900/40";

export default function VariantBarcodeFields({
  idPrefix,
  value = "",
  format = DEFAULT_VARIANT_BARCODE_FORMAT,
  disabled = false,
  invalid = false,
  onChange,
}) {
  const fmt = normalizeVariantBarcodeFormat(format);
  const maxLen = variantBarcodeMaxLength(fmt);

  return (
    <div className="min-w-0 sm:col-span-4">
      <label
        className={`mb-1 block text-xs font-medium ${
          invalid ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"
        }`}
        htmlFor={`${idPrefix}-format`}
      >
        Variant Barcode <span className="text-red-500" aria-hidden>*</span>
      </label>
      <select
        id={`${idPrefix}-format`}
        value={fmt}
        disabled={disabled}
        onChange={(e) => {
          const nextFmt = normalizeVariantBarcodeFormat(e.target.value);
          const patch = { barcode_format: nextFmt };
          if (value) {
            patch.sku_barcode = sanitizeVariantBarcodeInput(value, nextFmt);
          }
          onChange?.(patch);
        }}
        className={`${selectClass} mb-2${invalid ? ` ${inputErrClass}` : ""}`}
      >
        {VARIANT_BARCODE_FORMAT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex min-w-0 gap-2">
        <input
          id={`${idPrefix}-code`}
          value={value || ""}
          inputMode={fmt === "CODE128" ? "text" : "numeric"}
          maxLength={maxLen}
          onChange={(e) => {
            onChange?.({
              sku_barcode: sanitizeVariantBarcodeInput(e.target.value, fmt),
            });
          }}
          autoComplete="off"
          placeholder={variantBarcodePlaceholder(fmt)}
          disabled={disabled}
          className={`${inputClass}${invalid ? ` ${inputErrClass}` : ""}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange?.({
              sku_barcode: generateVariantBarcode(fmt),
              barcode_format: fmt,
            });
          }}
          className={btnClass}
        >
          Generate
        </button>
      </div>
    </div>
  );
}
