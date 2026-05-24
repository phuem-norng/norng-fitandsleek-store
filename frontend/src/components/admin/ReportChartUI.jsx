import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getReportChartTheme,
  reportChartColor,
  REPORT_CLUSTER,
} from "../../lib/reportChartTheme.js";

export function ReportChartTooltip({ active, payload, label, theme, formatLine }) {
  if (!active || !payload?.length) return null;
  const title = label || payload[0]?.payload?.name || payload[0]?.payload?.fullName || "—";

  return (
    <div
      className="rounded-xl border px-3.5 py-2.5 text-xs shadow-lg"
      style={{
        background: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
      }}
    >
      <p className="font-semibold" style={{ color: theme.title }}>
        {title}
      </p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="mt-1 tabular-nums" style={{ color: theme.subtitle }}>
          <span style={{ color: entry.color }}>{entry.name}: </span>
          <span className="font-semibold" style={{ color: theme.title }}>
            {formatLine ? formatLine(entry) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ReportLegendPills({ rows, theme, formatValue }) {
  if (!rows?.length) return null;
  return (
    <ul className="w-full max-h-60 space-y-2 overflow-y-auto text-sm">
      {rows.map((row, index) => {
        const color = row.fill || reportChartColor(index);
        return (
          <li
            key={row.key || row.name || index}
            className="flex items-center justify-between gap-2 rounded-full px-3 py-2"
            style={{ backgroundColor: `${color}18` }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              <span className="truncate font-medium" style={{ color: theme.title }}>
                {row.name}
              </span>
            </span>
            <span
              className="shrink-0 rounded-lg px-2.5 py-0.5 text-xs font-semibold tabular-nums"
              style={{ backgroundColor: theme.pillValueBg, color: theme.title }}
            >
              {formatValue(row)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ReportDonutChart({
  data,
  dataKey = "value",
  centerTitle,
  centerValue,
  theme,
  tooltipContent,
  legendRows,
  formatLegendValue,
  height = 260,
}) {
  const total = data.reduce((sum, row) => sum + (Number(row[dataKey]) || 0), 0);

  return (
    <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start">
      <div
        className="relative w-full max-w-[300px] mx-auto lg:mx-0 [&_.recharts-surface]:outline-none"
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke={theme.donutStroke}
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={tooltipContent} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: theme.subtitle }}>
            {centerTitle}
          </span>
          <span className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: theme.title }}>
            {centerValue ?? total}
          </span>
        </div>
      </div>
      {legendRows ? (
        <div className="w-full lg:flex-1 lg:pt-1">
          <ReportLegendPills rows={legendRows} theme={theme} formatValue={formatLegendValue} />
        </div>
      ) : null}
    </div>
  );
}

export function ReportSection({ title, subtitle, children, theme, className = "" }) {
  return (
    <section
      className={`mb-8 rounded-2xl border p-6 ${className}`}
      style={{
        background: theme.cardBg,
        borderColor: theme.cardBorder,
        boxShadow: theme.cardShadow,
      }}
    >
      <header className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: theme.title }}>
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm" style={{ color: theme.subtitle }}>
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function ReportChartPanel({ title, subtitle, children, theme, className = "" }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: theme.panelBg, border: `1px solid ${theme.cardBorder}` }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: theme.title }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs" style={{ color: theme.subtitle }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ReportEmptyChart({ message, theme }) {
  return (
    <p className="py-16 text-center text-sm" style={{ color: theme.subtitle }}>
      {message}
    </p>
  );
}

export function reportAxisTickProps(theme) {
  return { fill: theme.tick, fontSize: 11, fontWeight: 500 };
}

export function reportAxisLineProps(theme) {
  return { stroke: theme.axis };
}

export { getReportChartTheme, reportChartColor, REPORT_CLUSTER };
