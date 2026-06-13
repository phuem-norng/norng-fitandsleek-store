import React from "react";
import AdminModal from "./AdminModal.jsx";
import VariantBarcodePreview from "./VariantBarcodePreview.jsx";
import { resolveImageUrl } from "../../lib/images";
import { parseVariantMatrix } from "../../lib/variantMatrix.js";
import { normalizeVariantBarcodeFormat } from "../../lib/variantBarcode.js";

/** All color × size rows for display (includes rows without barcode). */
function variantRowsForProduct(product) {
  if (!product) return [];
  const matrix = parseVariantMatrix(product.variant_matrix);
  if (matrix.length > 0) {
    return matrix.map((row) => ({
      color: row.color,
      size: row.size,
      qty: row.qty,
      barcode: String(row.sku_barcode || "").trim(),
      barcodeFormat: normalizeVariantBarcodeFormat(row.barcode_format),
    }));
  }
  const sku = String(product.sku || "").trim();
  if (sku || product.stock != null) {
    return [{
      color: null,
      size: null,
      qty: Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 0,
      barcode: sku,
    }];
  }
  return [];
}

export default function ProductVariantDetailModal({
  product,
  open,
  onClose,
  isDark = false,
  onEditProduct,
}) {
  if (!product) return null;

  const rows = variantRowsForProduct(product);
  const hasVariants = parseVariantMatrix(product.variant_matrix).length > 0;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={product.name || "Product"}
      titleId="product-variant-detail-title"
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            {product.image_url ? (
              <img
                src={resolveImageUrl(product.image_url)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
                {product.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            {product.brand?.name ? (
              <p className="text-slate-500 dark:text-slate-400">{product.brand.name}</p>
            ) : null}
            {product.category?.name ? (
              <p className="text-slate-600 dark:text-slate-300">
                Category: <span className="font-medium">{product.category.name}</span>
              </p>
            ) : null}
            <p className="text-slate-600 dark:text-slate-300">
              Price: <span className="font-semibold text-slate-900 dark:text-slate-100">${product.price}</span>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Stock: <span className="font-semibold tabular-nums">{product.stock ?? 0}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasVariants
                ? `${rows.length} variant row${rows.length === 1 ? "" : "s"} (color × size)`
                : "Single product code (no color/size variants)"}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            No variant rows or product code yet. Edit this product to add Variant Barcode on each color and size.
          </p>
        ) : (
          <div className="max-h-[min(50vh,24rem)] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Color</th>
                  <th className="px-4 py-2.5">Size</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5">Variant barcode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, idx) => (
                  <tr key={`${row.color}-${row.size}-${idx}`} className="bg-white dark:bg-slate-900">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {row.color || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.size || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {row.qty}
                    </td>
                    <td className="px-4 py-3">
                      {row.barcode ? (
                        <VariantBarcodePreview
                          value={row.barcode}
                          format={row.barcodeFormat}
                          isDark={isDark}
                        />
                      ) : (
                        <span className="font-sans text-xs text-slate-400 dark:text-slate-500">Not set</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
          {onEditProduct ? (
            <button
              type="button"
              onClick={() => onEditProduct(product)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--admin-primary)] px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              Edit in Products
            </button>
          ) : null}
        </div>
      </div>
    </AdminModal>
  );
}
