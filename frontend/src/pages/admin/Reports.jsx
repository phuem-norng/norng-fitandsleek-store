import React, { useEffect, useMemo, useRef, useState } from "react";
import ChartResizeMenu from "../../components/admin/ChartResizeMenu.jsx";
import api from "../../lib/api";
import { errorAlert, toastSuccess } from "../../lib/swal";
import { useAdminAccents } from "../../lib/adminAccents.js";
import { useTheme } from "../../state/theme.jsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCountryLabel } from "../../lib/countries.js";
import {
  getReportChartTheme,
  reportChartColor,
  REPORT_CLUSTER,
} from "../../lib/reportChartTheme.js";
import {
  ReportChartPanel,
  ReportChartTooltip,
  ReportDonutChart,
  ReportEmptyChart,
  ReportLegendPills,
  ReportSection,
  reportAxisLineProps,
  reportAxisTickProps,
} from "../../components/admin/ReportChartUI.jsx";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";
import RevenueDashboard from "../../components/admin/RevenueDashboard.jsx";
import StockDashboard from "../../components/admin/StockDashboard.jsx";
import PlanDashboard from "../../components/admin/PlanDashboard.jsx";
import AdminReportExportMenu from "../../components/admin/AdminReportExportMenu.jsx";
import { downloadBlobResponse, parseBlobErrorMessage } from "../../lib/adminReportDownload.js";

// ─── helpers ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

function truncateChartLabel(value, max = 26) {
  const s = String(value || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
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
function StatCard({ title, value, subtext, icon, iconBoxStyle }) {
 return (
 <div className="admin-surface admin-spectrum-kpi border admin-border rounded-2xl p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{title}</p>
 <p className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-white">{value}</p>
 {subtext && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
 </div>
 <div
 className="admin-stat-icon w-11 h-11 rounded-2xl border admin-border flex items-center justify-center"
 style={iconBoxStyle}
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
 const { iconBoxStyle } = useAdminAccents();
 const accentColor = primaryColor;
 const reportTheme = useMemo(() => getReportChartTheme(mode), [mode]);

 const [dashboard, setDashboard] = useState(null);
 const [sales, setSales] = useState([]);
 const [topProducts, setTopProducts] = useState([]);
 const [productAnalytics, setProductAnalytics] = useState({ by_category: [], by_country: [], total_products: 0 });
 const [categorySales, setCategorySales] = useState({
   revenue_by_category: [],
   top_categories: [],
   total_revenue: 0,
   total_units: 0,
 });
 const [orderAnalytics, setOrderAnalytics] = useState({
   total_orders: 0,
   by_status: [],
   by_category: [],
 });
 const [period, setPeriod] = useState("28d");
 const [loading, setLoading] = useState(true);

 /* ── Chart resize state (xl col-span, max 2 inside xl:grid-cols-2 grids) ── */
 const [prodByCatSpan, setProdByCatSpan] = useState(1);
 const [prodByCountrySpan, setProdByCountrySpan] = useState(1);
 const [top10Span, setTop10Span] = useState(1);
 const [catRevenueSpan, setCatRevenueSpan] = useState(1);
 const [topCatSpan, setTopCatSpan] = useState(1);
 const [orderStatusSpan, setOrderStatusSpan] = useState(1);
 const [orderCatSpan, setOrderCatSpan] = useState(1);

 // custom date range for the Sales Overview chart
 const [chartFrom, setChartFrom] = useState("");
 const [chartTo, setChartTo] = useState("");

 // report generator
 const [reportType, setReportType] = useState("dashboard");
 const [dateFrom, setDateFrom] = useState("");
 const [dateTo, setDateTo] = useState("");
 const [generating, setGenerating] = useState(false);
 const [exportBusy, setExportBusy] = useState(false);
 const [generated, setGenerated] = useState(null);
 const [genOpen, setGenOpen] = useState(false);
 const genRef = useRef(null);

 // Close the "Generate report" popover when clicking outside the panel.
 useEffect(() => {
   const handler = (e) => { if (genRef.current && !genRef.current.contains(e.target)) setGenOpen(false); };
   document.addEventListener("mousedown", handler);
   return () => document.removeEventListener("mousedown", handler);
 }, []);

 const load = async () => {
 setLoading(true);
 try {
 const periodParams = buildSalesParams(period, chartFrom, chartTo);

 const [dashRes, salesRes, productsRes, productAnalyticsRes, categorySalesRes, orderAnalyticsRes] = await Promise.all([
 api.get("/admin/reports/dashboard", { params: periodParams }),
 api.get("/admin/reports/sales", { params: periodParams }),
 api.get("/admin/reports/top-products", { params: { ...periodParams, limit: 10 } }).catch(() => ({ data: { data: [] } })),
 api.get("/admin/reports/product-analytics").catch(() => ({ data: { by_category: [], by_country: [], total_products: 0 } })),
 api.get("/admin/reports/category-sales", { params: { ...periodParams, limit: 10 } }).catch(() => ({
   data: { revenue_by_category: [], top_categories: [], total_revenue: 0, total_units: 0 },
 })),
 api.get("/admin/reports/order-analytics", { params: periodParams }).catch(() => ({
   data: { total_orders: 0, by_status: [], by_category: [] },
 })),
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
 setProductAnalytics({
 by_category: productAnalyticsRes.data?.by_category || [],
 by_country: productAnalyticsRes.data?.by_country || [],
 total_products: productAnalyticsRes.data?.total_products || 0,
 });
 setCategorySales({
 revenue_by_category: categorySalesRes.data?.revenue_by_category || [],
 top_categories: categorySalesRes.data?.top_categories || [],
 total_revenue: categorySalesRes.data?.total_revenue || 0,
 total_units: categorySalesRes.data?.total_units || 0,
 });
 setOrderAnalytics({
 total_orders: orderAnalyticsRes.data?.total_orders || 0,
 by_status: orderAnalyticsRes.data?.by_status || [],
 by_category: orderAnalyticsRes.data?.by_category || [],
 });
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

 const ensureReportDateRange = async () => {
 if (!dateFrom || !dateTo) {
 await errorAlert({
 khTitle: "កាលបរិច្ឆេទមិនគ្រប់",
 enTitle: "Date range required",
 khText: "សូមជ្រើសរើសថ្ងៃចាប់ផ្ដើម និងថ្ងៃបញ្ចប់",
 enText: "Please select Date From and Date To",
 });
 return false;
 }
 return true;
 };

 const downloadGeneratedReport = async (format) => {
 if (!(await ensureReportDateRange())) return;
 setExportBusy(true);
 try {
 const endpoint = format === "pdf" ? "/admin/reports/download-pdf" : "/admin/reports/download-excel";
 const res = await api.get(endpoint, {
 params: { type: reportType, from: dateFrom, to: dateTo },
 responseType: "blob",
 });
 const ext = format === "pdf" ? "pdf" : "xls";
 await downloadBlobResponse(res, `report-${reportType}-${dateFrom}-to-${dateTo}.${ext}`);
 await toastSuccess({
 khText: format === "pdf" ? "បានទាញយក PDF ដោយជោគជ័យ" : "បានទាញយក Excel ដោយជោគជ័យ",
 enText: format === "pdf" ? "PDF downloaded successfully" : "Excel downloaded successfully",
 });
 } catch (e) {
 const message = await parseBlobErrorMessage(
 e?.response?.data,
 format === "pdf" ? "Failed to download PDF" : "Failed to download Excel",
 );
 await errorAlert({
 khTitle: format === "pdf" ? "ទាញយក PDF បរាជ័យ" : "ទាញយក Excel បរាជ័យ",
 enTitle: format === "pdf" ? "Download PDF failed" : "Download Excel failed",
 detail: message,
 });
 } finally {
 setExportBusy(false);
 }
 };

 const handleDownloadPdf = () => downloadGeneratedReport("pdf");
 const handleDownloadExcel = () => downloadGeneratedReport("excel");

 const categoryDonutData = useMemo(
 () =>
 (productAnalytics.by_category || []).map((row, index) => ({
 name: row.name,
 count: row.count,
 percentage: row.percentage,
 fill: reportChartColor(index),
 })),
 [productAnalytics.by_category],
 );

 const countryBarData = useMemo(
 () =>
 (productAnalytics.by_country || []).map((row, index) => {
 const label =
 row.code && row.code !== "unknown" && row.code !== "other"
 ? formatCountryLabel(row.code)
 : row.name;
 return {
 label,
 count: row.count,
 percentage: row.percentage,
 fill: reportChartColor(index),
 };
 }),
 [productAnalytics.by_country],
 );

 const categoryRevenueDonutData = useMemo(
 () =>
 (categorySales.revenue_by_category || []).map((row, index) => ({
 name: row.name,
 revenue: Number(row.revenue) || 0,
 percentage: row.percentage,
 fill: reportChartColor(index),
 })),
 [categorySales.revenue_by_category],
 );

 const topCategoryClusterData = useMemo(
 () =>
 (categorySales.top_categories || []).map((row) => ({
 name: row.name,
 shortLabel: truncateChartLabel(row.name, 14),
 unitsSold: Number(row.units_sold) || 0,
 revenue: Number(row.revenue) || 0,
 })),
 [categorySales.top_categories],
 );

 const topSellingChartData = useMemo(
 () =>
 (topProducts || []).slice(0, 10).map((item, index) => {
 const fullName = item.product?.name || `Product #${item.product_id}`;
 return {
 productId: item.product_id,
 fullName,
 shortLabel: truncateChartLabel(fullName),
 unitsSold: Number(item.total_sold) || 0,
 revenue: Number(item.total_revenue) || 0,
 fill: reportChartColor(index),
 };
 }),
 [topProducts],
 );

 const catalogueTotal = productAnalytics.total_products || dashboard?.products?.total || 0;
 const orderTotal = orderAnalytics.total_orders || dashboard?.orders?.total || 0;

 const orderStatusDonutData = useMemo(
 () =>
 (orderAnalytics.by_status || []).map((row, index) => ({
 name: row.name,
 count: Number(row.count) || 0,
 percentage: row.percentage,
 fill: reportChartColor(index),
 })),
 [orderAnalytics.by_status],
 );

 const orderCategoryDonutData = useMemo(
 () =>
 (orderAnalytics.by_category || []).map((row, index) => ({
 name: row.name,
 count: Number(row.count) || 0,
 percentage: row.percentage,
 fill: reportChartColor(index),
 })),
 [orderAnalytics.by_category],
 );

 const orderCategoryTotal = useMemo(
 () => orderCategoryDonutData.reduce((sum, row) => sum + row.count, 0),
 [orderCategoryDonutData],
 );

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
 <div className="reports-dashboard flex min-h-0 flex-1 flex-col text-slate-800 dark:text-slate-100">
 <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">

 {/* Header */}
 <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
 <div>
 <h1 className="text-3xl md:text-4xl font-semibold text-slate-800 dark:text-white mb-2">
 Reports &amp; Analytics
 </h1>
 <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg">Track your store performance and metrics</p>
 </div>
 {/* Top-right controls: Generate report popover + global period selector */}
 <div className="flex flex-wrap items-start gap-3 mt-1">

 {/* ── Generate report (button + popover) ────────────────────────────── */}
 <div className="relative" ref={genRef}>
 <button
 type="button"
 onClick={() => setGenOpen((p) => !p)}
 className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all shadow-md"
 style={{
 backgroundColor: REPORT_CLUSTER.primary,
 border: `1px solid ${REPORT_CLUSTER.primary}`,
 boxShadow: "0 10px 24px rgba(43, 127, 255, 0.25)",
 }}
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l1.4 3.6 3.6 1.4-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8L3.4 19l1.8-.8z" />
 </svg>
 <span>Generate report</span>
 <svg
 className={`w-4 h-4 opacity-80 transition-transform ${genOpen ? "rotate-180" : ""}`}
 fill="none" stroke="currentColor" viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>

 {genOpen && (
 <div
 className="absolute right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-2xl border p-5 shadow-2xl"
 style={{
 background: mode === "dark" ? "#1e2330" : "#ffffff",
 borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "#e2e8f0",
 }}
 >
 <div className="mb-4">
 <div className="text-sm font-semibold text-slate-800 dark:text-white">Generate report</div>
 <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Export dashboard or sales summary</div>
 </div>

 <form onSubmit={handleGenerate} className="space-y-3">
 <div>
 <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Report Type</label>
 <select
 value={reportType}
 onChange={(e) => setReportType(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 >
 <option value="dashboard">Dashboard Summary</option>
 <option value="sales">Sales Report</option>
 </select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Date From</label>
 <input
 type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-3 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Date To</label>
 <input
 type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
 className="w-full h-10 rounded-xl border-2 border-slate-200 dark:border-slate-600 px-3 text-sm outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-white dark:[color-scheme:dark]"
 />
 </div>
 </div>

 <div className="flex items-center gap-2 pt-1">
 <button
 type="submit"
 disabled={generating}
 className="h-10 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed flex-1"
 style={{
 backgroundColor: REPORT_CLUSTER.primary,
 border: `1px solid ${REPORT_CLUSTER.primary}`,
 boxShadow: "0 8px 18px rgba(43, 127, 255, 0.28)",
 }}
 >
 {generating ? "Generating..." : (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l1.4 3.6 3.6 1.4-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z" />
 </svg>
 <span>Generate</span>
 </>
 )}
 </button>
 <AdminReportExportMenu
 onExportPdf={handleDownloadPdf}
 onExportExcel={handleDownloadExcel}
 busy={exportBusy}
 accentColor={accentColor}
 mode={mode}
 />
 </div>
 </form>

 {generated && (
 <div
 className="mt-4 p-3 rounded-xl text-xs"
 style={{
 backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(var(--admin-primary-rgb),0.08)",
 border: mode === "dark" ? `1px solid ${accentColor}` : "1px solid rgba(var(--admin-primary-rgb),0.22)",
 }}
 >
 <div className="text-xs font-semibold" style={{ color: accentColor }}>Generated</div>
 <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
 {generated.type === "dashboard" && (
 <>
 Dashboard Summary from {generated.from} to {generated.to}.{" "}
 Revenue: ${Number(generated.revenue?.total || 0).toFixed(2)} · Orders: {generated.orders?.total || 0} ({generated.orders?.pending || 0} pending) · Products: {generated.products?.total || 0} · Customers: {generated.customers?.total || 0}.
 </>
 )}
 {generated.type === "sales" && (
 <>
 Sales Report from {generated.from} to {generated.to}.{" "}
 Orders: {generated.summary?.total_orders}, Revenue: ${Number(generated.summary?.total_revenue || 0).toFixed(2)}.
 </>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Global period selector — controls ALL sections */}
 <div className="flex flex-col items-end gap-2">
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
 </div>

 {loading ? (
 <AdminContentSkeleton lines={3} imageHeight={200} className="min-h-0 flex-1" />
 ) : (
 <>
 {/* Stats Grid */}
 <div className="admin-stat-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
 <StatCard
 title={`Revenue · ${periodLabel(period)}`}
 value={`$${(dashboard?.revenue?.total || 0).toLocaleString()}`}
 subtext={`Today: $${(dashboard?.revenue?.today || 0).toLocaleString()}`}
 icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
 iconBoxStyle={iconBoxStyle(0)}
 />
 <StatCard
 title={`Orders · ${periodLabel(period)}`}
 value={dashboard?.orders?.total || 0}
 subtext={`${dashboard?.orders?.pending || 0} pending · ${dashboard?.orders?.completed || 0} completed`}
 icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
 iconBoxStyle={iconBoxStyle(1)}
 />
 <StatCard
 title="Products"
 value={dashboard?.products?.total || 0}
 subtext={`${dashboard?.products?.active || 0} active · ${dashboard?.products?.low_stock || 0} low stock`}
 icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
 iconBoxStyle={iconBoxStyle(2)}
 />
 <StatCard
 title={`Customers · ${periodLabel(period)}`}
 value={dashboard?.customers?.total || 0}
 subtext={`${dashboard?.customers?.new_this_month || 0} new in period`}
 icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
 iconBoxStyle={iconBoxStyle(3)}
 />
 </div>

 <RevenueDashboard theme={reportTheme} />

 <StockDashboard theme={reportTheme} />

 <PlanDashboard theme={reportTheme} />

 <ReportSection
 title="Sales Overview"
 subtitle={`${periodLabel(period)} · daily revenue`}
 theme={reportTheme}
 >
 {sales.length === 0 ? (
 <ReportEmptyChart message="No sales data for this period" theme={reportTheme} />
 ) : (
 <div className="report-chart-panel w-full h-[min(22rem,calc(100vw-4rem))] min-h-[280px] rounded-2xl p-2 [&_.recharts-surface]:outline-none">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart
 data={salesChartData}
 margin={{ top: 8, right: 14, bottom: salesChartData.length > 31 ? 40 : salesChartData.length > 18 ? 28 : 12, left: 6 }}
 barCategoryGap="14%"
 >
 <CartesianGrid stroke={reportTheme.grid} strokeDasharray="3 3" vertical={false} />
 <XAxis
 dataKey="xLabel"
 tick={reportAxisTickProps(reportTheme)}
 axisLine={reportAxisLineProps(reportTheme)}
 tickLine={reportAxisLineProps(reportTheme)}
 minTickGap={salesChartData.length > 31 ? 6 : salesChartData.length > 14 ? 4 : 0}
 angle={salesChartData.length > 31 ? -35 : 0}
 textAnchor={salesChartData.length > 31 ? "end" : "middle"}
 height={salesChartData.length > 31 ? 48 : 28}
 interval="preserveStartEnd"
 />
 <YAxis
 width={72}
 tick={reportAxisTickProps(reportTheme)}
 axisLine={reportAxisLineProps(reportTheme)}
 tickLine={reportAxisLineProps(reportTheme)}
 tickFormatter={(v) => compactUsd.format(Number(v))}
 domain={[0, (max) => (max <= 0 ? 1 : max * 1.08)]}
 />
 <Tooltip
 cursor={{ fill: reportTheme.cursor }}
 content={(props) => (
 <ReportChartTooltip
 {...props}
 theme={reportTheme}
 label={props.payload?.[0]?.payload?.dateLong}
 formatLine={(e) => fullUsd.format(Number(e.value) || 0)}
 />
 )}
 />
 <Bar
 dataKey="revenue"
 name="Revenue"
 fill={REPORT_CLUSTER.primary}
 radius={[8, 8, 0, 0]}
 maxBarSize={48}
 animationDuration={500}
 />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </ReportSection>

 <ReportSection
 title="Product analysis"
 subtitle={`${catalogueTotal} products in catalogue · sales for ${periodLabel(period)}`}
 theme={reportTheme}
 >
           <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
           <ReportChartPanel
           className="report-chart-panel"
           title="Products by category"
           subtitle="Share of catalogue per storefront category"
           theme={reportTheme}
           style={{ gridColumn: `span ${prodByCatSpan}` }}
           action={<ChartResizeMenu colSpan={prodByCatSpan} maxCols={2} onChange={setProdByCatSpan} />}
           >
           {categoryDonutData.length === 0 ? (
           <ReportEmptyChart message="No products in catalogue yet" theme={reportTheme} />
           ) : (
           <ReportDonutChart
           data={categoryDonutData}
           dataKey="count"
           centerTitle="Products"
           centerValue={catalogueTotal}
           theme={reportTheme}
           legendRows={categoryDonutData}
           formatLegendValue={(row) => `${row.count} (${row.percentage}%)`}
           tooltipContent={(props) => (
           <ReportChartTooltip
           {...props}
           theme={reportTheme}
           formatLine={(e) =>
           e.dataKey === "count"
           ? `${e.payload?.count ?? e.value} (${e.payload?.percentage ?? 0}%)`
           : e.value
           }
           />
           )}
           />
           )}
           </ReportChartPanel>

           <ReportChartPanel
           className="report-chart-panel"
           title="Products by country"
           subtitle="Based on stock label origin (inventory source)"
           theme={reportTheme}
           style={{ gridColumn: `span ${prodByCountrySpan}` }}
           action={<ChartResizeMenu colSpan={prodByCountrySpan} maxCols={2} onChange={setProdByCountrySpan} />}
           >
 {countryBarData.length === 0 ? (
 <ReportEmptyChart message="No country data yet" theme={reportTheme} />
 ) : (
 <div className="h-[min(20rem,calc(100vw-4rem))] min-h-[260px] w-full [&_.recharts-surface]:outline-none">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={countryBarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap="20%">
 <CartesianGrid stroke={reportTheme.grid} strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={reportAxisLineProps(reportTheme)} allowDecimals={false} />
 <YAxis type="category" dataKey="label" width={124} tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={false} />
 <Tooltip
 cursor={{ fill: reportTheme.cursor }}
 content={(props) => (
 <ReportChartTooltip
 {...props}
 theme={reportTheme}
 label={props.payload?.[0]?.payload?.label}
 formatLine={(e) => `${e.payload?.count ?? e.value} (${e.payload?.percentage ?? 0}%)`}
 />
 )}
 />
 <Bar dataKey="count" name="Products" radius={[0, 8, 8, 0]} maxBarSize={26}>
 {countryBarData.map((row) => (
 <Cell key={row.label} fill={row.fill} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </ReportChartPanel>
 </div>

           <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
           <ReportChartPanel
           className="report-chart-panel"
           title="Top 10 selling products"
           subtitle={`Units sold · ${periodLabel(period)}`}
           theme={reportTheme}
           style={{ gridColumn: `span ${top10Span}` }}
           action={<ChartResizeMenu colSpan={top10Span} maxCols={2} onChange={setTop10Span} />}
           >
 {topSellingChartData.length === 0 ? (
 <ReportEmptyChart message="No products sold in this period" theme={reportTheme} />
 ) : (
 <>
 <div className="mb-4 h-[min(22rem,calc(100vw-4rem))] min-h-[280px] w-full [&_.recharts-surface]:outline-none" style={{ height: Math.max(280, topSellingChartData.length * 42 + 48) }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={topSellingChartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }} barCategoryGap="16%">
 <CartesianGrid stroke={reportTheme.grid} strokeDasharray="3 3" horizontal={false} />
 <XAxis type="number" tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={reportAxisLineProps(reportTheme)} allowDecimals={false} />
 <YAxis type="category" dataKey="shortLabel" width={148} tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={false} />
 <Tooltip
 cursor={{ fill: reportTheme.cursor }}
 content={(props) => (
 <ReportChartTooltip
 {...props}
 theme={reportTheme}
 label={props.payload?.[0]?.payload?.fullName}
 formatLine={(e) =>
 e.dataKey === "revenue" ? fullUsd.format(Number(e.value) || 0) : `${e.value} units`
 }
 />
 )}
 />
 <Bar dataKey="unitsSold" name="Units sold" radius={[0, 8, 8, 0]} maxBarSize={30}>
 {topSellingChartData.map((row) => (
 <Cell key={row.productId} fill={row.fill} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 <ReportLegendPills
 rows={topSellingChartData.map((row) => ({ name: row.fullName, fill: row.fill, key: row.productId, unitsSold: row.unitsSold, revenue: row.revenue }))}
 theme={reportTheme}
 formatValue={(row) => `${row.unitsSold} · ${fullUsd.format(row.revenue)}`}
 />
 </>
           )}
           </ReportChartPanel>
           </div>
           </ReportSection>

           <ReportSection
           title="Category analysis"
 subtitle={`${fullUsd.format(categorySales.total_revenue || 0)} revenue · ${categorySales.total_units || 0} units · ${periodLabel(period)}`}
 theme={reportTheme}
 >
           <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
           <ReportChartPanel
           className="report-chart-panel"
           title="Categories revenue"
           subtitle="Revenue share by storefront category"
           theme={reportTheme}
           style={{ gridColumn: `span ${catRevenueSpan}` }}
           action={<ChartResizeMenu colSpan={catRevenueSpan} maxCols={2} onChange={setCatRevenueSpan} />}
           >
           {categoryRevenueDonutData.length === 0 ? (
           <ReportEmptyChart message="No category sales in this period" theme={reportTheme} />
           ) : (
           <ReportDonutChart
           data={categoryRevenueDonutData}
           dataKey="revenue"
           centerTitle="Revenue"
           centerValue={fullUsd.format(categorySales.total_revenue || 0)}
           theme={reportTheme}
           legendRows={categoryRevenueDonutData}
           formatLegendValue={(row) => `${fullUsd.format(row.revenue)} (${row.percentage}%)`}
           tooltipContent={(props) => (
           <ReportChartTooltip
           {...props}
           theme={reportTheme}
           formatLine={(e) => `${fullUsd.format(Number(e.payload?.revenue ?? e.value) || 0)} (${e.payload?.percentage ?? 0}%)`}
           />
           )}
           />
           )}
           </ReportChartPanel>

           <ReportChartPanel
           className="report-chart-panel"
           title="Top sale categories"
           subtitle="Units sold vs revenue (clustered)"
           theme={reportTheme}
           style={{ gridColumn: `span ${topCatSpan}` }}
           action={<ChartResizeMenu colSpan={topCatSpan} maxCols={2} onChange={setTopCatSpan} />}
           >
 {topCategoryClusterData.length === 0 ? (
 <ReportEmptyChart message="No category sales in this period" theme={reportTheme} />
 ) : (
 <div className="h-[min(22rem,calc(100vw-4rem))] min-h-[300px] w-full [&_.recharts-surface]:outline-none">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={topCategoryClusterData} margin={{ top: 12, right: 12, bottom: topCategoryClusterData.length > 5 ? 56 : 28, left: 4 }} barGap={6} barCategoryGap="24%">
 <CartesianGrid stroke={reportTheme.grid} strokeDasharray="3 3" vertical={false} />
 <XAxis
 dataKey="shortLabel"
 tick={reportAxisTickProps(reportTheme)}
 axisLine={reportAxisLineProps(reportTheme)}
 tickLine={reportAxisLineProps(reportTheme)}
 angle={topCategoryClusterData.length > 4 ? -28 : 0}
 textAnchor={topCategoryClusterData.length > 4 ? "end" : "middle"}
 height={topCategoryClusterData.length > 4 ? 52 : 32}
 interval={0}
 />
 <YAxis yAxisId="units" tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={reportAxisLineProps(reportTheme)} allowDecimals={false} width={44} />
 <YAxis yAxisId="revenue" orientation="right" tick={reportAxisTickProps(reportTheme)} axisLine={reportAxisLineProps(reportTheme)} tickLine={reportAxisLineProps(reportTheme)} tickFormatter={(v) => compactUsd.format(Number(v))} width={64} />
 <Tooltip
 cursor={{ fill: reportTheme.cursor }}
 content={(props) => (
 <ReportChartTooltip
 {...props}
 theme={reportTheme}
 label={props.payload?.[0]?.payload?.name}
 formatLine={(e) =>
 e.dataKey === "revenue" ? fullUsd.format(Number(e.value) || 0) : `${e.value} units`
 }
 />
 )}
 />
 <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" formatter={(value) => <span style={{ color: reportTheme.subtitle }}>{value}</span>} />
 <Bar yAxisId="units" dataKey="unitsSold" name="Units sold" fill={REPORT_CLUSTER.primary} radius={[8, 8, 0, 0]} maxBarSize={34} />
 <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill={REPORT_CLUSTER.secondary} radius={[8, 8, 0, 0]} maxBarSize={34} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 )}
 </ReportChartPanel>
 </div>
 </ReportSection>

 <ReportSection
 title="Order analysis"
 subtitle={`${orderTotal} orders · ${periodLabel(period)}`}
 theme={reportTheme}
 >
           <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
           <ReportChartPanel
           className="report-chart-panel"
           title="Order status"
           subtitle="Share of orders by lifecycle status"
           theme={reportTheme}
           style={{ gridColumn: `span ${orderStatusSpan}` }}
           action={<ChartResizeMenu colSpan={orderStatusSpan} maxCols={2} onChange={setOrderStatusSpan} />}
           >
           {orderStatusDonutData.length === 0 ? (
           <ReportEmptyChart message="No orders in this period" theme={reportTheme} />
           ) : (
           <ReportDonutChart
           data={orderStatusDonutData}
           dataKey="count"
           centerTitle="Orders"
           centerValue={orderTotal}
           theme={reportTheme}
           legendRows={orderStatusDonutData}
           formatLegendValue={(row) => `${row.count} (${row.percentage}%)`}
           tooltipContent={(props) => (
           <ReportChartTooltip
           {...props}
           theme={reportTheme}
           formatLine={(e) => `${e.payload?.count ?? e.value} (${e.payload?.percentage ?? 0}%)`}
           />
           )}
           />
           )}
           </ReportChartPanel>

           <ReportChartPanel
           className="report-chart-panel"
           title="Orders by category"
           subtitle="Distinct orders with products in each category (non-cancelled)"
           theme={reportTheme}
           style={{ gridColumn: `span ${orderCatSpan}` }}
           action={<ChartResizeMenu colSpan={orderCatSpan} maxCols={2} onChange={setOrderCatSpan} />}
           >
 {orderCategoryDonutData.length === 0 ? (
 <ReportEmptyChart message="No orders with category data in this period" theme={reportTheme} />
 ) : (
 <ReportDonutChart
 data={orderCategoryDonutData}
 dataKey="count"
 centerTitle="Orders"
 centerValue={orderCategoryTotal}
 theme={reportTheme}
 legendRows={orderCategoryDonutData}
 formatLegendValue={(row) => `${row.count} (${row.percentage}%)`}
 tooltipContent={(props) => (
 <ReportChartTooltip
 {...props}
 theme={reportTheme}
 formatLine={(e) => `${e.payload?.count ?? e.value} (${e.payload?.percentage ?? 0}%)`}
 />
 )}
 />
 )}
 </ReportChartPanel>
 </div>
 </ReportSection>

 <ReportSection title="Top selling products (detail)" subtitle={periodLabel(period)} theme={reportTheme}>
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
 </ReportSection>

 </>
 )}
 </div>
 </div>
 );
}
