import React, { useState } from "react";
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
  const [success, setSuccess] = useState("");
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

  const handleEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await requestPasswordRecovery(email);
      if (data?.verification_required && data?.challenge_token) {
        setChallengeToken(data.challenge_token);
        setVerificationMethods(data.verification_methods || []);
        setPreferredMethod(data.preferred_method || "email");
        setNotice(data.message || "Choose how to verify.");
        setStep("method");
        return;
      }
      setSuccess(data?.message || "If the account exists, check your email.");
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
        setNotice(data.message || "Code sent.");
        setStep("verify");
        return;
      }
      if (data?.step === "authenticator") {
        setVerifyKind("authenticator");
        setNotice(data.message || "Enter authenticator code.");
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
        const data = await verifyOtpWithChallenge({
          email,
          code,
          purpose: "forgot",
          challengeToken,
        });
        if (data?.verified) {
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
          setStep("password");
          return;
        }
      }
      setError("Verification failed.");
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
    setSuccess("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await resetPasswordWithChallenge({
        challengeToken,
        password,
        passwordConfirmation: confirm,
      });
      setSuccess(data?.message || "Password reset successful!");
      setStep("done");
    } catch (err) {
      const { message } = getApiErrorDetails(err, "Failed to reset password.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-bold text-slate-900">Forgot Password</h2>

        {success ? <div className="mb-4 text-sm text-green-700">{success}</div> : null}
        {notice && step !== "done" ? <div className="mb-4 text-sm text-emerald-700">{notice}</div> : null}
        {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

        {step === "email" && !success ? (
          <form onSubmit={handleEmail}>
            <label className="mb-2 block text-sm font-medium">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              required
            />
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white" disabled={loading}>
              {loading ? "Continuing..." : "Continue"}
            </button>
          </form>
        ) : null}

        {step === "method" ? (
          <VerificationMethodPicker
            methods={verificationMethods}
            preferredMethod={preferredMethod}
            loading={loading}
            onSelect={handleSelectMethod}
          />
        ) : null}

        {step === "verify" ? (
          <form onSubmit={handleVerify}>
            <label className="mb-2 block text-sm font-medium">
              {verifyKind === "otp" ? "Email code" : "Authenticator code"}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              required
            />
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </button>
            {verifyKind === "otp" ? (
              <button
                type="button"
                className="mt-2 block text-sm text-indigo-600 underline"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await resendOtpWithChallenge({ email, purpose: "forgot", challengeToken });
                    setNotice("Code resent.");
                  } catch (err) {
                    setError(err?.response?.data?.message || "Resend failed");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Resend code
              </button>
            ) : null}
            <button type="button" className="mt-2 block text-sm text-gray-500 underline" onClick={() => setStep("method")}>
              Try another method
            </button>
          </form>
        ) : null}

        {step === "password" ? (
          <form onSubmit={handleReset}>
            <label className="mb-2 block text-sm font-medium">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              required
            />
            <label className="mb-2 block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              required
            />
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-white" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        ) : null}

        <button
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          onClick={() => {
            resetFlow();
            onClose();
          }}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
