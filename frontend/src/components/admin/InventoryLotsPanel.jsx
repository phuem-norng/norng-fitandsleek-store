import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Plus, Tag } from "lucide-react";
import api from "../../lib/api";
import { toastSuccess } from "../../lib/swal";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import {
  ADMIN_LIST_FIELD_CLASS,
  rowMatchesDateRange,
  rowMatchesSearch,
  sliceDetailTablePage,
} from "../../lib/adminListQuery.js";
import AdminListQueryToolbar from "./AdminListQueryToolbar.jsx";
import AdminTablePagination from "./AdminTablePagination.jsx";
import LotHistoryModal from "./LotHistoryModal.jsx";
import AdminModal from "./AdminModal.jsx";
import InventorySellStrategyCard from "./InventorySellStrategyCard.jsx";
import {
  emptyLotForm,
  listingStatusLabel,
  listingStatusTone,
  lotTierLabel,
  lotTierTone,
  LISTING_STATUSES,
  lotDiscountBasePrice,
  lotDiscountOff,
  PRICE_RULES,
  shortLotNumber,
  isLotOnHold,
} from "../../lib/inventoryLotHelpers.js";
import { SellQueueBadge, SellsNextBadge, SoldOutBadge } from "./LotSellOrderBadge.jsx";
import LotSellPriceCell from "./LotSellPriceCell.jsx";

function LotStatusPill({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${listingStatusTone(status)}`}>
      {listingStatusLabel(status)}
    </span>
  );
}

function LotTierPill({ tier }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${lotTierTone(tier)}`}>
      {lotTierLabel(tier)}
    </span>
  );
}

function lotActionItems(lot, canEdit) {
  const items = [];
  if (canEdit && !lot.is_sold_out) {
    items.push({ id: "edit-prices", label: "Edit prices" });
  }
  if (canEdit) {
    if (lotDiscountOff(lot) != null) {
      items.push({ id: "edit-discount", label: "Edit discount" });
      items.push({ id: "remove-discount", label: "Remove discount", tone: "danger" });
    } else {
      items.push({ id: "lot-discount", label: "Lot discount" });
    }
    if (lot.listing_status === "clearance") {
      items.push({ id: "edit-clearance", label: "Edit clearance" });
      items.push({ id: "revert-clearance", label: "Revert to active" });
    } else {
      items.push({ id: "mark-clearance", label: "Mark as clearance" });
    }
    items.push({
      id: isLotOnHold(lot) ? "release-hold" : "set-hold",
      label: isLotOnHold(lot) ? "Release hold" : "Set on hold",
    });
  }
  items.push({ id: "history", label: "History", separatorBefore: items.length > 0 });
  return items;
}

function LotRowActionsMenu({ lot, canEdit, onAction }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const items = useMemo(() => lotActionItems(lot, canEdit), [lot, canEdit]);

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuW = 184;
    const estH = Math.min(items.length * 36 + 24, window.innerHeight - 16);
    let top = rect.bottom + 4;
    if (top + estH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estH - 4);
    }
    let left = rect.right - menuW;
    left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
    setMenuStyle({ top, left, width: menuW });
  }, [items.length]);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onPointerDown = (e) => {
      const target = e.target;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  const select = (id) => {
    setOpen(false);
    onAction(lot, id);
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      setMenuStyle(null);
      return;
    }
    setOpen(true);
  };

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
            zIndex: 9999,
          }}
          className="min-w-[11.5rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
        >
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.separatorBefore ? (
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" role="separator" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => select(item.id)}
                className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${item.tone === "danger"
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-700 dark:text-slate-200"
                  }`}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>,
        document.body,
      )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={`Actions for lot ${lot.lot_number}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {menu}
    </>
  );
}

export default function InventoryLotsPanel({
  row,
  canEdit = false,
  embedded = false,
  onChanged,
  search = "",
  onSearchChange = null,
  fromDate = "",
  onFromDateChange = null,
  toDate = "",
  onToDateChange = null,
  showFilters = false,
}) {
  const [lots, setLots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sellOldFirst, setSellOldFirst] = useState(true);
  const [historyLot, setHistoryLot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyLotForm(row));
  const [saving, setSaving] = useState(false);
  const [clearanceLot, setClearanceLot] = useState(null);
  const [clearancePrice, setClearancePrice] = useState("");
  const [clearanceIsEdit, setClearanceIsEdit] = useState(false);
  const [discountLot, setDiscountLot] = useState(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [editPriceLot, setEditPriceLot] = useState(null);
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [searchDebounced, setSearchDebounced] = useState(search);
  const [lotPage, setLotPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const params = useMemo(
    () => ({
      product_id: row?.product_id,
      ...(row?.size ? { size: row.size } : {}),
      ...(row?.color ? { color: row.color } : {}),
    }),
    [row],
  );

  const load = useCallback(async () => {
    if (!row?.product_id) return;
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/admin/inventory-lots", { params });
      setLots(Array.isArray(data?.data) ? data.data : []);
      setSummary(data?.meta?.summary ?? null);
      setSellOldFirst(data?.meta?.sell_old_first !== false);
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not load inventory lots.");
      setLots([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [params, row?.product_id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      if (!rowMatchesDateRange(lot.received_at, fromDate, toDate)) return false;
      return rowMatchesSearch(
        [
          lot.lot_number,
          lot.season,
          lot.collection_code,
          lot.barcode,
          lot.listing_status,
          lot.lot_tier,
          lot.notes,
          listingStatusLabel(lot.listing_status),
          lotTierLabel(lot.lot_tier),
        ],
        searchDebounced,
      );
    });
  }, [lots, fromDate, toDate, searchDebounced]);

  const lotsFiltersActive = Boolean(search.trim() || fromDate || toDate);

  const lotListPage = useMemo(
    () => sliceDetailTablePage(filteredLots, lotPage),
    [filteredLots, lotPage],
  );

  useEffect(() => {
    setLotPage(1);
  }, [searchDebounced, fromDate, toDate, row?.id]);

  useEffect(() => {
    if (lotPage > lotListPage.lastPage) setLotPage(lotListPage.lastPage);
  }, [lotPage, lotListPage.lastPage]);

  const resetForm = () => {
    setForm(emptyLotForm(row));
    setShowForm(false);
  };

  const submitLot = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setErr("");
    try {
      await api.post("/admin/inventory-lots", {
        product_id: row.product_id,
        size: row.size || null,
        color: row.color || null,
        season: form.season || null,
        collection_code: form.collection_code || null,
        listing_status: form.listing_status,
        quantity_on_hand: Number(form.quantity_on_hand) || 0,
        unit_cost: Number(form.unit_cost) || 0,
        unit_price: form.unit_price === "" ? null : Number(form.unit_price),
        price_rule: form.price_rule,
        price_percent: form.price_percent === "" ? null : Number(form.price_percent),
        barcode: form.barcode || null,
        is_sellable: Boolean(form.is_sellable),
        notes: form.notes || null,
      });
      toastSuccess("Inventory lot created.");
      resetForm();
      await load();
      onChanged?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Could not create inventory lot.");
    } finally {
      setSaving(false);
    }
  };

  const openEditPrices = (lot) => {
    setEditPriceLot(lot);
    setEditUnitCost(String(lot.unit_cost ?? ""));
    setEditUnitPrice(String(lot.unit_price ?? lot.resolved_unit_price ?? ""));
    setErr("");
  };

  const saveEditPrices = async (e) => {
    e.preventDefault();
    if (!canEdit || !editPriceLot) return;
    const cost = Number(editUnitCost);
    const price = Number(editUnitPrice);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(price) || price < 0) {
      setErr("Enter valid unit cost and unit price.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await api.patch(`/admin/inventory-lots/${editPriceLot.id}`, {
        unit_cost: Math.round(cost * 100) / 100,
        unit_price: Math.round(price * 100) / 100,
        price_rule: "fixed",
      });
      toastSuccess("Lot prices updated.");
      setEditPriceLot(null);
      await load();
      onChanged?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Could not update lot prices.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSellable = async (lot) => {
    if (!canEdit) return;
    try {
      const onHold = isLotOnHold(lot);
      await api.post(`/admin/inventory-lots/${lot.id}/${onHold ? "release-hold" : "on-hold"}`);
      toastSuccess(onHold ? "Lot released from hold." : "Lot set on hold.");
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not update inventory lot.");
    }
  };

  const closeDiscountModal = () => {
    setDiscountLot(null);
    setDiscountPercent("");
    setErr("");
  };

  const submitLotDiscount = async (e) => {
    e.preventDefault();
    if (!canEdit || !discountLot?.id) return;
    setSaving(true);
    setErr("");
    try {
      await api.post(`/admin/inventory-lots/${discountLot.id}/lot-discount`, {
        discount_percent: Number(discountPercent) || 0,
      });
      toastSuccess(
        lotDiscountOff(discountLot) != null ? "Lot discount updated." : "Lot discount applied.",
      );
      closeDiscountModal();
      await load();
      onChanged?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Could not apply lot discount.");
    } finally {
      setSaving(false);
    }
  };

  const clearLotDiscount = async (lot) => {
    if (!canEdit) return;
    try {
      await api.delete(`/admin/inventory-lots/${lot.id}/lot-discount`);
      toastSuccess("Lot discount removed.");
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not remove lot discount.");
    }
  };

  const revertClearance = async (lot) => {
    if (!canEdit) return;
    try {
      await api.post(`/admin/inventory-lots/${lot.id}/revert-clearance`);
      toastSuccess("Lot reverted to active.");
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e?.response?.data?.message || "Could not revert clearance.");
    }
  };

  const handleLotAction = (lot, action) => {
    switch (action) {
      case "edit-prices":
        openEditPrices(lot);
        break;
      case "lot-discount":
        setDiscountLot(lot);
        setDiscountPercent("");
        setClearanceLot(null);
        setErr("");
        break;
      case "edit-discount":
        setDiscountLot(lot);
        setDiscountPercent(String(lotDiscountOff(lot) ?? ""));
        setClearanceLot(null);
        setErr("");
        break;
      case "remove-discount":
        void clearLotDiscount(lot);
        break;
      case "mark-clearance":
        setClearanceLot(lot);
        setClearancePrice(String(lot.resolved_unit_price ?? lot.unit_price ?? ""));
        setClearanceIsEdit(false);
        setDiscountLot(null);
        setErr("");
        break;
      case "edit-clearance":
        setClearanceLot(lot);
        setClearancePrice(String(lot.resolved_unit_price ?? lot.unit_price ?? ""));
        setClearanceIsEdit(true);
        setDiscountLot(null);
        setErr("");
        break;
      case "revert-clearance":
        void revertClearance(lot);
        break;
      case "set-hold":
      case "release-hold":
        void toggleSellable(lot);
        break;
      case "history":
        setHistoryLot({ id: lot.id, lot_number: lot.lot_number });
        break;
      default:
        break;
    }
  };

  const closeClearanceModal = () => {
    setClearanceLot(null);
    setClearancePrice("");
    setClearanceIsEdit(false);
    setErr("");
  };

  const submitClearance = async (e) => {
    e.preventDefault();
    if (!canEdit || !clearanceLot?.id) return;
    setSaving(true);
    setErr("");
    try {
      await api.post(`/admin/inventory-lots/${clearanceLot.id}/mark-clearance`, {
        unit_price: clearancePrice === "" ? null : Number(clearancePrice),
      });
      toastSuccess(clearanceIsEdit ? "Clearance price updated." : "Inventory lot marked as clearance.");
      closeClearanceModal();
      await load();
      onChanged?.();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Could not mark clearance.");
    } finally {
      setSaving(false);
    }
  };

  const discountPreview = useMemo(() => {
    if (!discountLot) return null;
    const baseline = lotDiscountBasePrice(discountLot);
    const off = Number(discountPercent) || 0;
    if (!baseline || off <= 0) return null;
    return {
      baseline,
      off,
      sale: Math.round(baseline * (1 - off / 100) * 100) / 100,
    };
  }, [discountLot, discountPercent]);

  return (
    <section
      className={
        embedded
          ? "rounded-xl border border-slate-200 dark:border-slate-700"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      }
    >
      <header className="shrink-0 border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {embedded ? (
            summary ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Older {summary.older || 0} · Newer {summary.newer || 0} · Active {summary.active || 0} · Clearance{" "}
                {summary.clearance || 0}
              </p>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">Lot breakdown for this SKU</span>
            )
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Tag className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-800 dark:text-slate-100">
                  Inventory Lots
                </h3>
                {summary ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Older {summary.older || 0} · Newer {summary.newer || 0} · Active {summary.active || 0} · Clearance{" "}
                    {summary.clearance || 0}
                  </p>
                ) : null}
              </div>
            </div>
          )}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Inventory Lot
            </button>
          ) : null}
        </div>
      </header>

      <div className={embedded ? "p-4 sm:p-5" : "min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"}>
        <div className="mb-4">
          <InventorySellStrategyCard
            canEdit={canEdit}
            sellOldFirst={sellOldFirst}
            onSaved={async () => {
              await load();
              onChanged?.();
            }}
          />
        </div>

        {showFilters ? (
          <div className="mb-4">
            <AdminListQueryToolbar
              embedded
              singleRow
              search={search}
              onSearchChange={onSearchChange}
              searchPlaceholder="Search lot, season, barcode, status…"
              fromDate={fromDate}
              onFromDateChange={onFromDateChange}
              toDate={toDate}
              onToDateChange={onToDateChange}
              hasDateRangeFilter={Boolean(fromDate || toDate)}
              showingCount={filteredLots.length}
              totalCount={lots.length}
              onClearFilters={() => {
                onSearchChange?.("");
                onFromDateChange?.("");
                onToDateChange?.("");
              }}
            />
          </div>
        ) : null}

        {err && !editPriceLot && !discountLot && !clearanceLot ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {showForm && canEdit ? (
          <form onSubmit={submitLot} className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Season
              <input className={ADMIN_LIST_FIELD_CLASS} value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Collection Code
              <input className={ADMIN_LIST_FIELD_CLASS} value={form.collection_code} onChange={(e) => setForm((f) => ({ ...f, collection_code: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Listing Status
              <select className={ADMIN_LIST_FIELD_CLASS} value={form.listing_status} onChange={(e) => setForm((f) => ({ ...f, listing_status: e.target.value }))}>
                {LISTING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Qty On Hand
              <input type="number" min="0" className={ADMIN_LIST_FIELD_CLASS} value={form.quantity_on_hand} onChange={(e) => setForm((f) => ({ ...f, quantity_on_hand: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Unit Cost
              <input type="number" min="0" step="0.01" className={ADMIN_LIST_FIELD_CLASS} value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Unit Price
              <input type="number" min="0" step="0.01" className={ADMIN_LIST_FIELD_CLASS} value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Price Rule
              <select className={ADMIN_LIST_FIELD_CLASS} value={form.price_rule} onChange={(e) => setForm((f) => ({ ...f, price_rule: e.target.value }))}>
                {PRICE_RULES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Barcode (optional)
              <input className={ADMIN_LIST_FIELD_CLASS} value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900">
                {saving ? "Saving…" : "Save Inventory Lot"}
              </button>
              <button type="button" onClick={resetForm} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading inventory lots…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-900 dark:ring-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/95 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-400">
                  <th className="px-4 py-3 text-left">Sell order</th>
                  <th className="px-4 py-3 text-left">Lot Number</th>
                  <th className="px-4 py-3 text-left">Season</th>
                  <th className="px-4 py-3 text-left">Lot Tier</th>
                  <th className="px-4 py-3 text-left">Listing Status</th>
                  <th className="px-4 py-3 text-right">Qty On Hand</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-left">Barcode</th>
                  <th className="px-4 py-3 text-center w-12" />
                </tr>
              </thead>
              <tbody>
                {filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="bg-white px-4 py-10 text-center text-slate-500 dark:bg-slate-950/20">
                      {lots.length === 0
                        ? "No inventory lots for this SKU yet. Receive stock from a Purchase Order or add a lot manually."
                        : lotsFiltersActive
                          ? "No lots match your search or date range."
                          : "No inventory lots for this SKU yet. Receive stock from a Purchase Order or add a lot manually."}
                    </td>
                  </tr>
                ) : (
                  lotListPage.rows.map((lot) => (
                    <tr
                      key={lot.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${lot.is_sold_out
                          ? "bg-slate-50/80 opacity-70 dark:bg-slate-900/30"
                          : lot.sells_next
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                            : "bg-white dark:bg-slate-950/10"
                        }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {lot.sells_next ? <SellsNextBadge /> : null}
                          {lot.is_sold_out ? <SoldOutBadge /> : <SellQueueBadge order={lot.sell_order} />}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200"
                        title={lot.lot_number}
                      >
                        {shortLotNumber(lot.lot_number)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{lot.season || "—"}</td>
                      <td className="px-4 py-3">
                        <LotTierPill tier={lot.lot_tier} />
                      </td>
                      <td className="px-4 py-3"><LotStatusPill status={lot.listing_status} /></td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{lot.quantity_on_hand}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPoMoney(lot.unit_cost)}</td>
                      <td className="px-4 py-3">
                        <LotSellPriceCell lot={lot} mode="detail" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{lot.barcode || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {isLotOnHold(lot) ? (
                          <p className="mb-1.5 text-[10px] font-medium leading-snug text-amber-700 dark:text-amber-300">
                            On hold
                          </p>
                        ) : null}
                        <LotRowActionsMenu lot={lot} canEdit={canEdit} onAction={handleLotAction} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminTablePagination
            page={lotListPage.page}
            lastPage={lotListPage.lastPage}
            onPageChange={setLotPage}
          />
          </div>
        )}

      </div>

      <LotHistoryModal
        open={Boolean(historyLot)}
        onClose={() => setHistoryLot(null)}
        lot={historyLot}
      />

      <AdminModal
        open={Boolean(discountLot)}
        onClose={closeDiscountModal}
        title={lotDiscountOff(discountLot) != null ? "Edit lot discount" : "Lot discount"}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={submitLotDiscount} className="space-y-4 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lot {discountLot ? shortLotNumber(discountLot.lot_number) : ""}
            {discountLot?.sells_next ? " · sells next on website & POS" : ""}
          </p>
          {err && discountLot ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Discount off lot price (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              className={ADMIN_LIST_FIELD_CLASS}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="e.g. 20"
            />
          </label>
          {discountPreview ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Lot price {formatPoMoney(discountPreview.baseline)} → {formatPoMoney(discountPreview.sale)} (
              {discountPreview.off}% off)
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDiscountModal}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Saving…" : lotDiscountOff(discountLot) != null ? "Save" : "Apply"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(clearanceLot)}
        onClose={closeClearanceModal}
        title={clearanceIsEdit ? "Edit clearance price" : "Mark as clearance"}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={submitClearance} className="space-y-4 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lot {clearanceLot ? shortLotNumber(clearanceLot.lot_number) : ""}
            {clearanceIsEdit ? " · currently clearance" : " · will be listed as clearance"}
          </p>
          {err && clearanceLot ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Clearance unit price
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={ADMIN_LIST_FIELD_CLASS}
              value={clearancePrice}
              onChange={(e) => setClearancePrice(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeClearanceModal}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Saving…" : clearanceIsEdit ? "Save" : "Confirm"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(editPriceLot)}
        onClose={() => {
          setEditPriceLot(null);
          setErr("");
        }}
        title="Edit lot prices"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={saveEditPrices} className="space-y-4 p-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Lot {editPriceLot ? shortLotNumber(editPriceLot.lot_number) : ""}
            {editPriceLot?.sells_next ? " · sells next on website & POS" : ""}
          </p>
          {err && editPriceLot ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Unit Cost
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={ADMIN_LIST_FIELD_CLASS}
              value={editUnitCost}
              onChange={(e) => setEditUnitCost(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Unit Price
            <input
              type="number"
              min="0"
              step="0.01"
              required
              className={ADMIN_LIST_FIELD_CLASS}
              value={editUnitPrice}
              onChange={(e) => setEditUnitPrice(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditPriceLot(null);
                setErr("");
              }}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </AdminModal>
    </section>
  );
}
