/** Admin POS + Barcode scan sale — payment method ids stored on orders.payment_method */

export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2-4h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z" },
  {
    id: "khqr",
    label: "KHQR",
    sub: "QR · ចំនួនទឹកប្រាក់",
    icon: "M3 3h5v5H3V3zm8 0h5v5h-5V3zM3 11h5v5H3v-5zm8 0h5v5h-5v-5z",
  },
  { id: "debit", label: "Debit Card", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { id: "credit", label: "Credit Card", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { id: "store_credit", label: "Store Credit", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "payment_link", label: "Payment Link", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  { id: "other", label: "Others", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
];

export function paymentMethodLabel(id) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label || String(id || "").replace(/_/g, " ") || "—";
}

/** KHQR shown as a primary row; remaining methods in a compact grid (avoids tiny tiles on md:6-col layouts). */
export function splitPaymentMethodsForUi() {
  const khqr = PAYMENT_METHODS.find((m) => m.id === "khqr");
  const rest = PAYMENT_METHODS.filter((m) => m.id !== "khqr");
  return { khqr, rest };
}
