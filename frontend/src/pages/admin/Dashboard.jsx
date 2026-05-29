import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useAdminAccents } from "../../lib/adminAccents.js";
import { useTheme } from "../../state/theme.jsx";
import { useLanguage } from "../../lib/i18n.jsx";
import ChartResizeMenu from "../../components/admin/ChartResizeMenu.jsx";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContentSkeleton } from "@/components/admin/AdminLoading";

const pad = (n) => String(n).padStart(2, "0");
const fmtYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

function shadeHex(hex, toward255, ratio) {
  const { r, g, b } = hexToRgb(hex);
  const t = toward255 ? 255 : 0;
  const rr = mixChannel(r, t, ratio);
  const gg = mixChannel(g, t, ratio);
  const bb = mixChannel(b, t, ratio);
  const x = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${x(rr)}${x(gg)}${x(bb)}`;
}

/** Human-readable order status for charts */
function formatStatusLabel(status) {
  if (!status) return "Unknown";
  const s = String(status).toLowerCase().replace(/_/g, " ");
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_SORT_ORDER = [
  "pending",
  "pending_payment",
  "paid",
  "processing",
  "preparing",
  "shipped",
  "completed",
  "cancelled",
  "canceled",
];

function sortStatusRows(rows) {
  const orderMap = new Map(STATUS_SORT_ORDER.map((k, i) => [k, i]));
  return [...rows].sort((a, b) => {
    const ka = orderMap.get(String(a.status || "").toLowerCase()) ?? 99;
    const kb = orderMap.get(String(b.status || "").toLowerCase()) ?? 99;
    if (ka !== kb) return ka - kb;
    return b.count - a.count;
  });
}

function buildDailySeries(salesRows, periodDays, endDate = new Date()) {
  const byKey = {};
  (salesRows || []).forEach((r) => {
    const raw = r.date || r.CreatedAt;
    const key = typeof raw === "string" ? raw.slice(0, 10) : "";
    if (!key) return;
    byKey[key] = {
      revenue: Number(r.revenue ?? 0),
      orders: Number(r.orders ?? 0),
    };
  });

  const out = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - i);
    const key = fmtYmd(d);
    const bucket = byKey[key] || { revenue: 0, orders: 0 };
    const invalid = Number.isNaN(d.getTime());
    out.push({
      dateKey: key,
      revenue: bucket.revenue,
      orders: bucket.orders,
      xLabel: invalid
        ? "—"
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateLong: invalid ? key : d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    });
  }
  return out;
}

function RevenueTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{
        borderColor: mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)",
        background: mode === "dark" ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
      }}
    >
      <p className="font-semibold text-slate-800 dark:text-slate-100">{row.dateLong}</p>
      <p className="mt-1 tabular-nums text-slate-600 dark:text-slate-300">
        Revenue:{" "}
        <span className="font-semibold text-slate-900 dark:text-white">{fullUsd.format(row.revenue || 0)}</span>
      </p>
      <p className="mt-0.5 tabular-nums text-slate-500 dark:text-slate-400">Orders: {row.orders ?? 0}</p>
    </div>
  );
}

function StatusTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{
        borderColor: mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)",
        background: mode === "dark" ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
      }}
    >
      <p className="font-semibold text-slate-800 dark:text-slate-100">{row.label}</p>
      <p className="mt-1 tabular-nums text-slate-600 dark:text-slate-300">
        Orders in period:{" "}
        <span className="font-semibold text-slate-900 dark:text-white">{row.count}</span>
      </p>
    </div>
  );
}

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) {
      setDisplayValue(target);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 620;
    setDisplayValue(0);

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const formatted = displayValue.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <>{prefix}{formatted}{suffix}</>;
}

function StatCard({ title, value, sub, icon, accentIndex = 0, iconBoxStyle }) {
  return (
    <div className="admin-surface admin-spectrum-kpi rounded-2xl border admin-border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{sub}</p>}
        </div>
        <div
          className="admin-stat-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border admin-border"
          style={iconBoxStyle}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function CardChrome({ title, description, action, children, animationDelay }) {
  return (
    <div
      className="fade-in-up admin-surface w-full min-w-0 overflow-hidden rounded-2xl border admin-border"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-start justify-between gap-4 border-b admin-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PeriodTabs({ days, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border admin-border bg-slate-50/90 p-0.5 dark:bg-slate-900/70">
      {days.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all " +
            (value === d
              ? "bg-[rgba(var(--admin-primary-rgb),0.2)] text-slate-900 shadow-sm dark:bg-[rgba(var(--admin-primary-rgb),0.25)] dark:text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200")
          }
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { primaryColor, mode } = useTheme();
  const { isSpectrum, iconBoxStyle, barFill } = useAdminAccents();
  const { t } = useLanguage();
  const gid = useId().replace(/:/g, "");

  const [periodDays, setPeriodDays] = useState(30);

  /* ── Chart resize state (xl col-span, max 3 in the 3-col grid) ── */
  const [revenueSpan, setRevenueSpan] = useState(2);
  const [statusSpan, setStatusSpan] = useState(1);

  const [stats, setStats] = useState({
    revenue: { total: 0, month: 0, today: 0 },
    ordersHead: { total: 0, pending: 0, processing: 0, completed: 0 },
    ordersByStatus: [],
    products: { total: 0, active: 0, low_stock: 0 },
    customers: { total: 0, new_this_month: 0 },
  });
  const [salesSeriesRaw, setSalesSeriesRaw] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  /** After first successful load, period changes refetch in-place (no full-page skeleton flash). */
  const hasLoadedOnceRef = useRef(false);
  /** First paint only: Recharts enter animation. Later updates swap data without re-animating from zero. */
  const [chartEnterAnim, setChartEnterAnim] = useState(true);

  const chartGridColor = mode === "dark" ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.06)";
  const chartAxisLine = mode === "dark" ? "#334155" : "#e2e8f0";
  const chartTickColor = mode === "dark" ? "#94a3b8" : "#64748b";

  const barTop = useMemo(() => shadeHex(primaryColor, true, 0.35), [primaryColor]);
  const barBottom = useMemo(() => shadeHex(primaryColor, false, 0.25), [primaryColor]);

  useEffect(() => {
    let cancelled = false;
    const skipFullScreenLoad = hasLoadedOnceRef.current;
    if (!skipFullScreenLoad) setLoading(true);

    (async () => {
      try {
        const [dashRes, salesRes] = await Promise.all([
          api.get("/admin/reports/dashboard", { params: { period: periodDays } }),
          api.get("/admin/reports/sales", { params: { period: periodDays } }),
        ]);
        const d = dashRes.data || {};
        const ordersByStatus = Array.isArray(d.orders_by_status) ? d.orders_by_status : [];

        const salesPayload = salesRes.data?.sales || salesRes.data?.data?.rows || salesRes.data?.data || [];
        const salesArr = Array.isArray(salesPayload) ? salesPayload : [];

        if (!cancelled) {
          setStats({
            revenue: d.revenue || { total: 0, month: 0, today: 0 },
            ordersHead: d.orders || { total: 0, pending: 0, processing: 0, completed: 0 },
            ordersByStatus,
            products: d.products || { total: 0, active: 0, low_stock: 0 },
            customers: d.customers || { total: 0, new_this_month: 0 },
          });
          setSalesSeriesRaw(salesArr);
        }
      } catch {
        if (!cancelled) {
          setSalesSeriesRaw([]);
          setStats((prev) => ({ ...prev, ordersByStatus: [] }));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hasLoadedOnceRef.current = true;
        }
      }

      if (cancelled) return;
      try {
        const ordersRes = await api.get("/admin/orders", { params: { per_page: 8, compact: 1 } });
        if (!cancelled) {
          setRecentOrders(ordersRes.data?.data?.slice(0, 8) || []);
        }
      } catch {
        if (!cancelled) setRecentOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  useEffect(() => {
    if (loading) return undefined;
    setChartEnterAnim(false);
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setChartEnterAnim(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [loading, periodDays, salesSeriesRaw, stats.ordersByStatus]);

  const chartData = useMemo(() => buildDailySeries(salesSeriesRaw, periodDays), [salesSeriesRaw, periodDays]);

  const statusBars = useMemo(() => {
    const rows = sortStatusRows(
      stats.ordersByStatus.map((r) => ({
        status: r.status,
        count: Number(r.count || 0),
        label: formatStatusLabel(r.status),
      }))
    ).filter((r) => r.count > 0);
    return rows;
  }, [stats.ordersByStatus]);

  if (loading) return <AdminContentSkeleton lines={3} imageHeight={220} />;

  const pctActive =
    stats.products.total > 0 ? Math.round((stats.products.active / stats.products.total) * 100) : null;

  const statCards = [
    {
      id: "kpi-revenue",
      title: `${t('dashboardRevenue')} (${periodDays}d)`,
      value: <AnimatedNumber value={stats.revenue.total || 0} prefix="$" decimals={2} />,
      sub: <>{t('dashboardToday')} · <AnimatedNumber value={stats.revenue.today || 0} prefix="$" decimals={2} /></>,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      id: "kpi-mtd",
      title: t('dashboardMonthToDate'),
      value: <AnimatedNumber value={stats.revenue.month || 0} prefix="$" decimals={2} />,
      sub: <>{t('dashboardNewCustomers')} ({periodDays}d): <AnimatedNumber value={stats.customers.new_this_month ?? 0} /></>,
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    },
    {
      id: "kpi-orders",
      title: `${t('dashboardOrders')} (${periodDays}d)`,
      value: <AnimatedNumber value={stats.ordersHead.total || 0} />,
      sub: <><AnimatedNumber value={stats.ordersHead.pending ?? 0} /> {t('dashboardPending')} · <AnimatedNumber value={stats.ordersHead.completed ?? 0} /> {t('dashboardCompleted')}</>,
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    },
    {
      id: "kpi-customers",
      title: t('dashboardCustomersTotal'),
      value: <AnimatedNumber value={stats.customers.total || 0} />,
      sub: pctActive !== null ? <>{t('dashboardCatalog')} · <AnimatedNumber value={pctActive} suffix="%" /> {t('dashboardProductsActive')}</> : t('dashboardRegisteredAccounts'),
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    },
  ];

  const gradientId = `dash-rev-${gid}`;
  const barGradId = `dash-bar-${gid}`;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* KPI */}
      <div className="admin-stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((c, index) => (
          <div key={c.id}>
            <StatCard
              title={c.title}
              value={c.value}
              sub={c.sub}
              icon={c.icon}
              accentIndex={index}
              iconBoxStyle={iconBoxStyle(index)}
            />
          </div>
        ))}
      </div>

      {/* Charts — dynamic col-spans controlled by resize menus */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <div
          className="min-w-0"
          style={{ gridColumn: `span ${revenueSpan}` }}
        >
          <CardChrome
            title={t('dashboardDailyRevenueTrend')}
            description={`${t('dashboardNetSettledSales')} · ${t('dashboardLast')} ${periodDays} ${t('dashboardDays')}`}
            animationDelay={300}
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PeriodTabs days={[7, 30, 90]} value={periodDays} onChange={setPeriodDays} />
                <Link
                  to="/admin/reports"
                  className="rounded-lg border admin-border px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-[rgba(var(--admin-primary-rgb),0.08)] dark:text-slate-300 dark:hover:bg-[rgba(var(--admin-primary-rgb),0.12)]"
                >
                  {t('dashboardFullReports')}
                </Link>
                <ChartResizeMenu colSpan={revenueSpan} maxCols={3} onChange={setRevenueSpan} />
              </div>
            }
          >
            <div className="h-[min(22rem,calc(100vw-5rem))] min-h-[280px] w-full px-2 pb-2 pt-1 md:px-4 [&_.recharts-surface]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={primaryColor} stopOpacity={0.42} />
                      <stop offset="100%" stopColor={primaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartGridColor} strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="xLabel"
                    tick={{ fill: chartTickColor, fontSize: 11 }}
                    axisLine={{ stroke: chartAxisLine }}
                    tickLine={{ stroke: chartAxisLine }}
                    interval={periodDays >= 45 ? Math.floor(periodDays / 10) : periodDays > 14 ? 3 : 1}
                    minTickGap={8}
                    height={28}
                    angle={periodDays > 31 ? -32 : 0}
                    textAnchor={periodDays > 31 ? "end" : "middle"}
                    dy={periodDays > 31 ? 4 : 0}
                  />
                  <YAxis
                    tickFormatter={(v) => compactUsd.format(v)}
                    tick={{ fill: chartTickColor, fontSize: 11 }}
                    axisLine={{ stroke: chartAxisLine }}
                    tickLine={{ stroke: chartAxisLine }}
                    width={62}
                    domain={[0, "auto"]}
                  />
                  <Tooltip content={<RevenueTooltip mode={mode} />} wrapperStyle={{ outline: "none" }} animationDuration={200} />
                  <Area
                    type="natural"
                    dataKey="revenue"
                    stroke={primaryColor}
                    strokeWidth={2.25}
                    fill={`url(#${gradientId})`}
                    activeDot={{
                      r: 5,
                      fill: primaryColor,
                      stroke: mode === "dark" ? "#0f172a" : "#fff",
                      strokeWidth: 2,
                    }}
                    animationDuration={chartEnterAnim ? 720 : 0}
                    animationEasing="ease-out"
                    isAnimationActive={chartEnterAnim}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardChrome>
        </div>

        {/* Orders by status */}
        <div
          className="flex min-w-0 flex-col gap-4"
          style={{ gridColumn: `span ${statusSpan}` }}
        >
          <CardChrome
            title={t('dashboardOrdersByStatus')}
            description={t('dashboardOrdersPlacedInPeriod')}
            animationDelay={360}
            action={<ChartResizeMenu colSpan={statusSpan} maxCols={3} onChange={setStatusSpan} />}
          >
            <div className="h-[min(22rem,calc(100vw-6rem))] min-h-[240px] w-full px-2 pb-2 pt-1 md:px-4 [&_.recharts-surface]:outline-none">
              {statusBars.length === 0 ? (
                <div className="flex h-[240px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  No order data this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBars} margin={{ top: 10, right: 12, left: 4, bottom: 4 }} barCategoryGap={16}>
                    <defs>
                      <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={barTop} />
                        <stop offset="100%" stopColor={barBottom} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGridColor} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartTickColor, fontSize: 10 }}
                      axisLine={{ stroke: chartAxisLine }}
                      tickLine={{ stroke: chartAxisLine }}
                      interval={0}
                      height={56}
                      angle={statusBars.length > 4 ? -28 : 0}
                      textAnchor={statusBars.length > 4 ? "end" : "middle"}
                      tickMargin={statusBars.length > 4 ? 6 : 4}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: chartTickColor, fontSize: 11 }}
                      axisLine={{ stroke: chartAxisLine }}
                      tickLine={{ stroke: chartAxisLine }}
                      width={38}
                      domain={[0, "auto"]}
                    />
                    <Tooltip content={<StatusTooltip mode={mode} />} cursor={{ fill: "rgba(var(--admin-primary-rgb),0.06)" }} animationDuration={200} />
                    <Bar
                      dataKey="count"
                      fill={isSpectrum ? barFill(0) : `url(#${barGradId})`}
                      radius={[10, 10, 4, 4]}
                      maxBarSize={44}
                      animationDuration={chartEnterAnim ? 680 : 0}
                      animationEasing="ease-out"
                      isAnimationActive={chartEnterAnim}
                    >
                      {isSpectrum
                        ? statusBars.map((row, index) => (
                            <Cell key={row.status ?? index} fill={barFill(index)} />
                          ))
                        : null}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardChrome>
        </div>
      </div>

      {/* Recent Orders */}
      <CardChrome title={t('dashboardRecentOrders')} description={t('dashboardRecentActivity')} animationDelay={460}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b admin-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('dashboardOrder')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('dashboardCustomer')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('dashboardAmount')}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('dashboardStatus')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    {t('dashboardNoRecentOrders')}
                  </td>
                </tr>
              )}
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b admin-border transition-colors hover:bg-[rgba(var(--admin-primary-rgb),0.06)] dark:hover:bg-[rgba(var(--admin-primary-rgb),0.08)]"
                >
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">#{order.order_number}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{order.user_name || t('guest')}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-900 dark:text-slate-100">
                    ${Number(order.total || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t admin-border px-5 py-3 text-right">
          <Link
            to="/admin/orders"
            className="text-xs font-semibold text-[color:var(--admin-primary)] hover:brightness-125"
          >
            {t('dashboardViewAllOrders')} →
          </Link>
        </div>
      </CardChrome>

      <style>{`
        @keyframes fade-in-up-dash {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          opacity: 0;
          animation: fade-in-up-dash 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    delivered: {
      label: "Delivered",
      cls: "bg-[rgba(var(--admin-primary-rgb),0.1)] text-[color:var(--admin-primary)] border-[rgba(var(--admin-primary-rgb),0.3)] dark:bg-[rgba(var(--admin-primary-rgb),0.15)] dark:text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.35)]",
    },
    completed: {
      label: "Completed",
      cls: "bg-[rgba(var(--admin-primary-rgb),0.1)] text-[color:var(--admin-primary)] border-[rgba(var(--admin-primary-rgb),0.3)] dark:bg-[rgba(var(--admin-primary-rgb),0.15)] dark:text-[color:var(--admin-primary)] dark:border-[rgba(var(--admin-primary-rgb),0.35)]",
    },
    shipped: {
      label: "Shipped",
      cls: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-600",
    },
    processing: {
      label: "Processing",
      cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    },
    pending: {
      label: "Pending",
      cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
    paid: {
      label: "Paid",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-400 dark:border-emerald-800",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    },
    canceled: {
      label: "Cancelled",
      cls: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    },
    pending_payment: {
      label: "Pending payment",
      cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    },
  };
  const key = (status || "pending").toLowerCase();
  const hit = map[key] || map.pending;
  const { label, cls } = hit;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
