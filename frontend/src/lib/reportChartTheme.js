/** Professional dashboard palette – refined, accessible, modern. */
export const REPORT_CHART_COLORS = [
  "#6366F1", // Indigo 500
  "#0EA5E9", // Sky 500
  "#10B981", // Emerald 500
  "#F59E0B", // Amber 500
  "#EF4444", // Red 500
  "#8B5CF6", // Violet 500
  "#F97316", // Orange 500
  "#06B6D4", // Cyan 500
  "#EC4899", // Pink 500
  "#14B8A6", // Teal 500
];

export const REPORT_CLUSTER = {
  primary: "#6366F1",
  secondary: "#10B981",
};

export function reportChartColor(index = 0) {
  return REPORT_CHART_COLORS[
    ((index % REPORT_CHART_COLORS.length) + REPORT_CHART_COLORS.length) %
      REPORT_CHART_COLORS.length
  ];
}

/** @param {'light' | 'dark'} mode */
export function getReportChartTheme(mode) {
  const isDark = mode === "dark";

  return {
    isDark,
    pageBg: "transparent",
    // Align dark report cards/panels with admin shell tokens for visual consistency.
    cardBg: isDark ? "var(--admin-card-bg, #161B22)" : "#ffffff",
    cardBorder: isDark ? "transparent" : "rgba(226, 232, 240, 0.8)",
    cardShadow: isDark
      ? "0 1px 2px rgba(1,4,9,0.6), 0 10px 26px rgba(1,4,9,0.42)"
      : "0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(99,102,241,0.07)",
    panelBg: isDark ? "var(--admin-elevated, #21262D)" : "#F8FAFC",
    panelHeaderBg: isDark ? "rgba(33,38,45,0.92)" : "#F1F5F9",
    title: isDark ? "var(--admin-heading, #F0F6FC)" : "#0F172A",
    subtitle: isDark ? "var(--admin-muted, #8B949E)" : "#64748B",
    grid: isDark ? "rgba(139, 148, 158, 0.16)" : "rgba(148, 163, 184, 0.2)",
    axis: isDark ? "rgba(139, 148, 158, 0.38)" : "#E2E8F0",
    tick: isDark ? "var(--admin-muted, #8B949E)" : "#94A3B8",
    cursor: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.06)",
    tooltipBg: isDark ? "rgba(22,27,34,0.98)" : "#ffffff",
    tooltipBorder: isDark ? "var(--admin-card-border, #30363D)" : "#E2E8F0",
    pillValueBg: isDark ? "rgba(148, 163, 184, 0.12)" : "#F1F5F9",
    donutStroke: isDark ? "var(--admin-elevated, #21262D)" : "#ffffff",
    barRadius: [6, 6, 0, 0],
    barRadiusH: [0, 6, 6, 0],
    accentColor: "#6366F1",
    accentSecondary: "#10B981",
    sectionAccentGradient: isDark
      ? "linear-gradient(to bottom, #818CF8, #A78BFA)"
      : "linear-gradient(to bottom, #6366F1, #8B5CF6)",
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
