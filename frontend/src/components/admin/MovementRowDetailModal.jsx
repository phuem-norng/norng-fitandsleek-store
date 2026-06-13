import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import api from "../../lib/api";
import AdminModal from "./AdminModal.jsx";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import {
  formatLotPriceEventAt,
  listingStatusLabel,
  lotTierLabel,
} from "../../lib/inventoryLotHelpers.js";
import { splitMovementRefs } from "../../lib/movementRows.js";

function DetailField({ label, value, mono = false }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100 ${
          mono ? "font-mono text-xs break-all" : ""
        }`}
      >
        {text}
      </p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-700 dark:text-slate-200">
        {title}
      </h4>
      {children}
    </section>
  );
}

export default function MovementRowDetailModal({ open, onClose, skuRow, movement }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const refs = useMemo(() => splitMovementRefs(movement), [movement]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setErr("");
    }
  }, [open]);

  const load = useCallback(async () => {
    if (!skuRow?.product_id || !movement) return;
    if (!refs.purchaseRef && !refs.saleRef) {
      setErr("No purchase or sale reference on this row.");
      setDetail(null);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (skuRow.size) params.size = skuRow.size;
      if (skuRow.color) params.color = skuRow.color;
      if (refs.purchaseRef) params.purchase_ref = refs.purchaseRef;
      if (refs.saleRef) params.sale_ref = refs.saleRef;
      const { data } = await api.get(`/admin/stock-inventory/${skuRow.product_id}/movement-detail`, {
        params,
      });
      setDetail(data?.data ?? null);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load movement details.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [skuRow?.product_id, skuRow?.size, skuRow?.color, movement, refs.purchaseRef, refs.saleRef]);

  useEffect(() => {
    if (!open || !movement) return;
    void load();
  }, [open, movement, load]);

  const titleRef = movement?.ref || [refs.purchaseRef, refs.saleRef].filter(Boolean).join(" · ");

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Movement details"
      titleIcon={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <ScrollText className="h-4 w-4" aria-hidden />
        </span>
      }
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {titleRef ? (
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{titleRef}</p>
        ) : null}

        {movement ? (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-950/30 sm:grid-cols-4">
            <DetailField label="Date" value={movement.date} />
            <DetailField label="Type" value={movement.type} />
            <DetailField label="Qty in" value={movement.qty_in != null ? `+${movement.qty_in}` : "—"} />
            <DetailField label="Qty out" value={movement.qty_out != null ? `-${movement.qty_out}` : "—"} />
          </div>
        ) : null}

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading movement details…</p>
        ) : null}

        {!loading && detail?.purchase ? (
          <SectionCard title="Purchase (stock in)">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="PO number" value={detail.purchase.po_number} mono />
              <DetailField label="Supplier" value={detail.purchase.supplier} />
              <DetailField label="Purchaser" value={detail.purchase.purchaser} />
              <DetailField label="PO date" value={detail.purchase.order_date} />
              <DetailField
                label="Received at"
                value={detail.purchase.received_at ? formatLotPriceEventAt(detail.purchase.received_at) : "—"}
              />
              <DetailField label="Qty received" value={detail.purchase.qty} />
              <DetailField label="Cost/unit" value={formatPoMoney(detail.purchase.cost_per_unit)} />
              <DetailField
                label="Sell price (PO)"
                value={detail.purchase.sell_price != null ? formatPoMoney(detail.purchase.sell_price) : "—"}
              />
            </div>
            {detail.purchase.stock_received ? (
              <div className="mt-4 rounded-md border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Inventory lot created
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <DetailField label="Lot number" value={detail.purchase.stock_received.lot_number} mono />
                  <DetailField
                    label="Lot tier"
                    value={lotTierLabel(detail.purchase.stock_received.lot_tier)}
                  />
                  <DetailField
                    label="Listing status"
                    value={listingStatusLabel(detail.purchase.stock_received.listing_status)}
                  />
                  <DetailField label="Barcode" value={detail.purchase.stock_received.barcode} mono />
                  <DetailField label="Qty received" value={detail.purchase.stock_received.quantity_received} />
                  <DetailField label="On hand now" value={detail.purchase.stock_received.quantity_on_hand} />
                </div>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {!loading && detail?.sale ? (
          <SectionCard title="Sale (stock out)">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Order" value={detail.sale.order_number} mono />
              <DetailField label="Channel" value={detail.sale.channel_label} />
              <DetailField
                label="Sold at"
                value={detail.sale.sold_at ? formatLotPriceEventAt(detail.sale.sold_at) : "—"}
              />
              <DetailField label="Payment" value={detail.sale.payment_method} />
              <DetailField
                label={detail.sale.seller ? "Sold by" : "Customer"}
                value={
                  detail.sale.seller?.name ||
                  detail.sale.seller?.email ||
                  detail.sale.customer?.name ||
                  detail.sale.customer?.email
                }
              />
              <DetailField label="Qty sold" value={detail.sale.qty} />
              <DetailField label="Sell/unit" value={formatPoMoney(detail.sale.unit_price)} />
              <DetailField label="Line total" value={formatPoMoney(detail.sale.line_total)} />
              {detail.sale.receipt_no ? (
                <DetailField label="Receipt no." value={detail.sale.receipt_no} mono />
              ) : null}
            </div>
            {Array.isArray(detail.sale.stock_deductions) && detail.sale.stock_deductions.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-800 dark:text-red-300">
                  Stock deducted (by lot)
                </p>
                {detail.sale.stock_deductions.map((line) => (
                  <div
                    key={line.order_item_id}
                    className="rounded-md border border-red-200/70 bg-red-50/40 px-3 py-2.5 text-xs dark:border-red-900/40 dark:bg-red-950/20"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-100">{line.line_name}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <DetailField label="Lot" value={line.lot_number || "—"} mono />
                      <DetailField label="Tier" value={lotTierLabel(line.lot_tier)} />
                      <DetailField
                        label="Status at sale"
                        value={listingStatusLabel(line.listing_status_at_sale)}
                      />
                      <DetailField label="Qty" value={line.qty} />
                      <DetailField label="Unit price" value={formatPoMoney(line.unit_price)} />
                      <DetailField
                        label="Unit cost"
                        value={line.unit_cost_at_sale != null ? formatPoMoney(line.unit_cost_at_sale) : "—"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {!loading && !err && detail && !detail.purchase && !detail.sale ? (
          <p className="py-6 text-center text-sm text-slate-500">No detail found for this movement.</p>
        ) : null}
      </div>
    </AdminModal>
  );
}
