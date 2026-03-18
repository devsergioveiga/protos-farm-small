import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api';
import PasswordStrengthIndicator, {
  isPasswordValid,
} from '@/components/ui/PasswordStrengthIndicator';
import './LoginPage.css';
import './ForgotPasswordPage.css';
import './ResetPasswordPage.css';

type PageState = 'idle' | 'submitting' | 'success' | 'error';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === 'success' && successRef.current) {
      successRef.current.focus();
    }
  }, [state]);

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
      await api.resetPassword(token!, password);
      setState('success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível redefinir a senha. Tente novamente.';
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
            <p>O link de redefinição de senha é inválido ou está incompleto.</p>
            <Link to="/forgot-password" className="forgot-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Solicitar novo link
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        {state === 'success' ? (
          <div
            className="forgot-success"
            ref={successRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
          >
            <CheckCircle size={48} aria-hidden="true" className="forgot-success-icon" />
            <h1>Senha redefinida com sucesso</h1>
            <p>Sua senha foi alterada. Faça login com a nova senha.</p>
            <Link to="/login" className="forgot-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Ir para o login
            </Link>
          </div>
        ) : (
          <>
            <header className="login-header">
              <Lock size={32} aria-hidden="true" className="forgot-header-icon" />
              <h1>Redefinir senha</h1>
              <p>Crie uma nova senha para sua conta.</p>
            </header>

            {state === 'error' && errorMessage && (
              <div className="login-alert" role="alert" aria-live="polite">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className={`form-field ${fieldErrors.password ? 'form-field-error' : ''}`}>
                <label htmlFor="password">Nova senha *</label>
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
                {state === 'submitting' ? 'Redefinindo...' : 'Redefinir senha'}
              </button>
            </form>

            <Link to="/login" className="forgot-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar para o login
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

export default ResetPasswordPage;
