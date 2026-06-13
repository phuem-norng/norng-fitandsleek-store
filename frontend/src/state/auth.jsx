import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { getDeviceMeta } from "../lib/device";
const AUTH_CONTEXT_KEY = "__fitandsleek_auth_context__";
const AuthCtx = globalThis[AUTH_CONTEXT_KEY] || createContext(null);
if (!globalThis[AUTH_CONTEXT_KEY]) {
  globalThis[AUTH_CONTEXT_KEY] = AuthCtx;
}
const TOKEN_KEY = "fs_token";
const USER_CACHE_KEY = "fs_user_snapshot";

function readCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const role = String(user?.role || "").toLowerCase();
    if (role === "admin" && !user?.effective_admin_permissions) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  if (!user) {
    try {
      sessionStorage.removeItem(USER_CACHE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY) ? readCachedUser() : null;
  });
  const [booted, setBooted] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(TOKEN_KEY);
  });
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  });

  const loadMe = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
      setBooted(true);
      setToken(null);
      setUser(null);
      writeCachedUser(null);
      return;
    }

    setToken(currentToken);

    try {
      const { data } = await api.get("/me");
      setUser(data);
      writeCachedUser(data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        writeCachedUser(null);
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
        writeCachedUser(data.user);
      }

      if (data?.otp_required || data?.verification_required) {
        return {
          ...data,
          email,
          purpose: data.purpose || "login",
          email_sent: data.email_sent,
        };
      }

      return data;
    } catch (err) {
      const data = err?.response?.data;
      if (data?.otp_required || data?.verification_required) {
        return {
          ...data,
          email,
          purpose: data.purpose || "login",
          email_sent: data.email_sent,
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
      writeCachedUser(data.user);
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
      writeCachedUser(data.user);
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
      writeCachedUser(data.user);
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
    writeCachedUser(null);
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
