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
      className="rounded-xl border text-xs shadow-xl"
      style={{
        background: theme.tooltipBg,
        borderColor: theme.tooltipBorder,
        boxShadow: theme.isDark
          ? "0 20px 40px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)"
          : "0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)",
        minWidth: 148,
        maxWidth: 240,
      }}
    >
      <div
        className="px-3.5 py-2 border-b"
        style={{ borderColor: theme.tooltipBorder }}
      >
        <p className="font-semibold text-[11px] leading-snug" style={{ color: theme.title }}>
          {title}
        </p>
      </div>
      <div className="px-3.5 py-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span style={{ color: theme.subtitle }}>{entry.name}</span>
            </span>
            <span className="font-bold tabular-nums" style={{ color: theme.title }}>
              {formatLine ? formatLine(entry) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportLegendPills({ rows, theme, formatValue }) {
  if (!rows?.length) return null;
  return (
    <ul className="w-full max-h-64 space-y-1.5 overflow-y-auto text-xs pr-0.5">
      {rows.map((row, index) => {
        const color = row.fill || reportChartColor(index);
        return (
          <li
            key={row.key || row.name || index}
            className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors"
            style={{
              backgroundColor: theme.isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(15,23,42,0.025)",
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-2"
                style={{ backgroundColor: color, ringColor: `${color}33` }}
                aria-hidden
              />
              <span className="truncate font-medium" style={{ color: theme.subtitle }}>
                {row.name}
              </span>
            </span>
            <span
              className="shrink-0 rounded-md px-2 py-0.5 font-semibold tabular-nums text-[11px]"
              style={{
                backgroundColor: `${color}1A`,
                color: color,
              }}
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
        className="relative w-full max-w-[280px] mx-auto lg:mx-0 [&_.recharts-surface]:outline-none"
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
              innerRadius="60%"
              outerRadius="86%"
              paddingAngle={data.length > 1 ? 2 : 0}
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
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: theme.subtitle }}
          >
            {centerTitle}
          </span>
          <span
            className="mt-1 text-2xl font-bold tabular-nums leading-none"
            style={{ color: theme.title }}
          >
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

export function ReportSection({
  id,
  title,
  subtitle,
  children,
  theme,
  className = "",
  showAccent = true,
}) {
  return (
    <section
      id={id}
      className={`mb-6 rounded-2xl border overflow-hidden ${className}`}
      style={{
        background: theme.cardBg,
        borderColor: theme.cardBorder,
        boxShadow: theme.cardShadow,
      }}
    >
      <header
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{
          borderColor: theme.cardBorder,
          background: theme.isDark
            ? "rgba(255,255,255,0.025)"
            : "rgba(248,250,252,0.8)",
        }}
      >
        {showAccent ? (
          <div
            className="w-1 h-7 rounded-full flex-shrink-0"
            style={{ background: theme.sectionAccentGradient || "#6366F1" }}
          />
        ) : null}
        <div className="min-w-0">
          <h2
            className="text-sm font-bold tracking-tight"
            style={{ color: theme.title }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs font-medium" style={{ color: theme.subtitle }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function ReportChartPanel({ title, subtitle, children, theme, className = "", action, style }) {
  return (
    <div
      className={`rounded-xl overflow-hidden border ${className}`}
      style={{
        background: theme.cardBg,
        borderColor: theme.cardBorder,
        boxShadow: theme.isDark
          ? "0 1px 4px rgba(0,0,0,0.25)"
          : "0 1px 4px rgba(15,23,42,0.05)",
        ...style,
      }}
    >
      <div
        className="flex items-start justify-between gap-3 px-4 py-3 border-b"
        style={{
          borderColor: theme.cardBorder,
          background: theme.panelHeaderBg || theme.panelBg,
        }}
      >
        <div className="min-w-0">
          <h3 className="text-xs font-bold tracking-tight" style={{ color: theme.title }}>
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] font-medium" style={{ color: theme.subtitle }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ReportEmptyChart({ message, theme }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{
          background: theme.isDark
            ? "rgba(148,163,184,0.08)"
            : "rgba(15,23,42,0.04)",
        }}
      >
        <svg
          className="w-6 h-6 opacity-30"
          style={{ color: theme.subtitle }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <p className="text-xs font-semibold" style={{ color: theme.subtitle }}>
        {message}
      </p>
    </div>
  );
}

export function reportAxisTickProps(theme) {
  return { fill: theme.tick, fontSize: 11, fontWeight: 500 };
}

export function reportAxisLineProps(theme) {
  return { stroke: theme.axis };
}

export { getReportChartTheme, reportChartColor, REPORT_CLUSTER };
