import React from "react";
import { QRCodeSVG } from "qrcode.react";

/** Buyer-facing KHQR on POS receipt / post-charge (ចំនួនទឹកប្រាក់ · scan with Bakong). */
export default function PosKhqrBuyerPayBlock({ khqr }) {
 if (!khqr?.qr_string) return null;
 const exp = khqr.expires_at ? new Date(khqr.expires_at) : null;
 const expLabel = exp && !Number.isNaN(exp.getTime()) ? exp.toLocaleString() : null;

 return (
 <div className="mt-5 w-full max-w-[280px] rounded-2xl border-2 border-[#C0272D]/35 bg-red-50/60 p-4 dark:border-[#C0272D]/45 dark:bg-red-950/25">
 <p className="text-center text-xs font-semibold tracking-wide text-[#C0272D]">KHQR · Bakong</p>
 <p className="mt-1 text-center text-xs leading-snug text-slate-800 dark:text-slate-200">
 ចំនួនទឹកប្រាក់ — Buyer scans to pay (Bakong app)
 </p>
 <div className="mx-auto mt-3 flex justify-center rounded-xl bg-white p-3 dark:bg-slate-950">
 <QRCodeSVG value={khqr.qr_string} size={200} level="M" includeMargin />
 </div>
 <p className="mt-3 text-center text-base font-bold tabular-nums text-slate-900 dark:text-white">{khqr.amount_label}</p>
 {expLabel ? <p className="mt-1 text-center text-xs leading-tight text-slate-500 dark:text-slate-400">Expires {expLabel}</p> : null}
 </div>
 );
}
