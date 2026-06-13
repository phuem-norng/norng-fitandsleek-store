import React from "react";
import { Link } from "react-router-dom";
import { catalogLotPricingHint, formatCatalogLotMoney } from "../../lib/catalogLotPricing.js";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";

const READONLY_INPUT_CLASS =
  "w-full min-h-[44px] cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 py-2 pl-7 pr-3 text-sm tabular-nums text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300";

function Field({ id, label, displayValue }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#183c6b] dark:text-slate-200">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
        <input id={id} type="text" readOnly tabIndex={-1} value={displayValue} className={READONLY_INPUT_CLASS} />
      </div>
    </div>
  );
}

function moneyInputDisplay(value) {
  if (value == null || value === "" || value === "—") return "0.00";
  return String(value).replace(/\$/g, "");
}

/** Product add/edit — mirrors next sellable lot; edit prices on PO or Inventory Lots only. */
export function CatalogPricingReadOnly({ costPrice = null, sellPrice = null, productId = null, product = null }) {
  const fromLots = product?.pricing_source === "inventory_lot";
  const costDisplay = fromLots
    ? moneyInputDisplay(formatCatalogLotMoney(product, "cost"))
    : moneyInputDisplay(costPrice == null || costPrice === "" ? "0.00" : formatPoMoney(costPrice));
  const sellDisplay = fromLots
    ? moneyInputDisplay(formatCatalogLotMoney(product, "sell"))
    : moneyInputDisplay(sellPrice == null || sellPrice === "" ? "0.00" : formatPoMoney(sellPrice));
  const lotHint = catalogLotPricingHint(product);
  const stockHref = productId
    ? `/admin/stock-inventory?search=${encodeURIComponent(String(productId))}`
    : "/admin/stock-inventory";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <Field id="catalog-cost-readonly" label="Cost/unit (from lot)" displayValue={costDisplay} />
        <Field id="catalog-sell-readonly" label="Sell price (from lot)" displayValue={sellDisplay} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {lotHint ? (
          <>
            <span className="font-medium text-slate-600 dark:text-slate-300">{lotHint}. </span>
          </>
        ) : null}
        Read-only mirror of the next sellable lot. Set or change prices on a{" "}
        <Link to="/admin/purchase-orders" className="font-semibold text-[color:var(--admin-primary)] hover:underline">
          Purchase Order
        </Link>{" "}
        or in{" "}
        <Link to={stockHref} className="font-semibold text-[color:var(--admin-primary)] hover:underline">
          Stock &amp; Inventory → Inventory Lots
        </Link>
        .
      </p>
    </div>
  );
}
