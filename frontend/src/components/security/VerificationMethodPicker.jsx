import React from "react";
import { Mail, Smartphone } from "lucide-react";

/**
 * Facebook-style verification method chooser (email OTP vs authenticator).
 */
export default function VerificationMethodPicker({
  methods = [],
  preferredMethod = "email",
  onSelect,
  loading = false,
  variant = "light",
  subtitle,
}) {
  const isDark = variant === "dark";

  if (!methods.length) {
    return null;
  }

  const iconFor = (type) => (type === "authenticator" ? Smartphone : Mail);

  return (
    <div className="space-y-3">
      <p className={`text-sm ${isDark ? "text-white/80" : "text-slate-600"}`}>
        {subtitle || "Choose how you want to verify your identity:"}
      </p>
      <div className="flex flex-col gap-2">
        {methods.map((method) => {
          const Icon = iconFor(method.type);
          const isRecommended =
            method.recommended || method.type === preferredMethod;

          return (
            <button
              key={method.type}
              type="button"
              disabled={loading}
              onClick={() => onSelect(method.type)}
              className={
                isDark
                  ? "flex w-full items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left transition hover:bg-white/20 disabled:opacity-60"
                  : "flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white disabled:opacity-60"
              }
            >
              <span
                className={
                  isDark
                    ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"
                    : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm"
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {method.label}
                  {isRecommended ? (
                    <span
                      className={
                        isDark
                          ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200"
                          : "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700"
                      }
                    >
                      Recommended
                    </span>
                  ) : null}
                </span>
                <span className={`mt-0.5 block text-xs ${isDark ? "text-white/65" : "text-slate-500"}`}>
                  {method.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
