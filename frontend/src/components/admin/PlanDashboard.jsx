import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../lib/api";
import { toastSuccess } from "../../lib/swal";
import { REPORT_CLUSTER } from "../../lib/reportChartTheme.js";
import {
  ReportChartPanel,
  ReportEmptyChart,
  ReportSection,
} from "./ReportChartUI.jsx";
import { Cell, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const fullUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function blockWheelChange(e) {
  e.currentTarget.blur();
}

function ymToParams(prefix, month, year) {
  return {
    [`${prefix}_month`]: parseInt(month, 10),
    [`${prefix}_year`]: parseInt(year, 10),
  };
}

function PeriodSelect({ label, value, onChange, options, theme, id }) {
  return (
    <label className="block flex-1 min-w-[7rem]">
      <span
        className="mb-1.5 block text-xs font-medium uppercase tracking-wide"
        style={{ color: theme.subtitle }}
      >
        {label}
      </span>
      <select
        id={id}
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

function MonthYearRow({ title, month, year, setMonth, setYear, monthOptions, yearOptions, theme, idPrefix }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.subtitle }}>
        {title}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <PeriodSelect
          id={`${idPrefix}-month`}
          label="Month"
          value={month}
          onChange={setMonth}
          options={monthOptions}
          theme={theme}
        />
        <PeriodSelect
          id={`${idPrefix}-year`}
          label="Year"
          value={year}
          onChange={setYear}
          options={yearOptions}
          theme={theme}
        />
      </div>
    </div>
  );
}

function applyYmFromApi(setMonth, setYear, ym) {
  if (!ym) return;
  if (ym.month) setMonth(String(ym.month));
  if (ym.year) setYear(String(ym.year));
}

export default function PlanDashboard({ theme }) {
  const now = new Date();
  const [planStartMonth, setPlanStartMonth] = useState(String(now.getMonth() + 1));
  const [planStartYear, setPlanStartYear] = useState(String(now.getFullYear()));
  const [planEndMonth, setPlanEndMonth] = useState(String(now.getMonth() + 1));
  const [planEndYear, setPlanEndYear] = useState(String(now.getFullYear() + 1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [targetInput, setTargetInput] = useState("");
  const formDirtyRef = useRef(false);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 10 }, (_, i) => {
      const yr = y + 2 - i;
      return { value: String(yr), label: String(yr) };
    });
  }, []);

  const monthOptions = useMemo(
    () =>
      MONTH_NAMES.map((name, index) => ({
        value: String(index + 1),
        label: name,
      })),
    [],
  );

  const queryParams = useMemo(
    () => ({
      ...ymToParams("plan_start", planStartMonth, planStartYear),
      ...ymToParams("plan_end", planEndMonth, planEndYear),
    }),
    [planStartMonth, planStartYear, planEndMonth, planEndYear],
  );

  const syncFormFromResponse = useCallback((res) => {
    if (formDirtyRef.current) return;
    applyYmFromApi(setPlanStartMonth, setPlanStartYear, res?.plan_start);
    applyYmFromApi(setPlanEndMonth, setPlanEndYear, res?.plan_end);
    const t = res?.target;
    setTargetInput(t > 0 ? String(t) : "");
  }, []);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get("/admin/reports/plan", { params: queryParams });
      setData(res);
      syncFormFromResponse(res);
    } catch (e) {
      console.error("Failed to load plan", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams, syncFormFromResponse]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPlan();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loadPlan]);

  const markDirty = () => {
    formDirtyRef.current = true;
  };

  const target = Number(data?.target) || 0;
  const current = Number(data?.current_revenue) || 0;
  const planLabel = data?.plan_period?.label || "—";
  const countLabel = data?.count_period?.label || "—";
  const monthsCounted = data?.months_counted ?? 0;

  const displayPercent = target > 0 ? Math.min(Math.round((current / target) * 1000) / 10, 999) : 0;
  const gaugeFill = target > 0 ? Math.min(displayPercent, 100) : 0;
  const remaining = Math.max(target - current, 0);

  const gaugeData = useMemo(
    () => [
      { name: "Progress", value: gaugeFill, fill: REPORT_CLUSTER.primary },
      {
        name: "Remaining",
        value: Math.max(100 - gaugeFill, 0),
        fill: theme.isDark ? "rgba(148, 163, 184, 0.2)" : "#e2e8f0",
      },
    ],
    [gaugeFill, theme.isDark],
  );

  const handleSave = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(String(targetInput).replace(/,/g, "").trim());
    if (Number.isNaN(parsed) || parsed < 0) return;

    setSaving(true);
    try {
      await api.put("/admin/reports/plan-target", {
        target: parsed,
        ...ymToParams("plan_start", planStartMonth, planStartYear),
        ...ymToParams("plan_end", planEndMonth, planEndYear),
      });
      await toastSuccess({ enText: "Plan saved", khText: "បានរក្សាទុកផែនការ" });
      formDirtyRef.current = false;
      await loadPlan();
    } catch (err) {
      console.error("Failed to save plan", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReportSection
      title="Plan"
      subtitle={
        loading
          ? "Loading…"
          : `Goal ${planLabel} · counting ${countLabel} (${monthsCounted} mo.)`
      }
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
        <ReportChartPanel
          className="report-chart-panel"
          title="Target progress"
          subtitle={
            target > 0 ? `${fullUsd.format(target)} goal for plan period` : "Configure your plan and save to see progress"
          }
          theme={theme}
        >
          {loading ? (
            <div className="grid min-h-[320px] place-items-center text-sm" style={{ color: theme.subtitle }}>
              Loading…
            </div>
          ) : target <= 0 ? (
            <ReportEmptyChart message="Set a target and save your plan" theme={theme} />
          ) : (
            <div className="relative mx-auto w-full select-none">
              <div
                className="relative aspect-[2/1] w-full min-h-[320px] touch-none [&_.recharts-surface]:pointer-events-none [&_.recharts-surface]:outline-none"
                aria-hidden
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    data={gaugeData}
                    cx="50%"
                    cy="78%"
                    innerRadius="68%"
                    outerRadius="98%"
                    startAngle={180}
                    endAngle={0}
                    barSize={26}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                    <RadialBar dataKey="value" cornerRadius={12} isAnimationActive={false}>
                      {gaugeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </RadialBar>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-[12%] text-center">
                <p className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: theme.title }}>
                  {fullUsd.format(current)}
                </p>
                <p className="mt-1.5 text-base" style={{ color: theme.subtitle }}>
                  {displayPercent}% of {compactUsd.format(target)}
                </p>
              </div>
            </div>
          )}
        </ReportChartPanel>

        <ReportChartPanel
          className="report-chart-panel"
          title="Set plan"
          subtitle="Plan period and revenue goal (current sums from plan start)"
          theme={theme}
        >
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <MonthYearRow
              title="Plan starts"
              month={planStartMonth}
              year={planStartYear}
              setMonth={(v) => {
                markDirty();
                setPlanStartMonth(v);
              }}
              setYear={(v) => {
                markDirty();
                setPlanStartYear(v);
              }}
              monthOptions={monthOptions}
              yearOptions={yearOptions}
              theme={theme}
              idPrefix="plan-start"
            />

            <MonthYearRow
              title="Plan ends"
              month={planEndMonth}
              year={planEndYear}
              setMonth={(v) => {
                markDirty();
                setPlanEndMonth(v);
              }}
              setYear={(v) => {
                markDirty();
                setPlanEndYear(v);
              }}
              monthOptions={monthOptions}
              yearOptions={yearOptions}
              theme={theme}
              idPrefix="plan-end"
            />

            <p className="text-xs leading-relaxed" style={{ color: theme.subtitle }}>
              Current revenue is totaled from plan start through today (or plan end if already passed).
            </p>

            <div>
              <label
                htmlFor="plan-target-input"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide"
                style={{ color: theme.subtitle }}
              >
                Target amount (USD)
              </label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                  style={{ color: theme.subtitle }}
                >
                  $
                </span>
                <input
                  id="plan-target-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={targetInput}
                  onChange={(e) => {
                    markDirty();
                    setTargetInput(e.target.value);
                  }}
                  onWheel={blockWheelChange}
                  onFocus={(e) => e.target.select()}
                  placeholder="e.g. 50000"
                  className="h-11 w-full rounded-xl border py-2 pl-7 pr-3 text-sm outline-none dark:[color-scheme:dark]"
                  style={{
                    background: theme.isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
                    borderColor: theme.cardBorder,
                    color: theme.title,
                  }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: theme.cardBorder, background: theme.panelBg }}
              >
                <dt style={{ color: theme.subtitle }}>Current</dt>
                <dd className="mt-0.5 font-semibold tabular-nums" style={{ color: theme.title }}>
                  {loading ? "—" : fullUsd.format(current)}
                </dd>
              </div>
              <div
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: theme.cardBorder, background: theme.panelBg }}
              >
                <dt style={{ color: theme.subtitle }}>Remaining</dt>
                <dd className="mt-0.5 font-semibold tabular-nums" style={{ color: theme.title }}>
                  {loading ? "—" : fullUsd.format(remaining)}
                </dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={saving || loading}
              className="h-11 rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: REPORT_CLUSTER.primary,
                border: `1px solid ${REPORT_CLUSTER.primary}`,
              }}
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
          </form>
        </ReportChartPanel>
      </div>
    </ReportSection>
  );
}
