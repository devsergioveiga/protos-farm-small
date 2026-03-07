import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'protos_access_token';
const REFRESH_KEY = 'protos_refresh_token';

interface ApiError {
  error: string;
  details?: string[];
}

let refreshPromise: Promise<boolean> | null = null;

class ApiClient {
  private baseUrl: string;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
  }

  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  private async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  private async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  private async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = await this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const isAuthRoute = path.startsWith('/auth/');

    if (response.status === 401 && retry && !isAuthRoute) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(method, path, body, false);
      }
      await this.clearTokens();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new Error('Sessão expirada');
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as ApiError;
      const error = new Error(errorBody.error || 'Erro inesperado') as Error & {
        status: number;
        details?: string[];
      };
      error.status = response.status;
      error.details = errorBody.details;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  private async tryRefresh(): Promise<boolean> {
    // Mutex: only one refresh at a time
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = this._doRefresh();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
      await this.setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient();
export { TOKEN_KEY, REFRESH_KEY };
