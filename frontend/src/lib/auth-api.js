import api from "./api";

export async function requestPasswordRecovery(email) {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
}

export async function selectVerificationMethod({ challengeToken, method }) {
    const { data } = await api.post("/auth/verification/select-method", {
        challenge_token: challengeToken,
        method,
    });
    return data;
}

export async function verifyOtpWithChallenge({ email, code, purpose, challengeToken }) {
    const { data } = await api.post("/auth/otp/verify", {
        email,
        code,
        purpose,
        challenge_token: challengeToken,
    });
    return data;
}

export async function verifyAuthenticatorChallenge({ challengeToken, code, deviceMeta = {} }) {
    const { data } = await api.post("/auth/two-factor/challenge", {
        challenge_token: challengeToken,
        code,
        ...deviceMeta,
    });
    return data;
}

export async function resendOtpWithChallenge({ email, purpose, challengeToken }) {
    const { data } = await api.post("/auth/otp/resend", {
        email,
        purpose,
        challenge_token: challengeToken,
    });
    return data;
}

export async function resetPasswordWithChallenge({ challengeToken, password, passwordConfirmation }) {
    const { data } = await api.post("/auth/reset-password-otp", {
        challenge_token: challengeToken,
        password,
        password_confirmation: passwordConfirmation,
    });
    return data;
}

/** @deprecated Use requestPasswordRecovery — kept for legacy reset-link page */
export async function requestPasswordResetLink(email) {
    return requestPasswordRecovery(email);
}

export async function submitPasswordReset(payload) {
    const { data } = await api.post("/auth/reset-password", payload);
    return data;
}

export function getApiErrorDetails(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const message = responseData?.message || fallbackMessage;
    const errors = responseData?.errors || {};

    return { message, errors };
}
