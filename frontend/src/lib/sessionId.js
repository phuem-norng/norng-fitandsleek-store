const SESSION_KEY = "fitandsleek_session_id";

function randomToken(length = 20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `sess_${Date.now()}_${randomToken(16)}`;
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return `sess_memory_${randomToken(16)}`;
  }
}

