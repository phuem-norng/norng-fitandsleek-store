import React from "react";
import { Link } from "react-router-dom";
import { Facebook, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Logo from "../Logo.jsx";
import { DialogPopup, DialogTitle, DialogDescription } from "../ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from "../ui/Tabs";

/** Shared corner radius — matches --fs-radius-* in styles/index.css */
export const AUTH_SHELL_CLASS =
  "auth-dialog-shell modal-no-scroll w-full min-w-0 max-w-[440px] overflow-hidden border border-slate-200/80 bg-white p-0 text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)]";

export const AUTH_INPUT =
  "auth-dialog-control h-11 w-full min-w-0 border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#586F64] focus:ring-2 focus:ring-[#586F64]/20";

export const AUTH_LABEL = "mb-1.5 block text-sm font-medium text-slate-700";

export const AUTH_PRIMARY_BTN =
  "auth-dialog-control flex h-11 w-full items-center justify-center bg-[#1a1f1c] text-sm font-semibold text-white shadow-sm transition hover:bg-[#2d3530] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#586F64] disabled:cursor-not-allowed disabled:opacity-60";

export const AUTH_OUTLINE_BTN =
  "auth-dialog-control flex h-11 w-full items-center justify-center gap-2.5 border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60";

export const PHONE_COUNTRY_CODES = [
  { code: "+855", label: "KH +855" },
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+65", label: "SG +65" },
  { code: "+60", label: "MY +60" },
  { code: "+66", label: "TH +66" },
  { code: "+84", label: "VN +84" },
  { code: "+81", label: "JP +81" },
  { code: "+82", label: "KR +82" },
  { code: "+86", label: "CN +86" },
  { code: "+91", label: "IN +91" },
];

export function GoogleIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthDialogShell({
  onClose,
  logoUrl,
  title,
  description,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <DialogPopup
      className={`${AUTH_SHELL_CLASS} pb-[max(1rem,env(safe-area-inset-bottom,0px))]`}
      from="top"
      position="center"
      showCloseButton={false}
    >
      <DialogPrimitive.Close
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#586F64]"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
      <div className="border-b border-slate-100 px-6 pb-4 pt-6">
        <Link to="/" className="mx-auto flex w-fit items-center justify-center" onClick={onClose}>
          <Logo className="h-11 w-auto max-w-[200px]" src={logoUrl || "/logo.png"} alt="Fit & Sleek" />
        </Link>
        {title ? (
          <DialogTitle className="mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </DialogTitle>
        ) : (
          <DialogTitle className="sr-only">{activeTab === "register" ? "Register" : "Login"}</DialogTitle>
        )}
        {description ? (
          <DialogDescription className="mt-1.5 text-center text-sm text-slate-500">
            {description}
          </DialogDescription>
        ) : null}
      </div>

      <div className="px-6 pb-6 pt-4">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="auth-dialog-tabs grid w-full grid-cols-2 gap-1 bg-slate-100 p-1">
            <TabsTrigger
              value="login"
              className="auth-dialog-tab py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Login
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="auth-dialog-tab py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContents>{children}</TabsContents>
        </Tabs>
      </div>
    </DialogPopup>
  );
}

export function AuthField({ id, label, hint, icon: Icon, children, error }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={AUTH_LABEL}>
        {label}
      </label>
      {hint ? <p className="mb-1.5 text-xs text-slate-500">{hint}</p> : null}
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        ) : null}
        {children}
      </div>
      {error ? <AuthError message={error} /> : null}
    </div>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="auth-dialog-notice mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

export function AuthNotice({ message }) {
  if (!message) return null;
  return (
    <div className="auth-dialog-notice border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {message}
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-white px-3 text-slate-400">or continue with</span>
      </div>
    </div>
  );
}

export function AuthSocialButtons({ onGoogle, onFacebook }) {
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={onGoogle} className={AUTH_OUTLINE_BTN}>
        <GoogleIcon />
        <span>Google</span>
      </button>
      <button type="button" onClick={onFacebook} className={AUTH_OUTLINE_BTN}>
        <Facebook className="h-5 w-5 text-[#1877F2]" aria-hidden />
        <span>Facebook</span>
      </button>
    </div>
  );
}

export function AuthPhoneField({ id, label, countryCode, onCountryCodeChange, value, onChange, required }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={AUTH_LABEL}>
        {label}
      </label>
      <div className="mt-0 flex gap-2">
        <select
          aria-label="Country code"
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          className="auth-dialog-control h-11 w-[108px] shrink-0 border border-slate-200 bg-slate-50 px-2 text-sm text-slate-800 outline-none focus:border-[#586F64] focus:ring-2 focus:ring-[#586F64]/20"
        >
          {PHONE_COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={onChange}
          placeholder="12 345 678"
          className={`${AUTH_INPUT} pl-3`}
          required={required}
        />
      </div>
    </div>
  );
}

export function AuthFooterLink({ children }) {
  return <p className="mt-5 text-center text-sm text-slate-500">{children}</p>;
}

export function AuthTextButton({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-medium text-[#586F64] underline-offset-2 hover:underline ${className}`}
    >
      {children}
    </button>
  );
}

export { TabsContent };
