/** Shared POS / Barcode & QR receipt counter, saved receipts, and handoff to /admin/checkout */

export const RECEIPT_COUNTER_KEY = "fs_pos_receipt_counter_v1";
export const RECEIPT_SAVED_KEY = "fs_pos_saved_receipts_v1";
export const POS_POST_SALE_NAV_KEY = "fs_pos_post_sale_nav_v1";

export function nextReceiptNumber() {
  let n = parseInt(localStorage.getItem(RECEIPT_COUNTER_KEY) || "0", 10) || 0;
  n += 1;
  localStorage.setItem(RECEIPT_COUNTER_KEY, String(n));
  return n;
}

export function saveReceiptSnapshotToStorage(receipt, settings) {
  try {
    let list = [];
    const raw = localStorage.getItem(RECEIPT_SAVED_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) list = p;
    }
    const entry = {
      savedAt: new Date().toISOString(),
      receipt: {
        receiptNo: receipt.receiptNo,
        completedAt: receipt.completedAt,
        subtotal: receipt.subtotal,
        paymentMethodLabel: receipt.paymentMethodLabel,
        orderNumber: receipt.orderNumber ?? null,
        lines: receipt.lines,
        tenderReceivedCents: receipt.tenderReceivedCents ?? null,
        khqr: receipt.khqr ?? null,
      },
      businessNameUsed: settings?.businessName ?? "",
      headerUsed: settings?.header ?? "",
      footerUsed: settings?.footer ?? "",
    };
    list.unshift(entry);
    if (list.length > 200) list = list.slice(0, 200);
    localStorage.setItem(RECEIPT_SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * After Reduce stock on Barcode & QR page: open Admin POS on the same receipt flow.
 * @param {object} receipt same shape as AdminPosScan lastReceipt
 * @param {string} [targetStep] default "postSale"
 */
export function queuePostSaleNavigation(receipt, targetStep = "postSale") {
  try {
    sessionStorage.setItem(POS_POST_SALE_NAV_KEY, JSON.stringify({ receipt, targetStep }));
  } catch {
    /* quota / private mode */
  }
}

/** @returns {{ receipt: object, targetStep: string } | null} */
export function consumePostSaleNavigation() {
  try {
    const raw = sessionStorage.getItem(POS_POST_SALE_NAV_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POS_POST_SALE_NAV_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed?.receipt) return null;
    return {
      receipt: parsed.receipt,
      targetStep: typeof parsed.targetStep === "string" ? parsed.targetStep : "postSale",
    };
  } catch {
    try {
      sessionStorage.removeItem(POS_POST_SALE_NAV_KEY);
    } catch {
      /* */
    }
    return null;
  }
}
