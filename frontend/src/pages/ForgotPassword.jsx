import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import VerificationMethodPicker from "../components/security/VerificationMethodPicker";
import Logo from "../components/Logo.jsx";
import { useHomepageSettings } from "../state/homepageSettings.jsx";
import {
    getApiErrorDetails,
    requestPasswordRecovery,
    resetPasswordWithChallenge,
    resendOtpWithChallenge,
    selectVerificationMethod,
    verifyAuthenticatorChallenge,
    verifyOtpWithChallenge,
} from "../lib/auth-api";
import { getDeviceMeta } from "../lib/device";
import { formatOtpNotice } from "../components/auth/AuthDialogShared";

const INPUT_CLASS =
    "h-14 w-full rounded-none border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#6E8B7E] focus:bg-white focus:ring-2 focus:ring-[#6E8B7E]/20";
const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN_PRIMARY =
    "flex h-14 w-full items-center justify-center bg-[#6E8B7E] text-base font-semibold text-white shadow-md shadow-[#6E8B7E]/30 transition hover:bg-[#5d7a6d] hover:shadow-lg hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6E8B7E] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none";

const STEPS = ["email", "method", "verify", "password", "done"];

function StepIndicator({ current }) {
    const active = STEPS.indexOf(current);
    const labels = ["Email", "Method", "Verify", "New Password"];
    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {labels.map((label, i) => (
                <React.Fragment key={label}>
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                i < active
                                    ? "bg-[#6E8B7E] text-white"
                                    : i === active
                                      ? "bg-[#38554a] text-white ring-4 ring-[#6E8B7E]/25"
                                      : "bg-slate-100 text-slate-400"
                            }`}
                        >
                            {i < active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <span
                            className={`text-[10px] font-medium ${
                                i <= active ? "text-[#38554a]" : "text-slate-400"
                            }`}
                        >
                            {label}
                        </span>
                    </div>
                    {i < labels.length - 1 && (
                        <div
                            className={`mb-4 h-px w-8 sm:w-12 transition-colors ${
                                i < active ? "bg-[#6E8B7E]" : "bg-slate-200"
                            }`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

function Notice({ message }) {
    if (!message) return null;
    return (
        <div className="mb-5 flex items-start gap-2.5 rounded-none border border-[#6E8B7E]/30 bg-[#6E8B7E]/8 px-4 py-3 text-sm text-[#38554a]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6E8B7E]" />
            <span>{message}</span>
        </div>
    );
}

function ErrorBox({ message }) {
    if (!message) return null;
    return (
        <div className="mb-5 flex items-start gap-2.5 rounded-none border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
            <span>{message}</span>
        </div>
    );
}

export default function ForgotPassword() {
    const { settings } = useHomepageSettings();
    const [step, setStep] = useState("email");
    const [email, setEmail] = useState("");
    const [challengeToken, setChallengeToken] = useState("");
    const [verificationMethods, setVerificationMethods] = useState([]);
    const [preferredMethod, setPreferredMethod] = useState("email");
    const [verifyKind, setVerifyKind] = useState("otp");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [validationErrors, setValidationErrors] = useState({});

    const handleEmailSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setNotice("");
        setValidationErrors({});
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
            setNotice(data?.message || "If the account exists, you can continue with verification.");
            setStep("done");
        } catch (err) {
            const { message, errors } = getApiErrorDetails(err, "Unable to process your request right now.");
            setError(message);
            setValidationErrors(errors);
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

    const handleVerify = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            if (verifyKind === "otp") {
                const data = await verifyOtpWithChallenge({ email, code, purpose: "forgot", challengeToken });
                if (data?.verified) {
                    setNotice("Verified. Set your new password below.");
                    setStep("password");
                    return;
                }
            } else {
                const data = await verifyAuthenticatorChallenge({ challengeToken, code, deviceMeta: getDeviceMeta() });
                if (data?.verified) {
                    setNotice("Verified. Set your new password below.");
                    setStep("password");
                    return;
                }
            }
            setError("Verification failed. Please try again.");
        } catch (err) {
            const { message } = getApiErrorDetails(err, "Verification failed.");
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await resendOtpWithChallenge({ email, purpose: "forgot", challengeToken });
            setNotice(
                formatOtpNotice({
                    message: data?.message,
                    email,
                    emailSent: data?.email_sent,
                    fallback: "A new code was sent to your email.",
                }),
            );
        } catch (err) {
            const { message } = getApiErrorDetails(err, "Could not resend code.");
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setValidationErrors({});
        try {
            const data = await resetPasswordWithChallenge({ challengeToken, password, passwordConfirmation: confirm });
            setNotice(data?.message || "Password reset successfully.");
            setStep("done");
        } catch (err) {
            const { message, errors } = getApiErrorDetails(err, "Could not reset password.");
            setError(message);
            setValidationErrors(errors);
        } finally {
            setLoading(false);
        }
    };

    const stepSubtitle = {
        email: "Enter your registered email to start the recovery process.",
        method: "Choose how you'd like to verify your identity.",
        verify: verifyKind === "otp" ? "Enter the 6-digit code we sent to your email." : "Enter the code from your authenticator app.",
        password: "Choose a strong new password for your account.",
        done: "Your password has been updated successfully.",
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-12"
            style={{ background: "linear-gradient(160deg, #f0f4f2 0%, #e8eeeb 100%)" }}
        >
            <div className="w-full max-w-[480px] overflow-hidden rounded-[14px] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                {/* Branded header */}
                <div
                    className="flex flex-col items-center px-10 pb-8 pt-10"
                    style={{ background: "linear-gradient(150deg, #4a6b5e 0%, #38554a 55%, #2e4a3f 100%)" }}
                >
                    <Link to="/" className="mx-auto flex w-fit items-center justify-center transition-opacity hover:opacity-85">
                        <Logo
                            className="h-16 w-auto max-w-[220px] drop-shadow-lg brightness-0 invert"
                            src={settings?.header?.logo_url || "/logo.png"}
                            alt="Fit & Sleek"
                        />
                    </Link>
                    <h1 className="mt-5 text-center text-xl font-semibold tracking-tight text-white">
                        {step === "done" ? "All done!" : "Reset your password"}
                    </h1>
                    <p className="mt-1.5 text-center text-sm text-white/60 max-w-xs">
                        {stepSubtitle[step]}
                    </p>
                </div>

                {/* Form body */}
                <div className="bg-white px-10 pb-10 pt-8">
                    {step !== "done" && <StepIndicator current={step} />}

                    <Notice message={notice} />
                    <ErrorBox message={error} />

                    {/* ── Step: email ── */}
                    {step === "email" && (
                        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="fp-email" className={LABEL_CLASS}>Email address</label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                                    <input
                                        id="fp-email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={INPUT_CLASS}
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                                {validationErrors?.email?.length ? (
                                    <p className="mt-1.5 text-xs text-rose-600">{validationErrors.email[0]}</p>
                                ) : null}
                            </div>
                            <button type="submit" disabled={loading} className={BTN_PRIMARY}>
                                {loading ? "Continuing…" : "Continue"}
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
                            <button
                                type="button"
                                onClick={() => setStep("email")}
                                className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Use a different email
                            </button>
                        </div>
                    )}

                    {/* ── Step: verify ── */}
                    {step === "verify" && (
                        <form onSubmit={handleVerify} className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="fp-code" className={LABEL_CLASS}>
                                    {verifyKind === "otp" ? "Verification code" : "Authenticator code"}
                                </label>
                                <div className="relative">
                                    <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                                    <input
                                        id="fp-code"
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
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={loading}
                                    className="text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors disabled:opacity-50"
                                >
                                    Didn't receive a code? Resend
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setStep("method")}
                                className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#38554a] transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Try another method
                            </button>
                        </form>
                    )}

                    {/* ── Step: password ── */}
                    {step === "password" && (
                        <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="fp-password" className={LABEL_CLASS}>New password</label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                                    <input
                                        id="fp-password"
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
                                <label htmlFor="fp-confirm" className={LABEL_CLASS}>Confirm new password</label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                                    <input
                                        id="fp-confirm"
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className={INPUT_CLASS}
                                        placeholder="Repeat your password"
                                        required
                                    />
                                </div>
                                {validationErrors?.password?.length ? (
                                    <p className="mt-1.5 text-xs text-rose-600">{validationErrors.password[0]}</p>
                                ) : null}
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
                            <p className="text-center text-sm text-slate-600 max-w-xs">
                                You can now sign in using your new password.
                            </p>
                            <Link
                                to="/login"
                                className={`${BTN_PRIMARY} mt-2 no-underline`}
                                style={{ display: "flex" }}
                            >
                                Back to login
                            </Link>
                        </div>
                    )}

                    {/* Back to login link (all steps except done) */}
                    {step !== "done" && (
                        <p className="mt-7 text-center text-sm text-slate-500">
                            Remembered it?{" "}
                            <Link
                                to="/login"
                                className="font-semibold text-[#6E8B7E] underline-offset-2 hover:text-[#5d7a6d] hover:underline"
                            >
                                Back to login
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
