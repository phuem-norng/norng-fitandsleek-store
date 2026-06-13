/**
 * Align purchase (+) and sale (−) qty on the same table row (paired by date, index).
 * Balance uses chronological running total (not reset per paired row).
 */

function movementSortKey(m) {
  const date = String(m?.date ?? "");
  const type = String(m?.type ?? "").toLowerCase();
  const purchaseFirst = type.includes("purchase") ? 0 : type.includes("sale") ? 1 : 2;
  return `${date}|${purchaseFirst}|${m?.ref ?? ""}`;
}

export function sortMovementEvents(movements) {
  if (!Array.isArray(movements)) return [];
  return [...movements].sort((a, b) => movementSortKey(a).localeCompare(movementSortKey(b)));
}

/** Attach running balance per raw event (matches backend ledger order). */
export function movementsWithBalance(movements) {
  const sorted = sortMovementEvents(movements);
  let balance = 0;

  return sorted.map((m) => {
    const qtyIn = m?.qty_in != null ? Number(m.qty_in) : 0;
    const qtyOut = m?.qty_out != null ? Number(m.qty_out) : 0;
    if (qtyIn > 0) balance += qtyIn;
    if (qtyOut > 0) balance -= qtyOut;

    return {
      ...m,
      balance: Math.max(0, balance),
    };
  });
}

export function alignMovementRows(movements) {
  if (!Array.isArray(movements) || movements.length === 0) return [];

  const enriched = movementsWithBalance(movements);
  const byDate = new Map();

  for (const m of enriched) {
    const date = String(m?.date ?? "");
    if (!byDate.has(date)) {
      byDate.set(date, { purchases: [], sales: [] });
    }
    const bucket = byDate.get(date);
    if (m?.qty_in != null && Number(m.qty_in) > 0) {
      bucket.purchases.push(m);
    } else if (m?.qty_out != null && Number(m.qty_out) > 0) {
      bucket.sales.push(m);
    }
  }

  const dates = [...byDate.keys()].sort();
  const rows = [];

  for (const date of dates) {
    const { purchases, sales } = byDate.get(date);
    const count = Math.max(purchases.length, sales.length);

    for (let i = 0; i < count; i += 1) {
      const purchase = purchases[i];
      const sale = sales[i];
      const qtyIn = purchase?.qty_in != null ? Number(purchase.qty_in) : null;
      const qtyOut = sale?.qty_out != null ? Number(sale.qty_out) : null;
      const refs = [purchase?.ref, sale?.ref].filter(Boolean);

      rows.push({
        date,
        type:
          purchase && sale ? "Purchase / Sale" : purchase ? "Purchase" : "Sale",
        qty_in: qtyIn,
        qty_out: qtyOut,
        cost_per_unit: purchase?.cost_per_unit ?? null,
        sell_per_unit: sale?.sell_per_unit ?? purchase?.sell_per_unit ?? null,
        balance: sale?.balance ?? purchase?.balance ?? null,
        purchase_ref: purchase?.ref ?? null,
        sale_ref: sale?.ref ?? null,
        ref: refs.length > 0 ? refs.join(" · ") : null,
      });
    }
  }

  return rows;
}

/** Split combined ref cell into purchase / sale refs for detail lookup. */
export function splitMovementRefs(movement) {
  if (movement?.purchase_ref || movement?.sale_ref) {
    return {
      purchaseRef: movement.purchase_ref || null,
      saleRef: movement.sale_ref || null,
    };
  }
  const parts = String(movement?.ref ?? "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  let purchaseRef = null;
  let saleRef = null;
  for (const part of parts) {
    if (/^PO-/i.test(part)) {
      purchaseRef = part;
    } else {
      saleRef = part;
    }
  }
  return { purchaseRef, saleRef };
}
