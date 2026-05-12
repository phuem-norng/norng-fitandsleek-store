function parseOrigin(input) {
    try {
        return new URL(input);
    } catch {
        return null;
    }
}

function getConfiguredValues() {
    return {
        backendOrigin: import.meta.env.VITE_BACKEND_ORIGIN,
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    };
}

function currentOriginFallback() {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "http://127.0.0.1:8000";
}

function normalizeConfiguredOrigin() {
    const { backendOrigin, apiBaseUrl } = getConfiguredValues();
    const primary = typeof backendOrigin === "string" ? backendOrigin.trim() : "";
    const secondary = typeof apiBaseUrl === "string" ? apiBaseUrl.trim() : "";
    const configured = primary || secondary || currentOriginFallback();

    if (configured.startsWith("/")) {
        return currentOriginFallback();
    }

    const parsed = parseOrigin(configured);
    if (!parsed) {
        return currentOriginFallback();
    }

    return `${parsed.protocol}//${parsed.host}`;
}

export function resolveBackendOrigin() {
    const configuredOrigin = normalizeConfiguredOrigin();
    return configuredOrigin;
}

export function resolveApiBaseUrl() {
    const { apiBaseUrl } = getConfiguredValues();
    const trimmed = typeof apiBaseUrl === "string" ? apiBaseUrl.trim() : "";

    if (trimmed.startsWith("/")) {
        return trimmed;
    }

    const base = `${resolveBackendOrigin()}/api`;

    if (import.meta.env.DEV && typeof window !== "undefined") {
        try {
            const pageOrigin = window.location.origin;
            const apiOrigin = new URL(base).origin;
            if (pageOrigin !== apiOrigin) {
                const isLocalPage =
                    window.location.hostname === "localhost" ||
                    window.location.hostname === "127.0.0.1";
                if (isLocalPage) {
                    console.warn(
                        "[Fit&Sleek] API is cross-origin from this page; the browser may block requests (CORS). " +
                            "For local dev, use same-origin API: set VITE_API_BASE_URL=/api and VITE_PROXY_TARGET=<Laravel base URL> in frontend/.env, then restart `npm run dev`. " +
                            "See frontend/.env.example.",
                    );
                }
            }
        } catch {
            /* ignore */
        }
    }

    return base;
}
