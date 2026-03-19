const TOKEN_KEY = 'protos_access_token';
const REFRESH_KEY = 'protos_refresh_token';

interface ApiError {
  error: string;
  details?: string[];
}

class ApiClient {
  private baseUrl = '/api';
  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(callback: () => void): void {
    this.onUnauthorized = callback;
  }

  private getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }

  clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  private async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getAccessToken();
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
      this.clearTokens();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      } else {
        window.location.href = '/login';
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
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
      this.setTokens(tokens.accessToken, tokens.refreshToken);
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

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  deleteWithBody<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }

  async getBlob(path: string, retry = true): Promise<Blob> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });

    if (response.status === 401 && retry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.getBlob(path, false);
      }
      this.clearTokens();
      if (this.onUnauthorized) {
        this.onUnauthorized();
      } else {
        window.location.href = '/login';
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

    return response.blob();
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

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

  forgotPassword(email: string): Promise<{ message: string }> {
    return this.post('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return this.post('/auth/reset-password', { token, password });
  }

  acceptInvite(
    token: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.post('/auth/accept-invite', { token, password });
  }
}

export const api = new ApiClient();

export { TOKEN_KEY, REFRESH_KEY };
