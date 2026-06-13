import React from "react";
import { ADMIN_APPEARANCE_PRESETS, ADMIN_SPECTRUM_SWATCH, useTheme } from "../../state/theme.jsx";
import { useLanguage } from "../../lib/i18n.jsx";
import { useAdminUiPreference } from "../../lib/adminUiPreferences.js";
import { ADMIN_NUMBER_FORMAT } from "../../lib/adminNumberFormat.js";

const CUSTOM_VALUE = "__custom_accent__";

function Segmented({ label, value, options, onChange }) {
  return (
    <fieldset className="space-y-1.5 border-0 p-0 m-0">
      <legend className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </legend>
      <div
        className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/80 dark:bg-slate-900"
        role="group"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 min-h-[34px] px-1.5 text-[11px] font-semibold rounded-md transition-colors ${active
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              title={opt.title}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Dashboard “appearance” controls (theme preset, density, radius, layout).
 * Rendered inside the top bar palette dropdown.
 */
export default function AdminAppearancePanel() {
  const { t } = useLanguage();
  const {
    mode,
    primaryColor,
    presetId,
    scale,
    radius,
    contentLayout,
    sidebarMode,
    setPreset,
    setScale,
    setRadius,
    setContentLayout,
    setSidebarMode,
    saveTheme,
    resetAdminAppearance,
  } = useTheme();
  const [numberFormat, setNumberFormat] = useAdminUiPreference(
    "dashboard.numberFormat",
    ADMIN_NUMBER_FORMAT.COMPACT
  );

  const selectValue = presetId === "custom" ? CUSTOM_VALUE : presetId;
  const currentPreset = ADMIN_APPEARANCE_PRESETS.find((p) => p.id === presetId);

  return (
    <div className="w-[min(calc(100vw-2rem),18rem)] p-3.5 space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="admin-theme-preset"
          className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Theme preset
        </label>
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 shrink-0 rounded-full border border-slate-200 dark:border-slate-600 shadow-inner"
            style={
              currentPreset?.palette
                ? { background: ADMIN_SPECTRUM_SWATCH }
                : {
                    backgroundColor:
                      currentPreset?.color || primaryColor || "var(--admin-primary)",
                  }
            }
            aria-hidden
          />
          <select
            id="admin-theme-preset"
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM_VALUE) return;
              setPreset(v);
            }}
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[rgba(var(--admin-primary-rgb),0.35)]"
          >
            {presetId === "custom" && (
              <option value={CUSTOM_VALUE}>Custom (from Settings)</option>
            )}
            {ADMIN_APPEARANCE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Segmented
        label={t("adminNumberFormat")}
        value={numberFormat}
        onChange={setNumberFormat}
        options={[
          {
            value: ADMIN_NUMBER_FORMAT.FULL,
            label: t("adminNumberFormatFull"),
            title: "Always show full values",
          },
          {
            value: ADMIN_NUMBER_FORMAT.COMPACT,
            label: t("adminNumberFormatCompact"),
            title: "Use compact format (K, M, B)",
          },
        ]}
      />

      <Segmented
        label="Scale"
        value={scale}
        onChange={setScale}
        options={[
          { value: "default", label: "⊘", title: "Default scale" },
          { value: "xs", label: "XS", title: "Compact" },
          { value: "lg", label: "LG", title: "Large" },
        ]}
      />

      <Segmented
        label="Radius"
        value={radius}
        onChange={setRadius}
        options={[
          { value: "none", label: "⊘", title: "Minimal" },
          { value: "sm", label: "SM", title: "Small" },
          { value: "md", label: "MD", title: "Medium" },
          { value: "lg", label: "LG", title: "Large" },
          { value: "xl", label: "XL", title: "Extra large" },
        ]}
      />

      <Segmented
        label="Color mode"
        value={mode}
        onChange={(next) => saveTheme(next, primaryColor)}
        options={[
          { value: "light", label: "Light", title: "Light" },
          { value: "dark", label: "Dark", title: "Dark" },
        ]}
      />

      <Segmented
        label="Content layout"
        value={contentLayout}
        onChange={setContentLayout}
        options={[
          { value: "full", label: "Full", title: "Full width content" },
          { value: "centered", label: "Centered", title: "Centered container" },
        ]}
      />

      <Segmented
        label="Sidebar mode"
        value={sidebarMode}
        onChange={setSidebarMode}
        options={[
          { value: "default", label: "Default", title: "Labels + icons" },
          { value: "icon", label: "Icon", title: "Icons only (narrow rail)" },
        ]}
      />

      <button
        type="button"
        onClick={resetAdminAppearance}
        className="w-full h-10 rounded-lg text-xs font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
        style={{ backgroundColor: "var(--admin-primary)" }}
      >
        Reset to default
      </button>
    </div>
  );
}
