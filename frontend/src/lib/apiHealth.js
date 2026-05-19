const DEGRADED_EVENT = "fs:api-infrastructure-degraded";

/**
 * Fired when the API is unreachable or returns 5xx so the UI can show a global notice
 * instead of silent empty sections or unrelated placeholder content.
 */
export function notifyApiInfrastructureDegraded() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEGRADED_EVENT));
}

export function subscribeApiInfrastructureDegraded(handler) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(DEGRADED_EVENT, handler);
  return () => window.removeEventListener(DEGRADED_EVENT, handler);
}
