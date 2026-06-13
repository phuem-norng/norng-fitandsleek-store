import React, { useState } from "react";
import { X, Mail, Lock, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import VerificationMethodPicker from "../security/VerificationMethodPicker";
import {
  getApiErrorDetails,
  requestPasswordRecovery,
  resetPasswordWithChallenge,
  resendOtpWithChallenge,
  selectVerificationMethod,
  verifyAuthenticatorChallenge,
  verifyOtpWithChallenge,
} from "../../lib/auth-api";
import { getDeviceMeta } from "../../lib/device";
import { formatOtpNotice } from "../auth/AuthDialogShared";

const INPUT_CLASS =
  "h-14 w-full rounded-none border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6E8B7E] focus:bg-white focus:ring-2 focus:ring-[#6E8B7E]/20";
const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN_PRIMARY =
  "flex h-14 w-full items-center justify-center bg-[#6E8B7E] text-base font-semibold text-white shadow-md shadow-[#6E8B7E]/30 transition hover:bg-[#5d7a6d] hover:shadow-lg hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E8B7E] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none";

function Notice({ message }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-start gap-2.5 border border-[#6E8B7E]/30 bg-[#6E8B7E]/8 px-4 py-3 text-sm text-[#38554a]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6E8B7E]" />
      <span>{message}</span>
    </div>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-start gap-2.5 border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
      <span>{message}</span>
    </div>
  );
}

export default function ForgotPasswordDialog({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("email");
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationMethods, setVerificationMethods] = useState([]);
  const [preferredMethod, setPreferredMethod] = useState("email");
  const [verifyKind, setVerifyKind] = useState("otp");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetFlow = () => {
    setStep("email");
    setChallengeToken("");
    setVerificationMethods([]);
    setCode("");
    setPassword("");
    setConfirm("");
    setNotice("");
    setError("");
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await requestPasswordRecovery(email);
      if (data?.verification_required && data?.challenge_token) {
        setChallengeToken(data.challenge_token);
        setVerificationMethods(data.verification_methods || []);
        setPreferredMethod(data.preferred_method || "email");
        setNotice(
          formatOtpNotice({
            message: data.message,
            email,
            emailSent: data.email_sent,
          }),
        );
        if (data.step === "otp") {
          setVerifyKind("otp");
          setStep("verify");
          return;
        }
        setStep("method");
        return;
      }
      setNotice(data?.message || "If the account exists, check your email.");
      setStep("done");
    } catch (err) {
      const { message } = getApiErrorDetails(err, "Failed to continue.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMethod = async (method) => {
    setLoading(true);
    setError("");
    try {
      const data = await selectVerificationMethod({ challengeToken, method });
      if (data?.step === "otp") {
        setVerifyKind("otp");
        setNotice(data.message || "Code sent to your email.");
        setStep("verify");
        return;
      }
      if (data?.step === "authenticator") {
        setVerifyKind("authenticator");
        setNotice(data.message || "Enter your authenticator code.");
        setStep("verify");
      }
    } catch (err) {
      const { message } = getApiErrorDetails(err, "Could not start verification.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (verifyKind === "otp") {
        const data = await verifyOtpWithChallenge({ email, code, purpose: "forgot", challengeToken });
        if (data?.verified) { setStep("password"); return; }
      } else {
        const data = await verifyAuthenticatorChallenge({ challengeToken, code, deviceMeta: getDeviceMeta() });
        if (data?.verified) { setStep("password"); return; }
      }
      setError("Verification failed. Please try again.");
    } catch (err) {
      const { message } = getApiErrorDetails(err, "Verification failed.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const data = await resetPasswordWithChallenge({ challengeToken, password, passwordConfirmation: confirm });
      setNotice(data?.message || "Password reset successfully!");
      setStep("done");
    } catch (err) {
      const { message } = getApiErrorDetails(err, "Failed to reset password.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = {
    email: "Reset your password",
    method: "Verify your identity",
    verify: "Enter verification code",
    password: "Set new password",
    done: "All done!",
  };

  const stepSubtitle = {
    email: "Enter your registered email address to begin.",
    method: "Choose how you'd like to verify your identity.",
    verify: verifyKind === "otp" ? "Enter the 6-digit code sent to your email." : "Enter the code from your authenticator app.",
    password: "Choose a strong new password for your account.",
    done: "Your password has been updated. You can now sign in.",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[480px] overflow-hidden rounded-[14px] shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        {/* Branded header */}
        <div
          className="relative flex flex-col items-center px-8 pb-7 pt-9"
          style={{ background: "linear-gradient(150deg, #4a6b5e 0%, #38554a 55%, #2e4a3f 100%)" }}
        >
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 p-1.5 text-white/70 backdrop-blur-sm transition hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-center text-xl font-semibold tracking-tight text-white">
            {stepTitle[step]}
          </h2>
          <p className="mt-1.5 text-center text-sm text-white/60 max-w-xs">
            {stepSubtitle[step]}
          </p>
        </div>

        {/* Form body */}
        <div className="bg-white px-8 pb-8 pt-7">
          <Notice message={notice} />
          <ErrorBox message={error} />

          {/* ── Step: email ── */}
          {step === "email" && (
            <form onSubmit={handleEmail} className="flex flex-col gap-5">
              <div>
                <label htmlFor="fpd-email" className={LABEL_CLASS}>Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="fpd-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={BTN_PRIMARY}>
                {loading ? "Continuing…" : "Continue"}
              </button>
              <button type="button" onClick={handleClose} className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
            </form>
          )}

          {/* ── Step: method ── */}
          {step === "method" && (
            <div className="flex flex-col gap-5">
              <VerificationMethodPicker
                methods={verificationMethods}
                preferredMethod={preferredMethod}
                loading={loading}
                onSelect={handleSelectMethod}
              />
              <button type="button" onClick={() => setStep("email")} className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Use a different email
              </button>
            </div>
          )}

          {/* ── Step: verify ── */}
          {step === "verify" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              <div>
                <label htmlFor="fpd-code" className={LABEL_CLASS}>
                  {verifyKind === "otp" ? "Verification code" : "Authenticator code"}
                </label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="fpd-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="6-digit code"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={BTN_PRIMARY}>
                {loading ? "Verifying…" : "Verify identity"}
              </button>
              {verifyKind === "otp" && (
                <button type="button" onClick={async () => {
                  setLoading(true);
                  try {
                    await resendOtpWithChallenge({ email, purpose: "forgot", challengeToken });
                    setNotice("A new code was sent to your email.");
                  } catch (err) {
                    setError(err?.response?.data?.message || "Resend failed.");
                  } finally {
                    setLoading(false);
                  }
                }} disabled={loading} className="text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors disabled:opacity-50">
                  Didn't receive a code? Resend
                </button>
              )}
              <button type="button" onClick={() => setStep("method")} className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Try another method
              </button>
            </form>
          )}

          {/* ── Step: password ── */}
          {step === "password" && (
            <form onSubmit={handleReset} className="flex flex-col gap-5">
              <div>
                <label htmlFor="fpd-password" className={LABEL_CLASS}>New password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="fpd-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="fpd-confirm" className={LABEL_CLASS}>Confirm new password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="fpd-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Repeat your password"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className={BTN_PRIMARY}>
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}

          {/* ── Step: done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#6E8B7E]/12">
                <CheckCircle2 className="h-9 w-9 text-[#6E8B7E]" />
              </div>
              <button onClick={handleClose} className={BTN_PRIMARY}>
                Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
