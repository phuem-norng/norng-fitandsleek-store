import React, { useState } from "react";
import { Link } from "react-router-dom";
import VerificationMethodPicker from "../components/security/VerificationMethodPicker";
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

export default function ForgotPassword() {
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
                setNotice(data.message || "Choose how to verify your identity.");
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
                const data = await verifyOtpWithChallenge({
                    email,
                    code,
                    purpose: "forgot",
                    challengeToken,
                });
                if (data?.verified) {
                    setNotice(data.message || "Verified. Set your new password.");
                    setStep("password");
                    return;
                }
            } else {
                const data = await verifyAuthenticatorChallenge({
                    challengeToken,
                    code,
                    deviceMeta: getDeviceMeta(),
                });
                if (data?.verified) {
                    setNotice(data.message || "Verified. Set your new password.");
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
            await resendOtpWithChallenge({ email, purpose: "forgot", challengeToken });
            setNotice("A new code was sent to your email.");
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
            const data = await resetPasswordWithChallenge({
                challengeToken,
                password,
                passwordConfirmation: confirm,
            });
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

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">Forgot password</h1>
                <p className="mt-2 text-sm text-slate-600">
                    {step === "email"
                        ? "Enter your email. If an account exists, you can choose how to verify (like Facebook)."
                        : step === "method"
                          ? "Verify it is you before setting a new password."
                          : step === "verify"
                            ? verifyKind === "otp"
                              ? "Enter the code we sent to your email."
                              : "Enter the code from your authenticator app."
                            : step === "password"
                              ? "Choose a strong new password."
                              : "You can sign in with your new password."}
                </p>

                {notice && step !== "done" ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {notice}
                    </div>
                ) : null}
                {error ? (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}
                {step === "done" && notice ? (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {notice}
                    </div>
                ) : null}

                {step === "email" ? (
                    <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                placeholder="name@example.com"
                                required
                            />
                            {validationErrors?.email?.length ? (
                                <p className="mt-1 text-xs text-rose-600">{validationErrors.email[0]}</p>
                            ) : null}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? "Continuing..." : "Continue"}
                        </button>
                    </form>
                ) : null}

                {step === "method" ? (
                    <div className="mt-6">
                        <VerificationMethodPicker
                            methods={verificationMethods}
                            preferredMethod={preferredMethod}
                            loading={loading}
                            onSelect={handleSelectMethod}
                        />
                        <button
                            type="button"
                            className="mt-4 text-sm text-slate-600 underline"
                            onClick={() => setStep("email")}
                        >
                            Use a different email
                        </button>
                    </div>
                ) : null}

                {step === "verify" ? (
                    <form onSubmit={handleVerify} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
                                {verifyKind === "otp" ? "Email code" : "Authenticator code"}
                            </label>
                            <input
                                id="code"
                                type="text"
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-70"
                        >
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                        {verifyKind === "otp" ? (
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={loading}
                                className="w-full text-sm text-slate-600 underline"
                            >
                                Resend code
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setStep("method")}
                            className="w-full text-sm text-slate-600 underline"
                        >
                            Try another method
                        </button>
                    </form>
                ) : null}

                {step === "password" ? (
                    <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                                New password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-slate-700">
                                Confirm password
                            </label>
                            <input
                                id="confirm"
                                type="password"
                                value={confirm}
                                onChange={(event) => setConfirm(event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                required
                            />
                            {validationErrors?.password?.length ? (
                                <p className="mt-1 text-xs text-rose-600">{validationErrors.password[0]}</p>
                            ) : null}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-70"
                        >
                            {loading ? "Saving..." : "Reset password"}
                        </button>
                    </form>
                ) : null}

                <div className="mt-4 text-sm text-slate-600">
                    <Link to="/login" className="font-medium text-slate-900 underline hover:text-slate-700">
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
}
