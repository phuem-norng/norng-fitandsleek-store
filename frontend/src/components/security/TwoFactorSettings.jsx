import React, { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";

/**
 * Optional TOTP 2FA — enable/disable from profile (customers & admins).
 * @param {{ variant?: 'customer' | 'admin', className?: string, accentColor?: string }} props
 */
export default function TwoFactorSettings({ variant = "customer", className = "", accentColor = "" }) {
  const isAdmin = variant === "admin";

  const [status, setStatus] = useState({ enabled: false, loading: true, preferred_method: "email" });
  const [setup, setSetup] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [regenCode, setRegenCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const cardClass = isAdmin
    ? "rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-5"
    : "rounded-xl border border-gray-200 bg-gray-50 p-5";

  const inputClass = isAdmin
    ? "w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 text-slate-900 dark:text-white"
    : "w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900";

  const btnPrimaryClass = isAdmin
    ? "inline-flex h-11 w-full sm:w-auto min-w-[240px] items-center justify-center rounded-xl px-6 text-sm font-bold shadow-lg transition hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
    : "px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-60";

  const primaryButtonStyle =
    isAdmin && accentColor
      ? {
          backgroundColor: accentColor,
          color: accentColor === "#ffffff" ? "#0b0b0f" : "#ffffff",
          border: accentColor === "#ffffff" ? "1px solid rgba(15,23,42,0.25)" : "none",
        }
      : isAdmin
        ? { backgroundColor: "#0f172a", color: "#ffffff" }
        : undefined;

  const btnSecondary = isAdmin
    ? "inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-60"
    : "px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold text-sm disabled:opacity-60";

  const loadStatus = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    setError("");
    try {
      const { data } = await api.get("/auth/two-factor");
      setStatus({
        enabled: !!data.enabled,
        loading: false,
        confirmed_at: data.confirmed_at,
        preferred_method: data.preferred_method || "email",
      });
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load two-factor status");
      setStatus((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startSetup = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    setRecoveryCodes(null);
    try {
      const { data } = await api.post("/auth/two-factor/setup");
      setSetup({
        qr_code: data.qr_code,
        manual_entry_key: data.manual_entry_key,
      });
      setMessage(data.message || "Scan the QR code with Google Authenticator, Authy, or similar.");
    } catch (e) {
      setError(e.response?.data?.message || "Could not start setup");
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/two-factor/confirm", { code: confirmCode });
      setRecoveryCodes(data.recovery_codes || []);
      setSetup(null);
      setConfirmCode("");
      setStatus({ enabled: true, loading: false });
      setMessage("Two-factor authentication is now enabled.");
    } catch (e) {
      setError(e.response?.data?.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { code: disableCode };
      if (disablePassword) payload.password = disablePassword;
      await api.post("/auth/two-factor/disable", payload);
      setDisableCode("");
      setDisablePassword("");
      setSetup(null);
      setRecoveryCodes(null);
      setStatus({ enabled: false, loading: false });
      setMessage("Two-factor authentication has been turned off.");
    } catch (e) {
      setError(e.response?.data?.message || "Could not disable two-factor");
    } finally {
      setBusy(false);
    }
  };

  const regenerateCodes = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/two-factor/recovery-codes", { code: regenCode });
      setRecoveryCodes(data.recovery_codes || []);
      setRegenCode("");
      setMessage("New recovery codes generated. Save them now — they will not be shown again.");
    } catch (e) {
      setError(e.response?.data?.message || "Could not regenerate codes");
    } finally {
      setBusy(false);
    }
  };

  if (status.loading) {
    return (
      <div className={className}>
        <p className={isAdmin ? "text-sm text-slate-500 dark:text-slate-400" : "text-sm text-gray-500"}>
          Loading security settings…
        </p>
      </div>
    );
  }

  return (
      <div className={className}>
      <div
        className={
          isAdmin
            ? "mt-6 rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-900/40 p-5 md:p-6 space-y-4"
            : "space-y-4"
        }
      >
        <div>
          <h3 className={isAdmin ? "text-lg font-bold text-slate-900 dark:text-white" : "font-bold text-lg text-gray-900"}>
            Authenticator app (2FA)
          </h3>
          <p className={isAdmin ? "text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed" : "text-sm text-gray-600 mt-1"}>
            Optional extra protection. When enabled, at login and forgot password you can choose to verify via email code or authenticator app.
          </p>
          <p className={`mt-2 text-sm font-semibold ${status.enabled ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            Status: {status.enabled ? "Enabled" : "Disabled"}
          </p>
        </div>

        {message && (
          <div className={isAdmin ? "rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm p-3" : "rounded-lg bg-green-50 text-green-800 text-sm p-3"}>
            {message}
          </div>
        )}
        {error && (
          <div className={isAdmin ? "rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3 flex flex-wrap items-center gap-3" : "rounded-lg bg-red-50 text-red-700 text-sm p-3"}>
            <span>{error}</span>
            <button type="button" className={btnSecondary} onClick={loadStatus}>
              Retry
            </button>
          </div>
        )}

        {recoveryCodes?.length > 0 && (
          <div className={cardClass}>
            <p className="font-semibold text-sm mb-2">Recovery codes — save these now</p>
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
              Each code works once if you lose your phone. Store them offline.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <li key={c} className="rounded bg-white dark:bg-slate-800 px-2 py-1 border border-gray-200 dark:border-slate-600">
                  {c}
                </li>
              ))}
            </ul>
            <button type="button" className={`${btnSecondary} mt-4`} onClick={() => setRecoveryCodes(null)}>
              I saved them
            </button>
          </div>
        )}

        {!status.enabled && !setup && (
          <div className="pt-2">
            <button
              type="button"
              className={`${btnPrimaryClass} ${!isAdmin ? "bg-slate-900 text-white" : ""}`}
              style={isAdmin ? primaryButtonStyle : undefined}
              disabled={busy}
              onClick={startSetup}
            >
              {busy ? "Starting…" : "Enable authenticator 2FA"}
            </button>
          </div>
        )}

        {setup && (
          <form onSubmit={confirmSetup} className={`space-y-4 ${cardClass}`}>
            <p className="text-sm font-medium">1. Scan this QR code</p>
            <img src={setup.qr_code} alt="Authenticator QR code" className="w-52 h-52 rounded-lg border border-gray-200 bg-white p-2" />
            <p className="text-xs text-gray-600 dark:text-slate-400 break-all">
              Or enter manually: <span className="font-mono font-semibold">{setup.manual_entry_key}</span>
            </p>
            <p className="text-sm font-medium">2. Enter the 6-digit code from your app</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              className={inputClass}
              placeholder="000000"
              required
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={btnPrimaryClass}
                style={isAdmin ? primaryButtonStyle : undefined}
                disabled={busy || confirmCode.length !== 6}
              >
                Confirm & enable
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={busy}
                onClick={() => {
                  setSetup(null);
                  setConfirmCode("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {status.enabled && (
          <div className="space-y-6">
            <div className={cardClass}>
              <p className="font-semibold text-sm mb-2">Default verification method</p>
              <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
                Used as the recommended option when you sign in or reset your password.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={`${btnSecondary} ${status.preferred_method === "email" ? "ring-2 ring-slate-400" : ""}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const { data } = await api.post("/auth/two-factor/preferred-method", { method: "email" });
                      setStatus((s) => ({ ...s, preferred_method: data.preferred_method || "email" }));
                      setMessage(data.message || "Default method updated.");
                    } catch (e) {
                      setError(e.response?.data?.message || "Could not update preference");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Email code
                </button>
                <button
                  type="button"
                  className={`${btnSecondary} ${status.preferred_method === "authenticator" ? "ring-2 ring-slate-400" : ""}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const { data } = await api.post("/auth/two-factor/preferred-method", { method: "authenticator" });
                      setStatus((s) => ({ ...s, preferred_method: data.preferred_method || "authenticator" }));
                      setMessage(data.message || "Default method updated.");
                    } catch (e) {
                      setError(e.response?.data?.message || "Could not update preference");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Authenticator app
                </button>
              </div>
            </div>

            <form onSubmit={disable2fa} className={cardClass}>
              <p className="font-semibold text-sm mb-2">Turn off authenticator 2FA</p>
              <p className="text-xs text-gray-600 dark:text-slate-400 mb-3">
                Enter your current app code (or a recovery code) and your account password if you have one.
              </p>
              <input
                type="text"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className={`${inputClass} mb-2`}
                placeholder="6-digit code or XXXX-XXXX"
                required
              />
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className={inputClass}
                placeholder="Account password (if set)"
              />
              <button type="submit" className={`${btnSecondary} mt-3`} disabled={busy}>
                Disable 2FA
              </button>
            </form>

            <form onSubmit={regenerateCodes} className={cardClass}>
              <p className="font-semibold text-sm mb-2">Regenerate recovery codes</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} mb-2`}
                placeholder="Current 6-digit app code"
                required
              />
              <button type="submit" className={btnSecondary} disabled={busy || regenCode.length !== 6}>
                Generate new recovery codes
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
