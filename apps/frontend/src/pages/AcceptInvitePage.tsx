import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import PasswordStrengthIndicator, {
  isPasswordValid,
} from '@/components/ui/PasswordStrengthIndicator';
import './AcceptInvitePage.css';

type PageState = 'idle' | 'submitting' | 'error';

function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === 'error' && formRef.current) {
      const alert = formRef.current.parentElement?.querySelector('[role="alert"]');
      if (alert instanceof HTMLElement) {
        alert.focus();
      }
    }
  }, [state, errorMessage]);

  const validatePassword = () => {
    if (!isPasswordValid(password)) {
      setFieldErrors((prev) => ({ ...prev, password: 'A senha não atende todos os critérios.' }));
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
    return true;
  };

  const validateConfirm = () => {
    if (confirmPassword && confirmPassword !== password) {
      setFieldErrors((prev) => ({ ...prev, confirm: 'As senhas não coincidem.' }));
      return false;
    }
    setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const pwOk = validatePassword();
    const confirmOk =
      confirmPassword === password
        ? (() => {
            setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            return true;
          })()
        : (() => {
            setFieldErrors((prev) => ({ ...prev, confirm: 'As senhas não coincidem.' }));
            return false;
          })();

    if (!pwOk || !confirmOk) return;

    setState('submitting');

    try {
      const tokens = await api.acceptInvite(token!, password);
      loginWithTokens(tokens.accessToken, tokens.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível aceitar o convite. Tente novamente.';
      setErrorMessage(message);
      setState('error');
    }
  };

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="reset-error-state" role="alert">
            <AlertCircle size={48} aria-hidden="true" className="reset-error-icon" />
            <h1>Link inválido</h1>
            <p>O link do convite é inválido ou está incompleto.</p>
            <Link to="/login" className="forgot-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Ir para o login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <UserPlus size={32} aria-hidden="true" className="forgot-header-icon" />
          <h1>Defina sua senha</h1>
          <p>Crie uma senha para acessar o Protos Farm.</p>
        </header>

        {state === 'error' && errorMessage && (
          <div className="login-alert" role="alert" aria-live="polite" tabIndex={-1}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate ref={formRef}>
          <div className={`form-field ${fieldErrors.password ? 'form-field-error' : ''}`}>
            <label htmlFor="password">Senha *</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={validatePassword}
              autoComplete="new-password"
              aria-required="true"
              aria-describedby="password-strength"
              disabled={state === 'submitting'}
            />
            {fieldErrors.password && (
              <span className="field-error" role="alert" aria-live="polite">
                <AlertCircle size={12} aria-hidden="true" />
                {fieldErrors.password}
              </span>
            )}
            <div id="password-strength">
              <PasswordStrengthIndicator password={password} />
            </div>
          </div>

          <div className={`form-field ${fieldErrors.confirm ? 'form-field-error' : ''}`}>
            <label htmlFor="confirm-password">Confirmar senha *</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={validateConfirm}
              autoComplete="new-password"
              aria-required="true"
              disabled={state === 'submitting'}
            />
            {fieldErrors.confirm && (
              <span className="field-error" role="alert" aria-live="polite">
                <AlertCircle size={12} aria-hidden="true" />
                {fieldErrors.confirm}
              </span>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={state === 'submitting'}>
            {state === 'submitting' ? 'Criando conta...' : 'Criar conta e entrar'}
          </button>
        </form>

        <Link to="/login" className="forgot-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Já tenho uma conta
        </Link>
      </section>
    </main>
  );
}

export default AcceptInvitePage;
