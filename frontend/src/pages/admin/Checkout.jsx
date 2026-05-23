import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import api from "../../lib/api";
import { useTheme } from "../../state/theme.jsx";
import { resolveImageUrl } from "../../lib/images";
import { errorAlert, toastSuccess } from "../../lib/swal";
import { consumePostSaleNavigation, nextReceiptNumber, saveReceiptSnapshotToStorage } from "../../lib/posReceiptStorage";
import { normalizePosKhqrResponse } from "../../lib/posKhqrReceipt";
import { paymentMethodLabel, splitPaymentMethodsForUi } from "../../lib/posPaymentMethods";
import PosKhqrBuyerPayBlock from "../../components/admin/PosKhqrBuyerPayBlock";

const { khqr: PAYMENT_KHQR_UI, rest: PAYMENT_METHODS_GRID_UI } = splitPaymentMethodsForUi();

function extractErr(e) {
 const d = e?.response?.data;
 const first =
 d?.errors && typeof d.errors === "object"
 ? Object.values(d.errors)
 .flat()
 .find(Boolean)
 : null;
 return first || d?.message || e?.message || "Request failed";
}

function formatMoney(n) {
 const v = Number(n);
 if (!Number.isFinite(v)) return "$0.00";
 return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

/** POS: full width inside AdminLayout outlet (same horizontal rhythm as Dashboard / other admin pages). */
const POS_OUTER =
 "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white dark:bg-slate-900 md:min-h-[calc(100vh-10rem)]";
const POS_OUTER_CARD =
 `${POS_OUTER} md:rounded-2xl md:border md:border-slate-200 md:dark:border-slate-700`;
const POS_INNER = "flex w-full min-w-0 flex-col gap-2";

/** Verify / Payment / Cash tender — shared shell (matches admin POS mobile screenshots) */
const POS_STEP_HEADER =
 "flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 bg-white px-4 py-3.5 dark:border-slate-700/90 dark:bg-slate-900 sm:px-5";
const POS_STEP_SUBBAR =
 "border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-800/35 dark:text-slate-400 sm:px-5";
const POS_HERO_CARD =
 "rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white px-5 py-8 text-center ring-1 ring-slate-950/[0.03] dark:border-slate-700/90 dark:from-slate-800/50 dark:to-slate-900/80 dark:ring-white/[0.04] sm:py-9";
const POS_LINE_CARD =
 "flex gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 ring-1 ring-slate-950/[0.03] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.04]";
const POS_SUMMARY_CARD =
 "mt-4 flex justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-4 ring-1 ring-slate-950/[0.03] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.04]";
const POS_STEP_BODY = "min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6";
const POS_STEP_FOOTER =
 "sticky bottom-0 z-[42] shrink-0 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 sm:px-5 md:static md:z-auto md:border-0 md:bg-transparent md:px-5 md:pb-6 md:pt-4 md:backdrop-blur-none";
const POS_CTA_PRIMARY =
 "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold tracking-tight transition active:scale-[0.99] disabled:opacity-50";
const POS_CTA_SECONDARY =
 "w-full rounded-2xl border border-slate-200/90 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const RECEIPT_SETTINGS_KEY = "fs_pos_receipt_settings_v1";

function defaultReceiptSettings() {
 return {
 businessName: "Fit andSleek",
 header: "",
 footer: "",
 showCustomer: false,
 };
}

function loadReceiptSettings() {
 try {
 const raw = localStorage.getItem(RECEIPT_SETTINGS_KEY);
 if (!raw) return defaultReceiptSettings();
 return { ...defaultReceiptSettings(), ...JSON.parse(raw) };
 } catch {
 return defaultReceiptSettings();
 }
}

function saveReceiptSettingsToStorage(partial) {
 const next = { ...loadReceiptSettings(), ...partial };
 localStorage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(next));
 return next;
}

function escHtml(s) {
 return String(s ?? "")
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;");
}

/** Printable / preview HTML for a POS receipt. */
function buildReceiptPrintHtml(receipt, settings) {
 const biz = settings.businessName || "Fit andSleek";
 const head = settings.header?.trim();
 const foot = settings.footer?.trim();
 const rows = receipt.lines
 .map(
 (l) =>
 `<tr><td>${escHtml(l.qty)}× ${escHtml(l.name)}</td><td class="r">${escHtml(formatMoney(l.unitPrice * l.qty))}</td></tr>`
 )
 .join("");
 const at = new Date(receipt.completedAt);
 const when = Number.isNaN(at.getTime()) ? String(receipt.completedAt) : at.toLocaleString();
 const no = receipt.receiptNo != null ? String(receipt.receiptNo) : "—";
 const kh = receipt.khqr;
 const khqrHtml =
 kh?.qr_string
 ? `<div style="text-align:center;margin-top:22px;padding:14px 12px 18px;border:2px solid #C0272D;border-radius:14px;background:#fff5f5">
<div style="font-weight:800;color:#C0272D;font-size:0.88rem;letter-spacing:.04em">KHQR · BAKONG</div>
<div style="font-size:0.78rem;color:#333;margin:6px 0 14px;line-height:1.35">ចំនួនទឹកប្រាក់ — Buyer scans to pay</div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
 kh.qr_string
 )}" width="220" height="220" alt="KHQR" style="display:block;margin:0 auto;background:#fff;border-radius:8px" />
<div style="margin-top:12px;font-size:1rem;font-weight:800;color:#111">${escHtml(String(kh.amount_label || ""))}</div>${
 kh.expires_at
 ? `<div style="margin-top:6px;font-size:0.72rem;color:#666">${escHtml(
 `Expires ${new Date(kh.expires_at).toLocaleString()}`
 )}</div>`
 : ""
 }
</div>`
 : "";

 return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt #${escHtml(no)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:400px;margin:0 auto;padding:20px 16px 32px;color:#111;background:#fff}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.rn{font-size:1.35rem;font-weight:800;letter-spacing:.02em}
.biz{font-weight:600;font-size:1rem}
.head,.foot{font-size:0.85rem;color:#444;margin:8px 0}
table{width:100%;border-collapse:collapse;font-size:0.95rem;margin-top:8px}
td{padding:8px 0;border-bottom:1px solid #eee}
td.r{text-align:right;font-weight:500}
.meta{text-align:center;font-size:0.8rem;color:#555;margin-top:16px;padding-top:12px;border-top:1px solid #ddd}
.total{display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;margin-top:14px;padding-top:10px;border-top:2px solid #111}
.small{font-size:0.75rem;color:#888;margin-top:20px;text-align:center}
@media print{body{margin:0;padding:16px}}
</style></head><body>
<div class="top"><span class="biz">${escHtml(biz)}</span><span class="rn">RECEIPT#${escHtml(no)}</span></div>
${head ? `<div class="head">${escHtml(head)}</div>` : ""}
<div style="font-size:0.85rem;color:#555">${escHtml(String(receipt.lines.length))} item(s) · Qty total: ${escHtml(
 String(receipt.lines.reduce((s, l) => s + l.qty, 0))
 )}</div>
<table><tbody>${rows}</tbody></table>
<div class="total"><span>Total</span><span>${escHtml(formatMoney(receipt.subtotal))}</span></div>
${khqrHtml}
${foot ? `<div class="foot" style="text-align:center;margin-top:14px;font-size:0.9rem">${escHtml(foot)}</div>` : ""}
<div class="meta">${receipt.orderNumber ? `<div style="font-weight:600;margin-bottom:6px">Order ${escHtml(String(receipt.orderNumber))}</div>` : ""}${escHtml(when)}</div>
<div class="small">${escHtml(receipt.paymentMethodLabel || "")}${receipt.orderNumber ? ` · Order ${escHtml(String(receipt.orderNumber))}` : ""} · Stock updated</div>
</body></html>`;
}

/** Open receipt in new window and trigger print (Save as PDF). */
function openPosReceiptReport(receipt, settings) {
 const doc = buildReceiptPrintHtml(receipt, settings || loadReceiptSettings()).replace(
 "</body>",
 `<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body>`
 );
 const w = window.open("", "_blank", "width=480,height=720");
 if (!w) return false;
 w.document.write(doc);
 w.document.close();
 w.focus();
 return true;
}

export default function AdminPosScan() {
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();
 const { primaryColor, mode } = useTheme();
 const isDark = mode === "dark";

 const [step, setStep] = useState("checkout");
 const [lines, setLines] = useState([]);
 const [scanErr, setScanErr] = useState("");
 const [confirmBusy, setConfirmBusy] = useState(false);
 const [selectedPayment, setSelectedPayment] = useState("cash");
 /** After successful sale: receipt for report / complete step */
 const [lastReceipt, setLastReceipt] = useState(null);
 /** Cash keypad: amount received in cents */
 const [tenderCents, setTenderCents] = useState(0);
 const [receiptSettings, setReceiptSettings] = useState(() => loadReceiptSettings());
 /** Where "receipt settings" back / save returns: receipt preview or post-charge menu */
 const [settingsReturnStep, setSettingsReturnStep] = useState("postSale");

 /** Scan sale / payment pickup (reduce stock without cart) — moved from Barcode & QR */
 const [pickupCode, setPickupCode] = useState("");
 const [pickupQty, setPickupQty] = useState("1");
 const [pickupBusy, setPickupBusy] = useState(false);
 const [pickupLookupBusy, setPickupLookupBusy] = useState(false);
 const [pickupPreview, setPickupPreview] = useState(null);
 const [pickupCameraOn, setPickupCameraOn] = useState(false);
 const [pickupErr, setPickupErr] = useState("");
 const pickupHtml5Ref = useRef(null);
 const pickupInputRef = useRef(null);
 const pickupLookupSeqRef = useRef(0);

 const scanHtml5Ref = useRef(null);
 const processingRef = useRef(false);
 const lastScanRef = useRef({ text: "", t: 0 });
 const linesRef = useRef([]);

 useEffect(() => {
 linesRef.current = lines;
 }, [lines]);

 /** After Barcode & QR queued receipt (legacy): open same post-sale flow */
 useEffect(() => {
 const nav = consumePostSaleNavigation();
 if (!nav?.receipt) return;
 setLastReceipt(nav.receipt);
 setLines([]);
 setScanErr("");
 setStep(nav.targetStep === "receipt" ? "receipt" : "postSale");
 }, []);

 const stopScanCamera = useCallback(async () => {
 const h = scanHtml5Ref.current;
 scanHtml5Ref.current = null;
 if (!h) return;
 try {
 await h.stop();
 } catch {
 /* */
 }
 try {
 await h.clear();
 } catch {
 /* */
 }
 }, []);

 const stopPickupCamera = useCallback(async () => {
 const h = pickupHtml5Ref.current;
 pickupHtml5Ref.current = null;
 if (!h) return;
 try {
 await h.stop();
 } catch {
 /* */
 }
 try {
 await h.clear();
 } catch {
 /* */
 }
 setPickupCameraOn(false);
 }, []);

 const lookupPickupCode = useCallback(async (codeArg, { silentEmpty = false } = {}) => {
 const code = String(codeArg ?? "").trim();
 if (!code) {
 setPickupPreview(null);
 setPickupErr(silentEmpty ? "" : "Enter or scan a label code.");
 return null;
 }
 const seq = ++pickupLookupSeqRef.current;
 setPickupLookupBusy(true);
 setPickupErr("");
 try {
 const { data: lookupData } = await api.get("/admin/barcode-scan/lookup", { params: { code } });
 if (seq !== pickupLookupSeqRef.current) return null;
 const lookupRow = lookupData?.data;
 if (!lookupRow?.code) {
 setPickupPreview(null);
 setPickupErr("No product matches this code.");
 return null;
 }
 setPickupPreview(lookupRow);
 const normalized = String(lookupRow.code || code).trim();
 setPickupCode((prev) => (prev.trim() === normalized ? prev : normalized));
 return lookupRow;
 } catch (le) {
 if (seq !== pickupLookupSeqRef.current) return null;
 const d = le?.response?.data;
 const first =
 d?.errors && typeof d.errors === "object"
 ? Object.values(d.errors)
 .flat()
 .find(Boolean)
 : null;
 setPickupErr(first || d?.message || extractErr(le));
 setPickupPreview(null);
 return null;
 } finally {
 if (seq === pickupLookupSeqRef.current) setPickupLookupBusy(false);
 }
 }, []);

 const submitPickupScanSale = useCallback(
 async () => {
 if (!pickupPreview?.code) {
 setPickupErr("Enter a valid code and wait for the product to appear.");
 return;
 }
 const code = String(pickupPreview.code).trim();
 const qtyRaw = parseInt(document.getElementById("pos-pickup-scan-qty")?.value || pickupQty || "1", 10);
 const qty = Math.max(1, Math.min(9999, Number.isFinite(qtyRaw) ? qtyRaw : 1));
 if (!code) {
 setPickupErr("Enter or scan a label code.");
 return;
 }
 setPickupBusy(true);
 setPickupErr("");
 try {
 const lookupRow = pickupPreview;
 const maxSell = lookupRow?.max_sellable_qty;
 if (maxSell != null && qty > maxSell) {
 const msg =
 maxSell < 1
 ? "No stock: this item cannot be reduced further (inventory is 0 or unavailable)."
 : `No stock: only ${maxSell} unit(s) available for this code. Lower the quantity.`;
 setPickupErr(msg);
 await errorAlert({
 khTitle: "គ្មានស្តុក",
 enTitle: "No stock",
 detail: msg,
 });
 return;
 }

 const receiptNo = nextReceiptNumber();
 const { data: saleResp } = await api.post("/admin/pos/complete-sale", {
 payment_method: "cash",
 lines: [{ code: String(lookupRow.code), qty }],
 receipt_no: String(receiptNo),
 });
 const d = saleResp?.data;
 const lineCode = String(lookupRow.code);
 const slug = (Array.isArray(d?.lines) && d.lines[0]?.code) || lineCode || code;
 const unitPrice = Number(lookupRow.price) || 0;
 const itemName = String(lookupRow.name || "Item");
 const sub = Math.round(unitPrice * qty * 100) / 100;
 const srvLines = Array.isArray(d?.lines) ? d.lines : [];
 const linesForNav =
 srvLines.length > 0
 ? srvLines.map((l) => ({
 code: l.code,
 name: l.name,
 qty: l.qty,
 unitPrice: Number(l.unit_price),
 }))
 : [{ code: lineCode, name: itemName, qty, unitPrice }];
 const subNav = Number(d?.subtotal);
 const subtotalFinal = Number.isFinite(subNav) ? subNav : sub;
 const payLabel = paymentMethodLabel("cash");
 setLastReceipt({
 lines: linesForNav,
 subtotal: subtotalFinal,
 paymentMethodId: "cash",
 paymentMethodLabel: payLabel,
 completedAt: new Date().toISOString(),
 receiptNo,
 tenderReceivedCents: null,
 orderNumber: d?.order?.order_number,
 khqr: normalizePosKhqrResponse(d?.khqr),
 });
 setLines([]);
 setScanErr("");
 setStep("postSale");
 setPickupCode("");
 setPickupPreview(null);
 toastSuccess(`Stock reduced (${slug}) × ${qty}. Order ${d?.order?.order_number ?? "saved"}.`);
 setTimeout(() => pickupInputRef.current?.focus(), 0);
 } catch (e2) {
 const d = e2?.response?.data;
 const first =
 d?.errors && typeof d.errors === "object"
 ? Object.values(d.errors)
 .flat()
 .find(Boolean)
 : null;
 setPickupErr(first || d?.message || extractErr(e2));
 } finally {
 setPickupBusy(false);
 }
 },
 [pickupPreview, pickupQty]
 );

 useEffect(() => {
 const code = pickupCode.trim();
 if (!code) {
 pickupLookupSeqRef.current += 1;
 setPickupPreview(null);
 setPickupErr("");
 setPickupLookupBusy(false);
 return undefined;
 }
 setPickupPreview((prev) => {
 if (!prev) return null;
 return String(prev.code).trim().toLowerCase() === code.toLowerCase() ? prev : null;
 });
 const timer = window.setTimeout(() => {
 void lookupPickupCode(code, { silentEmpty: true });
 }, 320);
 return () => window.clearTimeout(timer);
 }, [pickupCode, lookupPickupCode]);

 const startPickupCamera = useCallback(async () => {
 setPickupErr("");
 await stopPickupCamera();
 await stopScanCamera();
 setPickupCameraOn(true);
 await new Promise((r) => setTimeout(r, 120));
 const host = document.getElementById("pos-pickup-scan-reader");
 if (!host) {
 setPickupCameraOn(false);
 return;
 }
 host.innerHTML = "";
 const formatsToSupport = [
 Html5QrcodeSupportedFormats.QR_CODE,
 Html5QrcodeSupportedFormats.CODE_128,
 Html5QrcodeSupportedFormats.EAN_13,
 Html5QrcodeSupportedFormats.EAN_8,
 ];
 try {
 const scanner = new Html5Qrcode("pos-pickup-scan-reader", { formatsToSupport, verbose: false });
 pickupHtml5Ref.current = scanner;
 await scanner.start(
 { facingMode: "environment" },
 { fps: 10, qrbox: { width: 280, height: 180 } },
 async (decodedText) => {
 const t = String(decodedText || "").trim();
 if (!t) return;
 try {
 await scanner.stop();
 } catch {
 /* */
 }
 try {
 await scanner.clear();
 } catch {
 /* */
 }
 pickupHtml5Ref.current = null;
 setPickupCameraOn(false);
 setPickupCode(t);
 },
 () => {}
 );
 } catch (camErr) {
 pickupHtml5Ref.current = null;
 setPickupCameraOn(false);
 setPickupErr(extractErr(camErr) || "Camera failed. Allow permission or type the code.");
 }
 }, [stopPickupCamera, stopScanCamera]);

 const appendLookupToCart = useCallback(async (rawText) => {
 const t = String(rawText || "").trim();
 if (!t) return false;
 setScanErr("");
 try {
 const { data } = await api.get(`/admin/barcode-scan/lookup`, {
 params: { code: t },
 });
 const row = data?.data;
 if (!row?.code) {
 setScanErr("Unknown code.");
 return false;
 }
 const code = String(row.code);
 const name = String(row.name || "Item");
 const unitPrice = Number(row.price) || 0;

 const prev = linesRef.current;
 const idxExisting = prev.findIndex((l) => l.code.toLowerCase() === code.toLowerCase());
 const nextQty = idxExisting >= 0 ? prev[idxExisting].qty + 1 : 1;
 const maxSell = row.max_sellable_qty;
 if (maxSell != null && nextQty > maxSell) {
 const msg =
 maxSell < 1
 ? "No stock: this item cannot be sold (inventory is 0 or not tracked as available)."
 : `No stock: only ${maxSell} unit(s) available; your cart already has or would exceed that.`;
 setScanErr(msg);
 await errorAlert({
 khTitle: "គ្មានស្តុក",
 enTitle: "No stock",
 detail: msg,
 });
 return false;
 }

 setLines((prev) => {
 const idx = prev.findIndex((l) => l.code.toLowerCase() === code.toLowerCase());
 if (idx >= 0) {
 const next = [...prev];
 const cur = next[idx];
 next[idx] = {
 ...cur,
 qty: cur.qty + 1,
 has_label: Boolean(row.has_label),
 manage_label_stock: Boolean(row.manage_label_stock),
 label_stock: row.label_stock != null ? row.label_stock : cur.label_stock,
 };
 return next;
 }
 return [
 ...prev,
 {
 id: crypto.randomUUID?.() ?? `line-${Date.now()}-${Math.random()}`,
 code,
 name,
 unitPrice,
 image_url: row.image_url || null,
 qty: 1,
 has_label: Boolean(row.has_label),
 manage_label_stock: Boolean(row.manage_label_stock),
 label_stock: row.label_stock != null ? row.label_stock : null,
 },
 ];
 });
 return true;
 } catch (e) {
 setScanErr(extractErr(e));
 return false;
 }
 }, []);

 const startScanCamera = useCallback(async () => {
 setScanErr("");
 await stopPickupCamera();
 await stopScanCamera();
 await new Promise((r) => setTimeout(r, 80));
 const host = document.getElementById("pos-scan-reader");
 if (!host) return;
 host.innerHTML = "";
 const formatsToSupport = [
 Html5QrcodeSupportedFormats.QR_CODE,
 Html5QrcodeSupportedFormats.CODE_128,
 Html5QrcodeSupportedFormats.EAN_13,
 Html5QrcodeSupportedFormats.EAN_8,
 ];
 try {
 const scanner = new Html5Qrcode("pos-scan-reader", { formatsToSupport, verbose: false });
 scanHtml5Ref.current = scanner;
 await scanner.start(
 { facingMode: "environment" },
 { fps: 10, qrbox: { width: Math.min(300, window.innerWidth - 32), height: 200 } },
 async (decodedText) => {
 const text = String(decodedText || "").trim();
 if (!text || processingRef.current) return;
 const now = Date.now();
 if (lastScanRef.current.text === text && now - lastScanRef.current.t < 1800) return;
 processingRef.current = true;
 try {
 const added = await appendLookupToCart(text);
 if (added) {
 lastScanRef.current = { text, t: Date.now() };
 }
 } finally {
 processingRef.current = false;
 }
 },
 () => {}
 );
 } catch (camErr) {
 scanHtml5Ref.current = null;
 setScanErr(extractErr(camErr) || "Camera failed. Allow permission or type a code in the checkout panel.");
 }
 }, [appendLookupToCart, stopPickupCamera, stopScanCamera]);

 useEffect(() => {
 if (step !== "checkout") {
 void stopScanCamera();
 void stopPickupCamera();
 return;
 }
 if (pickupCameraOn) {
 void stopScanCamera();
 return;
 }
 const id = window.setTimeout(() => {
 void startScanCamera();
 }, 200);
 return () => {
 window.clearTimeout(id);
 void stopScanCamera();
 };
 }, [step, pickupCameraOn, startScanCamera, stopScanCamera, stopPickupCamera]);

 useEffect(() => {
 return () => {
 void stopScanCamera();
 void stopPickupCamera();
 };
 }, [stopScanCamera, stopPickupCamera]);

 /** Deep link: /admin/checkout?pickup=1 (replaces old Barcode & QR ?scan=1) */
 useEffect(() => {
 if (step !== "checkout") return;
 if (searchParams.get("pickup") !== "1") return;
 const timer = window.setTimeout(() => {
 setSearchParams({}, { replace: true });
 document.getElementById("pos-pickup-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
 void startPickupCamera();
 }, 400);
 return () => window.clearTimeout(timer);
 }, [step, searchParams, setSearchParams, startPickupCamera]);

 const subtotal = useMemo(
 () => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
 [lines]
 );
 const subtotalCents = useMemo(() => Math.round(subtotal * 100), [subtotal]);
 const itemCount = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

 const removeLine = (id) => {
 setLines((prev) => prev.filter((l) => l.id !== id));
 };

 const saveDraftOrder = async () => {
 if (lines.length === 0 || confirmBusy) return;
 setConfirmBusy(true);
 try {
 const { data } = await api.post("/admin/pos/draft-order", {
 payment_method: selectedPayment,
 lines: lines.map((l) => ({ code: l.code, qty: l.qty })),
 });
 const on = data?.data?.order?.order_number;
 toastSuccess(on ? `Draft saved: ${on}` : "Draft order saved.");
 } catch (e) {
 await errorAlert({ khTitle: "បរាជ័យ", enTitle: "Failed", detail: extractErr(e) });
 } finally {
 setConfirmBusy(false);
 }
 };

 const confirmSale = async (opts = {}) => {
 const tenderReceivedCents = opts.tenderReceivedCents;
 if (lines.length === 0) return;
 const snapshot = lines.map((l) => ({
 code: l.code,
 name: l.name,
 qty: l.qty,
 unitPrice: l.unitPrice,
 }));
 const payLabel = paymentMethodLabel(selectedPayment);
 setConfirmBusy(true);
 try {
 const receiptNo = nextReceiptNumber();
 const { data } = await api.post("/admin/pos/complete-sale", {
 payment_method: selectedPayment,
 lines: snapshot.map((l) => ({ code: l.code, qty: l.qty })),
 receipt_no: String(receiptNo),
 tender_received_cents: tenderReceivedCents != null ? tenderReceivedCents : undefined,
 });
 const d = data?.data;
 const srvLines = Array.isArray(d?.lines) ? d.lines : [];
 const linesOut =
 srvLines.length > 0
 ? srvLines.map((l) => ({
 code: l.code,
 name: l.name,
 qty: l.qty,
 unitPrice: Number(l.unit_price),
 }))
 : snapshot;
 const sub = Number(d?.subtotal);
 const subtotalFinal = Number.isFinite(sub) ? sub : snapshot.reduce((s, l) => s + l.unitPrice * l.qty, 0);
 setLastReceipt({
 lines: linesOut,
 subtotal: subtotalFinal,
 paymentMethodId: selectedPayment,
 paymentMethodLabel: payLabel,
 completedAt: new Date().toISOString(),
 receiptNo,
 tenderReceivedCents: tenderReceivedCents != null ? tenderReceivedCents : null,
 orderNumber: d?.order?.order_number,
 khqr: normalizePosKhqrResponse(d?.khqr),
 });
 setLines([]);
 setStep("postSale");
 toastSuccess("Sale recorded. Stock updated.");
 } catch (e) {
 await errorAlert({ khTitle: "បរាជ័យ", enTitle: "Failed", detail: extractErr(e) });
 } finally {
 setConfirmBusy(false);
 }
 };

 const goToCashTender = () => {
 setTenderCents(Math.max(0, subtotalCents));
 setStep("tender");
 };

 const tenderKey = (digit) => {
 const d = parseInt(digit, 10);
 if (Number.isNaN(d)) return;
 setTenderCents((c) => Math.min(999999999, c * 10 + d));
 };

 const tenderBackspace = () => {
 setTenderCents((c) => Math.floor(c / 10));
 };

 const finishFlow = () => {
 setLastReceipt(null);
 setSelectedPayment("cash");
 setTenderCents(0);
 setStep("checkout");
 };

 const handleCreateReport = () => {
 if (!lastReceipt) return;
 const ok = openPosReceiptReport(lastReceipt, receiptSettings);
 if (!ok) {
 toastSuccess("Allow pop-ups for this site, then try again.");
 return;
 }
 toastSuccess("Use Print → Save as PDF if you want a file.");
 };

 const shareReceipt = async () => {
 if (!lastReceipt) return;
 const text = `${receiptSettings.businessName}\nReceipt #${lastReceipt.receiptNo}${
 lastReceipt.orderNumber ? `\nOrder ${lastReceipt.orderNumber}` : ""
 }\nTotal ${formatMoney(lastReceipt.subtotal)}`;
 try {
 if (navigator.share) {
 await navigator.share({ title: "Receipt", text });
 } else {
 await navigator.clipboard.writeText(text);
 toastSuccess("Receipt summary copied to clipboard.");
 }
 } catch {
 /* user cancelled or clipboard denied */
 }
 };

 const emailReceipt = () => {
 if (!lastReceipt) return;
 const subj = encodeURIComponent(`Receipt #${lastReceipt.receiptNo}`);
 const body = encodeURIComponent(
 `${receiptSettings.businessName}\nTotal: ${formatMoney(lastReceipt.subtotal)}${
 lastReceipt.orderNumber ? `\nOrder: ${lastReceipt.orderNumber}` : ""
 }\n${lastReceipt.lines.map((l) => `${l.qty}x ${l.name} ${formatMoney(l.unitPrice * l.qty)}`).join("\n")}`
 );
 window.location.href = `mailto:?subject=${subj}&body=${body}`;
 };

 const saveReceiptToDevice = () => {
 if (!lastReceipt) return;
 const ok = saveReceiptSnapshotToStorage(lastReceipt, receiptSettings);
 if (ok) {
 toastSuccess({ enText: "Receipt saved on this device." });
 } else {
 void errorAlert({ khTitle: "មិនអាចរក្សាទុក", enTitle: "Could not save", detail: "Storage may be full or blocked." });
 }
 };

 const tealBtn = "rounded-xl font-semibold text-white transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";
 const accentBg = { backgroundColor: "var(--admin-primary)" };

 if (step === "receiptSettings") {
 return (
 <div className={POS_OUTER}>
 <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-700">
 <button
 type="button"
 onClick={() => setStep(settingsReturnStep)}
 className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
 aria-label="Back"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Set up my receipt</h1>
 </header>

 <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
 <button
 type="button"
 disabled
 className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-400 dark:border-slate-700"
 >
 Business information
 <span className="text-slate-400">›</span>
 </button>

 <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
 <div>
 <p className="text-sm font-medium text-slate-900 dark:text-white">Display customer information</p>
 <p className="text-xs text-slate-500 dark:text-slate-400">Name, address, and phone number.</p>
 </div>
 <button
 type="button"
 role="switch"
 aria-checked={receiptSettings.showCustomer}
 onClick={() =>
 setReceiptSettings((s) => ({ ...s, showCustomer: !s.showCustomer }))
 }
 className={`relative h-7 w-12 shrink-0 rounded-full transition ${receiptSettings.showCustomer ? "bg-[color:var(--admin-primary)]" : "bg-slate-300 dark:bg-slate-600"}`}
 >
 <span
 className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition ${receiptSettings.showCustomer ? "translate-x-5" : ""}`}
 />
 </button>
 </div>

 <div>
 <label className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
 Header (optional)
 <span className="text-slate-400" title="Shown below store name on receipt">
 ?
 </span>
 </label>
 <input
 value={receiptSettings.header}
 onChange={(e) => setReceiptSettings((s) => ({ ...s, header: e.target.value }))}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
 placeholder="e.g. Fit andSleek"
 />
 </div>
 <div>
 <label className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
 Footer (optional)
 <span className="text-slate-400" title="Shown above date on receipt">
 ?
 </span>
 </label>
 <input
 value={receiptSettings.footer}
 onChange={(e) => setReceiptSettings((s) => ({ ...s, footer: e.target.value }))}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
 placeholder="e.g. phone or thank-you"
 />
 </div>

 <div>
 <label className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Store name on receipt</label>
 <input
 value={receiptSettings.businessName}
 onChange={(e) => setReceiptSettings((s) => ({ ...s, businessName: e.target.value }))}
 className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
 />
 </div>

 <button
 type="button"
 disabled
 className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-400 dark:border-slate-700"
 >
 Printer
 <span className="text-slate-400">›</span>
 </button>
 </div>

 <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700">
 <div className={POS_INNER}>
 <button
 type="button"
 onClick={() => {
 if (lastReceipt) {
 const w = window.open("", "_blank", "width=480,height=720");
 if (w) {
 w.document.write(buildReceiptPrintHtml(lastReceipt, receiptSettings));
 w.document.close();
 }
 }
 }}
 disabled={!lastReceipt}
 className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
 </svg>
 Open my receipt
 </button>
 <button
 type="button"
 onClick={() => {
 const saved = saveReceiptSettingsToStorage(receiptSettings);
 setReceiptSettings(saved);
 toastSuccess("Receipt settings saved.");
 setStep(settingsReturnStep);
 }}
 className={`w-full py-3.5 ${tealBtn}`}
 style={accentBg}
 >
 Save
 </button>
 </div>
 </div>
 </div>
 );
 }

 if (step === "receipt" && lastReceipt) {
 const at = new Date(lastReceipt.completedAt);
 const when = Number.isNaN(at.getTime()) ? lastReceipt.completedAt : at.toLocaleString();
 const qtyTotal = lastReceipt.lines.reduce((s, l) => s + l.qty, 0);
 return (
 <div className={POS_OUTER}>
 <header className="flex items-center justify-between border-b border-slate-200 px-2 py-2 dark:border-slate-700">
 <button
 type="button"
 onClick={() => setStep("postSale")}
 className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
 >
 Close
 </button>
 <button
 type="button"
 onClick={() => {
 setSettingsReturnStep("receipt");
 setStep("receiptSettings");
 }}
 className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--admin-primary)] hover:bg-[rgba(var(--admin-primary-rgb),0.08)] dark:text-[color:var(--admin-primary)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)]"
 >
 Edit my receipt
 <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
 </svg>
 </button>
 </header>

 <div className="flex-1 overflow-y-auto px-4 py-6">
 <div className="flex items-start justify-between gap-2">
 <span className="font-semibold text-slate-900 dark:text-white">{receiptSettings.businessName}</span>
 <span className="text-right text-lg font-bold tracking-tight text-slate-900 dark:text-white">
 {`RECEIPT#${lastReceipt.receiptNo}`}
 </span>
 </div>
 <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
 {lastReceipt.lines.length} item{lastReceipt.lines.length === 1 ? "" : "s"} (Qty.: {qtyTotal})
 </p>
 {lastReceipt.orderNumber ? (
 <p className="mt-1 text-xs font-semibold text-[color:var(--admin-primary)] dark:text-[color:var(--admin-primary)]">Order {lastReceipt.orderNumber}</p>
 ) : null}
 {receiptSettings.header?.trim() ? (
 <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{receiptSettings.header.trim()}</p>
 ) : null}
 <div className="my-4 border-t border-slate-200 dark:border-slate-700" />
 <ul className="space-y-2">
 {lastReceipt.lines.map((l, i) => (
 <li key={`rc-${i}-${l.code}`} className="flex justify-between gap-2 text-sm">
 <span className="text-slate-800 dark:text-slate-200">
 {l.qty}× {l.name}
 </span>
 <span className="shrink-0 font-medium text-slate-900 dark:text-white">{formatMoney(l.unitPrice * l.qty)}</span>
 </li>
 ))}
 </ul>
 <div className="mt-4 flex justify-between border-t-2 border-slate-900 pt-3 text-base font-bold text-slate-900 dark:border-white dark:text-white">
 <span>Total</span>
 <span>{formatMoney(lastReceipt.subtotal)}</span>
 </div>
 {lastReceipt.khqr ? (
 <div className="mt-6 flex flex-col items-center">
 <PosKhqrBuyerPayBlock khqr={lastReceipt.khqr} />
 </div>
 ) : null}
 {receiptSettings.footer?.trim() ? (
 <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">{receiptSettings.footer.trim()}</p>
 ) : null}
 <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{when}</p>
 </div>

 <nav className="grid grid-cols-4 border-t border-slate-800 bg-slate-900 py-2 text-white dark:border-slate-600">
 <button
 type="button"
 onClick={() => handleCreateReport()}
 className="flex flex-col items-center gap-1 py-2 text-xs leading-tight font-medium opacity-90 hover:opacity-100"
 >
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 PDF
 </button>
 <button type="button" onClick={emailReceipt} className="flex flex-col items-center gap-1 py-2 text-xs leading-tight font-medium opacity-90 hover:opacity-100">
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
 </svg>
 Email
 </button>
 <button type="button" onClick={() => handleCreateReport()} className="flex flex-col items-center gap-1 py-2 text-xs leading-tight font-medium opacity-90 hover:opacity-100">
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2M7 7H5a2 2 0 00-2 2v4a2 2 0 002 2h2m0 0h10M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6" />
 </svg>
 Print
 </button>
 <button type="button" onClick={() => void shareReceipt()} className="flex flex-col items-center gap-1 py-2 text-xs leading-tight font-medium opacity-90 hover:opacity-100">
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
 </svg>
 Share
 </button>
 </nav>
 </div>
 );
 }

 if (step === "postSale" && lastReceipt) {
 const teal = "var(--admin-primary)";
 const menuBtn =
 "flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";
 return (
 <div className={POS_OUTER}>
 <header className="flex items-center justify-between border-b border-slate-100 px-2 py-3 dark:border-slate-800">
 <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Menu" disabled>
 <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 </button>
 <span className="text-base font-semibold text-slate-800 dark:text-white">Charge complete</span>
 <button type="button" disabled className="h-9 w-9 rounded-lg opacity-40" aria-hidden />
 </header>

 <div className="flex flex-1 flex-col gap-8 px-4 pb-24 pt-6 md:pb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:px-8">
 <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
 <svg className="mb-4 h-16 w-16 shrink-0" viewBox="0 0 64 64" fill="none" aria-hidden>
 <circle cx="32" cy="32" r="28" stroke={teal} strokeWidth="2" opacity="0.25" />
 <path d="M18 34l10 10 18-22" stroke={teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Amount charged</p>
 <p className="mt-1 text-4xl font-light tracking-tight lg:text-5xl" style={{ color: teal }}>
 <span className="align-top text-2xl opacity-80">$</span>
 {lastReceipt.subtotal.toFixed(2)}
 </p>
 <p className="mt-4 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 lg:text-sm">
 Create the receipt, customize header/footer if needed, print for the customer, then save a copy on this device.
 </p>
 <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
 {lastReceipt.paymentMethodLabel}
 {lastReceipt.orderNumber ? ` · ${lastReceipt.orderNumber}` : ""}
 </p>
 {lastReceipt.khqr ? (
 <div className="mt-6 flex w-full flex-col items-center">
 <PosKhqrBuyerPayBlock khqr={lastReceipt.khqr} />
 </div>
 ) : null}
 </div>

 <ol className="mt-0 space-y-2.5 lg:mt-2">
 <li className="list-none">
 <button type="button" className={menuBtn} onClick={() => setStep("receipt")}>
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--admin-primary-rgb),0.14)] text-xs font-bold text-[color:var(--admin-primary)] dark:bg-[rgba(var(--admin-primary-rgb),0.2)] dark:text-[color:var(--admin-primary)]">
 1
 </span>
 <span className="flex-1">Create receipt</span>
 <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 </li>
 <li className="list-none">
 <button
 type="button"
 className={menuBtn}
 onClick={() => {
 setSettingsReturnStep("postSale");
 setStep("receiptSettings");
 }}
 >
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
 2
 </span>
 <span className="flex-1">Customize receipt</span>
 <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 </li>
 <li className="list-none">
 <button type="button" className={menuBtn} onClick={() => handleCreateReport()}>
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
 3
 </span>
 <span className="flex-1">Print receipt</span>
 <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2M7 7H5a2 2 0 00-2 2v4a2 2 0 002 2h2m0 0h10M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M9 7h6" />
 </svg>
 </button>
 </li>
 <li className="list-none">
 <button type="button" className={menuBtn} onClick={saveReceiptToDevice}>
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
 4
 </span>
 <span className="flex-1">Save receipt</span>
 <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-4 0h4" />
 </svg>
 </button>
 </li>
 </ol>
 </div>

 <div className="fixed bottom-0 left-0 right-0 z-[42] border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] dark:border-slate-700 dark:bg-slate-900 md:static md:z-auto md:border-0 md:pb-3 md:pt-2">
 <button type="button" onClick={finishFlow} className={`block w-full py-3.5 ${tealBtn}`} style={accentBg}>
 Start a new sale
 </button>
 </div>
 </div>
 );
 }

 if (step === "tender") {
 const due = subtotalCents;
 const canCharge = tenderCents >= due;
 const display = (tenderCents / 100).toFixed(2);
 const payTitle = paymentMethodLabel(selectedPayment);
 const keys = [
 ["1", "2", "3"],
 ["4", "5", "6"],
 ["7", "8", "9"],
 ["blank", "0", "back"],
 ];
 return (
 <div className={POS_OUTER_CARD}>
 <header className={POS_STEP_HEADER}>
 <div className="flex min-w-0 items-center gap-1">
 <button
 type="button"
 onClick={() => setStep("payment")}
 className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
 aria-label="Back"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">Payment: {payTitle}</h1>
 </div>
 <div className="h-10 w-10 shrink-0" aria-hidden />
 </header>

 <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-5 sm:px-5 sm:pt-6">
 <div className={POS_HERO_CARD}>
 <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Amount received</p>
 <div className="mt-3 flex items-baseline justify-center gap-0.5 text-[color:var(--admin-primary)]">
 <span className="text-3xl font-medium">$</span>
 <span className="text-5xl font-semibold tabular-nums tracking-tight">{display}</span>
 </div>
 {tenderCents < due ? (
 <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">Enter at least {formatMoney(due / 100)} due.</p>
 ) : tenderCents > due ? (
 <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Change {formatMoney((tenderCents - due) / 100)}</p>
 ) : null}
 </div>

 <div className="mt-6 w-full min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/90 bg-white ring-1 ring-slate-950/[0.03] dark:border-slate-700 dark:bg-slate-900 dark:ring-white/[0.04]">
 {keys.map((row, ri) => (
 <div
 key={ri}
 className="grid grid-cols-3 divide-x divide-slate-200/90 border-b border-slate-200/90 last:border-b-0 dark:divide-slate-700 dark:border-slate-700"
 >
 {row.map((k) => (
 <button
 key={k}
 type="button"
 disabled={k === "blank"}
 onClick={() => {
 if (k === "back") tenderBackspace();
 else if (k !== "blank") tenderKey(k);
 }}
 className="flex h-[3.25rem] items-center justify-center text-2xl font-medium text-slate-800 transition hover:bg-slate-50/90 active:bg-slate-100 disabled:cursor-default disabled:bg-transparent disabled:hover:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800/80 dark:active:bg-slate-800"
 >
 {k === "back" ? (
 <svg className="h-7 w-7 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
 </svg>
 ) : k === "blank" ? null : (
 k
 )}
 </button>
 ))}
 </div>
 ))}
 </div>
 </div>

 <div className={`${POS_STEP_FOOTER} mt-auto`}>
 <button
 type="button"
 disabled={!canCharge || confirmBusy}
 onClick={() => void confirmSale({ tenderReceivedCents: tenderCents })}
 className={`${POS_CTA_PRIMARY} ${tealBtn}`}
 style={accentBg}
 >
 {confirmBusy ? "Processing…" : `Charge ${formatMoney(tenderCents / 100)}`}
 </button>
 </div>
 </div>
 );
 }

 if (step === "payment") {
 return (
 <div className={POS_OUTER_CARD}>
 <header className={POS_STEP_HEADER}>
 <div className="flex min-w-0 items-center gap-1">
 <button
 type="button"
 onClick={() => setStep("verify")}
 className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
 aria-label="Back to verify order"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white">Payment</h1>
 </div>
 <button
 type="button"
 disabled
 title="Coming soon"
 className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-400 opacity-60 dark:border-slate-600 dark:bg-slate-900"
 aria-label="Add customer"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
 </svg>
 </button>
 </header>

 <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5 sm:px-5 sm:pb-6 sm:pt-6">
 <div className={POS_HERO_CARD}>
 <div className="flex items-baseline justify-center gap-0.5 text-slate-900 dark:text-white">
 <span className="align-top text-2xl font-medium text-slate-500 dark:text-slate-400">$</span>
 <span className="text-5xl font-semibold tabular-nums tracking-tight">{subtotal.toFixed(2)}</span>
 </div>
 </div>

 <div className="mt-5 grid grid-cols-2 gap-3">
 <button
 type="button"
 disabled
 className={`${POS_CTA_SECONDARY} px-3 py-3.5 text-left text-slate-400 opacity-80 dark:text-slate-500`}
 >
 Select a customer
 </button>
 <button
 type="button"
 disabled
 className={`${POS_CTA_SECONDARY} px-3 py-3.5 text-center text-slate-400 opacity-80 dark:text-slate-500`}
 >
 Pay Later
 </button>
 </div>

 <p className="mt-7 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Payment method</p>
 {PAYMENT_KHQR_UI ? (
 <button
 type="button"
 onClick={() => setSelectedPayment(PAYMENT_KHQR_UI.id)}
 className={`mt-2 flex w-full min-h-[3.75rem] items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
 selectedPayment === PAYMENT_KHQR_UI.id
 ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.1)] text-slate-900 ring-2 ring-[rgba(var(--admin-primary-rgb),0.22)] dark:border-[rgba(var(--admin-primary-rgb),0.7)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-slate-100"
 : "border-slate-200/90 bg-white text-slate-800 ring-1 ring-slate-950/[0.03] hover:border-[rgba(var(--admin-primary-rgb),0.35)] hover:bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/[0.04] dark:hover:border-[rgba(var(--admin-primary-rgb),0.5)]"
 }`}
 >
 <svg className="h-9 w-9 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={PAYMENT_KHQR_UI.icon} />
 </svg>
 <span className="min-w-0 flex-1">
 <span className="block text-sm font-bold tracking-tight">KHQR (Bakong)</span>
 <span className="mt-0.5 block text-xs font-medium leading-snug text-current opacity-90">
 {PAYMENT_KHQR_UI.sub || "ចំនួនទឹកប្រាក់ · QR"}
 </span>
 </span>
 </button>
 ) : null}
 <div className="mt-3 grid grid-cols-3 gap-2.5">
 {PAYMENT_METHODS_GRID_UI.map((m) => {
 const active = selectedPayment === m.id;
 return (
 <button
 key={m.id}
 type="button"
 onClick={() => setSelectedPayment(m.id)}
 className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2.5 text-center text-xs font-semibold leading-tight transition ${
 active
 ? "border-[color:var(--admin-primary)] bg-[rgba(var(--admin-primary-rgb),0.1)] text-slate-800 ring-2 ring-[rgba(var(--admin-primary-rgb),0.2)] dark:border-[rgba(var(--admin-primary-rgb),0.7)] dark:bg-[rgba(var(--admin-primary-rgb),0.14)] dark:text-slate-100"
 : "border-slate-200/90 bg-white text-slate-600 ring-1 ring-slate-950/[0.03] hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/[0.04]"
 }`}
 >
 <svg className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={m.icon} />
 </svg>
 <span>{m.label}</span>
 {m.sub ? (
 <span className="max-w-[5.5rem] text-xs leading-tight font-normal leading-tight text-current opacity-80">{m.sub}</span>
 ) : null}
 </button>
 );
 })}
 </div>
 </div>

 <div className={POS_STEP_FOOTER}>
 <div className={`${POS_INNER} flex flex-col gap-3`}>
 <button
 type="button"
 disabled={confirmBusy || lines.length === 0}
 onClick={() => void saveDraftOrder()}
 className={POS_CTA_SECONDARY}
 >
 {confirmBusy ? "Saving…" : "Save order"}
 </button>
 <button
 type="button"
 disabled={confirmBusy || lines.length === 0}
 onClick={() => {
 if (selectedPayment === "cash") goToCashTender();
 else void confirmSale();
 }}
 className={`${POS_CTA_PRIMARY} ${tealBtn}`}
 style={accentBg}
 >
 {confirmBusy
 ? "Processing…"
 : selectedPayment === "cash"
 ? "Continue to amount"
 : "Confirm payment"}
 {!confirmBusy && (
 <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 )}
 </button>
 </div>
 </div>
 </div>
 );
 }

 if (step === "verify") {
 return (
 <div className={POS_OUTER_CARD}>
 <header className={POS_STEP_HEADER}>
 <div className="flex min-w-0 items-center gap-1">
 <button
 type="button"
 onClick={() => setStep("checkout")}
 className="rounded-xl p-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
 aria-label="Back to scanning"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white lg:text-xl">Verify order</h1>
 </div>
 <div className="h-10 w-10 shrink-0" aria-hidden />
 </header>

 <p className={POS_STEP_SUBBAR}>
 Review the full list of everything you scanned. Confirm names, codes, quantities, and prices before payment.
 </p>

 <div className={POS_STEP_BODY}>
 {lines.length === 0 ? (
 <p className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/80 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
 No items. Go back to scan.
 </p>
 ) : (
 <>
 <div className="mb-5">
 <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">All scanned products</h2>
 <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
 {lines.length} {lines.length === 1 ? "product line" : "product lines"} · {itemCount} total{" "}
 {itemCount === 1 ? "unit" : "units"}
 </p>
 </div>

 <ol className="space-y-3.5">
 {lines.map((line) => (
 <li key={line.id} className="list-none">
 <div className={POS_LINE_CARD}>
 <div className="shrink-0">
 {line.image_url ? (
 <img
 src={resolveImageUrl(line.image_url)}
 alt=""
 className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-900/10 dark:ring-white/10"
 />
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--admin-primary-rgb))] to-slate-800 text-xs leading-tight font-semibold uppercase tracking-wider text-white/90 ring-1 ring-black/10 dark:from-[rgb(var(--admin-primary-rgb))] dark:to-slate-900">
 FS
 </div>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="font-semibold leading-snug text-slate-900 dark:text-white">{line.name}</p>
 <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">Code: {line.code}</p>
 {line.has_label && line.manage_label_stock && line.label_stock != null && (
 <p className="mt-1.5 text-xs font-semibold text-[color:var(--admin-primary)]">
 Label stock (now): {line.label_stock}
 </p>
 )}
 <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-600/70">
 <span className="text-sm text-slate-600 dark:text-slate-400">
 Qty <span className="font-semibold text-slate-900 dark:text-white">{line.qty}</span>
 <span className="text-slate-400 dark:text-slate-500"> · </span>
 Unit <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(line.unitPrice)}</span>
 </span>
 <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
 {formatMoney(line.unitPrice * line.qty)}
 </span>
 </div>
 </div>
 </div>
 </li>
 ))}
 </ol>

 <div className={POS_SUMMARY_CARD}>
 <span className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">Total</span>
 <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(subtotal)}</span>
 </div>
 </>
 )}
 </div>

 <div className={POS_STEP_FOOTER}>
 <button
 type="button"
 disabled={lines.length === 0}
 onClick={() => setStep("payment")}
 className={`${POS_CTA_PRIMARY} ${tealBtn}`}
 style={accentBg}
 >
 Pay — choose method
 <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className={POS_OUTER_CARD}>
 <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-700 lg:px-6">
 <div className="flex min-w-0 items-center gap-1">
 <button
 type="button"
 onClick={() => navigate("/admin")}
 className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
 aria-label="Back to admin"
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 </button>
 <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-white lg:text-xl">Checkout</h1>
 </div>
 <div className="flex items-center gap-1">
 <button
 type="button"
 disabled
 className="rounded-lg p-2 text-slate-300 dark:text-slate-600"
 aria-hidden
 >
 <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
 </svg>
 </button>
 </div>
 </header>

 <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(280px,440px)_1fr] lg:items-stretch">
 <div className="relative h-[min(38vh,300px)] w-full shrink-0 bg-black lg:h-auto lg:min-h-[min(50vh,420px)]">
 <div id="pos-scan-reader" className="absolute inset-0 overflow-hidden" />
 <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
 <div className="h-0.5 w-full bg-red-500 " />
 </div>
 {scanErr && (
 <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-red-950/90 px-2 py-1.5 text-center text-xs text-red-100">
 {scanErr}
 </div>
 )}
 </div>

 <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:border-l lg:border-slate-200 dark:lg:border-slate-700">
 <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:px-6">
 {/* Scan sale / pickup — reduces label + linked product stock (moved from Barcode & QR) */}
 <div
 id="pos-pickup-section"
 className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white ring-1 ring-slate-950/[0.02] dark:border-slate-700/90 dark:bg-slate-900 dark:ring-white/[0.03]"
 >
 <div className="border-b border-slate-200/90 px-4 py-3 dark:border-slate-700/80 sm:px-5">
 <h2 className={`text-sm font-bold tracking-tight sm:text-base ${isDark ? "text-white" : "text-slate-900"}`}>
 Scan sale / payment pickup
 </h2>
 <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Type or scan a code — product info appears automatically. Confirm, then reduce stock.</p>
 </div>
 <div className="space-y-4 px-4 py-4 sm:px-5">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
 <div className="min-w-0 flex-1">
 <label
 className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-white" : "text-slate-700"}`}
 >
 Code (scan or type)
 </label>
 <input
 ref={pickupInputRef}
 value={pickupCode}
 onChange={(e) => setPickupCode(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter" && pickupPreview) {
 e.preventDefault();
 void submitPickupScanSale();
 }
 }}
 disabled={pickupBusy || pickupCameraOn}
 placeholder="Slug, full URL from QR, or barcode text"
 className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/15 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500 dark:focus:ring-slate-400/20"
 />
 </div>
 <div className="w-full shrink-0 sm:w-28">
 <label
 htmlFor="pos-pickup-scan-qty"
 className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-white" : "text-slate-700"}`}
 >
 Qty
 </label>
 <input
 id="pos-pickup-scan-qty"
 type="number"
 min={1}
 max={9999}
 value={pickupQty}
 onChange={(e) => setPickupQty(e.target.value)}
 disabled={pickupBusy || pickupCameraOn}
 className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-500/15 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950/80 dark:text-white dark:focus:border-slate-500 dark:focus:ring-slate-400/20"
 />
 </div>
 <div className="flex shrink-0 flex-wrap gap-2">
 <button
 type="button"
 disabled={pickupBusy || pickupLookupBusy || !pickupPreview}
 onClick={() => void submitPickupScanSale()}
 className="h-12 rounded-xl bg-slate-800 px-5 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
 >
 {pickupBusy ? "Saving…" : "Reduce stock"}
 </button>
            {pickupCameraOn ? (
 <button
 type="button"
 onClick={() => void stopPickupCamera()}
 className={`h-12 rounded-xl border px-4 text-sm font-semibold transition ${
 isDark
 ? "border-white/30 bg-white/10 text-white hover:bg-white/[0.16]"
 : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
 }`}
 >
 Stop camera
 </button>
            ) : null}
 </div>
 </div>
 {pickupLookupBusy && pickupCode.trim() && !pickupPreview ? (
 <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
 Looking up product…
 </p>
 ) : null}
 {pickupPreview ? (
 <div className={POS_LINE_CARD}>
 <div className="shrink-0">
 {pickupPreview.image_url ? (
 <img
 src={resolveImageUrl(pickupPreview.image_url)}
 alt=""
 className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-900/10 dark:ring-white/10"
 />
 ) : (
 <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--admin-primary-rgb))] to-slate-800 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-black/10 dark:to-slate-900">
 FS
 </div>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Matched product</p>
 <p className="mt-1 font-semibold leading-snug text-slate-900 dark:text-white">{pickupPreview.name}</p>
 <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">Code: {pickupPreview.code}</p>
 {pickupPreview.has_label && pickupPreview.manage_label_stock && pickupPreview.label_stock != null ? (
 <p className="mt-1.5 text-xs font-semibold text-[color:var(--admin-primary)]">
 Label stock (now): {pickupPreview.label_stock}
 </p>
 ) : null}
 {pickupPreview.max_sellable_qty != null ? (
 <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
 Max you can reduce: {pickupPreview.max_sellable_qty} unit{pickupPreview.max_sellable_qty === 1 ? "" : "s"}
 </p>
 ) : null}
 <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-600/70">
 <span className="text-sm text-slate-600 dark:text-slate-400">
 Unit price <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(pickupPreview.price)}</span>
 </span>
 <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
 Qty {pickupQty} → {formatMoney(Number(pickupPreview.price) * (parseInt(pickupQty, 10) || 1))}
 </span>
 </div>
 </div>
 </div>
 ) : null}
 {pickupErr ? (
 <p className="rounded-lg bg-red-950/90 px-3 py-2 text-center text-xs text-red-100 dark:bg-red-950/80">{pickupErr}</p>
 ) : null}
 {pickupCameraOn ? (
 <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-black dark:border-slate-600">
 <div id="pos-pickup-scan-reader" className="min-h-[200px] w-full" />
 </div>
 ) : null}
 </div>
 </div>

 {lines.length === 0 ? (
 <p className="text-center text-sm text-slate-500 dark:text-slate-400">Scan a label or product code to add a line.</p>
 ) : (
 lines.map((line) => (
 <div key={line.id} className="flex gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
 {line.image_url ? (
 <img
 src={resolveImageUrl(line.image_url)}
 alt=""
 className="h-14 w-14 shrink-0 rounded-lg object-cover"
 />
 ) : (
 <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
 )}
 <div className="min-w-0 flex-1">
 <div className="flex justify-between gap-2">
 <span className="font-medium text-slate-900 dark:text-white">
 {line.qty} × {line.name}
 </span>
 <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
 {formatMoney(line.unitPrice * line.qty)}
 </span>
 </div>
 <div className="mt-0.5 flex items-center justify-between gap-2">
 <span className="text-sm text-slate-500 dark:text-slate-400">
 {formatMoney(line.unitPrice)} · <span className="font-mono text-xs">{line.code}</span>
 </span>
 <button
 type="button"
 onClick={() => removeLine(line.id)}
 className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
 >
 Remove
 </button>
 </div>
 </div>
 </div>
 ))
 )}
 <div className="flex justify-end pt-1">
 <span
 className="cursor-not-allowed text-sm font-medium text-[color:var(--admin-primary)] opacity-50"
 title="Coming soon"
 >
 Add Discount
 </span>
 </div>
 <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white">
 <span>TOTAL</span>
 <span>{formatMoney(subtotal)}</span>
 </div>
 </div>

 <div className="sticky bottom-0 z-[42] shrink-0 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 lg:static lg:z-auto lg:border-t-0 lg:bg-transparent lg:p-4 lg:pb-0 lg:pt-0">
 <button
 type="button"
 disabled={lines.length === 0}
 onClick={() => setStep("verify")}
 className={`flex w-full flex-col items-stretch gap-0.5 rounded-xl px-4 py-3 ${tealBtn}`}
 style={accentBg}
 >
 <span className="flex w-full items-center justify-between">
 <span>
 {itemCount} {itemCount === 1 ? "item" : "items"} = {formatMoney(subtotal)}
 </span>
 <svg className="h-5 w-5 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 </span>
 <span className="text-center text-xs font-normal opacity-90">Verify details, then pay</span>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}
