function sessionFingerprint(session) {
  const browser = String(session?.browser || "").trim().toLowerCase();
  const os = String(session?.os || "").trim().toLowerCase();
  const name = String(session?.device_name || "").trim().toLowerCase();
  if (browser && os && name) {
    return `fp:${browser}|${os}|${name}`;
  }

  const deviceId = String(session?.device_id || "")
    .trim()
    .replace(/_hist_[a-f0-9]+$/i, "");
  if (deviceId) return `id:${deviceId}`;

  return `row:${session?.id ?? "unknown"}`;
}

function sessionSortTime(session) {
  const value = session?.last_used_at || session?.last_login_at || session?.created_at || "";
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

/** Group active sessions by physical device; newest first in each group. */
export function groupTrustedDeviceSessions(sessions = []) {
  const groups = new Map();

  for (const session of sessions) {
    const key = sessionFingerprint(session);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(session);
  }

  return Array.from(groups.values())
    .map((items) => {
      const sorted = [...items].sort((a, b) => sessionSortTime(b) - sessionSortTime(a));
      const primary = sorted.find((s) => s.is_current) || sorted.find((s) => s.is_active) || sorted[0];
      const others = sorted.filter((s) => s.id !== primary.id);
      return { key: sessionFingerprint(primary), primary, others, total: sorted.length };
    })
    .sort((a, b) => sessionSortTime(b.primary) - sessionSortTime(a.primary));
}
