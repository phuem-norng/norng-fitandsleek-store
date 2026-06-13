import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../../lib/api";
import { useAdminPermissions } from "../../hooks/useAdminPermissions.js";
import { canUpdatePurchaseOrderReceiveStatus } from "../../lib/adminPermissions.js";
import { closeSwal, errorAlert, loadingAlert, toastSuccess } from "../../lib/swal";
import { getAdminValidationMessage } from "../../lib/adminValidation.js";
import {
  formatPoMoney,
  lineMoney,
  PO_STATUS_LABELS,
  poStatusBadgeClass,
} from "../../lib/purchaseOrderHelpers.js";

const EMPTY = "—";

function formatDate(value) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function DetailRow({ label, value, mono = false, className = "", required = false, multiline = false }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
        {label}
        {required ? <span className="normal-case tracking-normal text-red-500 ml-0.5">*</span> : null}
      </p>
      <p
        className={`mt-1 text-sm text-slate-800 dark:text-slate-100 ${mono ? "font-mono" : ""} ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value || EMPTY}
      </p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 pb-2">
      {children}
    </h3>
  );
}

export default function PurchaseOrderDetailDrawer({
  order,
  open,
  onClose,
  onUpdated,
  allowStatusActions = true,
}) {
  const { user } = useAdminPermissions();
  const canUpdateStatus = canUpdatePurchaseOrderReceiveStatus(user);
  const [busy, setBusy] = useState(false);

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

  if (!open || !order) return null;

  const supplier = order.supplier || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const totalCost = order.total_cost ?? items.reduce((s, row) => s + (Number(row.line_total_cost) || 0), 0);
  const stockReceived = order.stock_received;
  const status = order.status || "draft";
  const statusLabel = PO_STATUS_LABELS[status] || status;

  const updateStatus = async (nextStatus) => {
    if (busy || !order.id) return;
    setBusy(true);
    loadingAlert(nextStatus === "received" ? "Receiving stock…" : "Updating…");
    try {
      const { data } = await api.patch(`/admin/purchase-orders/${order.id}/status`, {
        status: nextStatus,
      });
      closeSwal();
      const updated = data?.data ?? data;
      onUpdated?.(updated);
      if (nextStatus === "received") {
        const units = updated?.stock_received?.total_units;
        await toastSuccess(
          units != null && units > 0
            ? `Received ${units} unit(s) into inventory.`
            : "Purchase order marked as received.",
        );
        if (updated?.stock_received?.warnings?.length) {
          errorAlert(updated.stock_received.warnings.join("\n"));
        }
      } else {
        await toastSuccess("Purchase order marked as pending.");
      }
    } catch (e) {
      closeSwal();
      errorAlert(getAdminValidationMessage(e, "Could not update purchase order status."));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" aria-hidden={!open}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-detail-drawer-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Purchase order
            </p>
            <h2
              id="po-detail-drawer-title"
              className="mt-0.5 truncate font-mono text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {order.po_number || "Purchase order"}
            </h2>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${poStatusBadgeClass(status)}`}
            >
              {statusLabel}
            </span>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-7">
          <section className="space-y-4">
            <SectionTitle>Order details</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="PO number" value={order.po_number} mono />
              <DetailRow label="Supplier" value={supplier.name} />
              <DetailRow label="Contact person" value={supplier.contact_person} />
              <DetailRow label="Phone" required value={supplier.phone} />
              <DetailRow label="Email" required value={supplier.email} />
              <DetailRow label="Country" value={supplier.country} />
              <DetailRow label="Address" value={supplier.address} multiline className="col-span-2" />
              <DetailRow label="Order date" value={formatDate(order.order_date)} />
              <DetailRow label="Expected date" value={formatDate(order.expected_delivery)} />
              <DetailRow label="Created" value={formatDateTime(order.created_at)} />
              <DetailRow label="Received" value={formatDateTime(order.received_at)} />
              <DetailRow label="Notes" value={order.notes} className="col-span-2" />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Line items</SectionTitle>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 w-10">#</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5">Qty</th>
                      <th className="px-3 py-2.5">Unit price</th>
                      <th className="px-3 py-2.5">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                          No line items
                        </td>
                      </tr>
                    ) : (
                      items.map((row, index) => {
                        const lineCost = row.line_total_cost ?? lineMoney(row.qty, row.cost_per_unit);
                        return (
                          <tr key={row.id ?? index}>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{index + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                              {row.product_name
                                || (row.product_id ? `Product #${row.product_id}` : EMPTY)}
                              {row.product_sku ? (
                                <span className="block text-xs font-mono text-slate-500 dark:text-slate-400">
                                  {row.product_sku}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">{row.qty ?? EMPTY}</td>
                            <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                              {formatPoMoney(row.cost_per_unit)}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                              {formatPoMoney(lineCost)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 px-4 py-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  Grand total: <strong className="text-slate-900 dark:text-slate-100">{formatPoMoney(totalCost)}</strong>
                </span>
              </div>
            </div>
          </section>

          {stockReceived?.received_lines > 0 ? (
            <section className="space-y-2">
              <SectionTitle>Stock received</SectionTitle>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {stockReceived.total_units} unit(s) received across {stockReceived.received_lines} line(s).
              </p>
            </section>
          ) : allowStatusActions && (status === "draft" || status === "pending") ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Warehouse stock has not been updated yet. Mark as received when goods arrive.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-wrap gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          {allowStatusActions && canUpdateStatus && order.can_mark_pending ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateStatus("pending")}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Mark as pending
            </button>
          ) : null}
          {allowStatusActions && canUpdateStatus && order.can_mark_received ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateStatus("received")}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Mark as received
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
