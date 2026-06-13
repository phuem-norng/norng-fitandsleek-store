import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { resolveImageUrl } from "../lib/images";
import api from "../lib/api";

function itemQty(orderItem) {
  return Number(orderItem?.qty ?? orderItem?.quantity ?? 1);
}

function emptySelection(orderItems = []) {
  return Object.fromEntries(
    orderItems.map((item) => [
      item.id,
      {
        selected: false,
        quantity: itemQty(item),
        requested_size: "",
        requested_color: "",
        note: "",
      },
    ]),
  );
}

export default function ReplacementRequestModal({
  open,
  onClose,
  order,
  onSuccess,
  t = (key, fallback) => fallback || key,
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const orderItems = useMemo(() => order?.items || [], [order]);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("modal-open");
      document.documentElement.classList.remove("modal-open");
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !order) return;
    setReason("");
    setNotes("");
    setSelection(emptySelection(orderItems));
    setError("");
  }, [open, order, orderItems]);

  if (!open || !order) return null;

  const selectedItems = orderItems.filter((item) => selection[item.id]?.selected);

  const toggleItem = (itemId) => {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected },
    }));
  };

  const updateField = (itemId, field, value) => {
    setSelection((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const submit = async () => {
    if (!selectedItems.length) {
      setError(t("replacementSelectItemsError"));
      return;
    }
    if (!reason.trim()) {
      setError(t("replacementReasonRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.post("/replacement-cases", {
        order_id: order.id,
        reason: reason.trim(),
        notes: notes.trim() || null,
        items: selectedItems.map((item) => ({
          order_item_id: item.id,
          quantity: Number(selection[item.id]?.quantity || itemQty(item)),
          requested_size: selection[item.id]?.requested_size?.trim() || null,
          requested_color: selection[item.id]?.requested_color?.trim() || null,
          note: selection[item.id]?.note?.trim() || null,
        })),
      });
      onSuccess?.();
      onClose?.();
    } catch (e) {
      setError(
        e?.response?.data?.message
          || e?.response?.data?.errors?.items?.[0]
          || t("replacementSubmitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="replacement-request-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("close")}
      />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-2xl rounded-xl sm:rounded-2xl bg-white p-4 sm:p-6 shadow-xl max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 id="replacement-request-title" className="text-base sm:text-lg font-bold">
              {t("requestReplacement")}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {t("orderNumber")} {order.order_number || order.id}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("replacementSelectItems")}
            </label>
            <div className="space-y-3">
              {orderItems.map((item) => {
                const maxQty = itemQty(item);
                const row = selection[item.id] || {};
                const name = item.product?.name || item.name || "Product";
                const variantParts = [item.size, item.color].filter(Boolean);

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 ${row.selected ? "border-[#6F8B7F] bg-[#f7faf9]" : "border-gray-200"}`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!row.selected}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1"
                      />
                      <div className="h-14 w-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                        <img
                          src={resolveImageUrl(item.product?.image_url)}
                          alt={name}
                          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t("qty")}: {maxQty}
                          {variantParts.length ? ` · ${variantParts.join(" / ")}` : ""}
                        </p>
                      </div>
                    </label>

                    {row.selected ? (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t("replacementQty")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={row.quantity}
                            onChange={(e) => updateField(item.id, "quantity", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t("replacementRequestedSize")}
                          </label>
                          <input
                            type="text"
                            value={row.requested_size}
                            onChange={(e) => updateField(item.id, "requested_size", e.target.value)}
                            placeholder="e.g. L"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t("replacementRequestedColor")}
                          </label>
                          <input
                            type="text"
                            value={row.requested_color}
                            onChange={(e) => updateField(item.id, "requested_color", e.target.value)}
                            placeholder="e.g. Black"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t("replacementItemNote")}
                          </label>
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateField(item.id, "note", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("replacementReasonPrompt")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F8B7F] focus:border-transparent outline-none text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("replacementNotesPrompt")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6F8B7F] focus:border-transparent outline-none text-sm sm:text-base"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm sm:text-base"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#6F8B7F] text-white hover:bg-[#5f786d] disabled:opacity-50 text-sm sm:text-base"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

export function ReplacementCaseItemsList({ caseItem, compact = false, t = (key, fallback) => fallback || key }) {
  const rows = caseItem?.items || [];
  const orderItems = caseItem?.order?.items || [];

  if (!rows.length) {
    if (!orderItems.length) {
      return (
        <p className="text-sm text-gray-500 italic">
          {t("replacementLegacyItems", "No products linked to this case yet.")}
        </p>
      );
    }

    return (
      <div className={`space-y-3 ${compact ? "" : "mt-2"}`}>
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg px-3 py-2">
          {t(
            "replacementLegacyOrderItems",
            "Customer did not pick specific items. These are all products from the original order — confirm what to send when completing.",
          )}
        </p>
        {orderItems.map((orderItem) => {
          const product = orderItem.product;
          const name = product?.name || orderItem.name || "Product";
          const variant = [orderItem.size, orderItem.color].filter(Boolean).join(" / ");

          return (
            <div key={orderItem.id} className="flex gap-3 rounded-lg border border-gray-200 p-3 bg-gray-50 dark:bg-white/5 dark:border-slate-700">
              <div className="h-12 w-12 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0">
                <img
                  src={resolveImageUrl(product?.image_url)}
                  alt={name}
                  onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-slate-100">{name}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                  {t("qty", "Qty")}: {orderItem.qty ?? orderItem.quantity ?? 1}
                  {variant ? ` · ${variant}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${compact ? "" : "mt-2"}`}>
      {rows.map((row) => {
        const orderItem = row.order_item || row.orderItem;
        const product = orderItem?.product;
        const name = product?.name || orderItem?.name || "Product";
        const currentVariant = [orderItem?.size, orderItem?.color].filter(Boolean).join(" / ");
        const requestedVariant = [row.requested_size, row.requested_color].filter(Boolean).join(" / ");

        return (
          <div key={row.id} className="flex gap-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="h-12 w-12 rounded-lg border border-gray-200 overflow-hidden bg-white shrink-0">
              <img
                src={resolveImageUrl(product?.image_url)}
                alt={name}
                onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-900">{name}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {t("qty", "Qty")}: {row.quantity}
                {currentVariant ? ` · ${currentVariant}` : ""}
              </p>
              {requestedVariant ? (
                <p className="text-xs text-[#6F8B7F] mt-1">
                  {t("replacementRequested", "Requested")}: {requestedVariant}
                </p>
              ) : null}
              {row.note ? <p className="text-xs text-gray-500 mt-1">{row.note}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
