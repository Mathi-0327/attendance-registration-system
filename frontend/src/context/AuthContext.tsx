/**
 * @file frontend/src/context/AuthContext.tsx
 * @description Authentication & authorization state provider.
 * Implements JWT token handling, automatic token refresh, and RBAC utility functions.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { SafeUser, LoginResponse, JWTPayload } from "@shared/types";
import { UserRole, Permission } from "@shared/types";

interface AuthContextType {
  user: SafeUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, name: string, phone?: string) => Promise<any>;
  verifyEmail: (otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, password: string) => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: Permission | Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "attendreg_access_token";
const REFRESH_KEY = "attendreg_refresh_token";
const REMEMBER_KEY = "attendreg_remember_me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to extract tokens from storage based on rememberMe preference
  const getStoredToken = (key: string): string | null => {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  };

  const storeToken = (key: string, value: string, rememberMe = false) => {
    if (rememberMe) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  };

  const clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REMEMBER_KEY);
  };

  // Perform initial authorization checks and set up automatic token refresh loop
  useEffect(() => {
    const initAuth = async () => {
      const storedRefresh = getStoredToken(REFRESH_KEY);
      if (!storedRefresh) {
        setLoading(false);
        return;
      }

      try {
        // Attempt token refresh immediately on start-up
        await performRefresh(storedRefresh);
      } catch (err) {
        console.error("[auth] Automatic session restoration failed:", err);
        clearTokens();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!accessToken) return;

    // Decode token to see when it expires (safety margin of 30 seconds)
    try {
      const parts = accessToken.split(".");
      if (parts.length === 3) {
        const payload: JWTPayload = JSON.parse(atob(parts[1]));
        const expTime = (payload.exp || 0) * 1000;
        const delay = expTime - Date.now() - 30 * 1000;

        if (delay > 0) {
          const timer = setTimeout(() => {
            const storedRefresh = getStoredToken(REFRESH_KEY);
            if (storedRefresh) {
              performRefresh(storedRefresh).catch((e) => {
                console.error("[auth] Silent refresh failed:", e);
                logout();
              });
            }
          }, delay);

          return () => clearTimeout(timer);
        }
      }
    } catch (e) {
      console.error("[auth] Error setting up refresh timer:", e);
    }
  }, [accessToken]);

  const performRefresh = async (refreshToken: string) => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new Error("Refresh failed");
    }

    const data = await res.json();
    const rememberMe = getStoredToken(REMEMBER_KEY) === "true";

    setAccessToken(data.tokens.accessToken);
    storeToken(TOKEN_KEY, data.tokens.accessToken, rememberMe);
    storeToken(REFRESH_KEY, data.tokens.refreshToken, rememberMe);

    // Fetch user details
    await fetchUserProfile(data.tokens.accessToken);
  };

  const fetchUserProfile = async (token: string) => {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch user profile");
    }

    const data = await res.json();
    setUser(data.user);
  };

  const login = async (identifier: string, password: string, rememberMe = false): Promise<LoginResponse> => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Login failed. Check credentials.");
      }

      const data: LoginResponse = await res.json();

      if (data.requiresTwoFactor) {
        return data;
      }

      if (data.tokens && data.user) {
        setAccessToken(data.tokens.accessToken);
        setUser(data.user);
        storeToken(TOKEN_KEY, data.tokens.accessToken, rememberMe);
        storeToken(REFRESH_KEY, data.tokens.refreshToken, rememberMe);
        storeToken(REMEMBER_KEY, rememberMe ? "true" : "false", rememberMe);
      }

      return data;
    } catch (error) {
      console.error("[auth] Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const storedRefresh = getStoredToken(REFRESH_KEY);
    if (storedRefresh && accessToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken: storedRefresh }),
        });
      } catch (e) {
        console.warn("[auth] Server-side logout request failed:", e);
      }
    }
    clearTokens();
    setUser(null);
    setAccessToken(null);
  };

  const register = async (username: string, email: string, password: string, name: string, phone?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, name, phone, role: "student" }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Registration failed");
    }

    return res.json();
  };

  const verifyEmail = async (otp: string) => {
    if (!accessToken) throw new Error("Unauthenticated");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ otp }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Email verification failed");
    }

    if (user) {
      setUser({ ...user, isEmailVerified: true });
    }
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to submit request");
    }
  };

  const resetPassword = async (email: string, otp: string, password: string) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, password }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Password reset failed");
    }
  };

  const hasRole = (allowed: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.roles.includes(UserRole.SUPER_ADMIN)) return true;
    const allowedList = Array.isArray(allowed) ? allowed : [allowed];
    return allowedList.some((role) => user.roles.includes(role));
  };

  const hasPermission = (required: Permission | Permission[]): boolean => {
    if (!user) return false;
    if (user.roles.includes(UserRole.SUPER_ADMIN)) return true;
    const requiredList = Array.isArray(required) ? required : [required];
    return requiredList.some((perm) => user.permissions.includes(perm));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        accessToken,
        login,
        logout,
        register,
        verifyEmail,
        forgotPassword,
        resetPassword,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
