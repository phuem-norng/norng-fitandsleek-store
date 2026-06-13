import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { resolveImageUrl } from "../../lib/images";
import { catalogLotPricingHint, formatCatalogLotMoney } from "../../lib/catalogLotPricing.js";

const EMPTY = "-";

function formatMoney(value) {
  if (value == null || value === "") return EMPTY;
  const n = Number(value);
  if (Number.isNaN(n)) return EMPTY;
  return `$${n.toFixed(2)}`;
}

function sizesList(rawSizes) {
  if (Array.isArray(rawSizes)) {
    return rawSizes.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof rawSizes === "string" && rawSizes.trim()) {
    return rawSizes.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function colorSwatches(rawColors) {
  if (rawColors == null || rawColors === "") return [];
  if (typeof rawColors === "string") {
    return rawColors.split(",").map((n) => ({ name: n.trim(), image_url: "" })).filter((c) => c.name);
  }
  if (!Array.isArray(rawColors)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawColors) {
    const name = typeof item === "string"
      ? item.trim()
      : String(item?.name ?? item?.label ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      image_url: typeof item === "object" ? String(item?.image_url ?? item?.imageUrl ?? "").trim() : "",
    });
  }
  return out;
}

function parseGallery(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function DetailField({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

export default function ProductDetailDrawer({
  product,
  open,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !product) return null;

  const gallery = parseGallery(product.gallery);
  const photos = [product.image_url, ...gallery].filter(Boolean);
  const sizes = sizesList(product.sizes);
  const colors = colorSwatches(product.colors);
  const brand = String(product?.brand?.name ?? "").trim() || EMPTY;
  const category = String(product?.category?.name ?? "").trim() || EMPTY;
  const description = String(product?.description ?? "").trim();

  return createPortal(
    <div className="fixed inset-0 z-[60]" aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:border-slate-700 dark:bg-slate-900 sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-drawer-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Product detail</p>
            <h2 id="product-detail-drawer-title" className="mt-0.5 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
              {product.name || "Product"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {photos.length > 0 ? (
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Product photos</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-800 ${
                      idx === 0 ? "border-[color:var(--admin-primary)] ring-2 ring-[rgba(var(--admin-primary-rgb),0.2)]" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
                    {idx === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white bg-[color:var(--admin-primary)]">
                        Cover
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-4">
            <DetailField label="Brand">{brand}</DetailField>
            <DetailField label="Category">{category}</DetailField>
            <DetailField label="Cost price">
              {product?.pricing_source === "inventory_lot"
                ? formatCatalogLotMoney(product, "cost")
                : formatMoney(product.cost_price)}
            </DetailField>
            <DetailField label="Sell price">
              <span className="font-semibold tabular-nums">
                {product?.pricing_source === "inventory_lot"
                  ? formatCatalogLotMoney(product, "sell")
                  : formatMoney(product.price)}
              </span>
              {catalogLotPricingHint(product) ? (
                <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">{catalogLotPricingHint(product)}</p>
              ) : null}
            </DetailField>
            <DetailField label="Status">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  product.is_active
                    ? "border-[rgba(var(--admin-primary-rgb),0.35)] bg-[rgba(var(--admin-primary-rgb),0.08)] text-[color:var(--admin-primary)]"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {product.is_active ? "Active" : "Inactive"}
              </span>
            </DetailField>
          </dl>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {description || EMPTY}
            </p>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sizes available</p>
            {sizes.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sizes.map((size) => (
                  <span
                    key={size}
                    className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {size}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{EMPTY}</p>
            )}
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Colors available</p>
            {colors.length > 0 ? (
              <div className="mt-2 space-y-2">
                {colors.map((color) => (
                  <div
                    key={color.name}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                      {color.image_url ? (
                        <img src={resolveImageUrl(color.image_url)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                          {color.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{color.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{EMPTY}</p>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
