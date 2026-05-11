function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

const BRAND_HEADER_COLOR = "#4A675D";
const APP_BACKGROUND_COLOR = "#FFFFFF";

export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
    // requestFullscreen exists on the SDK before it is actually supported; Bot API 8.0+ only.
    const canRequestFullscreen =
      typeof tg.isVersionAtLeast === "function" &&
      tg.isVersionAtLeast("8.0") &&
      typeof tg.requestFullscreen === "function";
    if (canRequestFullscreen) {
      tg.requestFullscreen();
    }
    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }
    const version = Number.parseFloat(tg.version || "0");
    if (Number.isFinite(version) && version >= 6.9) {
      tg.setHeaderColor("secondary_bg_color");
    } else {
      tg.setHeaderColor(BRAND_HEADER_COLOR);
    }
    tg.setBackgroundColor(APP_BACKGROUND_COLOR);
    if (typeof tg.setBottomBarColor === "function") {
      tg.setBottomBarColor(APP_BACKGROUND_COLOR);
    }
  } catch {
    // Prevent Telegram-specific runtime errors from breaking the app.
  }
}

export function isTelegramWebApp() {
  return Boolean(getTelegramWebApp());
}

export function triggerTelegramHaptic(type = "impact", style = "light") {
  const tg = getTelegramWebApp();
  if (!tg?.HapticFeedback) return;

  try {
    if (type === "notification") {
      tg.HapticFeedback.notificationOccurred(style);
      return;
    }

    tg.HapticFeedback.impactOccurred(style);
  } catch {
    // Ignore unsupported haptic calls on non-Telegram browsers.
  }
}

export function setupTelegramMainButton({
  text,
  onClick,
  color,
  textColor,
  isVisible = true,
  isEnabled = true,
  showProgress = false,
} = {}) {
  const tg = getTelegramWebApp();
  const btn = tg?.MainButton;
  if (!btn) return () => {};

  try {
    if (typeof text === "string" && text.trim()) btn.setText(text);
    if (typeof color === "string" && color.trim()) btn.color = color;
    if (typeof textColor === "string" && textColor.trim()) btn.textColor = textColor;

    if (isEnabled) btn.enable();
    else btn.disable();

    if (showProgress) btn.showProgress(false);
    else btn.hideProgress();

    if (isVisible) btn.show();
    else btn.hide();

    if (typeof onClick === "function") btn.onClick(onClick);
  } catch {
    // Ignore if Telegram client version does not support all operations.
  }

  return () => {
    try {
      if (typeof onClick === "function") btn.offClick(onClick);
      btn.hideProgress();
      btn.hide();
    } catch {
      // Ignore cleanup errors on unsupported clients.
    }
  };
}

export function setupTelegramBackButton({ onClick, isVisible = true } = {}) {
  const tg = getTelegramWebApp();
  const btn = tg?.BackButton;
  if (!btn) return () => {};

  try {
    if (isVisible) btn.show();
    else btn.hide();
    if (typeof onClick === "function") btn.onClick(onClick);
  } catch {
    // Ignore if Telegram client version does not support all operations.
  }

  return () => {
    try {
      if (typeof onClick === "function") btn.offClick(onClick);
      btn.hide();
    } catch {
      // Ignore cleanup errors on unsupported clients.
    }
  };
}
