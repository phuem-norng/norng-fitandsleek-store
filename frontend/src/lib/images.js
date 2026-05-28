import { resolveBackendOrigin, shouldRewriteLoopbackAssetsToPageOrigin } from "./backendOrigin";

/** When set (e.g. production API origin), `/storage/...` URLs use this host so images work with an empty local `storage/app/public`. */
const storageMediaOrigin = (import.meta.env.VITE_STORAGE_MEDIA_ORIGIN || "")
  .trim()
  .replace(/\/$/, "");

/** True when the SPA proxies `/api` and `/storage` to Laravel (same-origin `VITE_API_BASE_URL=/api`). */
function devSpaUsesViteProxy() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return String(import.meta.env.VITE_API_BASE_URL || "").trim().startsWith("/");
}

/**
 * In Vite dev with `/api` proxy, `/storage` is proxied on the same host:port as the SPA.
 * Use the page origin so images work on a phone/tablet (LAN IP) — not `127.0.0.1` on the device.
 */
function storageServingOrigin() {
  if (typeof window !== "undefined" && import.meta.env.DEV && devSpaUsesViteProxy()) {
    return window.location.origin;
  }
  // In production, never fall back to Vite dev proxy target (often localhost/127.0.0.1).
  if (import.meta.env.PROD) {
    return resolveBackendOrigin();
  }

  const raw = (import.meta.env.VITE_PROXY_TARGET || "http://127.0.0.1:8001").trim().replace(/\/$/, "");
  if (raw && !raw.startsWith("/")) {
    try {
      return new URL(raw).origin;
    } catch {
      /* fall through */
    }
  }
  return resolveBackendOrigin();
}

/** Public disk URLs live under `/storage` (with or without a trailing slash in odd inputs). */
function pathRefersToPublicStorage(pathnameOrPath) {
  const p = String(pathnameOrPath || "");
  if (p === "/storage" || p.startsWith("/storage/")) return true;
  return p.includes("/storage/");
}

function originForStoragePath(path) {
  const p = String(path || "");
  const isStorage = pathRefersToPublicStorage(p);
  if (storageMediaOrigin && isStorage) return storageMediaOrigin;
  if (isStorage) return storageServingOrigin();
  return resolveBackendOrigin();
}

/**
 * API layer may rewrite `http://127.0.0.1:8001/storage/...` to the SPA origin so
 * `<img src>` hits Vite's `/storage` proxy. If that proxy fails, point storage at Laravel.
 */
function loopbackEquivalent(hostnameA, hostnameB) {
  const loop = (h) => {
    const x = (h || "").toLowerCase();
    return x === "localhost" || x === "127.0.0.1" || x === "[::1]";
  };
  return loop(hostnameA) && loop(hostnameB);
}

/** True when this URL is the SPA dev server (e.g. :5173) — `/storage` here must go to Laravel, not stay on Vite. */
function spaDevOriginMatchesUrl(parsed) {
  if (typeof window === "undefined" || !import.meta.env.DEV || !devSpaUsesViteProxy()) return false;
  if (String(parsed.port || "") !== String(window.location.port || "")) return false;
  return (
    parsed.hostname === window.location.hostname ||
    loopbackEquivalent(parsed.hostname, window.location.hostname)
  );
}

/** Prefer Laravel's own origin for `/storage` on loopback / LAN when APP_URL port differs from Vite proxy default (e.g. Docker :8001). */
function useParsedOriginForStorage(parsed) {
  const host = (parsed.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  return (
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function rewriteViteDevStorageUrl(urlString) {
  if (typeof window === "undefined" || !import.meta.env.DEV || !devSpaUsesViteProxy()) return null;
  try {
    const u = new URL(urlString);
    if (!pathRefersToPublicStorage(u.pathname)) return null;
    if (String(u.port || "") !== String(window.location.port || "")) return null;
    if (!(u.hostname === window.location.hostname || loopbackEquivalent(u.hostname, window.location.hostname))) {
      return null;
    }
    const target = new URL(
      (import.meta.env.VITE_PROXY_TARGET || "http://127.0.0.1:8001").trim()
    ).origin;
    return `${target}${u.pathname}${u.search || ""}`;
  } catch {
    return null;
  }
}

const normalizePort = (url) => url;

const hasFileExtension = (value) =>
  /\.(png|jpe?g|webp|gif|avif|svg|mp4|webm|ogg)$/i.test(String(value || ""));

const shouldRewritePrivateHost = (urlString) => {
  try {
    const parsed = new URL(urlString);
    const host = (parsed.hostname || "").toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "host.docker.internal" ||
      host === "backend" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
};

function upgradeStorageUrlToPageProtocol(urlString) {
  if (typeof window === "undefined" || window.location?.protocol !== "https:") return null;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" || !pathRefersToPublicStorage(parsed.pathname)) return null;
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return "/placeholder.svg";

  const sanitizedUrl = normalizePort(imageUrl);

  try {
    const t = String(sanitizedUrl).trim();
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      const pn = (u.pathname || "").replace(/\/+$/, "") || "/";
      if (pn === "/" && !u.search) {
        return "/placeholder.svg";
      }
    }
  } catch {
    /* ignore */
  }

  const viteStorage = rewriteViteDevStorageUrl(sanitizedUrl);
  if (viteStorage) return viteStorage;

  // Handle base64 data URIs (e.g., data:image/jpeg;base64,...)
  if (/^data:/i.test(sanitizedUrl)) return sanitizedUrl;

  // Rewrite private / dev URLs so thumbnails work on LAN and Docker (gallery often uses APP_URL, e.g. :8001).
  if (shouldRewritePrivateHost(sanitizedUrl)) {
    try {
      const parsed = new URL(sanitizedUrl);
      const path = parsed.pathname || "/";
      if (shouldRewriteLoopbackAssetsToPageOrigin()) {
        return `${window.location.origin}${path}${parsed.search || ""}`;
      }
      const isStorage = pathRefersToPublicStorage(path);
      let origin;
      if (isStorage && import.meta.env.DEV && devSpaUsesViteProxy() && typeof window !== "undefined") {
        origin = window.location.origin;
      } else if (isStorage && spaDevOriginMatchesUrl(parsed)) {
        origin = storageServingOrigin();
      } else if (isStorage && useParsedOriginForStorage(parsed)) {
        origin = parsed.origin;
      } else {
        origin = originForStoragePath(path);
      }
      return `${origin}${path}${parsed.search || ""}`;
    } catch {
      return sanitizedUrl;
    }
  }

  // Handle external URLs, avoiding mixed content for public storage assets.
  if (/^https?:\/\//i.test(sanitizedUrl)) {
    return upgradeStorageUrlToPageProtocol(sanitizedUrl) || sanitizedUrl;
  }

  // Handle filename-only values from API (e.g. "abc123.png").
  if (!sanitizedUrl.includes("/") && hasFileExtension(sanitizedUrl)) {
    const path = `/storage/banners/${sanitizedUrl}`;
    return `${originForStoragePath(path)}${path}`;
  }

  // common patterns: /storage/.., storage/.., public/storage/..
  const cleaned = sanitizedUrl.startsWith("/") ? sanitizedUrl : `/${sanitizedUrl}`;
  const normalized = cleaned.replace(/^\/+public(?=\/storage\/)/, "");
  const origin = originForStoragePath(normalized);
  return `${origin}${normalized}`;
}
