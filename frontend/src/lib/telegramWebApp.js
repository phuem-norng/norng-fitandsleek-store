function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

const BRAND_HEADER_COLOR = "#4A675D";
const APP_BACKGROUND_COLOR = "#FFFFFF";

export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  const atLeast =
    typeof tg.isVersionAtLeast === "function"
      ? (v) => {
          try {
            return tg.isVersionAtLeast(v);
          } catch {
            return false;
          }
        }
      : () => false;

  try {
    tg.ready();
    tg.expand();
    // requestFullscreen exists on the SDK before it is actually supported; Bot API 8.0+ only.
    const canRequestFullscreen =
      atLeast("8.0") && typeof tg.requestFullscreen === "function";
    if (canRequestFullscreen) {
      tg.requestFullscreen();
    }
    // Theme / swipe APIs log noisy warnings on WebApp 6.0 (Telegram client); only call when supported.
    if (atLeast("7.7") && typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }
    if (atLeast("7.0")) {
      try {
        tg.setHeaderColor("secondary_bg_color");
      } catch {
        tg.setHeaderColor(BRAND_HEADER_COLOR);
      }
      tg.setBackgroundColor(APP_BACKGROUND_COLOR);
      if (typeof tg.setBottomBarColor === "function") {
        tg.setBottomBarColor(APP_BACKGROUND_COLOR);
      }
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
  const btn = tg && telegramAtLeast(tg, "6.0") ? tg.MainButton : null;
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

function telegramAtLeast(tg, version) {
  if (!tg || typeof tg.isVersionAtLeast !== "function") return false;
  try {
    return tg.isVersionAtLeast(version);
  } catch {
    return false;
  }
}

export function setupTelegramBackButton({ onClick, isVisible = true } = {}) {
  const tg = getTelegramWebApp();
  // BackButton logs console warnings on WebApp 6.0; supported from 6.1+.
  const btn = tg && telegramAtLeast(tg, "6.1") ? tg.BackButton : null;
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
