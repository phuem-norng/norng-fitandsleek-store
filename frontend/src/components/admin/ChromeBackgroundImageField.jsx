import React from "react";
import { resolveImageUrl } from "../../lib/images";
import { buildStorefrontChromeStyle } from "../../lib/storefrontChrome.js";

/**
 * Upload / preview / remove chrome background image for header or footer.
 */
export default function ChromeBackgroundImageField({
  label,
  description,
  imageUrl = "",
  tintColor = "#6e8b7e",
  disabled = false,
  onFileSelect,
  onRemove,
  extraActions = null,
}) {
  const resolved = imageUrl ? resolveImageUrl(imageUrl) : "";

  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-950/30">
      <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</label>
      {description ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        {resolved ? (
          <div
            className="h-20 w-full max-w-[10rem] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center dark:border-slate-600"
            style={{ backgroundImage: `url(${resolved})` }}
            role="img"
            aria-label={`${label} preview`}
          />
        ) : (
          <div className="flex h-20 w-full max-w-[10rem] shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-600">
            No image
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect?.(file);
              e.target.value = "";
            }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[color:var(--admin-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110 disabled:opacity-50 dark:text-slate-300"
          />
          {imageUrl ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="self-start text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              Remove image
            </button>
          ) : null}
          {extraActions}
        </div>
      </div>
      <div
        className="mt-3 min-h-[2.5rem] rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-600"
        style={buildStorefrontChromeStyle({
          backgroundColor: tintColor,
          textColor: "#ffffff",
          backgroundImage: imageUrl,
        })}
      >
        Preview
      </div>
    </div>
  );
}
