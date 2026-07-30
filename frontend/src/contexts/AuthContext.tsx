import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AuthTokens, CurrentUser } from '../types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

interface AuthContextValue {
  currentUser: CurrentUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  ACCESS: 'cs_access_token',
  REFRESH: 'cs_refresh_token',
  USER: 'cs_current_user',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.ACCESS)
  );
  const [isLoading, setIsLoading] = useState(false);

  const _storeTokens = (tokens: AuthTokens, user: CurrentUser) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH, tokens.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    setAccessToken(tokens.access_token);
    setCurrentUser(user);
  };

  const _clearAuth = () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setAccessToken(null);
    setCurrentUser(null);
  };

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH);
    if (!refreshToken) { _clearAuth(); return null; }

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) { _clearAuth(); return null; }
      const tokens: AuthTokens = await res.json();
      localStorage.setItem(STORAGE_KEYS.ACCESS, tokens.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH, tokens.refresh_token);
      setAccessToken(tokens.access_token);
      return tokens.access_token;
    } catch {
      _clearAuth();
      return null;
    }
  }, []);

  // Auto-refresh: schedule refresh 60s before expiry (default 30min → at 29min)
  useEffect(() => {
    if (!accessToken) return;
    const EXPIRE_MS = 30 * 60 * 1000; // 30 min
    const REFRESH_BEFORE_MS = 60 * 1000; // 1 min before
    const timer = setTimeout(refreshAccessToken, EXPIRE_MS - REFRESH_BEFORE_MS);
    return () => clearTimeout(timer);
  }, [accessToken, refreshAccessToken]);

  const login = async (username: string, password: string, rememberMe = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
      });
      if (!res.ok) {
        let errorMessage = 'Login failed';
        try {
          const err = await res.json();
          errorMessage = err.detail ?? errorMessage;
        } catch {
          try {
            const txt = await res.text();
            if (txt && txt.length < 200) {
              errorMessage = txt;
            } else {
              errorMessage = `Server error (${res.status}): ${res.statusText || 'Internal Server Error'}`;
            }
          } catch {
            errorMessage = `Server error (${res.status})`;
          }
        }
        throw new Error(errorMessage);
      }
      const tokens: AuthTokens = await res.json();

      // Fetch current user profile
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!meRes.ok) throw new Error('Failed to fetch user profile');
      const user: CurrentUser = await meRes.json();

      _storeTokens(tokens, user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH);
    if (accessToken && refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch { /* ignore network errors on logout */ }
    }
    _clearAuth();
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      accessToken,
      isLoading,
      isAuthenticated: !!accessToken && !!currentUser,
      login,
      logout,
      refreshAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
