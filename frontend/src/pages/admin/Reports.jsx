import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import { errorAlert, toastSuccess } from "../../lib/swal";
import { useTheme } from "../../state/theme.jsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";

// ─── helpers ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse `#RRGGBB` → { r,g,b }; fallback muted sage. */
function hexToRgb(hex) {
  const h = (hex || "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 107, g: 126, b: 115 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function mixChannel(c, toward, ratio) {
  return Math.round(c + (toward - c) * ratio);
}

/** Lighter / darker hex for bar gradient (top = lighter). */
function shadeHex(hex, toward255, ratio) {
  const { r, g, b } = hexToRgb(hex);
  const t = toward255 ? 255 : 0;
  const rr = mixChannel(r, t, ratio);
  const gg = mixChannel(g, t, ratio);
  const bb = mixChannel(b, t, ratio);
  const x = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${x(rr)}${x(gg)}${x(bb)}`;
}

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function SalesOverviewTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs shadow-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
      <p className="font-semibold text-slate-800 dark:text-slate-100">{row.dateLong}</p>
      <p className="mt-1 tabular-nums text-slate-600 dark:text-slate-300">
        Revenue: <span className="font-semibold text-slate-900 dark:text-white">{fullUsd.format(row.revenue || 0)}</span>
      </p>
    </div>
  );
}

function buildSalesParams(period, customFrom, customTo) {
 const now = new Date();
 const year = now.getFullYear();

 if (period === "7d") return { period: 7 };
 if (period === "28d") return { period: 28 };
 if (period === "90d") return { period: 90 };
 if (period === "365d") return { period: 365 };
 if (period === "lifetime") return { period: 3650 };
 if (period === "custom") return { from: customFrom, to: customTo };

 // year e.g. "2026"
 if (/^\d{4}$/.test(period)) {
 const y = parseInt(period, 10);
 return { from: `${y}-01-01`, to: `${y}-12-31` };
 }

 // month e.g. "2026-04"
 if (/^\d{4}-\d{2}$/.test(period)) {
 const [y, m] = period.split("-").map(Number);
 const last = new Date(y, m, 0).getDate();
 return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
 }

 return { period: 30 };
}

function periodLabel(period) {
 const names = {
 "7d": "Last 7 days", "28d": "Last 28 days",
 "90d": "Last 90 days", "365d": "Last 365 days",
 "lifetime": "Lifetime", "custom": "Custom",
 };
 if (names[period]) return names[period];

 if (/^\d{4}$/.test(period)) return period;

 if (/^\d{4}-\d{2}$/.test(period)) {
 const [y, m] = period.split("-").map(Number);
 const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 const now = new Date();
 return now.getFullYear() === y ? monthNames[m - 1] : `${monthNames[m - 1]} ${y}`;
 }

 return period;
}

// ─── PeriodDropdown ───────────────────────────────────────────────────────────
function PeriodDropdown({ value, onChange, mode }) {
 const [open, setOpen] = useState(false);
 const ref = useRef(null);

 useEffect(() => {
 const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, []);

 const now = new Date();
 const thisYear = now.getFullYear();
 const thisMonth = now.getMonth(); // 0-indexed

 const recentMonths = Array.from({ length: 3 }, (_, i) => {
 const d = new Date(thisYear, thisMonth - i, 1);
 return {
 key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
 label: d.toLocaleString("en-US", { month: "long" }),
 };
 });

 const groups = [
 {
 items: [
 { key: "7d", label: "Last 7 days" },
 { key: "28d", label: "Last 28 days" },
 { key: "90d", label: "Last 90 days" },
 { key: "365d", label: "Last 365 days" },
 { key: "lifetime", label: "Lifetime" },
 ],
 },
 {
 items: [
 { key: String(thisYear), label: String(thisYear) },
 { key: String(thisYear - 1), label: String(thisYear - 1) },
 ],
 },
 {
 items: recentMonths,
 },
 {
 items: [{ key: "custom", label: "Custom" }],
 },
 ];

 const isDark = mode === "dark";
 const dropdownBg = isDark ? "#1e2330" : "#ffffff";
 const dropdownBorder = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
 const itemHoverBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(var(--admin-primary-rgb),0.08)";
 const itemActiveBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(var(--admin-primary-rgb),0.15)";
 const textColor = isDark ? "#e2e8f0" : "#334155";
 const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9";

 return (
 <div className="relative" ref={ref}>
 <button
 onClick={() => setOpen((p) => !p)}
 className="flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium transition-all"
 style={{
 background: isDark ? "rgba(255,255,255,0.06)" : "#f8fafc",
 borderColor: dropdownBorder,
 color: textColor,
 }}
 >
 <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span>{periodLabel(value)}</span>
 <svg
 className={`w-4 h-4 opacity-50 transition-transform ${open ? "rotate-180" : ""}`}
 fill="none" stroke="currentColor" viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {open && (
 <div
 className="absolute right-0 mt-2 w-52 rounded-2xl z-50 overflow-hidden py-1"
 style={{
 background: dropdownBg,
 border: `1px solid ${dropdownBorder}`,
 boxShadow: isDark
 ? "0 20px 60px rgba(0,0,0,0.6)"
 : "0 8px 40px rgba(15,23,42,0.18)",
 }}
 >
 {groups.map((group, gi) => (
 <React.Fragment key={gi}>
 {gi > 0 && (
 <div style={{ height: 1, background: dividerColor, margin: "4px 0" }} />
 )}
 {group.items.map((item) => {
 const isActive = value === item.key;
 return (
 <button
 key={item.key}
 onClick={() => { onChange(item.key); setOpen(false); }}
 className="w-full text-left px-5 py-2.5 text-sm transition-colors"
 style={{
 color: isActive
 ? isDark ? "#ffffff" : "var(--admin-primary)"
 : textColor,
 background: isActive ? itemActiveBg : "transparent",
 fontWeight: isActive ? 600 : 400,
 }}
 onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = itemHoverBg; }}
 onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
 >
 {item.label}
 </button>
 );
 })}
 </React.Fragment>
 ))}
 </div>
 )}
 </div>
 );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, subtext, icon, accentColor, mode }) {
 return (
 <div className="admin-surface border admin-border rounded-2xl p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
 <p className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-white">{value}</p>
 {subtext && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
 </div>
 <div
 className="w-11 h-11 rounded-2xl border admin-border flex items-center justify-center"
 style={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(var(--admin-primary-rgb),0.12)",
 color: accentColor,
 }}
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
 </svg>
 </div>
 </div>
 </div>
 );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Reports() {
 const { primaryColor, mode } = useTheme();
 const accentColor = primaryColor;
 const salesGradId = useId().replace(/:/g, "");
 const barTop = useMemo(() => shadeHex(accentColor, true, 0.38), [accentColor]);
 const barBottom = useMemo(() => shadeHex(accentColor, false, 0.28), [accentColor]);
 const chartGridColor = mode === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.08)";
 const chartAxisLine = mode === "dark" ? "#334155" : "#e2e8f0";
 const chartTickColor = mode === "dark" ? "#94a3b8" : "#64748b";

 const [dashboard, setDashboard] = useState(null);
 const [sales, setSales] = useState([]);
 const [topProducts, setTopProducts] = useState([]);
 const [period, setPeriod] = useState("28d");
 const [loading, setLoading] = useState(true);

 // custom date range for the Sales Overview chart
 const [chartFrom, setChartFrom] = useState("");
 const [chartTo, setChartTo] = useState("");

 // report generator
 const [reportType, setReportType] = useState("dashboard");
 const [dateFrom, setDateFrom] = useState("");
 const [dateTo, setDateTo] = useState("");
 const [generating, setGenerating] = useState(false);
 const [generated, setGenerated] = useState(null);

 const load = async () => {
 setLoading(true);
 try {
 const periodParams = buildSalesParams(period, chartFrom, chartTo);

 const [dashRes, salesRes, productsRes] = await Promise.all([
 api.get("/admin/reports/dashboard", { params: periodParams }),
 api.get("/admin/reports/sales", { params: periodParams }),
 api.get("/admin/reports/top-products", { params: periodParams }).catch(() => ({ data: { data: [] } })),
 ]);

 const dashData = dashRes.data;
 setDashboard({
 revenue: dashData.revenue || { total: 0, month: 0, today: 0 },
 orders: dashData.orders || { total: 0, pending: 0, processing: 0, completed: 0 },
 products: dashData.products || { total: 0, active: 0, low_stock: 0 },
 customers: dashData.customers || { total: 0, new_this_month: 0 },
 });

 setSales(salesRes.data?.sales || salesRes.data?.data || []);
 setTopProducts(productsRes.data?.data || []);
 } catch (e) {
 console.error("Failed to load reports", e);
 } finally {
 setLoading(false);
 }
 };

 // Initialize generator date range
 useEffect(() => {
 if (dateFrom || dateTo) return;
 const now = new Date();
 const first = new Date(now.getFullYear(), now.getMonth(), 1);
 setDateFrom(fmtDate(first));
 setDateTo(fmtDate(now));
 }, []);

 // Initialize chart custom range
 useEffect(() => {
 if (chartFrom || chartTo) return;
 const now = new Date();
 const first = new Date(now.getFullYear(), now.getMonth(), 1);
 setChartFrom(fmtDate(first));
 setChartTo(fmtDate(now));
 }, []);

 // Reload whenever period or custom range changes
 useEffect(() => {
 if (period === "custom" && (!chartFrom || !chartTo)) return;
 load();
 }, [period, chartFrom, chartTo]);

 const handleGenerate = async (e) => {
 e.preventDefault();
 if (!dateFrom || !dateTo) {
 await errorAlert({
 khTitle: "កាលបរិច្ឆេទមិនគ្រប់",
 enTitle: "Date range required",
 khText: "សូមជ្រើសរើសថ្ងៃចាប់ផ្ដើម និងថ្ងៃបញ្ចប់",
 enText: "Please select Date From and Date To",
 });
 return;
 }
 setGenerating(true);
 try {
 const { data } = await api.get("/admin/reports/generate", {
 params: { type: reportType, from: dateFrom, to: dateTo },
 });
 setGenerated(data?.data || null);
 } catch (e) {
 await errorAlert({
 khTitle: "បង្កើតរបាយការណ៍បរាជ័យ",
 enTitle: "Generate report failed",
 detail: e?.response?.data?.message || "Failed to generate report",
 });
 } finally {
 setGenerating(false);
 }
 };

 const handleDownloadPdf = async () => {
 if (!dateFrom || !dateTo) {
 await errorAlert({
 khTitle: "កាលបរិច្ឆេទមិនគ្រប់",
 enTitle: "Date range required",
 khText: "សូមជ្រើសរើសថ្ងៃចាប់ផ្ដើម និងថ្ងៃបញ្ចប់",
 enText: "Please select Date From and Date To",
 });
 return;
 }
 try {
 const res = await api.get("/admin/reports/download-pdf", {
 params: { type: reportType, from: dateFrom, to: dateTo },
 responseType: "blob",
 });
 const blob = new Blob([res.data], { type: "application/pdf" });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `report-${reportType}-${dateFrom}-to-${dateTo}.pdf`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 window.URL.revokeObjectURL(url);
 await toastSuccess({ khText: "បានទាញយក PDF ដោយជោគជ័យ", enText: "PDF downloaded successfully" });
 } catch (e) {
 let message = e?.response?.data?.message;
 const data = e?.response?.data;
 if (!message && data instanceof Blob) {
 try { message = JSON.parse(await data.text())?.message; } catch { message = null; }
 }
 await errorAlert({
 khTitle: "ទាញយក PDF បរាជ័យ",
 enTitle: "Download PDF failed",
 detail: message || "Failed to download PDF",
 });
 }
 };

 const salesChartData = useMemo(
 () =>
 (sales || []).map((day) => {
 const d = new Date(day.date);
 const invalid = Number.isNaN(d.getTime());
 return {
 revenue: Number(day.revenue || 0),
 dateKey: day.date,
 dateLong: invalid
 ? String(day.date)
 : d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
 xLabel: invalid ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
 };
 }),
 [sales]
 );

 return (
 <div className="flex min-h-0 flex-1 flex-col admin-soft text-slate-800 dark:text-slate-100">
 <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">

 {/* Header */}
 <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
 <div>
 <h1 className="text-3xl md:text-4xl font-semibold text-slate-800 dark:text-white mb-2">
 Reports &amp; Analytics
 </h1>
 <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg">Track your store performance and metrics</p>
 </div>
 {/* Global period selector — controls ALL sections */}
 <div className="flex flex-col items-end gap-2 mt-1">
 <PeriodDropdown value={period} onChange={setPeriod} mode={mode} />
 {period === "custom" && (
 <div className="flex flex-wrap items-center gap-2">
 <input
 type="date"
 value={chartFrom}
 onChange={(e) => setChartFrom(e.target.value)}
 className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]"
 />
 <span className="text-sm text-slate-500">→</span>
 <input
 type="date"
 value={chartTo}
 onChange={(e) => setChartTo(e.target.value)}
 className="h-9 rounded-lg border border-slate-200 dark:border-slate-600 px-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]"
 />
 </div>
 )}
 </div>
 </div>

 {loading ? (
 <AdminContentSkeleton lines={3} imageHeight={200} className="min-h-0 flex-1" />
 ) : (
 <>
 {/* Stats Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
 <StatCard
 title={`Revenue · ${periodLabel(period)}`}
 value={`$${(dashboard?.revenue?.total || 0).toLocaleString()}`}
 subtext={`Today: $${(dashboard?.revenue?.today || 0).toLocaleString()}`}
 icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
 accentColor={accentColor} mode={mode}
 />
 <StatCard
 title={`Orders · ${periodLabel(period)}`}
 value={dashboard?.orders?.total || 0}
 subtext={`${dashboard?.orders?.pending || 0} pending · ${dashboard?.orders?.completed || 0} completed`}
 icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
 accentColor={accentColor} mode={mode}
 />
 <StatCard
 title="Products"
 value={dashboard?.products?.total || 0}
 subtext={`${dashboard?.products?.active || 0} active · ${dashboard?.products?.low_stock || 0} low stock`}
 icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
 accentColor={accentColor} mode={mode}
 />
 <StatCard
 title={`Customers · ${periodLabel(period)}`}
 value={dashboard?.customers?.total || 0}
 subtext={`${dashboard?.customers?.new_this_month || 0} new in period`}
 icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
 accentColor={accentColor} mode={mode}
 />
 </div>

 {/* Sales Chart — axes, grid, tooltips (Recharts) */}
 <div className="admin-surface border admin-border rounded-2xl p-6 mb-8">
 <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
 <div>
 <h2 className="text-lg font-semibold text-slate-800 dark:text-white tracking-tight">Sales Overview</h2>
 <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{periodLabel(period)} · daily revenue</p>
 </div>
 </div>

 {sales.length === 0 ? (
 <p className="text-center text-slate-500 dark:text-slate-400 py-12">No sales data for this period</p>
 ) : (
 <div className="w-full h-[min(22rem,calc(100vw-4rem))] min-h-[280px] [&_.recharts-surface]:outline-none">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart
 data={salesChartData}
 margin={{ top: 8, right: 14, bottom: salesChartData.length > 31 ? 40 : salesChartData.length > 18 ? 28 : 12, left: 6 }}
 barCategoryGap="12%"
 >
 <defs>
 <linearGradient id={salesGradId} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={barTop} stopOpacity={1} />
 <stop offset="100%" stopColor={barBottom} stopOpacity={1} />
 </linearGradient>
 </defs>
 <CartesianGrid stroke={chartGridColor} strokeDasharray="4 4" vertical={false} />
 <XAxis
 dataKey="xLabel"
 tick={{ fill: chartTickColor, fontSize: 11 }}
 axisLine={{ stroke: chartAxisLine }}
 tickLine={{ stroke: chartAxisLine }}
 minTickGap={salesChartData.length > 31 ? 6 : salesChartData.length > 14 ? 4 : 0}
 angle={salesChartData.length > 31 ? -35 : 0}
 textAnchor={salesChartData.length > 31 ? "end" : "middle"}
 height={salesChartData.length > 31 ? 48 : 28}
 interval="preserveStartEnd"
 />
 <YAxis
 width={72}
 tick={{ fill: chartTickColor, fontSize: 11 }}
 axisLine={{ stroke: chartAxisLine }}
 tickLine={{ stroke: chartAxisLine }}
 tickFormatter={(v) => compactUsd.format(Number(v))}
 domain={[0, (max) => (max <= 0 ? 1 : max * 1.08)]}
 label={{
 value: "Revenue (USD)",
 angle: -90,
 position: "insideLeft",
 style: { fill: chartTickColor, fontSize: 11, fontWeight: 500 },
 }}
 />
 <Tooltip
 cursor={{ fill: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }}
 content={<SalesOverviewTooltip />}
 />
 <Bar
 dataKey="revenue"
 name="Revenue"
 fill={`url(#${salesGradId})`}
 radius={[6, 6, 0, 0]}
 maxBarSize={52}
 animationDuration={500}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>

 {/* Top Products */}
 <div className="admin-surface border admin-border rounded-2xl p-6">
 <div className="mb-6">
 <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Top Selling Products</h2>
 <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{periodLabel(period)}</p>
 </div>
 {topProducts.length === 0 ? (
 <p className="text-center text-slate-500 dark:text-slate-400 py-12">No products sold yet</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-sm text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
 <th className="pb-4 font-medium">Product</th>
 <th className="pb-4 font-medium text-right">Units Sold</th>
 <th className="pb-4 font-medium text-right">Revenue</th>
 </tr>
 </thead>
 <tbody>
 {topProducts.map((item) => (
 <tr key={item.product_id} className="border-b border-slate-50 dark:border-slate-700">
 <td className="py-4">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
 {item.product?.image_url && (
 <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
 )}
 </div>
 <span className="font-medium text-slate-800 dark:text-white">
 {item.product?.name || `Product #${item.product_id}`}
 </span>
 </div>
 </td>
 <td className="py-4 text-right font-semibold text-slate-800 dark:text-white">{item.total_sold}</td>
 <td className="py-4 text-right font-semibold" style={{ color: accentColor }}>
 ${item.total_revenue?.toLocaleString()}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Report Generator */}
 <div className="admin-surface border admin-border rounded-2xl p-6 mt-8">
 <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">Generate Report</h2>
 <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Report Type</label>
 <select
 value={reportType}
 onChange={(e) => setReportType(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 >
 <option value="dashboard">Dashboard Summary</option>
 <option value="sales">Sales Report</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date From</label>
 <input
 type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date To</label>
 <input
 type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 />
 </div>
 <div className="flex items-end gap-2">
 <button
 type="submit"
 disabled={generating}
 className="h-11 px-5 rounded-full flex items-center justify-center gap-2 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
 style={{
 backgroundColor: accentColor,
 color: mode === "dark" ? "#0b0b0f" : "#ffffff",
 border: `1px solid ${accentColor}`,
 boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
 }}
 >
 {generating ? "Generating..." : (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l1.4 3.6 3.6 1.4-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8L3.4 19l1.8-.8zM17 16.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" />
 </svg>
 <span>Generate</span>
 </>
 )}
 </button>
 <button
 type="button"
 onClick={handleDownloadPdf}
 className="h-11 w-11 rounded-xl flex items-center justify-center border hover:bg-slate-50 dark:hover:bg-slate-800 transition"
 style={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "transparent",
 color: accentColor,
 borderColor: accentColor,
 }}
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v9m0 0l-3-3m3 3l3-3" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18h12" />
 </svg>
 <span className="sr-only">Download PDF</span>
 </button>
 </div>
 </form>

 {generated && (
 <div
 className="mt-6 p-4 rounded-xl"
 style={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(var(--admin-primary-rgb),0.10)",
 border: mode === "dark" ? `1px solid ${accentColor}` : "1px solid rgba(var(--admin-primary-rgb),0.25)",
 }}
 >
 <div className="text-sm font-semibold" style={{ color: accentColor }}>Generated</div>
 <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
 {generated.type === "dashboard" && (
 <>
 Dashboard Summary from {generated.from} to {generated.to}.{" "}
 Revenue in range: ${Number(generated.revenue?.total || 0).toFixed(2)}.{" "}
 Total Orders in range: {generated.orders?.total || 0} ({generated.orders?.pending || 0} pending).{" "}
 Products: {generated.products?.total || 0} ({generated.products?.active || 0} active, {generated.products?.low_stock || 0} low stock).{" "}
 Customers: {generated.customers?.total || 0} ({generated.customers?.new_this_month || 0} new in range).
 </>
 )}
 {generated.type === "sales" && (
 <>
 Sales Report from {generated.from} to {generated.to}.{" "}
 Total Orders: {generated.summary?.total_orders}, Total Revenue: ${Number(generated.summary?.total_revenue || 0).toFixed(2)}
 </>
 )}
 </div>
 </div>
 )}
 </div>
 </>
 )}
 </div>
 </div>
 );
}
