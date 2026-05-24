import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { getDeviceMeta } from "../lib/device";

const AUTH_CONTEXT_KEY = "__fitandsleek_auth_context__";
const AuthCtx = globalThis[AUTH_CONTEXT_KEY] || createContext(null);
if (!globalThis[AUTH_CONTEXT_KEY]) {
  globalThis[AUTH_CONTEXT_KEY] = AuthCtx;
}
const TOKEN_KEY = "fs_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [token, setToken] = useState(null);

  // Initialize token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const loadMe = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setBooted(true);
      setToken(null);
      setUser(null);
      return;
    }

    // Ensure token state is synced
    setToken(currentToken);

    try {
      const { data } = await api.get("/me");
      setUser(data);
    } catch (err) {
      // If 404 or 401, token might be invalid - clear it
      if (err.response?.status === 404 || err.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } finally {
      setBooted(true);
    }
  };

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
        ...getDeviceMeta(),
      });
      if (data?.token) {
        const newToken = data.token;
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(data.user);
      }

      return data;
    } catch (err) {
      const data = err?.response?.data;
      if (data?.otp_required || data?.verification_required) {
        return {
          ...data,
          email,
          purpose: data.purpose || "login",
        };
      }
      // Normalize error shape so callers can show a friendly message
      if (data) {
        return {
          error: true,
          message: data.message || data.error || "Invalid email or password",
          status: err.response?.status,
        };
      }
      throw err;
    }
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    if (data?.token) {
      const newToken = data.token;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(data.user);
    }
    return data;
  };

  const selectVerificationMethod = async ({ challengeToken, method }) => {
    const { data } = await api.post("/auth/verification/select-method", {
      challenge_token: challengeToken,
      method,
    });
    return data;
  };

  const verifyOtp = async ({ email, code, purpose, challengeToken }) => {
    const { data } = await api.post("/auth/otp/verify", {
      email,
      code,
      purpose,
      challenge_token: challengeToken,
      ...getDeviceMeta(),
    });
    if (data?.two_factor_required && data?.challenge_token) {
      return data;
    }
    const newToken = data.token;
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(data.user);
    }
    return data;
  };

  const verifyTwoFactor = async ({ challengeToken, code }) => {
    const { data } = await api.post("/auth/two-factor/challenge", {
      challenge_token: challengeToken,
      code,
      ...getDeviceMeta(),
    });
    const newToken = data.token;
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(data.user);
    }
    return data;
  };

  const resendOtp = async ({ email, purpose, challengeToken }) => {
    const { data } = await api.post("/auth/otp/resend", {
      email,
      purpose,
      challenge_token: challengeToken,
      ...getDeviceMeta(),
    });
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      booted,
      token,
      login,
      register,
      selectVerificationMethod,
      verifyOtp,
      verifyTwoFactor,
      resendOtp,
      logout,
      refresh: loadMe,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, booted, token]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { TOKEN_KEY };
