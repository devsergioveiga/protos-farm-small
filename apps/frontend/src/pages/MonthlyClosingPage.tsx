import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Lock,
  ShieldCheck,
  Unlock,
  ChevronDown,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import {
  useMonthlyClosing,
  useStartClosing,
  useValidateStep,
  useCompleteClosing,
  useReopenClosing,
} from '@/hooks/useMonthlyClosing';
import {
  STEP_LABELS,
  STEP_MODULE_LINKS,
} from '@/types/monthly-closing';
import type { MonthlyClosingOutput, StepResults } from '@/types/monthly-closing';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/stores/AuthContext';
import './MonthlyClosingPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? `Mês ${month}`} / ${year}`;
}

function getStepResult(stepResults: StepResults, stepNumber: number) {
  const key = `step${stepNumber}` as keyof StepResults;
  return stepResults[key];
}

function isStepBlocked(stepResults: StepResults, stepNumber: number): boolean {
  if (stepNumber === 1) return false;
  const prevResult = getStepResult(stepResults, stepNumber - 1);
  return !prevResult || prevResult.status !== 'OK';
}

// ─── Step icon ────────────────────────────────────────────────────────────────

interface StepIconProps {
  stepNumber: number;
  status: 'ok' | 'failed' | 'pending' | 'blocked';
}

function StepIcon({ stepNumber, status }: StepIconProps) {
  if (status === 'ok') {
    return <CheckCircle2 size={20} aria-hidden="true" />;
  }
  if (status === 'failed') {
    return <XCircle size={20} aria-hidden="true" />;
  }
  if (status === 'blocked') {
    return <Lock size={20} aria-hidden="true" />;
  }
  return <Circle size={20} aria-hidden="true" />;
}

// ─── Step status badge ────────────────────────────────────────────────────────

function StepStatusBadge({ status }: { status: 'ok' | 'failed' | 'pending' | 'blocked' }) {
  const map = {
    ok: { label: 'Aprovado', css: 'mc-step__status-badge--ok' },
    failed: { label: 'Falhou', css: 'mc-step__status-badge--failed' },
    pending: { label: 'Pendente', css: 'mc-step__status-badge--pending' },
    blocked: { label: 'Bloqueado', css: 'mc-step__status-badge--blocked' },
  };
  const { label, css } = map[status];
  return <span className={`mc-step__status-badge ${css}`}>{label}</span>;
}

// ─── Individual step card ─────────────────────────────────────────────────────

interface StepCardProps {
  stepNumber: number;
  closing: MonthlyClosingOutput;
  onValidate: (stepNumber: number) => Promise<void>;
  validatingStep: number | null;
}

function StepCard({ stepNumber, closing, onValidate, validatingStep }: StepCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const stepResult = getStepResult(closing.stepResults, stepNumber);
  const blocked = isStepBlocked(closing.stepResults, stepNumber);

  let displayStatus: 'ok' | 'failed' | 'pending' | 'blocked';
  if (stepResult?.status === 'OK') displayStatus = 'ok';
  else if (stepResult?.status === 'FAILED') displayStatus = 'failed';
  else if (blocked) displayStatus = 'blocked';
  else displayStatus = 'pending';

  const label = STEP_LABELS[stepNumber] ?? `Etapa ${stepNumber}`;
  const moduleLink = STEP_MODULE_LINKS[stepNumber];
  const isValidating = validatingStep === stepNumber;
  const closingDone = closing.status === 'COMPLETED';

  const canValidate =
    !closingDone && (displayStatus === 'pending' || displayStatus === 'failed');
  const hasDetails = !!stepResult?.details && Object.keys(stepResult.details).length > 0;

  return (
    <div className={`mc-step mc-step--${displayStatus}`}>
      {/* Step circle */}
      <div className="mc-step__indicator" aria-hidden="true">
        <div className={`mc-step__circle mc-step__circle--${displayStatus}`}>
          <StepIcon stepNumber={stepNumber} status={displayStatus} />
        </div>
      </div>

      {/* Step content */}
      <div className="mc-step__content">
        <div className="mc-step__header">
          <span
            className={`mc-step__label ${displayStatus === 'blocked' ? 'mc-step__label--blocked' : ''}`}
          >
            {label}
          </span>
          <div className="mc-step__header-right">
            <StepStatusBadge status={displayStatus} />
            {(stepResult || hasDetails) && (
              <button
                type="button"
                className={`mc-step__toggle ${expanded ? 'mc-step__toggle--expanded' : ''}`}
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? `Recolher detalhes de ${label}` : `Expandir detalhes de ${label}`}
                aria-expanded={expanded}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        {stepResult?.summary && (
          <p className={`mc-step__summary ${displayStatus === 'failed' ? 'mc-step__summary--failed' : ''}`}>
            {stepResult.summary}
          </p>
        )}

        {/* Actions */}
        {canValidate && (
          <div className="mc-step__actions">
            {displayStatus === 'failed' && moduleLink && (
              <button
                type="button"
                className="mc-btn mc-btn--link"
                onClick={() => navigate(moduleLink.path)}
              >
                {moduleLink.label}
              </button>
            )}
            <button
              type="button"
              className="mc-btn mc-btn--secondary"
              onClick={() => void onValidate(stepNumber)}
              disabled={isValidating}
              aria-label={displayStatus === 'failed' ? `Revalidar ${label}` : `Validar ${label}`}
            >
              {isValidating
                ? 'Validando...'
                : displayStatus === 'failed'
                  ? 'Revalidar'
                  : 'Validar'}
            </button>
          </div>
        )}

        {/* Expanded details */}
        {expanded && stepResult?.details && (
          <div className="mc-step__details">
            <pre>{JSON.stringify(stepResult.details, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Closing status badge ─────────────────────────────────────────────────────

function ClosingStatusBadge({ status }: { status: MonthlyClosingOutput['status'] }) {
  if (status === 'COMPLETED') {
    return (
      <span className="mc-page__status-badge mc-page__status-badge--completed">
        <ShieldCheck size={14} aria-hidden="true" />
        Concluído
      </span>
    );
  }
  if (status === 'REOPENED') {
    return (
      <span className="mc-page__status-badge mc-page__status-badge--reopened">
        <Unlock size={14} aria-hidden="true" />
        Reaberto
      </span>
    );
  }
  return (
    <span className="mc-page__status-badge mc-page__status-badge--in-progress">
      Em Andamento
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ClosingSkeleton() {
  return (
    <div className="mc-page__loading" aria-label="Carregando fechamento mensal..." aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="mc-page__skeleton-card" />
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MonthlyClosingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const periodId = searchParams.get('periodId') ?? undefined;

  const { closing, loading, error, refetch } = useMonthlyClosing(periodId);
  const { startClosing, loading: starting } = useStartClosing();
  const { validateStep, loading: validating } = useValidateStep();
  const { completeClosing, loading: completing } = useCompleteClosing();
  const { reopenClosing, loading: reopening } = useReopenClosing();

  const [validatingStep, setValidatingStep] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const isAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';

  const allStepsOk = closing
    ? [1, 2, 3, 4, 5, 6].every(
        (n) => getStepResult(closing.stepResults, n)?.status === 'OK',
      )
    : false;

  const monthLabel = closing
    ? getMonthLabel(closing.periodMonth, closing.periodYear)
    : '';

  const handleStartClosing = useCallback(async () => {
    if (!periodId) return;
    try {
      await startClosing(periodId);
      showToast('Fechamento iniciado com sucesso');
      void refetch();
    } catch {
      showToast('Não foi possível iniciar o fechamento. Tente novamente.');
    }
  }, [periodId, startClosing, refetch, showToast]);

  const handleValidateStep = useCallback(
    async (stepNumber: number) => {
      if (!closing) return;
      setValidatingStep(stepNumber);
      try {
        await validateStep(closing.id, stepNumber);
        void refetch();
      } catch {
        showToast('Não foi possível validar a etapa. Tente novamente.');
      } finally {
        setValidatingStep(null);
      }
    },
    [closing, validateStep, refetch, showToast],
  );

  const handleCompleteClosing = useCallback(async () => {
    if (!closing) return;
    try {
      await completeClosing(closing.id);
      setShowCloseConfirm(false);
      showToast('Período fechado com sucesso');
      void refetch();
    } catch {
      setShowCloseConfirm(false);
      showToast('Não foi possível fechar o período. Tente novamente.');
    }
  }, [closing, completeClosing, refetch, showToast]);

  const handleReopenClosing = useCallback(async () => {
    if (!closing) return;
    if (!reopenReason.trim()) {
      setReopenError('Motivo da reabertura é obrigatório');
      return;
    }
    setReopenError('');
    try {
      await reopenClosing(closing.id, reopenReason.trim());
      setShowReopenModal(false);
      setReopenReason('');
      showToast('Período reaberto com sucesso');
      void refetch();
    } catch {
      showToast('Não foi possível reabrir o período. Tente novamente.');
    }
  }, [closing, reopenClosing, reopenReason, refetch, showToast]);

  // ─── Render: no period selected ────────────────────────────────────────────

  if (!periodId) {
    return (
      <main className="mc-page" id="main-content">
        <nav className="mc-page__breadcrumb" aria-label="Caminho da página">
          <span className="mc-page__breadcrumb-item">Contabilidade</span>
          <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
          <span className="mc-page__breadcrumb-item mc-page__breadcrumb-item--current">
            Fechamento Mensal
          </span>
        </nav>
        <div className="mc-page__empty">
          <ClipboardCheck size={48} aria-hidden="true" className="mc-page__start-icon" />
          <h1 className="mc-page__empty-title">Selecione um período</h1>
          <p>
            Acesse{' '}
            <Link to="/fiscal-periods" className="mc-page__empty-link">
              Períodos Fiscais
            </Link>{' '}
            e clique em "Fechamento" para iniciar o processo de fechamento.
          </p>
        </div>
      </main>
    );
  }

  // ─── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="mc-page" id="main-content">
        <nav className="mc-page__breadcrumb" aria-label="Caminho da página">
          <span className="mc-page__breadcrumb-item">Contabilidade</span>
          <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
          <span className="mc-page__breadcrumb-item mc-page__breadcrumb-item--current">
            Fechamento Mensal
          </span>
        </nav>
        <ClosingSkeleton />
      </main>
    );
  }

  // ─── Render: error ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <main className="mc-page" id="main-content">
        <nav className="mc-page__breadcrumb" aria-label="Caminho da página">
          <span className="mc-page__breadcrumb-item">Contabilidade</span>
          <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
          <span className="mc-page__breadcrumb-item mc-page__breadcrumb-item--current">
            Fechamento Mensal
          </span>
        </nav>
        <div className="mc-page__error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      </main>
    );
  }

  // ─── Render: no closing yet ─────────────────────────────────────────────────

  if (!closing) {
    return (
      <main className="mc-page" id="main-content">
        <nav className="mc-page__breadcrumb" aria-label="Caminho da página">
          <span className="mc-page__breadcrumb-item">Contabilidade</span>
          <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
          <span className="mc-page__breadcrumb-item mc-page__breadcrumb-item--current">
            Fechamento Mensal
          </span>
        </nav>

        <header className="mc-page__header">
          <div className="mc-page__title-area">
            <h1 className="mc-page__title">Fechamento Mensal</h1>
          </div>
        </header>

        <div className="mc-page__start-section">
          <ClipboardCheck size={48} aria-hidden="true" className="mc-page__start-icon" />
          <h2 className="mc-page__start-title">Pronto para iniciar o fechamento</h2>
          <p className="mc-page__start-desc">
            O processo de fechamento mensal verifica 6 etapas para garantir a integridade contábil do período.
          </p>
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            onClick={() => void handleStartClosing()}
            disabled={starting}
          >
            <ClipboardCheck size={16} aria-hidden="true" />
            {starting ? 'Iniciando...' : 'Iniciar Fechamento'}
          </button>
        </div>

        {toast && (
          <div className="mc-page__toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </main>
    );
  }

  // ─── Render: closing in progress / completed / reopened ────────────────────

  return (
    <main className="mc-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="mc-page__breadcrumb" aria-label="Caminho da página">
        <span className="mc-page__breadcrumb-item">Início</span>
        <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="mc-page__breadcrumb-item">Contabilidade</span>
        <span className="mc-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="mc-page__breadcrumb-item mc-page__breadcrumb-item--current">
          Fechamento Mensal
        </span>
      </nav>

      {/* Header */}
      <header className="mc-page__header">
        <div className="mc-page__title-area">
          <h1 className="mc-page__title">
            Fechamento Mensal — {monthLabel}
          </h1>
          <ClosingStatusBadge status={closing.status} />
        </div>
      </header>

      {/* Stepper */}
      <section className="mc-page__stepper" aria-label="Etapas do fechamento mensal">
        {[1, 2, 3, 4, 5, 6].map((stepNumber) => (
          <StepCard
            key={stepNumber}
            stepNumber={stepNumber}
            closing={closing}
            onValidate={handleValidateStep}
            validatingStep={validatingStep}
          />
        ))}
      </section>

      {/* Footer actions */}
      <footer className="mc-page__footer">
        {/* Reopen: only for ADMIN users when period is COMPLETED */}
        {closing.status === 'COMPLETED' && isAdmin && (
          <button
            type="button"
            className="mc-btn mc-btn--secondary"
            onClick={() => setShowReopenModal(true)}
            disabled={reopening}
            aria-label="Reabrir período fechado"
          >
            <Unlock size={16} aria-hidden="true" />
            Reabrir Período
          </button>
        )}

        {/* Close period: enabled only when all 6 steps OK */}
        {closing.status !== 'COMPLETED' && (
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            onClick={() => setShowCloseConfirm(true)}
            disabled={!allStepsOk || completing}
            aria-label="Fechar período contábil"
            aria-disabled={!allStepsOk}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {completing ? 'Fechando...' : 'Fechar Período'}
          </button>
        )}
      </footer>

      {/* Confirm close period */}
      <ConfirmModal
        isOpen={showCloseConfirm}
        title="Fechar período"
        message={`Confirma o fechamento de ${monthLabel}? Após fechado, novos lançamentos neste período exigirão reabertura.`}
        confirmLabel="Fechar Período"
        variant="warning"
        isLoading={completing}
        onConfirm={() => { void handleCompleteClosing(); }}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* Reopen modal */}
      {showReopenModal && (
        <div
          className="confirm-modal__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-modal-title"
        >
          <div className="confirm-modal__box">
            <h2 id="reopen-modal-title" className="confirm-modal__title">
              Reabrir período
            </h2>
            <p className="confirm-modal__message">
              Informe o motivo da reabertura de {monthLabel}. Esta ação é registrada no histórico.
            </p>
            <div className="mc-reopen-form">
              <label htmlFor="mc-reopen-reason" className="mc-reopen-form__label">
                Motivo da reabertura <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="mc-reopen-reason"
                className="mc-reopen-form__textarea"
                value={reopenReason}
                onChange={(e) => { setReopenReason(e.target.value); setReopenError(''); }}
                rows={3}
                placeholder="Descreva o motivo da reabertura..."
                aria-required="true"
                aria-describedby={reopenError ? 'mc-reopen-error' : undefined}
              />
              {reopenError && (
                <span id="mc-reopen-error" role="alert" className="mc-reopen-form__error">
                  <AlertTriangle size={12} aria-hidden="true" />
                  {reopenError}
                </span>
              )}
              <div className="mc-reopen-form__actions">
                <button
                  type="button"
                  className="mc-btn mc-btn--secondary"
                  onClick={() => {
                    setShowReopenModal(false);
                    setReopenReason('');
                    setReopenError('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mc-btn mc-btn--warning"
                  onClick={() => { void handleReopenClosing(); }}
                  disabled={reopening}
                >
                  <Unlock size={16} aria-hidden="true" />
                  {reopening ? 'Reabrindo...' : 'Confirmar Reabertura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="mc-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
