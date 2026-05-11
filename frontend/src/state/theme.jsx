import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "fitandsleek_admin_theme";

/** Named presets (matches common dashboard “theme picker” patterns). */
export const ADMIN_APPEARANCE_PRESETS = [
  { id: "default", label: "Default", color: "#6B7E73" },
  { id: "emerald", label: "Emerald", color: "#10A37F" },
  { id: "ocean", label: "Ocean Breeze", color: "#6366F1" },
  { id: "coral", label: "Coral Sunset", color: "#F97316" },
  { id: "rose", label: "Rose", color: "#E11D48" },
  { id: "slate", label: "Slate Pro", color: "#475569" },
  { id: "violet", label: "Violet", color: "#8B5CF6" },
];

const DEFAULT_THEME = {
  mode: "dark",
  primaryColor: "#6B7E73",
  presetId: "default",
  scale: "default",
  radius: "md",
  contentLayout: "full",
  sidebarMode: "default",
};

function normalizeHexColor(value) {
  if (!value) return DEFAULT_THEME.primaryColor;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    const expanded = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  return DEFAULT_THEME.primaryColor;
}

function hexToRgbString(hex) {
  const clean = normalizeHexColor(hex).replace("#", "");
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

/** Preset key for a hex color, or "custom" when it does not match a named preset. */
export function presetIdForPrimaryColor(hex) {
  const n = normalizeHexColor(hex);
  const hit = ADMIN_APPEARANCE_PRESETS.find((p) => p.color.toUpperCase() === n.toUpperCase());
  return hit?.id ?? "custom";
}

const RADIUS_PX = {
  none: "2px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

const SCALE_MULT = {
  xs: 0.875,
  default: 1,
  lg: 1.125,
};

function applyModeAndPrimary(mode, primaryColor) {
  const html = document.documentElement;
  const normalizedMode = mode === "dark" ? "dark" : "light";
  const normalizedColor = normalizeHexColor(primaryColor);
  html.classList.toggle("dark", normalizedMode === "dark");
  html.style.setProperty("--admin-primary", normalizedColor);
  html.style.setProperty("--admin-primary-rgb", hexToRgbString(normalizedColor));
}

/** Updates CSS variables used by `html.admin-dashboard` typography + radius. */
export function applyAdminAppearanceVars(scale, radius) {
  const html = document.documentElement;
  const r = RADIUS_PX[radius] || RADIUS_PX.md;
  const mult = SCALE_MULT[scale] ?? 1;

  html.style.setProperty("--admin-ui-radius", r);
  html.style.setProperty("--admin-font-body", `${mult}rem`);
  html.style.setProperty("--admin-font-page", `${1.375 * mult}rem`);
  html.style.setProperty("--admin-font-section", `${1.125 * mult}rem`);
  html.style.setProperty("--admin-font-subsection", `${1 * mult}rem`);
  html.style.setProperty("--admin-font-compact", `${0.875 * mult}rem`);
  html.style.setProperty("--fs-radius-sm", r);
  html.style.setProperty("--fs-radius-md", r);
  html.style.setProperty("--fs-radius-lg", r);
}

function normalizeStored(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME };
  const mode = raw.mode === "light" ? "light" : "dark";
  const primaryColor = normalizeHexColor(raw.primaryColor);
  const presetId = presetIdForPrimaryColor(primaryColor);
  const scale = ["xs", "default", "lg"].includes(raw.scale) ? raw.scale : "default";
  const radius = ["none", "sm", "md", "lg", "xl"].includes(raw.radius) ? raw.radius : "md";
  const contentLayout = raw.contentLayout === "centered" ? "centered" : "full";
  const sidebarMode = raw.sidebarMode === "icon" ? "icon" : "default";
  return {
    mode,
    primaryColor,
    presetId,
    scale,
    radius,
    contentLayout,
    sidebarMode,
  };
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState(DEFAULT_THEME.mode);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_THEME.primaryColor);
  const [presetId, setPresetId] = useState(DEFAULT_THEME.presetId);
  const [scale, setScale] = useState(DEFAULT_THEME.scale);
  const [radius, setRadius] = useState(DEFAULT_THEME.radius);
  const [contentLayout, setContentLayout] = useState(DEFAULT_THEME.contentLayout);
  const [sidebarMode, setSidebarMode] = useState(DEFAULT_THEME.sidebarMode);

  const persist = useCallback((next) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const storedRaw = localStorage.getItem(THEME_STORAGE_KEY);
      if (!storedRaw) {
        applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor);
        applyAdminAppearanceVars(DEFAULT_THEME.scale, DEFAULT_THEME.radius);
        setHydrated(true);
        return;
      }
      const parsed = normalizeStored(JSON.parse(storedRaw));
      setMode(parsed.mode);
      setPrimaryColor(parsed.primaryColor);
      setPresetId(parsed.presetId);
      setScale(parsed.scale);
      setRadius(parsed.radius);
      setContentLayout(parsed.contentLayout);
      setSidebarMode(parsed.sidebarMode);
      applyModeAndPrimary(parsed.mode, parsed.primaryColor);
      applyAdminAppearanceVars(parsed.scale, parsed.radius);
    } catch {
      applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor);
      applyAdminAppearanceVars(DEFAULT_THEME.scale, DEFAULT_THEME.radius);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const derivedPreset = presetIdForPrimaryColor(primaryColor);
    setPresetId(derivedPreset);
    applyModeAndPrimary(mode, primaryColor);
    applyAdminAppearanceVars(scale, radius);
    persist({
      mode,
      primaryColor,
      presetId: derivedPreset,
      scale,
      radius,
      contentLayout,
      sidebarMode,
    });
  }, [
    hydrated,
    mode,
    primaryColor,
    scale,
    radius,
    contentLayout,
    sidebarMode,
    persist,
  ]);

  const saveTheme = useCallback((nextMode, nextColor) => {
    const modeToSave = nextMode === "dark" ? "dark" : "light";
    const colorToSave = normalizeHexColor(nextColor);
    setMode(modeToSave);
    setPrimaryColor(colorToSave);
  }, []);

  const setPreset = useCallback((id) => {
    const p = ADMIN_APPEARANCE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPrimaryColor(p.color);
  }, []);

  const resetAdminAppearance = useCallback(() => {
    setMode(DEFAULT_THEME.mode);
    setPrimaryColor(DEFAULT_THEME.primaryColor);
    setPresetId(DEFAULT_THEME.presetId);
    setScale(DEFAULT_THEME.scale);
    setRadius(DEFAULT_THEME.radius);
    setContentLayout(DEFAULT_THEME.contentLayout);
    setSidebarMode(DEFAULT_THEME.sidebarMode);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor);
    applyAdminAppearanceVars(DEFAULT_THEME.scale, DEFAULT_THEME.radius);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      mode,
      primaryColor,
      presetId,
      scale,
      radius,
      contentLayout,
      sidebarMode,
      setMode,
      setPrimaryColor,
      setPreset,
      setScale,
      setRadius,
      setContentLayout,
      setSidebarMode,
      saveTheme,
      resetAdminAppearance,
      normalizeHexColor,
    }),
    [
      hydrated,
      mode,
      primaryColor,
      presetId,
      scale,
      radius,
      contentLayout,
      sidebarMode,
      setPreset,
      saveTheme,
      resetAdminAppearance,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
