import axios from "axios";
import { notifyApiInfrastructureDegraded } from "./apiHealth";
import { getDeviceHeaders } from "./device";
import { resolveApiBaseUrl, shouldRewriteLoopbackAssetsToPageOrigin } from "./backendOrigin";

const baseURL = resolveApiBaseUrl();
const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "fs_token";

const api = axios.create({
  baseURL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true, // Allow cookies for CSRF
});

const localAssetPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|backend|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?(\/.*)?$/i;

/** Only rewrite known media fields (faster than walking every string in large admin lists). */
const ASSET_URL_KEYS = new Set([
  "image_url",
  "logo_url",
  "logo_path",
  "profile_image_url",
  "profile_image_path",
  "image_path",
  "promo_image_path",
  "media_url",
  "image",
  "logo",
  "gallery",
  "images",
  "fallback_image",
]);

const rewriteLocalhostString = (value) => {
  if (typeof window === "undefined" || !window.location?.origin) return value;
  const match = value.match(localAssetPattern);
  if (!match) return value;
  const path = match[3] || "";
  const isStorage = path === "/storage" || path.startsWith("/storage/");
  if (isStorage && !shouldRewriteLoopbackAssetsToPageOrigin()) {
    return value;
  }
  return `${window.location.origin}${path}`;
};

const rewriteLocalhostUrls = (value, depth = 0) => {
  if (depth > 14) return value;

  if (typeof value === "string") {
    return rewriteLocalhostString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteLocalhostUrls(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      if (typeof item === "string" && ASSET_URL_KEYS.has(key) && localAssetPattern.test(item)) {
        next[key] = rewriteLocalhostString(item);
      } else {
        next[key] = rewriteLocalhostUrls(item, depth + 1);
      }
    });
    return next;
  }

  return value;
};

let cachedApiBaseUrl = baseURL;
let cachedCsrfToken = null;

// Get CSRF token from meta tag
const getCsrfToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : null;
};

// Attach Bearer token to requests
api.interceptors.request.use((config) => {
  cachedApiBaseUrl = resolveApiBaseUrl();
  config.baseURL = cachedApiBaseUrl;

  // Default `Content-Type: application/json` breaks multipart file uploads (Laravel never sees the file).
  if (typeof FormData !== "undefined" && config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
    delete config.headers["content-type"];
  }

  const isNgrokBase = typeof config.baseURL === "string" && config.baseURL.includes("ngrok-free.");
  const isNgrokHost =
    typeof window !== "undefined" &&
    typeof window.location?.host === "string" &&
    window.location.host.includes("ngrok-free.");

  if (isNgrokBase || isNgrokHost) {
    config.headers["ngrok-skip-browser-warning"] = "true";
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add CSRF token if available
  if (cachedCsrfToken === null) {
    cachedCsrfToken = getCsrfToken() || "";
  }
  if (cachedCsrfToken) {
    config.headers["X-CSRF-TOKEN"] = cachedCsrfToken;
  }

  const deviceHeaders = getDeviceHeaders();
  Object.entries(deviceHeaders).forEach(([key, value]) => {
    config.headers[key] = value;
  });

  return config;
});

const looksLikeHtmlApiResponse = (data) => {
  if (typeof data !== "string") return false;
  const head = data.slice(0, 256).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
};

const isBinaryApiResponse = (response) => {
  const type = response.config?.responseType;
  if (type === "blob" || type === "arraybuffer") return true;
  const data = response.data;
  return typeof Blob !== "undefined" && data instanceof Blob;
};

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => {
    if (isBinaryApiResponse(response)) {
      return response;
    }
    if (looksLikeHtmlApiResponse(response.data)) {
      notifyApiInfrastructureDegraded();
      return Promise.reject(
        new Error("API returned HTML instead of JSON — check API host / tunnel routing."),
      );
    }
    response.data = rewriteLocalhostUrls(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Clear invalid token and redirect to login
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login";
    }

    const status = error.response?.status;
    const noResponse = !error.response;
    const infrastructureDown =
      noResponse ||
      error.code === "ECONNABORTED" ||
      (typeof status === "number" && status >= 500 && status < 600);
    if (infrastructureDown) {
      notifyApiInfrastructureDegraded();
    }

    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
export default api;

