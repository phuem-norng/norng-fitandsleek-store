import React from "react";
import { formatPoMoney } from "../../lib/purchaseOrderHelpers.js";
import { lotDiscountBasePrice, lotDiscountOff } from "../../lib/inventoryLotHelpers.js";

/**
 * Compact sell price cell for inventory lot tables.
 * Catalog: $40 + strikethrough $50 · −20%
 * Detail:  $40 + −20% vs lot $50.00
 */
export default function LotSellPriceCell({ lot, mode = "catalog", className = "" }) {
  const sale = Number(lot?.resolved_unit_price ?? lot?.unit_price ?? 0);
  const percentOff = lotDiscountOff(lot);
  const compare = percentOff != null ? lotDiscountBasePrice(lot) : null;
  const showCompare = percentOff != null && compare != null && compare > sale;

  const tooltip = showCompare
    ? `Lot discount · Was ${formatPoMoney(compare)} · Now ${formatPoMoney(sale)} (−${percentOff}%)`
    : undefined;

  return (
    <div className={`text-right tabular-nums ${className}`} title={tooltip}>
      <div className="font-semibold text-slate-900 dark:text-slate-50">{formatPoMoney(sale)}</div>
      {showCompare ? (
        mode === "detail" ? (
          <p className="mt-0.5 text-[10px] font-semibold leading-tight text-violet-700 dark:text-violet-300">
            −{percentOff}% vs lot {formatPoMoney(compare)}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            <span className="line-through">{formatPoMoney(compare)}</span>
            <span className="mx-1 opacity-50">·</span>
            <span className="font-semibold text-violet-600 dark:text-violet-300">−{percentOff}%</span>
          </p>
        )
      ) : null}
    </div>
  );
}
