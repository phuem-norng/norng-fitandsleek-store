/** POS complete-sale KHQR payload → receipt / print */

export function formatKhqrPayAmount(amount, currency) {
  const cur = (currency || "KHR").toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  if (cur === "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }
  return new Intl.NumberFormat("km-KH", { style: "currency", currency: "KHR", maximumFractionDigits: 0 }).format(n);
}

/** @param {object|null|undefined} k API `data.khqr` */
export function normalizePosKhqrResponse(k) {
  if (!k || typeof k.qr_string !== "string" || !k.qr_string.trim()) return null;
  const amount = Number(k.amount);
  const currency = String(k.currency || "KHR").toUpperCase();
  const amt = Number.isFinite(amount) ? amount : 0;
  return {
    qr_string: k.qr_string.trim(),
    expires_at: k.expires_at || null,
    amount: amt,
    currency,
    amount_label: formatKhqrPayAmount(amt, currency),
  };
}
