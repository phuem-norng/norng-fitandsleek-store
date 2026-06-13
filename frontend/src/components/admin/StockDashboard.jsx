import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChartResizeMenu from "./ChartResizeMenu.jsx";
import api from "../../lib/api";
import { reportChartColor } from "../../lib/reportChartTheme.js";
import {
  ReportChartPanel,
  ReportChartTooltip,
  ReportDonutChart,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";

function yearRangeLabel(fromYear, toYear) {
  if (fromYear === toYear) return String(fromYear);
  return `${fromYear} – ${toYear}`;
}

function FilterYearSelect({ label, value, onChange, options, theme }) {
  return (
    <label className="block flex-1 min-w-[8rem]">
      <span
        className="mb-1.5 block text-xs font-medium uppercase tracking-wide"
        style={{ color: theme.subtitle }}
      >
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

export default function StockDashboard({ theme }) {
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(String(currentYear - 1));
  const [toYear, setToYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  /* chart resize state */
  const [labelSpan, setLabelSpan] = useAdminUiPreference("charts.stock.labelSpan", 1);
  const [monthSpan, setMonthSpan] = useAdminUiPreference("charts.stock.monthSpan", 1);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 15; y -= 1) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, [currentYear]);

  const load = useCallback(async () => {
    let from = parseInt(fromYear, 10);
    let to = parseInt(toYear, 10);
    if (from > to) {
      [from, to] = [to, from];
    }

    setLoading(true);
    try {
      const { data: res } = await api.get("/admin/reports/stock-analytics", {
        params: { from_year: from, to_year: to },
      });
      setData(res);
    } catch (e) {
      console.error("Failed to load stock analytics", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromYear, toYear]);

  useEffect(() => {
    load();
  }, [load]);

  const labelDonutData = useMemo(
    () =>
      (data?.by_label || []).map((row, index) => ({
        name: row.name,
        count: Number(row.count) || 0,
        percentage: row.percentage,
        fill: reportChartColor(index),
      })),
    [data?.by_label],
  );

  const compareYears = data?.compare_years || [];
  const rangeFrom = data?.year_range?.from ?? parseInt(fromYear, 10);
  const rangeTo = data?.year_range?.to ?? parseInt(toYear, 10);
  const totalStock = data?.total_stock ?? 0;
  const rangeLabel = yearRangeLabel(rangeFrom, rangeTo);

  const monthlyChartData = useMemo(() => {
    const years = compareYears.length ? compareYears : [rangeFrom, rangeTo];
    return (data?.monthly_compare || []).map((row) => {
      const point = {
        month: row.month,
        month_label: row.month_label,
        month_short: row.month_short,
      };
      years.forEach((yr) => {
        const key = `y${yr}`;
        point[key] = Number(row.by_year?.[String(yr)] ?? row.by_year?.[yr] ?? 0);
      });
      return point;
    });
  }, [data?.monthly_compare, compareYears, rangeFrom, rangeTo]);

  const hasMonthlyCompare = monthlyChartData.some((row) =>
    compareYears.some((yr) => (row[`y${yr}`] ?? 0) > 0),
  );

  return (
    <ReportSection
      title="Stock"
      subtitle={
        loading ? "Loading…" : `${totalStock.toLocaleString()} units on hand across inventory labels`
      }
      theme={theme}
    >
      {loading ? (
        <div className="grid min-h-[280px] place-items-center text-sm" style={{ color: theme.subtitle }}>
          Loading charts…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ReportChartPanel
            className="report-chart-panel"
            title="Stock by label"
            subtitle="Current on-hand units per inventory label"
            theme={theme}
            style={{ gridColumn: `span ${labelSpan}` }}
            action={<ChartResizeMenu colSpan={labelSpan} maxCols={2} onChange={setLabelSpan} />}
          >
            {labelDonutData.length === 0 ? (
              <ReportEmptyChart message="No inventory labels with stock" theme={theme} />
            ) : (
              <ReportDonutChart
                data={labelDonutData}
                dataKey="count"
                centerTitle="Units"
                centerValue={totalStock.toLocaleString()}
                theme={theme}
                legendRows={labelDonutData}
                formatLegendValue={(row) => `${row.count.toLocaleString()} (${row.percentage}%)`}
                tooltipContent={(props) => (
                  <ReportChartTooltip
                    {...props}
                    theme={theme}
                    formatLine={(e) =>
                      `${e.payload?.count ?? e.value} units (${e.payload?.percentage ?? 0}%)`
                    }
                  />
                )}
              />
            )}
          </ReportChartPanel>

          <ReportChartPanel
            className="report-chart-panel"
            title="Stock in by month"
            subtitle={`Units received · ${rangeLabel}`}
            theme={theme}
            style={{ gridColumn: `span ${monthSpan}` }}
            action={<ChartResizeMenu colSpan={monthSpan} maxCols={2} onChange={setMonthSpan} />}
          >
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <FilterYearSelect
                label="From year"
                value={fromYear}
                onChange={setFromYear}
                options={yearOptions}
                theme={theme}
              />
              <span className="hidden pb-2.5 text-sm sm:inline" style={{ color: theme.subtitle }}>
                to
              </span>
              <FilterYearSelect
                label="To year"
                value={toYear}
                onChange={setToYear}
                options={yearOptions}
                theme={theme}
              />
            </div>

            {!hasMonthlyCompare ? (
              <ReportEmptyChart message="No stock received in this year range" theme={theme} />
            ) : (
              <div className="h-[min(22rem,calc(100vw-4rem))] min-h-[300px] w-full [&_.recharts-surface]:outline-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 12, right: 12, bottom: 48, left: 4 }}
                    barGap={compareYears.length > 4 ? 2 : 6}
                    barCategoryGap={compareYears.length > 4 ? "12%" : "24%"}
                  >
                    <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month_short"
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      angle={-28}
                      textAnchor="end"
                      height={52}
                      interval={0}
                    />
                    <YAxis
                      tick={reportAxisTickProps(theme)}
                      axisLine={reportAxisLineProps(theme)}
                      tickLine={reportAxisLineProps(theme)}
                      allowDecimals={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: theme.cursor }}
                      content={(props) => (
                        <ReportChartTooltip
                          {...props}
                          theme={theme}
                          label={props.payload?.[0]?.payload?.month_label}
                          formatLine={(e) => `${e.value} units`}
                        />
                      )}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      iconType="circle"
                      formatter={(value) => <span style={{ color: theme.subtitle }}>{value}</span>}
                    />
                    {compareYears.map((yr, index) => (
                      <Bar
                        key={yr}
                        dataKey={`y${yr}`}
                        name={String(yr)}
                        fill={reportChartColor(index)}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={compareYears.length > 4 ? 22 : 34}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ReportChartPanel>
        </div>
      )}
    </ReportSection>
  );
}
