import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, History, Package, Pencil, Tag } from "lucide-react";
import AdminModal from "./AdminModal.jsx";
import InventoryLotsPanel from "./InventoryLotsPanel.jsx";
import MovementDetailsButton from "./MovementDetailsButton.jsx";
import MovementRowDetailModal from "./MovementRowDetailModal.jsx";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import { lotTierLabel } from "../../lib/inventoryLotHelpers.js";
import { alignMovementRows } from "../../lib/movementRows.js";
import { rowMatchesSearch, sliceDetailTablePage } from "../../lib/adminListQuery.js";
import AdminListQueryToolbar from "./AdminListQueryToolbar.jsx";
import AdminTablePagination from "./AdminTablePagination.jsx";

function sellPriceOverview(row) {
  const source = row?.sell_price_source;
  if (source === "inventory_lot") {
    const tier = row?.next_lot_tier ? lotTierLabel(row.next_lot_tier) : "FIFO lot";
    return {
      label: "Sell price",
      value: formatPoMoney(row.sell_price),
      hint: `Website & POS · ${tier}`,
    };
  }
  if (source === "unsellable_lots") {
    return {
      label: "Sell price",
      value: "—",
      hint: "All lots on hold",
    };
  }
  return {
    label: "Sell price",
    value: formatPoMoney(row?.sell_price),
    hint: "No sellable lots — catalog default",
  };
}

const EMPTY = "—";

function defaultOpenSections(initialSection) {
  const section = ["overview", "lots", "movements"].includes(initialSection) ? initialSection : "overview";
  return {
    overview: section === "overview",
    lots: section === "lots",
    movements: section === "movements",
  };
}

function formatDateIso(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function displayValue(value) {
  return value === null || value === undefined || value === "" ? EMPTY : String(value);
}

function StatField({ label, value, hint = null, mono = false, className = "", centered = false }) {
  const text = displayValue(value);
  return (
    <div className={`${centered ? "text-center" : ""} ${className}`.trim()}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 ${mono ? "font-mono text-xs break-all" : "truncate"
          } ${centered ? "mx-auto max-w-full" : ""}`}
        title={typeof text === "string" && text.length > 24 ? text : undefined}
      >
        {text}
      </p>
      {hint ? (
        <p className={`mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400 ${centered ? "mx-auto max-w-full" : ""}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TypeCell({ type }) {
  const t = String(type).toLowerCase();
  const isBoth = t.includes("purchase") && t.includes("sale");
  const isPurchase = t.includes("purchase");
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
      {isBoth ? (
        <>
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
        </>
      ) : (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isPurchase ? "bg-emerald-500" : "bg-red-500"}`}
          aria-hidden
        />
      )}
      {type}
    </span>
  );
}

function stockStatusMeta(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("out")) {
    return "border-red-200/90 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200";
  }
  if (s.includes("low")) {
    return "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200";
}

function movementRowClass(type, index) {
  const t = String(type).toLowerCase();
  const isBoth = t.includes("purchase") && t.includes("sale");
  const isPurchase = t.includes("purchase");
  const zebra =
    index % 2 === 1
      ? "bg-slate-50/90 dark:bg-slate-900/55"
      : "bg-white dark:bg-slate-950/15";
  const tint = isBoth
    ? "hover:bg-slate-50 dark:hover:bg-slate-900/40"
    : isPurchase
      ? "hover:bg-emerald-50/95 dark:hover:bg-emerald-950/35"
      : "hover:bg-rose-50/90 dark:hover:bg-red-950/30";
  const accent = isBoth
    ? "border-l-[3px] border-l-slate-400/80 dark:border-l-slate-500/70"
    : isPurchase
      ? "border-l-[3px] border-l-emerald-400/80 dark:border-l-emerald-500/70"
      : "border-l-[3px] border-l-red-400/80 dark:border-l-red-500/70";
  return `${zebra} ${tint} ${accent} transition-colors`;
}

function AccordionSection({ id, icon: Icon, title, badge, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        id={id}
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 bg-slate-50/80 px-4 py-3 text-left transition hover:bg-slate-100/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <h3 className="min-w-0 flex-1 text-sm font-bold uppercase tracking-[0.1em] text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        {badge ? (
          <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${open ? "rotate-0" : "-rotate-90"
            }`}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t border-slate-200 dark:border-slate-700">{children}</div> : null}
    </section>
  );
}

/**
 * Single-SKU detail sheet — Overview, Inventory Lots, and Movements on one scrollable page.
 */
export default function StockSkuDetailModal({
  row,
  open,
  onClose,
  movements = [],
  movementsLoading = false,
  hasDateRange = false,
  movementFromDate = "",
  onMovementFromDateChange,
  movementToDate = "",
  onMovementToDateChange,
  movementSearch = "",
  onMovementSearchChange,
  lotsSearch = "",
  onLotsSearchChange,
  lotsFromDate = "",
  onLotsFromDateChange,
  lotsToDate = "",
  onLotsToDateChange,
  canEditLots = false,
  canEditStock = false,
  onLotsChanged,
  initialSection = "overview",
}) {
  const [movementDetailRow, setMovementDetailRow] = useState(null);
  const [openSections, setOpenSections] = useState(() => defaultOpenSections(initialSection));
  const [movementSearchDebounced, setMovementSearchDebounced] = useState(movementSearch);
  const [movementPage, setMovementPage] = useState(1);

  useEffect(() => {
    if (!open || !row) return;
    setOpenSections(defaultOpenSections(initialSection));
  }, [open, row?.id, initialSection]);

  useEffect(() => {
    const t = window.setTimeout(() => setMovementSearchDebounced(movementSearch), 300);
    return () => window.clearTimeout(t);
  }, [movementSearch]);

  const toggleSection = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const alignedMovements = useMemo(() => alignMovementRows(movements), [movements]);
  const filteredMovements = useMemo(() => {
    return alignedMovements.filter((m) =>
      rowMatchesSearch(
        [m.type, m.ref, m.date, m.qty_in, m.qty_out, m.cost_per_unit, m.sell_per_unit, m.balance],
        movementSearchDebounced,
      ),
    );
  }, [alignedMovements, movementSearchDebounced]);

  const movementListPage = useMemo(
    () => sliceDetailTablePage(filteredMovements, movementPage),
    [filteredMovements, movementPage],
  );

  useEffect(() => {
    setMovementPage(1);
  }, [movementSearchDebounced, movementFromDate, movementToDate, row?.id]);

  useEffect(() => {
    if (movementPage > movementListPage.lastPage) setMovementPage(movementListPage.lastPage);
  }, [movementPage, movementListPage.lastPage]);

  if (!row) return null;

  const inStock = Math.max(0, Number(row.in_stock) || 0);
  const totalOnHand = Math.max(0, Number(row.lot_summary?.total_on_hand) || 0);
  const heldAside = totalOnHand > inStock ? totalOnHand - inStock : 0;
  const lotSummary = row.lot_summary || null;
  const showMovementFilters =
    typeof onMovementFromDateChange === "function" &&
    typeof onMovementToDateChange === "function" &&
    typeof onMovementSearchChange === "function";
  const showLotsFilters =
    typeof onLotsFromDateChange === "function" &&
    typeof onLotsToDateChange === "function" &&
    typeof onLotsSearchChange === "function";
  const movementHasFilters = Boolean(
    movementSearch.trim() || movementFromDate || movementToDate,
  );
  const movementCountLabel = movementsLoading
    ? "Loading…"
    : `${filteredMovements.length} movement${filteredMovements.length !== 1 ? "s" : ""}`;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="SKU Details"
      titleIcon={<Package className="h-5 w-5" strokeWidth={2} aria-hidden />}
      titleId="stock-sku-detail-title"
      variant="sheet"
      maxWidthClass="max-w-6xl"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4 pr-1">
          <AccordionSection
            id="sku-detail-overview"
            icon={Package}
            title="Overview"
            open={openSections.overview}
            onToggle={() => toggleSection("overview")}
          >
            <div className="bg-slate-50/50 px-4 py-5 text-center dark:bg-slate-950/30 sm:px-6">
              <div className="flex flex-col items-center gap-5">
                <div className="grid w-full max-w-4xl grid-cols-2 justify-items-center gap-x-6 gap-y-4 md:grid-cols-5 md:gap-x-8">
                  <StatField centered label="SKU" value={row.sku} mono />
                  <StatField centered label="Product" value={row.product_name} className="min-w-0" />
                  <StatField centered label="Size" value={row.size} />
                  <StatField centered label="Color" value={row.color} />
                  <StatField centered label="Date" value={formatDateIso(row.activity_date)} />
                </div>
                <div className="grid w-full max-w-4xl grid-cols-2 justify-items-center gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-5 md:gap-x-6">
                  <StatField
                    centered
                    label="In stock"
                    value={String(inStock)}
                    hint={
                      heldAside > 0
                        ? `${heldAside} on hold / not sellable · ${totalOnHand} total in lots`
                        : null
                    }
                  />
                  <StatField
                    centered
                    label="Cost/unit"
                    value={formatPoMoney(row?.next_lot_cost ?? row?.wac_cost ?? 0)}
                  />
                  {(() => {
                    const sell = sellPriceOverview(row);
                    return <StatField centered label={sell.label} value={sell.value} hint={sell.hint} />;
                  })()}
                  <StatField centered label="Stock value" value={formatPoMoney(row.stock_value)} />
                  <div className="flex min-w-0 flex-col items-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      Status
                    </p>
                    <span
                      className={`mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stockStatusMeta(row.status)}`}
                    >
                      {row.status || "In stock"}
                    </span>
                  </div>
                </div>
                {lotSummary &&
                  (lotSummary.older > 0 ||
                    lotSummary.newer > 0 ||
                    lotSummary.clearance > 0 ||
                    lotSummary.active > 0) ? (
                  <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                    {lotSummary.older > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900">
                        Older {lotSummary.older}
                      </span>
                    ) : null}
                    {lotSummary.newer > 0 ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-800">
                        Newer {lotSummary.newer}
                      </span>
                    ) : null}
                    {lotSummary.active > 0 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800">
                        Active {lotSummary.active}
                      </span>
                    ) : null}
                    {lotSummary.clearance > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900">
                        Clearance {lotSummary.clearance}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            id="sku-detail-lots"
            icon={Tag}
            title="Inventory Lots"
            open={openSections.lots}
            onToggle={() => toggleSection("lots")}
          >
            <InventoryLotsPanel
              row={row}
              canEdit={canEditLots}
              embedded
              onChanged={onLotsChanged}
              search={lotsSearch}
              onSearchChange={onLotsSearchChange}
              fromDate={lotsFromDate}
              onFromDateChange={onLotsFromDateChange}
              toDate={lotsToDate}
              onToDateChange={onLotsToDateChange}
              showFilters={showLotsFilters}
            />
          </AccordionSection>

          <AccordionSection
            id="sku-detail-movements"
            icon={History}
            title="Movements"
            badge={movementCountLabel}
            open={openSections.movements}
            onToggle={() => toggleSection("movements")}
          >
            <div className="space-y-3 p-4 sm:p-5">
              {showMovementFilters ? (
                <AdminListQueryToolbar
                  embedded
                  singleRow
                  search={movementSearch}
                  onSearchChange={onMovementSearchChange}
                  searchPlaceholder="Search type, ref, qty, price…"
                  fromDate={movementFromDate}
                  onFromDateChange={onMovementFromDateChange}
                  toDate={movementToDate}
                  onToDateChange={onMovementToDateChange}
                  hasDateRangeFilter={Boolean(movementFromDate || movementToDate)}
                  showingCount={filteredMovements.length}
                  totalCount={alignedMovements.length}
                  onClearFilters={() => {
                    onMovementSearchChange("");
                    onMovementFromDateChange("");
                    onMovementToDateChange("");
                  }}
                />
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.03] dark:border-slate-800 dark:bg-slate-900 dark:ring-white/[0.04]">
                {movementsLoading ? (
                  <p className="px-4 py-12 text-center text-sm text-slate-500">Loading movement history…</p>
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/95 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-400">
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">Qty in</th>
                          <th className="px-4 py-3 text-right text-red-600 dark:text-red-400">Qty out</th>
                          <th className="px-4 py-3 text-right">Cost/unit</th>
                          <th className="px-4 py-3 text-right">Sell/unit</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                          <th className="px-4 py-3 text-left">Ref</th>
                          <th className="px-4 py-3 text-center">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="bg-white px-4 py-10 text-center text-slate-500 dark:bg-slate-950/20">
                              {movementHasFilters
                                ? "No movements match your search or date range."
                                : hasDateRange
                                  ? "No purchase or sale movements in the selected date range."
                                  : "No movements recorded for this SKU yet."}
                            </td>
                          </tr>
                        ) : (
                          movementListPage.rows.map((m, idx) => (
                            <tr key={`${m.date}-${m.type}-${m.ref}-${idx}`} className={movementRowClass(m.type, idx)}>
                              <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                                {formatDateIso(m.date) || EMPTY}
                              </td>
                              <td className="px-4 py-3">
                                <TypeCell type={m.type} />
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                {m.qty_in != null ? `+${m.qty_in}` : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                                {m.qty_out != null ? `-${m.qty_out}` : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                {m.cost_per_unit != null ? formatPoMoney(m.cost_per_unit) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                                {m.sell_per_unit != null ? formatPoMoney(m.sell_per_unit) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900 dark:text-slate-50">
                                {m.balance ?? "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] font-medium tracking-tight text-slate-600 dark:text-slate-300">
                                {m.ref || "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <MovementDetailsButton compact onClick={() => setMovementDetailRow(m)} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <AdminTablePagination
                    page={movementListPage.page}
                    lastPage={movementListPage.lastPage}
                    onPageChange={setMovementPage}
                  />
                  </>
                )}
              </div>
            </div>
          </AccordionSection>
        </div>

        <MovementRowDetailModal
          open={Boolean(movementDetailRow)}
          onClose={() => setMovementDetailRow(null)}
          skuRow={row}
          movement={movementDetailRow}
        />

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Close
          </button>
          <Link
            to={`/admin/products?edit=${row.product_id}`}
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--admin-primary)] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit product
          </Link>
        </footer>
      </div>
    </AdminModal>
  );
}
