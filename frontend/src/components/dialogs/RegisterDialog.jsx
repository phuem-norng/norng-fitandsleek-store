import React, { useState } from "react";
import { Chrome, Facebook, Lock, User, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { resolveBackendOrigin } from "../../lib/backendOrigin";
import { useAuth } from "../../state/auth";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import Logo from "../Logo.jsx";
import VerificationMethodPicker from "../security/VerificationMethodPicker";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../ui/Dialog";
import { Tabs, TabsList, TabsTrigger, TabsContents, TabsContent } from "../ui/Tabs";

export default function RegisterDialog({ isOpen, onClose, onSwitchToLogin }) {
  const { settings } = useHomepageSettings();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });
  const [otpForm, setOtpForm] = useState({ email: "", code: "", purpose: "register" });
  const [verifyStep, setVerifyStep] = useState("form");
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationMethods, setVerificationMethods] = useState([]);
  const [preferredMethod, setPreferredMethod] = useState("email");
  const [otpNotice, setOtpNotice] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register, selectVerificationMethod, verifyOtp, verifyTwoFactor, resendOtp } = useAuth();

  const handleSocial = (provider) => {
    const selectedBackendOrigin = resolveBackendOrigin();
    const normalizedBase = `${selectedBackendOrigin}/api`;
    const frontendCallback = `${window.location.origin}/oauth/callback`;
    localStorage.setItem("oauth_provider", provider);
    window.location.href = `${normalizedBase}/auth/${provider}/redirect?frontend_callback=${encodeURIComponent(frontendCallback)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.password_confirmation) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      if (result?.verification_required && result?.challenge_token) {
        setChallengeToken(result.challenge_token);
        setVerificationMethods(result.verification_methods || []);
        setPreferredMethod(result.preferred_method || "email");
        setOtpForm({ email: form.email, code: "", purpose: result.purpose || "register" });
        setVerifyStep("method");
        setOtpNotice(result.message || "Choose how to verify your account.");
        return;
      }
      if (result?.otp_required) {
        setVerificationMethods([
          {
            type: "email",
            label: "Email code",
            description: `Send a 6-digit code to ${form.email}`,
            recommended: true,
          },
        ]);
        setOtpForm({ email: form.email, code: "", purpose: "register" });
        setVerifyStep("method");
        setOtpNotice(result.message || "Choose how to verify your account.");
        return;
      }
      setForm({ name: "", email: "", phone: "", password: "", password_confirmation: "" });
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const finishRegister = (user) => {
    setForm({ name: "", email: "", phone: "", password: "", password_confirmation: "" });
    setVerifyStep("form");
    setChallengeToken("");
    setVerificationMethods([]);
    setTwoFactorCode("");
    setOtpNotice("");
    if (user?.role === "admin" || user?.role === "superadmin") {
      setTimeout(() => {
        window.location.href = "/admin";
      }, 300);
      return;
    }
    onClose();
  };

  const handleSelectMethod = async (method) => {
    setLoading(true);
    setError("");
    try {
      const data = await selectVerificationMethod({ challengeToken, method });
      if (data?.step === "otp") {
        setOtpForm((prev) => ({ ...prev, purpose: data.purpose || prev.purpose }));
        setVerifyStep("otp");
        setOtpNotice(data.message || "Code sent to your email.");
        return;
      }
      if (data?.step === "authenticator") {
        setVerifyStep("authenticator");
        setOtpNotice(data.message || "Enter your authenticator code.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Could not start verification");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await verifyOtp({
        email: otpForm.email,
        code: otpForm.code,
        purpose: otpForm.purpose,
        challengeToken: challengeToken || undefined,
      });
      finishRegister(data?.user);
    } catch (err) {
      setError(err?.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await verifyTwoFactor({
        challengeToken,
        code: twoFactorCode,
      });
      finishRegister(data?.user);
    } catch (err) {
      setError(err?.response?.data?.message || "Two-factor verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await resendOtp({
        email: otpForm.email,
        purpose: otpForm.purpose,
        challengeToken: challengeToken || undefined,
      });
      setOtpNotice("A new code was sent to your email.");
    } catch (err) {
      setError(err?.response?.data?.message || "Resend failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPopup className="auth-dialog-shell modal-no-scroll min-w-0 max-h-[92dvh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-white/10 p-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] text-white shadow-2xl backdrop-blur-xl scrollbar-hide" from="top" position="center" showCloseButton={true}>
        <div className="border-b border-white/10 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          <Link to="/" className="flex items-center justify-center">
            <Logo className="h-12 w-auto max-w-full sm:h-14" src={settings?.header?.logo_url || "/logo.png"} alt="FitandSleek" />
          </Link>
        </div>

        <div className="border-b border-white/10 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          <DialogTitle className="text-2xl font-black tracking-tight text-white">Create Account</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-white/70">
            Join FitandSleek and start shopping
          </DialogDescription>
        </div>

        <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <Tabs
            value="register"
            onValueChange={(value) => {
              if (value === "login") {
                onClose();
                onSwitchToLogin();
              }
            }}
          >
            <TabsList className="w-full rounded-full p-1 bg-white/15 border border-white/10 shadow-inner backdrop-blur-md">
              <TabsTrigger value="login" className="flex-1 rounded-full text-sm font-semibold text-white/70 data-[state=active]:bg-white/80 data-[state=active]:text-slate-900 data-[state=active]:shadow transition-all duration-200">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-full text-sm font-semibold text-white/70 data-[state=active]:bg-white/80 data-[state=active]:text-slate-900 data-[state=active]:shadow transition-all duration-200">
                Register
              </TabsTrigger>
            </TabsList>
            <TabsContents>
              <TabsContent value="register">
                {verifyStep === "form" ? (
                  <form onSubmit={handleSubmit} className="mt-4 flex min-w-0 flex-col gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <label htmlFor="register-name" className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70 leading-snug">
                          Full Name
                        </label>
                        <div className="relative mt-1.5">
                          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                          <input
                            id="register-name"
                            name="name"
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="John Doe"
                            className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-white shadow-sm outline-none transition-all duration-200 placeholder:text-white/60 focus:border-transparent focus:bg-white/20 focus:ring-2 focus:ring-white/30"
                            required
                          />
                        </div>
                    </div>

                    <div className="min-w-0">
                        <label htmlFor="register-email" className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70 leading-snug">
                          Email Address
                        </label>
                        <div className="relative mt-1.5">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                          <input
                            id="register-email"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            placeholder="your@email.com"
                            className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-white shadow-sm outline-none transition-all duration-200 placeholder:text-white/60 focus:border-transparent focus:bg-white/20 focus:ring-2 focus:ring-white/30"
                            required
                          />
                        </div>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="register-phone" className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70 leading-snug">
                        Phone Number
                      </label>
                      <div className="relative mt-1.5">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                        <input
                          id="register-phone"
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+855..."
                          className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-white shadow-sm outline-none transition-all duration-200 placeholder:text-white/60 focus:border-transparent focus:bg-white/20 focus:ring-2 focus:ring-white/30"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="register-password" className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70 leading-snug">
                        Password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                        <input
                          id="register-password"
                          name="password"
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="••••••••"
                          className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-white shadow-sm outline-none transition-all duration-200 placeholder:text-white/60 focus:border-transparent focus:bg-white/20 focus:ring-2 focus:ring-white/30"
                          required
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="register-password-confirm" className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70 leading-snug">
                        Confirm password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                        <input
                          id="register-password-confirm"
                          name="password_confirmation"
                          type="password"
                          value={form.password_confirmation}
                          onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                          placeholder="••••••••"
                          className="h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-white shadow-sm outline-none transition-all duration-200 placeholder:text-white/60 focus:border-transparent focus:bg-white/20 focus:ring-2 focus:ring-white/30"
                          required
                        />
                      </div>
                      {error && (
                        <div className="mt-2 text-xs text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
                          {error}
                        </div>
                      )}
                    </div>

                    <div className="flex w-full min-w-0 flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#586F64] via-[#6e8b7e] to-[#9BB0A5] text-white text-sm font-semibold shadow-lg shadow-[#6e8b7e]/35 hover:brightness-105 active:scale-[0.98] transition-all duration-200"
                      >
                        {loading ? "Creating account..." : "Create Account"}
                      </button>
                      <DialogClose
                        onClick={onClose}
                        className="w-full h-10 rounded-2xl bg-white/5 text-white/80 text-sm font-semibold border border-white/15 hover:bg-white/15 active:scale-[0.98] transition-all duration-200"
                      >
                        Cancel
                      </DialogClose>
                    </div>
                  </form>
                ) : verifyStep === "method" ? (
                  <div className="mt-4 flex min-w-0 flex-col gap-3 sm:gap-4">
                    {otpNotice && (
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        {otpNotice}
                      </div>
                    )}
                    <VerificationMethodPicker
                      variant="dark"
                      methods={verificationMethods}
                      preferredMethod={preferredMethod}
                      loading={loading}
                      onSelect={handleSelectMethod}
                      subtitle="Verify your new account — email code or authenticator (if enabled)."
                    />
                    {error && (
                      <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {error}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setVerifyStep("form")}
                      className="w-full h-10 rounded-2xl bg-white/5 text-white/80 text-sm font-semibold border border-white/15"
                    >
                      Back
                    </button>
                  </div>
                ) : verifyStep === "authenticator" ? (
                  <form onSubmit={handleVerifyTwoFactor} className="mt-4 flex min-w-0 flex-col gap-3 sm:gap-4">
                    {otpNotice && (
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        {otpNotice}
                      </div>
                    )}
                    <div className="min-w-0">
                      <label htmlFor="register-2fa-code" className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Authenticator Code</label>
                      <div className="relative mt-1.5">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                        <input
                          id="register-2fa-code"
                          type="text"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                          placeholder="6-digit code or recovery code"
                          className="w-full h-12 rounded-2xl bg-white/10 text-white placeholder-white/60 border border-white/15 pl-11 pr-4 shadow-sm focus:bg-white/20 focus:border-transparent focus:ring-2 focus:ring-white/30 outline-none transition-all duration-200"
                          required
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="mt-1 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {error}
                      </div>
                    )}
                    <div className="flex w-full min-w-0 flex-col gap-2 pt-2">
                      <button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#586F64] via-[#6e8b7e] to-[#9BB0A5] text-white text-sm font-semibold">
                        {loading ? "Verifying..." : "Verify"}
                      </button>
                      <button type="button" onClick={() => setVerifyStep("method")} className="w-full h-10 rounded-2xl bg-white/5 text-white/80 text-sm font-semibold border border-white/15">
                        Try another method
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="mt-4 flex min-w-0 flex-col gap-3 sm:gap-4">
                    {otpNotice && (
                      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                        {otpNotice}
                      </div>
                    )}
                    <div className="min-w-0">
                      <label htmlFor="register-otp-code" className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Verification Code</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
                        <input
                          id="register-otp-code"
                          name="otp_code"
                          type="text"
                          value={otpForm.code}
                          onChange={(e) => setOtpForm({ ...otpForm, code: e.target.value })}
                          placeholder="Enter OTP"
                          className="w-full h-12 rounded-2xl bg-white/10 text-white placeholder-white/60 border border-white/15 pl-11 pr-4 shadow-sm focus:bg-white/20 focus:border-transparent focus:ring-2 focus:ring-white/30 outline-none transition-all duration-200"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="mt-1 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {error}
                      </div>
                    )}

                    <div className="flex w-full min-w-0 flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#586F64] via-[#6e8b7e] to-[#9BB0A5] text-white text-sm font-semibold shadow-lg shadow-[#6e8b7e]/35 hover:brightness-105 active:scale-[0.98] transition-all duration-200"
                      >
                        {loading ? "Verifying..." : "Verify"}
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="w-full h-10 rounded-2xl bg-white/5 text-white/80 text-sm font-semibold border border-white/15 hover:bg-white/15 active:scale-[0.98] transition-all duration-200"
                      >
                        Resend code
                      </button>
                      <DialogClose
                        onClick={onClose}
                        className="w-full h-10 rounded-2xl bg-white/5 text-white/80 text-sm font-semibold border border-white/15 hover:bg-white/15 active:scale-[0.98] transition-all duration-200"
                      >
                        Cancel
                      </DialogClose>
                    </div>
                  </form>
                )}

                {verifyStep === "form" && (
                  <>
                    <div className="mt-4 px-1 text-center text-sm text-white/70">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSwitchToLogin();
                        }}
                        className="font-semibold text-white hover:underline"
                      >
                        Login
                      </button>
                    </div>

                    <div className="my-5 flex items-center gap-3 text-xs text-white/60">
                      <span className="h-px flex-1 bg-white/20" />
                      or
                      <span className="h-px flex-1 bg-white/20" />
                    </div>

                    <div className="flex min-w-0 flex-col gap-3 pb-2">
                      <button
                        type="button"
                        onClick={() => handleSocial("google")}
                        className="flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20 active:scale-[0.98]"
                      >
                        <Chrome className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="truncate">Continue with Google</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSocial("facebook")}
                        className="flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20 active:scale-[0.98]"
                      >
                        <Facebook className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="truncate">Continue with Facebook</span>
                      </button>
                    </div>
                  </>
                )}
              </TabsContent>
            </TabsContents>
          </Tabs>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
