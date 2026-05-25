/** Footer "We Accept" payment method catalog — ids stored in footer.accepted_payment_methods */

export const FOOTER_PAYMENT_METHODS = [
  { id: "aba_pay", label: "ABA PAY", type: "brand", row: 1 },
  { id: "visa", label: "VISA", type: "brand", row: 1 },
  { id: "mastercard", label: "Mastercard", type: "brand", row: 1 },
  { id: "unionpay", label: "UnionPay", type: "brand", row: 1 },
  { id: "jcb", label: "JCB", type: "brand", row: 1 },
  { id: "khqr", label: "KHQR", type: "brand", row: 1 },
  { id: "wing", label: "Wing Bank", type: "brand", row: 2 },
  { id: "bank_transfer", label: "Bank Transfer", type: "text", row: 2 },
  { id: "cod", label: "Cash on Delivery", type: "text", row: 2 },
];

export const DEFAULT_FOOTER_ACCEPTED_METHODS = FOOTER_PAYMENT_METHODS.map((m) => m.id);

export function resolveFooterAcceptedMethods(footerSettings) {
  if (footerSettings?.payment_accept_enabled === false) return [];
  const configured = footerSettings?.accepted_payment_methods;
  if (Array.isArray(configured)) {
    return configured.filter((id) => FOOTER_PAYMENT_METHODS.some((m) => m.id === id));
  }
  return DEFAULT_FOOTER_ACCEPTED_METHODS;
}

export function getFooterPaymentMethodsForDisplay(methodIds) {
  const idSet = new Set(methodIds || []);
  return FOOTER_PAYMENT_METHODS.filter((m) => idSet.has(m.id));
}
