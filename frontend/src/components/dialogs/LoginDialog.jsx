import React, { useState } from "react";
import { Lock, Mail } from "lucide-react";
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
  AuthNotice,
  formatOtpNotice,
  AUTH_PRIMARY_BTN,
  AuthSocialButtons,
  AuthTextButton,
  AUTH_INPUT,
  TabsContent,
} from "../auth/AuthDialogShared";

export default function LoginDialog({ isOpen, onClose, onSwitchToRegister }) {
  const { settings } = useHomepageSettings();
  const [form, setForm] = useState({ email: "", password: "" });
  const [otpForm, setOtpForm] = useState({
    email: "",
    code: "",
    purpose: "login",
    challengeToken: "",
  });
  const [otpMode, setOtpMode] = useState(false);
  const [otpNotice, setOtpNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, verifyOtp, resendOtp } = useAuth();

  const handleSocial = (provider) => {
    const selectedBackendOrigin = resolveBackendOrigin();
    const normalizedBase = `${selectedBackendOrigin}/api`;
    const frontendCallback = `${window.location.origin}/oauth/callback`;
    localStorage.setItem("oauth_provider", provider);
    window.location.href = `${normalizedBase}/auth/${provider}/redirect?frontend_callback=${encodeURIComponent(frontendCallback)}`;
  };

  const finishLogin = (user) => {
    setForm({ email: "", password: "" });
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
    setLoading(true);
    setError("");
    try {
      const result = await login(form.email, form.password, { forceOtp: true });
      if (result?.error) {
        setError(result.message || "Invalid email or password");
        return;
      }
      if (result?.otp_required || result?.verification_required) {
        setOtpMode(true);
        setOtpForm({
          email: form.email,
          code: "",
          purpose: result.purpose || "login",
          challengeToken: result.challenge_token || "",
        });
        setOtpNotice(
          formatOtpNotice({
            message: result.message,
            email: form.email,
            emailSent: result.email_sent,
            debugOtp: result.debug_otp,
          }),
        );
        return;
      }
      finishLogin(result?.user || result);
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Please try again.");
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
        challengeToken: otpForm.challengeToken,
      });

      // Backend asks for an additional authenticator step when 2FA is on and
      // the email OTP wasn't tied to a challenge token. Surface a clear error
      // instead of silently dropping the user back to the login form.
      if (data?.two_factor_required) {
        setError(
          data?.message ||
            "This account has 2FA enabled. Open the authenticator app to finish signing in.",
        );
        return;
      }

      if (!data?.token) {
        setError(data?.message || "Verification failed. Check the code and try again.");
        return;
      }

      setOtpMode(false);
      setOtpForm({ email: "", code: "", purpose: "login", challengeToken: "" });
      setOtpNotice("");
      finishLogin(data?.user);
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
      const data = await resendOtp({
        email: otpForm.email,
        purpose: otpForm.purpose,
        challengeToken: otpForm.challengeToken,
      });
      setOtpNotice(
        formatOtpNotice({
          message: data?.message,
          email: otpForm.email,
          emailSent: data?.email_sent,
          debugOtp: data?.debug_otp,
          fallback: `A new code was sent to ${otpForm.email}`,
        }),
      );
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
        activeTab="login"
        onTabChange={(value) => {
          if (value === "register") {
            onClose();
            onSwitchToRegister();
          }
        }}
      >
        <TabsContent value="login">
          {!otpMode ? (
            <>
              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-6">
                <AuthField id="login-email" label="Email" icon={Mail}>
                  <input
                    id="login-email"
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

                <AuthField
                  id="login-password"
                  label="Password"
                  icon={Lock}
                >
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Enter your password"
                    className={AUTH_INPUT}
                  />
                </AuthField>

                <div className="flex justify-end">
                  <AuthTextButton
                    onClick={() => {
                      onClose();
                      window.location.href = "/forgot-password";
                    }}
                  >
                    Forgot password?
                  </AuthTextButton>
                </div>

                <AuthError message={error} />

                <button type="submit" disabled={loading} className={AUTH_PRIMARY_BTN}>
                  {loading ? "Logging in…" : "Login"}
                </button>
              </form>

              <AuthDivider />
              <AuthSocialButtons
                onGoogle={() => handleSocial("google")}
                onFacebook={() => handleSocial("facebook")}
              />

              <AuthFooterLink>
                New here?{" "}
                <AuthTextButton
                  onClick={() => {
                    onClose();
                    onSwitchToRegister();
                  }}
                >
                  Register
                </AuthTextButton>
              </AuthFooterLink>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-7 flex flex-col gap-6">
              <AuthNotice message={otpNotice} />
              <AuthField id="login-otp-code" label="Verification code" icon={Lock}>
                <input
                  id="login-otp-code"
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
                {loading ? "Verifying…" : "Verify and log in"}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
              >
                Resend code
              </button>
              <AuthTextButton
                onClick={() => {
                  setOtpMode(false);
                  setError("");
                  setOtpNotice("");
                }}
              >
                ← Back to login
              </AuthTextButton>
            </form>
          )}
        </TabsContent>
      </AuthDialogShell>
    </Dialog>
  );
}
