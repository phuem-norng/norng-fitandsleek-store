import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { formatCountryLabel } from "../../lib/countries.js";
import { REPORT_CLUSTER } from "../../lib/reportChartTheme.js";
import {
  ReportChartTooltip,
  ReportEmptyChart,
  ReportSection,
  reportAxisLineProps,
  reportAxisTickProps,
} from "./ReportChartUI.jsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const PANEL_HEADERS = {
  line: { bg: "#fecdd3", title: "#7f1d1d" },
  column: { bg: "#e9d5ff", title: "#581c87" },
  product: { bg: "#93c5fd", title: "#1e3a8a" },
  country: { bg: "#e2e8f0", title: "#334155" },
};

function truncateLabel(value, max = 26) {
  const s = String(value || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function RevenueVisualPanel({ title, variant, children, theme }) {
  const accent = PANEL_HEADERS[variant] || PANEL_HEADERS.country;
  return (
    <div
      className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-2xl border"
      style={{ borderColor: theme.cardBorder, background: theme.panelBg }}
    >
      <div className="px-4 py-2.5" style={{ background: accent.bg }}>
        <h3 className="text-sm font-semibold" style={{ color: accent.title }}>
          {title}
        </h3>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">{children}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, theme }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide" style={{ color: theme.subtitle }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border px-3 text-sm outline-none dark:[color-scheme:dark]"
        style={{
          background: theme.isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
          borderColor: theme.cardBorder,
          color: theme.title,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RevenueDashboard({ theme }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year: parseInt(year, 10) };
      if (categoryId) params.category_id = categoryId;
      if (productId) params.product_id = productId;
      const { data: res } = await api.get("/admin/reports/revenue-analytics", { params });
      setData(res);
    } catch (e) {
      console.error("Failed to load revenue analytics", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, categoryId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y -= 1) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, [currentYear]);

  const categoryOptions = useMemo(() => {
    const cats = data?.filters?.categories || [];
    return [{ value: "", label: "All" }, ...cats.map((c) => ({ value: String(c.id), label: c.name }))];
  }, [data?.filters?.categories]);

  const productOptions = useMemo(() => {
    const products = data?.filters?.products || [];
    return [{ value: "", label: "All" }, ...products.map((p) => ({ value: String(p.id), label: p.name }))];
  }, [data?.filters?.products]);

  const monthly = data?.monthly || [];
  const yearNum = parseInt(year, 10);
  const hasMonthly = monthly.some((row) => row.revenue > 0);

  const productChartData = useMemo(
    () =>
      (data?.by_product || []).map((row) => ({
        productId: row.product_id,
        fullName: row.name,
        shortLabel: truncateLabel(row.name),
        revenue: Number(row.revenue) || 0,
      })),
    [data?.by_product],
  );

  const countryChartData = useMemo(
    () =>
      (data?.by_country || []).map((row) => {
        const label =
          row.code && row.code !== "unknown" && row.code !== "other"
            ? formatCountryLabel(row.code)
            : row.name;
        return {
          label,
          revenue: Number(row.revenue) || 0,
        };
      }),
    [data?.by_country],
  );

  const handleCategoryChange = (value) => {
    setCategoryId(value);
    setProductId("");
  };

  return (
    <ReportSection
      title="Revenue"
      subtitle={
        loading
          ? "Loading…"
          : `${fullUsd.format(data?.total_revenue || 0)} total · ${yearNum}`
      }
      theme={theme}
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FilterSelect label="Year" value={year} onChange={setYear} options={yearOptions} theme={theme} />
        <FilterSelect
          label="Category"
          value={categoryId}
          onChange={handleCategoryChange}
          options={categoryOptions}
          theme={theme}
        />
        <FilterSelect
          label="Product"
          value={productId}
          onChange={setProductId}
          options={productOptions}
          theme={theme}
        />
      </div>

      {loading ? (
        <div className="grid min-h-[320px] place-items-center text-sm" style={{ color: theme.subtitle }}>
          Loading charts…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RevenueVisualPanel title="Total Revenue by Month and Year" variant="line" theme={theme}>
            {!hasMonthly ? (
              <ReportEmptyChart message="No revenue data for this year" theme={theme} />
            ) : (
              <div className="h-[min(20rem,calc(100vw-4rem))] min-h-[240px] w-full flex-1 [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      tickFormatter={(m) => String(m)}
                    />
                    <YAxis
                      width={72}
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      tickFormatter={(v) => compactUsd.format(Number(v))}
                      domain={[0, (max) => (max <= 0 ? 1 : max * 1.1)]}
                    />
                    <Tooltip
                      content={(props) => (
                        <ReportChartTooltip
                          {...props}
                          theme={theme}
                          label={
                            props.payload?.[0]?.payload?.month_label
                              ? `${props.payload[0].payload.month_label} ${yearNum}`
                              : undefined
                          }
                          formatLine={(e) => fullUsd.format(Number(e.value) || 0)}
                        />
                      )}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={() => <span style={{ color: theme.subtitle }}>{yearNum}</span>}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={String(yearNum)}
                      stroke={REPORT_CLUSTER.primary}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: REPORT_CLUSTER.primary }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </RevenueVisualPanel>

          <RevenueVisualPanel title="Total Revenue by Month and Year" variant="column" theme={theme}>
            {!hasMonthly ? (
              <ReportEmptyChart message="No revenue data for this year" theme={theme} />
            ) : (
              <div className="h-[min(20rem,calc(100vw-4rem))] min-h-[240px] w-full flex-1 [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 16, bottom: 48, left: 4 }} barCategoryGap="18%">
                    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month_label"
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      angle={-35}
                      textAnchor="end"
                      height={56}
                      interval={0}
                    />
                    <YAxis
                      width={72}
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      tickFormatter={(v) => compactUsd.format(Number(v))}
                      domain={[0, (max) => (max <= 0 ? 1 : max * 1.1)]}
                    />
                    <Tooltip
                      cursor={{ fill: theme.cursor }}
                      content={(props) => (
                        <ReportChartTooltip
                          {...props}
                          theme={theme}
                          label={props.payload?.[0]?.payload?.month_label}
                          formatLine={(e) => fullUsd.format(Number(e.value) || 0)}
                        />
                      )}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      formatter={() => <span style={{ color: theme.subtitle }}>{yearNum}</span>}
                    />
                    <Bar
                      dataKey="revenue"
                      name={String(yearNum)}
                      fill={REPORT_CLUSTER.primary}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </RevenueVisualPanel>

          <RevenueVisualPanel title="Product Revenue by product_name" variant="product" theme={theme}>
            {productChartData.length === 0 ? (
              <ReportEmptyChart message="No product revenue for selected filters" theme={theme} />
            ) : (
              <div
                className="w-full flex-1 overflow-y-auto pr-1 [&_.recharts-surface]:outline-none"
                style={{ height: Math.max(280, Math.min(productChartData.length * 36 + 48, 420)) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
                    barCategoryGap="14%"
                  >
                    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      tickFormatter={(v) => compactUsd.format(Number(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortLabel"
                      width={148}
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: theme.cursor }}
                      content={(props) => (
                        <ReportChartTooltip
                          {...props}
                          theme={theme}
                          label={props.payload?.[0]?.payload?.fullName}
                          formatLine={(e) => fullUsd.format(Number(e.value) || 0)}
                        />
                      )}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill={REPORT_CLUSTER.primary} radius={[0, 6, 6, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </RevenueVisualPanel>

          <RevenueVisualPanel title="Revenue by country" variant="country" theme={theme}>
            {countryChartData.length === 0 ? (
              <ReportEmptyChart message="No country data for selected filters" theme={theme} />
            ) : (
              <div className="h-[min(20rem,calc(100vw-4rem))] min-h-[240px] w-full flex-1 [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countryChartData} margin={{ top: 8, right: 16, bottom: 40, left: 4 }} barCategoryGap="22%">
                    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      angle={-28}
                      textAnchor="end"
                      height={48}
                      interval={0}
                    />
                    <YAxis
                      width={72}
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      tickFormatter={(v) => compactUsd.format(Number(v))}
                      domain={[0, (max) => (max <= 0 ? 1 : max * 1.1)]}
                    />
                    <Tooltip
                      cursor={{ fill: theme.cursor }}
                      content={(props) => (
                        <ReportChartTooltip
                          {...props}
                          theme={theme}
                          label={props.payload?.[0]?.payload?.label}
                          formatLine={(e) => fullUsd.format(Number(e.value) || 0)}
                        />
                      )}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Revenue"
                      fill={REPORT_CLUSTER.primary}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </RevenueVisualPanel>
        </div>
      )}
    </ReportSection>
  );
}
