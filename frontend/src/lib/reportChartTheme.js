/** Reference dashboard palette (New Report UI). */
export const REPORT_CHART_COLORS = [
  "#2B7FFF",
  "#FF6B6B",
  "#A855F7",
  "#FBBF24",
  "#22C55E",
  "#06B6D4",
  "#F97316",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
];

export const REPORT_CLUSTER = {
  primary: "#2B7FFF",
  secondary: "#FF6B6B",
};

export function reportChartColor(index = 0) {
  return REPORT_CHART_COLORS[((index % REPORT_CHART_COLORS.length) + REPORT_CHART_COLORS.length) % REPORT_CHART_COLORS.length];
}

/** @param {'light' | 'dark'} mode */
export function getReportChartTheme(mode) {
  const isDark = mode === "dark";

  return {
    isDark,
    pageBg: "transparent",
    cardBg: isDark ? "rgba(30, 41, 59, 0.55)" : "#ffffff",
    cardBorder: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(226, 232, 240, 0.9)",
    cardShadow: isDark
      ? "0 4px 24px rgba(0, 0, 0, 0.25)"
      : "0 4px 24px rgba(148, 163, 184, 0.18)",
    panelBg: isDark ? "rgba(15, 23, 42, 0.45)" : "#f8fafc",
    title: isDark ? "#f1f5f9" : "#1e293b",
    subtitle: isDark ? "#94a3b8" : "#64748b",
    grid: isDark ? "rgba(148, 163, 184, 0.1)" : "rgba(148, 163, 184, 0.35)",
    axis: isDark ? "#475569" : "#e2e8f0",
    tick: isDark ? "#94a3b8" : "#64748b",
    cursor: isDark ? "rgba(43, 127, 255, 0.08)" : "rgba(43, 127, 255, 0.06)",
    tooltipBg: isDark ? "#1e293b" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    pillValueBg: isDark ? "rgba(148, 163, 184, 0.15)" : "#eef1f8",
    donutStroke: isDark ? "#1e293b" : "#ffffff",
    barRadius: [8, 8, 0, 0],
    barRadiusH: [0, 8, 8, 0],
  };
}

export const reportAxisTick = (theme) => ({
  fill: theme.tick,
  fontSize: 11,
  fontWeight: 500,
});

export const reportAxisLine = (theme) => ({
  stroke: theme.axis,
});
