import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const code = searchParams.get('code');

    if (!code) {
      navigate('/login?error=google_error', { replace: true });
      return;
    }

    api
      .post<{ accessToken: string; refreshToken: string }>('/auth/google/exchange', { code })
      .then((tokens) => {
        loginWithTokens(tokens.accessToken, tokens.refreshToken);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=google_error', { replace: true });
      });
  }, [searchParams, navigate, loginWithTokens]);

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <p>Autenticando...</p>
    </main>
  );
}

export default AuthCallbackPage;
