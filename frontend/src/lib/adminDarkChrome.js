/**
 * True when the admin dashboard is in dark appearance (matches Tailwind scope +
 * `AdminHtmlThemeSync` on `<html>`).
 */
export function isAdminDarkChrome() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.classList.contains("admin-dashboard") && root.getAttribute("data-admin-theme") === "dark";
}

export function isAdminDashboard() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("admin-dashboard");
}

let adminModalChromeDepth = 0;

function applyAdminModalChrome(active) {
  if (!isAdminDashboard()) return;
  const root = document.documentElement;
  const body = document.body;
  if (active) {
    root.setAttribute("data-admin-modal", "");
    body.classList.add("modal-open");
    root.classList.add("modal-open");
  } else {
    root.removeAttribute("data-admin-modal");
    body.classList.remove("modal-open");
    root.classList.remove("modal-open");
  }
}

/** Dim sidebar + lock scroll while an admin modal/dialog is open (ref-counted). */
export function pushAdminModalChrome() {
  if (!isAdminDashboard()) return;
  adminModalChromeDepth += 1;
  if (adminModalChromeDepth === 1) applyAdminModalChrome(true);
}

export function popAdminModalChrome() {
  if (!isAdminDashboard()) return;
  adminModalChromeDepth = Math.max(0, adminModalChromeDepth - 1);
  if (adminModalChromeDepth === 0) applyAdminModalChrome(false);
}
