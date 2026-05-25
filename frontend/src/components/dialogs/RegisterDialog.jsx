import React, { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { useAuth } from "../../state/auth";
import { useHomepageSettings } from "../../state/homepageSettings.jsx";
import { resolveBackendOrigin } from "../../lib/backendOrigin";
import { Dialog } from "../ui/Dialog";
import {
  AuthDialogShell,
  AuthDivider,
  AuthError,
  AuthField,
  AuthFooterLink,
  AuthPhoneField,
  AuthSocialButtons,
  AuthTextButton,
  AUTH_INPUT,
  AUTH_PRIMARY_BTN,
  TabsContent,
} from "../auth/AuthDialogShared";

export default function RegisterDialog({ isOpen, onClose, onSwitchToLogin }) {
  const { settings } = useHomepageSettings();
  const [countryCode, setCountryCode] = useState("+855");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [otpForm, setOtpForm] = useState({ email: "", code: "", purpose: "register" });
  const [otpMode, setOtpMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register, verifyOtp, resendOtp } = useAuth();

  const fullPhone = phoneLocal.trim() ? `${countryCode}${phoneLocal.replace(/\s+/g, "")}` : "";

  const handleSocial = (provider) => {
    const selectedBackendOrigin = resolveBackendOrigin();
    const normalizedBase = `${selectedBackendOrigin}/api`;
    const frontendCallback = `${window.location.origin}/oauth/callback`;
    localStorage.setItem("oauth_provider", provider);
    window.location.href = `${normalizedBase}/auth/${provider}/redirect?frontend_callback=${encodeURIComponent(frontendCallback)}`;
  };

  const finishRegister = (user) => {
    setForm({ name: "", email: "", password: "", password_confirmation: "" });
    setPhoneLocal("");
    if (user?.role === "admin" || user?.role === "superadmin") {
      setTimeout(() => {
        window.location.href = "/admin";
      }, 300);
      return;
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.password_confirmation) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        phone: fullPhone,
        password: form.password,
        password_confirmation: form.password_confirmation,
      });
      if (result?.otp_required) {
        setOtpMode(true);
        setOtpForm({ email: form.email, code: "", purpose: result.purpose || "register" });
        return;
      }
      finishRegister(result?.user);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Registration failed. Please try again.";
      setError(msg);
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
      });
      setOtpMode(false);
      setOtpForm({ email: "", code: "", purpose: "register" });
      finishRegister(data?.user);
    } catch (err) {
      setError(err?.response?.data?.message || "Verification failed. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await resendOtp({ email: otpForm.email, purpose: otpForm.purpose });
    } catch (err) {
      setError(err?.response?.data?.message || "Could not resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AuthDialogShell
        onClose={onClose}
        logoUrl={settings?.header?.logo_url}
        activeTab="register"
        onTabChange={(value) => {
          if (value === "login") {
            onClose();
            onSwitchToLogin();
          }
        }}
      >
        <TabsContent value="register">
          {!otpMode ? (
            <>
              <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
                <AuthField id="register-name" label="Full name" icon={User}>
                  <input
                    id="register-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                    className={AUTH_INPUT}
                    required
                  />
                </AuthField>

                <AuthField id="register-email" label="Email" icon={Mail}>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className={AUTH_INPUT}
                    required
                  />
                </AuthField>

                <AuthPhoneField
                  id="register-phone"
                  label="Phone (optional)"
                  countryCode={countryCode}
                  onCountryCodeChange={setCountryCode}
                  value={phoneLocal}
                  onChange={(e) => setPhoneLocal(e.target.value)}
                />

                <AuthField id="register-password" label="Password" icon={Lock}>
                  <input
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="At least 8 characters"
                    className={AUTH_INPUT}
                    required
                    minLength={8}
                  />
                </AuthField>

                <AuthField id="register-password-confirm" label="Confirm password" icon={Lock}>
                  <input
                    id="register-password-confirm"
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={form.password_confirmation}
                    onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                    placeholder="Repeat your password"
                    className={AUTH_INPUT}
                    required
                    minLength={8}
                  />
                </AuthField>

                <AuthError message={error} />

                <button type="submit" disabled={loading} className={AUTH_PRIMARY_BTN}>
                  {loading ? "Registering…" : "Register"}
                </button>
              </form>

              <AuthDivider />
              <AuthSocialButtons
                onGoogle={() => handleSocial("google")}
                onFacebook={() => handleSocial("facebook")}
              />

              <AuthFooterLink>
                Already have an account?{" "}
                <AuthTextButton
                  onClick={() => {
                    onClose();
                    onSwitchToLogin();
                  }}
                >
                  Login
                </AuthTextButton>
              </AuthFooterLink>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-5 flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                Enter the verification code we sent to <strong className="text-slate-900">{otpForm.email}</strong>.
              </p>
              <AuthField id="register-otp-code" label="Verification code" icon={Lock}>
                <input
                  id="register-otp-code"
                  name="otp_code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpForm.code}
                  onChange={(e) => setOtpForm({ ...otpForm, code: e.target.value })}
                  placeholder="6-digit code"
                  className={AUTH_INPUT}
                  required
                />
              </AuthField>
              <AuthError message={error} />
              <button type="submit" disabled={loading} className={AUTH_PRIMARY_BTN}>
                {loading ? "Verifying…" : "Verify email"}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
              >
                Resend code
              </button>
            </form>
          )}
        </TabsContent>
      </AuthDialogShell>
    </Dialog>
  );
}
