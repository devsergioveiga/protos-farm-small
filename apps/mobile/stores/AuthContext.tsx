import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/services/api';
import type { User, AuthTokens } from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): User | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64);
    const payload = JSON.parse(json) as User & { exp?: number };
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organizationId: payload.organizationId,
    };
  } catch {
    return null;
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const SecureStore = await import('expo-secure-store');
      const token = await SecureStore.getItemAsync('protos_access_token');
      if (token) {
        const decoded = decodeJwtPayload(token);
        if (decoded) {
          setUser(decoded);
        } else {
          // Token expired, try refresh
          const refreshed = await refreshSessionInternal();
          if (!refreshed) {
            await api.clearTokens();
          }
        }
      }
    } catch {
      // Silently fail on restore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSessionInternal = async (): Promise<boolean> => {
    try {
      const SecureStore = await import('expo-secure-store');
      const refreshToken = await SecureStore.getItemAsync('protos_refresh_token');
      if (!refreshToken) return false;

      const tokens = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
      await api.setTokens(tokens.accessToken, tokens.refreshToken);
      const decoded = decodeJwtPayload(tokens.accessToken);
      if (decoded) {
        setUser(decoded);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    api.setOnUnauthorized(() => {
      setUser(null);
    });
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.post<AuthTokens>('/auth/login', { email, password });
    await api.setTokens(tokens.accessToken, tokens.refreshToken);
    const decoded = decodeJwtPayload(tokens.accessToken);
    setUser(decoded);
  }, []);

  const logout = useCallback(async () => {
    try {
      const SecureStore = await import('expo-secure-store');
      const refreshToken = await SecureStore.getItemAsync('protos_refresh_token');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Logout silently on error
    } finally {
      await api.clearTokens();
      setUser(null);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    return refreshSessionInternal();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

export { AuthProvider, useAuth };
