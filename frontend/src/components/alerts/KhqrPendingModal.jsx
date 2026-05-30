import React from "react";
import { Link } from "react-router-dom";
import ModalPortal from "../payments/ModalPortal";

const KHQR_RED = "#C0272D";
const GOLD = "#C88F09";

export default function KhqrPendingModal({
  open,
  orderNumber = "—",
  billNumber,
  total,
  currency = "KHR",
  onClose,
}) {
  if (!open) return null;

  const fmt = (v) =>
    Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      >
        <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl">
          <div
            className="px-6 pt-8 pb-5 text-center"
            style={{ background: `linear-gradient(135deg, ${KHQR_RED} 0%, #8b1a1e 100%)` }}
          >
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/90"
              aria-hidden
            >
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-white">Payment submitted</h2>
            <p className="mt-1 text-sm text-white/75">via KHQR · awaiting confirmation</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Thank you! Our team will verify your Bakong payment and confirm your order shortly.
              <span className="mt-1 block font-medium text-slate-800 dark:text-slate-100">
                Keep this page open — it will update automatically when confirmed.
              </span>
            </p>

            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Order</span>
                <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{orderNumber}</span>
              </div>
              {billNumber && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Bill</span>
                  <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{billNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Amount</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  {currency} {fmt(total)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-slate-400">Status</span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  Pending verification
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-2xl py-3 text-sm font-bold text-white shadow-md"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #a87308)` }}
                >
                  Continue shopping
                </button>
              )}
              <Link
                to="/orders"
                className="w-full rounded-2xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                View my orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
