import { useState, type FormEvent, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '@/services/api';
import './ForgotPasswordPage.css';

type PageState = 'idle' | 'submitting' | 'success' | 'error';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<PageState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === 'success' && successRef.current) {
      successRef.current.focus();
    }
  }, [state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Informe seu email.');
      setState('error');
      return;
    }

    setState('submitting');

    try {
      await api.forgotPassword(email);
      setState('success');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível enviar o link. Tente novamente.';
      setErrorMessage(message);
      setState('error');
    }
  };

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
            <h1>Verifique seu e-mail</h1>
            <p>
              Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de
              entrada e a pasta de spam.
            </p>
            <Link to="/login" className="forgot-back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <header className="login-header">
              <Mail size={32} aria-hidden="true" className="forgot-header-icon" />
              <h1>Esqueci minha senha</h1>
              <p>Informe seu email e enviaremos um link para redefinir sua senha.</p>
            </header>

            {state === 'error' && errorMessage && (
              <div className="login-alert" role="alert" aria-live="polite">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  aria-required="true"
                  disabled={state === 'submitting'}
                />
              </div>

              <button type="submit" className="btn-primary" disabled={state === 'submitting'}>
                {state === 'submitting' ? 'Enviando...' : 'Enviar link de recuperação'}
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

export default ForgotPasswordPage;
