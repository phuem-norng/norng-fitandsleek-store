import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TOKEN_KEY } from "../../state/auth.jsx";
import { resolveBackendOrigin } from "../../lib/backendOrigin";

function alternateLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost") {
      return `${parsed.protocol}//127.0.0.1${parsed.port ? `:${parsed.port}` : ""}`;
    }
    if (parsed.hostname === "127.0.0.1") {
      return `${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ""}`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function OAuthCallback() {
  const nav = useNavigate();
  const { ticket } = useParams();
  const [message, setMessage] = useState("Signing you in...");
  const [showRetry, setShowRetry] = useState(false);
  const [showDirectHome, setShowDirectHome] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishWithToken = (token) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem("oauth_provider");
      window.location.replace("/");
    };

    const fail = (text) => {
      setMessage(text || "Social login failed. Please try again.");
      setShowRetry(true);
      // Show option to go to home after a delay (in case user wants to debug)
      setTimeout(() => {
        if (!cancelled) setShowDirectHome(true);
      }, 3000);
      setTimeout(() => {
        if (!cancelled) nav("/login");
      }, 1500);
    };

    const run = async () => {
      const origin = resolveBackendOrigin();
      const alternateOrigin = alternateLoopbackOrigin(origin);

      const query = new URLSearchParams(window.location.search);
      const directToken = query.get("token");
      if (directToken) {
        finishWithToken(directToken);
        return;
      }

      const hash = window.location.hash?.startsWith("#")
        ? new URLSearchParams(window.location.hash.slice(1))
        : new URLSearchParams();

      const resolvedTicket =
        ticket ||
        query.get("ticket") ||
        hash.get("ticket") ||
        hash.get("oauth_ticket") ||
        null;

      if (resolvedTicket) {
        const doneKey = `oauth_ticket_done:${resolvedTicket}`;
        const lockKey = `oauth_ticket_lock:${resolvedTicket}`;
        const existingToken = localStorage.getItem(TOKEN_KEY);

        if (sessionStorage.getItem(doneKey) === "1" && existingToken) {
          finishWithToken(existingToken);
          return;
        }

        if (sessionStorage.getItem(lockKey) === "1") {
          if (existingToken) {
            finishWithToken(existingToken);
            return;
          }

          setMessage("Finalizing sign-in...");
          let attempts = 0;
          const maxAttempts = 30;
          const timer = window.setInterval(() => {
            const tokenFromStorage = localStorage.getItem(TOKEN_KEY);
            if (tokenFromStorage) {
              window.clearInterval(timer);
              finishWithToken(tokenFromStorage);
              return;
            }

            attempts += 1;
            if (attempts >= maxAttempts) {
              window.clearInterval(timer);
              fail("Social login is taking too long. Please try again.");
            }
          }, 100);
          return;
        }

        sessionStorage.setItem(lockKey, "1");
        setMessage("Completing social login...");
        const candidateOrigins = [origin, alternateOrigin].filter(Boolean);
        let lastError = null;

        for (const currentOrigin of candidateOrigins) {
          const res = await fetch(`${currentOrigin}/api/auth/social/exchange/${encodeURIComponent(resolvedTicket)}`, {
            headers: { Accept: "application/json" },
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            lastError = new Error(data?.message || "Social login failed. Please try again.");
            continue;
          }
          if (data?.error) {
            throw new Error(data.error);
          }
          if (!data?.token) {
            lastError = new Error("Social login failed. Please try again.");
            continue;
          }

          sessionStorage.setItem(doneKey, "1");
          sessionStorage.removeItem(lockKey);
          finishWithToken(data.token);
          return;
        }

        sessionStorage.removeItem(lockKey);
        throw lastError || new Error("Social login failed. Please try again.");
      }

      const code = query.get("code");
      if (code) {
        const provider = query.get("provider") || localStorage.getItem("oauth_provider") || "google";
        query.set("provider", provider);
        window.location.replace(`${origin}/api/auth/${provider}/callback?${query.toString()}`);
        return;
      }

      throw new Error("Social login callback is invalid. Please try again.");
    };

    run().catch((err) => fail(err?.message));

    return () => {
      cancelled = true;
    };
  }, [nav, ticket]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 gap-5 p-6">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-soft text-sm text-zinc-700 text-center max-w-md">
        <p className="text-base font-medium text-zinc-900 mb-2">{message}</p>
        {showRetry && (
          <button
            type="button"
            onClick={() => nav("/login")}
            className="mt-4 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm"
          >
            Back to Login
          </button>
        )}
        {showDirectHome && (
          <button
            type="button"
            onClick={() => window.location.replace("/")}
            className="mt-3 px-4 py-2 rounded-lg border border-zinc-300 text-sm"
          >
            Go to Home
          </button>
        )}
      </div>
    </div>
  );
}
