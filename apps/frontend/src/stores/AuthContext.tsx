import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, TOKEN_KEY } from '@/services/api';

interface User {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
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
    return payload;
  } catch {
    return null;
  }
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await api.get<{ permissions: string[] }>('/org/permissions/me');
      setPermissions(data.permissions);
    } catch {
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    api.setOnUnauthorized(() => {
      setUser(null);
      setPermissions([]);
    });

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const decoded = decodeJwtPayload(token);
      if (decoded) {
        setUser(decoded);
        void fetchPermissions();
      } else {
        api.clearTokens();
      }
    }
    setIsLoading(false);
  }, [fetchPermissions]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
        email,
        password,
      });

      api.setTokens(tokens.accessToken, tokens.refreshToken);
      const decoded = decodeJwtPayload(tokens.accessToken);
      setUser(decoded);
      void fetchPermissions();
    },
    [fetchPermissions],
  );

  const loginWithTokens = useCallback(
    (accessToken: string, refreshToken: string) => {
      api.setTokens(accessToken, refreshToken);
      const decoded = decodeJwtPayload(accessToken);
      setUser(decoded);
      void fetchPermissions();
    },
    [fetchPermissions],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('protos_refresh_token');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Logout silently on error
    } finally {
      api.clearTokens();
      setUser(null);
      setPermissions([]);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        permissions,
        login,
        loginWithTokens,
        logout,
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
