import api from "./api.js";

/** Throttle badge polls so HMR/remounts do not spam the console when the API is down. */
let lastAttemptAt = 0;
const MIN_ATTEMPT_MS = 30_000;

/**
 * @returns {Promise<{ orders: number, messages: number } | null>}
 */
export async function fetchAdminNavBadges() {
  const now = Date.now();
  if (now - lastAttemptAt < MIN_ATTEMPT_MS) {
    return null;
  }
  lastAttemptAt = now;

  try {
    const { data } = await api.get("/admin/nav-badges");
    return {
      orders: Number(data?.orders) || 0,
      messages: Number(data?.messages) || 0,
    };
  } catch {
    return null;
  }
}
