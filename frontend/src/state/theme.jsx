import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "fitandsleek_admin_theme";
const STOREFRONT_THEME_KEY = "fitandsleek_storefront_theme";

/** Brand sage — buttons, sidebar, menus, focus rings (`--admin-primary`). */
export const ADMIN_BRAND_PRIMARY = "#6E8B7E";

/** Legacy admin green — migrated to {@link ADMIN_BRAND_PRIMARY} on load. */
const LEGACY_ADMIN_PRIMARY = "#37A169";
const LEGACY_SPECTRUM_PRIMARY = "#3B82F6";
const LEGACY_SPECTRUM_PRESET_ID = "spectrum";

/** Multi-sage palette preset (theme picker + KPI accents). */
export const ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID = "light-muted-palette";

/** Named presets (matches common dashboard “theme picker” patterns). */
export const ADMIN_APPEARANCE_PRESETS = [
  { id: "default", label: "Default", color: ADMIN_BRAND_PRIMARY },
  { id: "emerald", label: "Emerald", color: "#10A37F" },
  { id: "ocean", label: "Ocean Breeze", color: "#6366F1" },
  { id: "coral", label: "Coral Sunset", color: "#F97316" },
  { id: "rose", label: "Rose", color: "#E11D48" },
  { id: "slate", label: "Slate Pro", color: "#475569" },
  { id: "violet", label: "Violet", color: "#8B5CF6" },
  /** Sage accent cycle — KPI cards, charts, and soft canvas glows. */
  {
    id: ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID,
    label: "Light Muted Palette",
    color: ADMIN_BRAND_PRIMARY,
    palette: true,
  },
];

/** Solid accent cycle for KPI cards & charts (sage + muted blue/amber for Dasher-style variety). */
export const ADMIN_SPECTRUM_COLORS = [
  "#6E8B7E",
  "#5B8DEF",
  "#7A9A8D",
  "#D4A574",
  "#9BB0A5",
  "#6B9BD1",
  "#8FA89A",
];

export const ADMIN_SPECTRUM_SWATCH =
  "linear-gradient(135deg, #6E8B7E 0%, #5B8DEF 28%, #7A9A8D 52%, #D4A574 72%, #9BB0A5 88%, #6B9BD1 100%)";

const DEFAULT_THEME = {
  mode: "light",
  primaryColor: ADMIN_BRAND_PRIMARY,
  presetId: ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID,
  scale: "default",
  radius: "md",
  contentLayout: "full",
  sidebarMode: "default",
  customCursor: true,
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

function applySpectrumPalette(html) {
  const [base, info, light, warning, mist, infoAlt, pale] = ADMIN_SPECTRUM_COLORS;
  /* Buttons, menus, links — brand sage; KPI grid cycles muted accents */
  html.style.setProperty("--admin-primary", ADMIN_BRAND_PRIMARY);
  html.style.setProperty("--admin-primary-rgb", hexToRgbString(ADMIN_BRAND_PRIMARY));
  html.style.setProperty("--admin-success", light);
  html.style.setProperty("--admin-success-rgb", hexToRgbString(light));
  html.style.setProperty("--admin-danger", "#DC2626");
  html.style.setProperty("--admin-danger-rgb", hexToRgbString("#DC2626"));
  html.style.setProperty("--admin-info", info);
  html.style.setProperty("--admin-info-rgb", hexToRgbString(info));
  html.style.setProperty("--admin-warning", warning);
  html.style.setProperty("--admin-warning-rgb", hexToRgbString(warning));
  html.style.setProperty("--admin-accent-purple", pale);
  html.style.setProperty("--admin-accent-teal", base);
  ADMIN_SPECTRUM_COLORS.forEach((hex, i) => {
    html.style.setProperty(`--admin-spectrum-${i + 1}`, hex);
    html.style.setProperty(`--admin-spectrum-${i + 1}-rgb`, hexToRgbString(hex));
  });
}

function clearSpectrumPalette(html) {
  [
    "--admin-success",
    "--admin-success-rgb",
    "--admin-danger",
    "--admin-danger-rgb",
    "--admin-info",
    "--admin-info-rgb",
    "--admin-warning",
    "--admin-warning-rgb",
    "--admin-accent-purple",
    "--admin-accent-teal",
  ].forEach((key) => html.style.removeProperty(key));
  for (let i = 1; i <= ADMIN_SPECTRUM_COLORS.length; i += 1) {
    html.style.removeProperty(`--admin-spectrum-${i}`);
    html.style.removeProperty(`--admin-spectrum-${i}-rgb`);
  }
}

function normalizePresetId(id) {
  if (id === LEGACY_SPECTRUM_PRESET_ID) return ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID;
  return id;
}

function resolveActivePresetId(primaryColor, presetIdHint) {
  const hint = normalizePresetId(presetIdHint);
  if (hint && ADMIN_APPEARANCE_PRESETS.some((p) => p.id === hint)) {
    return hint;
  }
  return presetIdForPrimaryColor(primaryColor);
}

function applyModeAndPrimary(_mode, primaryColor, presetIdHint) {
  const html = document.documentElement;
  const normalizedColor = normalizeHexColor(primaryColor);
  const activePresetId = resolveActivePresetId(normalizedColor, presetIdHint);
  const preset = ADMIN_APPEARANCE_PRESETS.find((p) => p.id === activePresetId);

  /* Never toggle `dark` on <html> — storefront shares the same document; admin uses `data-admin-theme` + Tailwind selector */
  html.classList.remove("dark");
  html.setAttribute("data-admin-preset", activePresetId);
  html.removeAttribute("data-admin-accent-mode");

  if (preset?.palette) {
    applySpectrumPalette(html);
  } else {
    clearSpectrumPalette(html);
    html.style.setProperty("--admin-primary", normalizedColor);
    html.style.setProperty("--admin-primary-rgb", hexToRgbString(normalizedColor));
  }
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
  let mode = raw.mode === "light" ? "light" : "dark";
  let primaryColor = normalizeHexColor(raw.primaryColor);
  const storedPreset = normalizePresetId(
    typeof raw.presetId === "string" ? raw.presetId : "default",
  );
  const colorUpper = primaryColor.toUpperCase();
  if (colorUpper === LEGACY_ADMIN_PRIMARY || colorUpper === LEGACY_SPECTRUM_PRIMARY) {
    primaryColor = ADMIN_BRAND_PRIMARY;
  }
  let presetId = ADMIN_APPEARANCE_PRESETS.some((p) => p.id === storedPreset)
    ? storedPreset
    : presetIdForPrimaryColor(primaryColor);
  /* Legacy “Default” preset → Light Muted Palette + light mode (Dasher-style admin UI). */
  if (storedPreset === "default" || presetId === "default") {
    presetId = ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID;
    mode = "light";
  }
  const scale = ["xs", "default", "lg"].includes(raw.scale) ? raw.scale : "default";
  const radius = ["none", "sm", "md", "lg", "xl"].includes(raw.radius) ? raw.radius : "md";
  const contentLayout = raw.contentLayout === "centered" ? "centered" : "full";
  const sidebarMode = raw.sidebarMode === "icon" ? "icon" : "default";
  const customCursor = raw.customCursor === false ? false : true;
  return {
    mode,
    primaryColor,
    presetId,
    scale,
    radius,
    contentLayout,
    sidebarMode,
    customCursor,
  };
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState(DEFAULT_THEME.mode);

  const [storefrontMode, setStorefrontMode] = useState(() => {
    try {
      const stored = localStorage.getItem(STOREFRONT_THEME_KEY);
      if (stored === "dark" || stored === "light") return stored;
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch { /* ignore */ }
    return "light";
  });

  const toggleStorefrontMode = useCallback(() => {
    setStorefrontMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(STOREFRONT_THEME_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_THEME.primaryColor);
  const [presetId, setPresetId] = useState(DEFAULT_THEME.presetId);
  const [scale, setScale] = useState(DEFAULT_THEME.scale);
  const [radius, setRadius] = useState(DEFAULT_THEME.radius);
  const [contentLayout, setContentLayout] = useState(DEFAULT_THEME.contentLayout);
  const [sidebarMode, setSidebarMode] = useState(DEFAULT_THEME.sidebarMode);
  const [customCursor, setCustomCursor] = useState(DEFAULT_THEME.customCursor);

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
        applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor, DEFAULT_THEME.presetId);
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
      setCustomCursor(parsed.customCursor);
      applyModeAndPrimary(parsed.mode, parsed.primaryColor, parsed.presetId);
      applyAdminAppearanceVars(parsed.scale, parsed.radius);
    } catch {
      applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor, DEFAULT_THEME.presetId);
      applyAdminAppearanceVars(DEFAULT_THEME.scale, DEFAULT_THEME.radius);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const derivedPreset = presetIdForPrimaryColor(primaryColor);
    const activePreset = ADMIN_APPEARANCE_PRESETS.find((p) => p.id === normalizePresetId(presetId))
      ?.palette
      ? normalizePresetId(presetId)
      : derivedPreset;
    setPresetId(activePreset);
    applyModeAndPrimary(mode, primaryColor, activePreset);
    applyAdminAppearanceVars(scale, radius);
    persist({
      mode,
      primaryColor,
      presetId: activePreset,
      scale,
      radius,
      contentLayout,
      sidebarMode,
      customCursor,
    });
  }, [
    hydrated,
    mode,
    primaryColor,
    presetId,
    scale,
    radius,
    contentLayout,
    sidebarMode,
    customCursor,
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
    setPresetId(p.id);
    setPrimaryColor(p.color);
    applyModeAndPrimary(mode, p.color, p.id);
  }, [mode]);

  const resetAdminAppearance = useCallback(() => {
    setMode(DEFAULT_THEME.mode);
    setPrimaryColor(DEFAULT_THEME.primaryColor);
    setPresetId(DEFAULT_THEME.presetId);
    setScale(DEFAULT_THEME.scale);
    setRadius(DEFAULT_THEME.radius);
    setContentLayout(DEFAULT_THEME.contentLayout);
    setSidebarMode(DEFAULT_THEME.sidebarMode);
    setCustomCursor(DEFAULT_THEME.customCursor);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    applyModeAndPrimary(DEFAULT_THEME.mode, DEFAULT_THEME.primaryColor, DEFAULT_THEME.presetId);
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
      customCursor,
      setMode,
      setPrimaryColor,
      setPreset,
      setScale,
      setRadius,
      setContentLayout,
      setSidebarMode,
      setCustomCursor,
      saveTheme,
      resetAdminAppearance,
      normalizeHexColor,
      storefrontMode,
      toggleStorefrontMode,
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
      customCursor,
      setPreset,
      saveTheme,
      resetAdminAppearance,
      storefrontMode,
      toggleStorefrontMode,
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
