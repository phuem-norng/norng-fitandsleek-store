import React, { useEffect, useMemo, useState } from "react";
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
      setError(t("replacementSelectItems", "Select at least one product to replace."));
      return;
    }
    if (!reason.trim()) {
      setError(t("replacementReasonPrompt", "Why do you need a replacement?"));
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
          || t("replacementSubmitFailed", "Failed to submit replacement request"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold">
              {t("requestReplacement", "Request Replacement")}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {t("orderNumber", "Order #")} {order.order_number || order.id}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("replacementSelectItems", "Which items do you want to replace?")}
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
                          {t("qty", "Qty")}: {maxQty}
                          {variantParts.length ? ` · ${variantParts.join(" / ")}` : ""}
                        </p>
                      </div>
                    </label>

                    {row.selected ? (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            {t("replacementQty", "Quantity to replace")}
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
                            {t("replacementRequestedSize", "Requested size (optional)")}
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
                            {t("replacementRequestedColor", "Requested color (optional)")}
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
                            {t("replacementItemNote", "Item note (optional)")}
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
              {t("replacementReasonPrompt", "Why do you need a replacement?")}
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
              {t("replacementNotesPrompt", "Any extra details? (optional)")}
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
            {t("cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#6F8B7F] text-white hover:bg-[#5f786d] disabled:opacity-50 text-sm sm:text-base"
          >
            {submitting ? (t("submitting", "Submitting...")) : (t("submit", "Submit"))}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReplacementCaseItemsList({ caseItem, compact = false, t = (key, fallback) => fallback || key }) {
  const rows = caseItem?.items || [];

  if (!rows.length) {
    return (
      <p className="text-sm text-gray-500 italic">
        {t("replacementLegacyItems", "No specific items recorded — check the full order.")}
      </p>
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
