import { useCallback, useMemo } from "react";
import {
  ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID,
  ADMIN_SPECTRUM_COLORS,
  useTheme,
} from "../state/theme.jsx";

export function spectrumHexToRgb(hex) {
  const h = String(hex || "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/i.test(h)) return "110, 139, 126";
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

/** Shared Light Muted Palette / primary accent helpers for admin KPIs and charts. */
export function useAdminAccents() {
  const { presetId, primaryColor } = useTheme();
  const isSpectrum = presetId === ADMIN_LIGHT_MUTED_PALETTE_PRESET_ID;

  const accentAt = useCallback(
    (index = 0) => {
      if (!isSpectrum) return primaryColor;
      const n = ADMIN_SPECTRUM_COLORS.length;
      return ADMIN_SPECTRUM_COLORS[((index % n) + n) % n];
    },
    [isSpectrum, primaryColor],
  );

  const iconBoxStyle = useCallback(
    (index = 0) => {
      if (!isSpectrum) {
        return {
          backgroundColor: "rgba(var(--admin-primary-rgb), 0.14)",
          color: "var(--admin-primary)",
        };
      }
      const hex = accentAt(index);
      return {
        backgroundColor: `rgba(${spectrumHexToRgb(hex)}, 0.14)`,
        color: hex,
      };
    },
    [isSpectrum, accentAt],
  );

  const barFill = useCallback(
    (index = 0) => (isSpectrum ? accentAt(index) : null),
    [isSpectrum, accentAt],
  );

  const colors = useMemo(() => (isSpectrum ? ADMIN_SPECTRUM_COLORS : [primaryColor]), [isSpectrum, primaryColor]);

  return { isSpectrum, primaryColor, presetId, accentAt, iconBoxStyle, barFill, colors };
}
