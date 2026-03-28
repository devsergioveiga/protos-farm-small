import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, AlertTriangle, Lock, RotateCcw, CheckCircle, ClipboardCheck } from 'lucide-react';
import {
  useFiscalYears,
  useCreateFiscalYear,
  useClosePeriod,
  useReopenPeriod,
  useBlockPeriod,
} from '@/hooks/useFiscalPeriods';
import FiscalYearModal from '@/components/accounting/FiscalYearModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useAuth } from '@/stores/AuthContext';
import type { AccountingPeriod, FiscalYear, CreateFiscalYearInput } from '@/types/accounting';
import './FiscalPeriodsPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

// ─── Status badge ─────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'OPEN' | 'CLOSED' | 'BLOCKED';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const map = {
    OPEN: { label: 'Aberto', css: 'fp-period__status--open' },
    CLOSED: { label: 'Fechado', css: 'fp-period__status--closed' },
    BLOCKED: { label: 'Bloqueado', css: 'fp-period__status--blocked' },
  };
  const { label, css } = map[status];
  return <span className={`fp-period__status ${css}`}>{label}</span>;
}

// ─── Period cell ──────────────────────────────────────────────────────────

interface PeriodCellProps {
  period: AccountingPeriod;
  onSelect: (period: AccountingPeriod) => void;
  isSelected: boolean;
}

function PeriodCell({ period, onSelect, isSelected }: PeriodCellProps) {
  const monthName = MONTH_ABBR[period.month - 1] ?? `M${period.month}`;

  return (
    <button
      type="button"
      className={`fp-period-cell ${isSelected ? 'fp-period-cell--selected' : ''} fp-period-cell--${period.status.toLowerCase()}`}
      onClick={() => onSelect(period)}
      aria-label={`${monthName} ${period.year} — ${period.status}`}
      aria-pressed={isSelected}
    >
      <span className="fp-period-cell__month">{monthName}</span>
      <span className="fp-period-cell__year">{period.year}</span>
      <StatusBadge status={period.status} />
    </button>
  );
}

// ─── Period panel ─────────────────────────────────────────────────────────

interface PeriodPanelProps {
  period: AccountingPeriod;
  onClose: () => void;
  onActionDone: () => void;
}

function PeriodPanel({ period, onClose, onActionDone }: PeriodPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { mutate: closePeriod, isLoading: closing } = useClosePeriod();
  const { mutate: reopenPeriod, isLoading: reopening } = useReopenPeriod();
  const { mutate: blockPeriod, isLoading: blocking } = useBlockPeriod();

  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);

  const monthName = MONTH_ABBR[period.month - 1] ?? `M${period.month}`;
  const userName = user?.email ?? 'sistema';

  const handleClose = async () => {
    await closePeriod(period.id, userName);
    onActionDone();
    onClose();
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setReopenError('Motivo é obrigatório para reabertura');
      return;
    }
    setReopenError('');
    await reopenPeriod(period.id, userName, reopenReason.trim());
    onActionDone();
    onClose();
  };

  const handleBlock = async () => {
    await blockPeriod(period.id);
    onActionDone();
    onClose();
  };

  return (
    <div className="fp-period-panel" role="region" aria-label={`Ações para ${monthName} ${period.year}`}>
      <div className="fp-period-panel__header">
        <span className="fp-period-panel__title">
          {monthName} {period.year}
        </span>
        <button
          type="button"
          className="fp-period-panel__close"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          ×
        </button>
      </div>

      <StatusBadge status={period.status} />

      {/* Audit info */}
      {period.closedAt && (
        <p className="fp-period-panel__audit">
          Fechado em {formatDateTime(period.closedAt)}{period.closedBy ? ` por ${period.closedBy}` : ''}
        </p>
      )}
      {period.reopenedAt && (
        <p className="fp-period-panel__audit">
          Reaberto em {formatDateTime(period.reopenedAt)}{period.reopenedBy ? ` por ${period.reopenedBy}` : ''}
          {period.reopenReason ? `: ${period.reopenReason}` : ''}
        </p>
      )}

      {/* Actions */}
      {period.status === 'OPEN' && (
        <>
          <button
            type="button"
            className="fp-period-panel__action fp-period-panel__action--closing"
            onClick={() => navigate(`/monthly-closing?periodId=${period.id}`)}
            aria-label={`Iniciar fechamento de ${monthName} ${period.year}`}
          >
            <ClipboardCheck size={16} aria-hidden="true" />
            Fechamento
          </button>
          <button
            type="button"
            className="fp-period-panel__action fp-period-panel__action--close"
            onClick={() => { void handleClose(); }}
            disabled={closing}
          >
            <CheckCircle size={16} aria-hidden="true" />
            {closing ? 'Fechando...' : 'Fechar Período'}
          </button>
        </>
      )}

      {period.status === 'CLOSED' && (
        <>
          {!showReopenForm ? (
            <button
              type="button"
              className="fp-period-panel__action fp-period-panel__action--reopen"
              onClick={() => setShowReopenForm(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reabrir Período
            </button>
          ) : (
            <div className="fp-period-panel__reopen-form">
              <label htmlFor="reopen-reason" className="fp-period-panel__label">
                Motivo da reabertura <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="reopen-reason"
                className={`fp-period-panel__textarea ${reopenError ? 'fp-period-panel__textarea--error' : ''}`}
                value={reopenReason}
                onChange={(e) => { setReopenReason(e.target.value); setReopenError(''); }}
                rows={3}
                placeholder="Descreva o motivo da reabertura..."
                aria-required="true"
                aria-describedby={reopenError ? 'reopen-reason-error' : undefined}
              />
              {reopenError && (
                <span id="reopen-reason-error" role="alert" className="fp-period-panel__error">
                  {reopenError}
                </span>
              )}
              <div className="fp-period-panel__reopen-actions">
                <button
                  type="button"
                  className="fp-period-panel__action fp-period-panel__action--cancel"
                  onClick={() => { setShowReopenForm(false); setReopenReason(''); setReopenError(''); }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="fp-period-panel__action fp-period-panel__action--reopen"
                  onClick={() => { void handleReopen(); }}
                  disabled={reopening}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {reopening ? 'Reabrindo...' : 'Confirmar Reabertura'}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="fp-period-panel__action fp-period-panel__action--block"
            onClick={() => { void handleBlock(); }}
            disabled={blocking}
          >
            <Lock size={16} aria-hidden="true" />
            {blocking ? 'Bloqueando...' : 'Bloquear Período'}
          </button>
        </>
      )}

      {period.status === 'BLOCKED' && (
        <p className="fp-period-panel__blocked-msg">
          <Lock size={14} aria-hidden="true" />
          Período bloqueado — não pode ser reaberto
        </p>
      )}
    </div>
  );
}

// ─── Fiscal year card ────────────────────────────────────────────────────

interface FiscalYearCardProps {
  year: FiscalYear;
  onRefetch: () => void;
}

function FiscalYearCard({ year, onRefetch }: FiscalYearCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);

  // Sort periods by year+month
  const periods = [...year.periods].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  const handlePeriodSelect = (period: AccountingPeriod) => {
    setSelectedPeriod((prev) => (prev?.id === period.id ? null : period));
  };

  return (
    <div className="fp-year-card">
      <div className="fp-year-card__header">
        <div className="fp-year-card__title-row">
          <h2 className="fp-year-card__name">{year.name}</h2>
          {year.isActive && (
            <span className="fp-year-card__active-badge">Ativo</span>
          )}
        </div>
        <p className="fp-year-card__dates">
          {formatDate(year.startDate)} — {formatDate(year.endDate)}
        </p>
      </div>

      {/* Period grid */}
      <div className="fp-year-card__grid" role="group" aria-label={`Períodos de ${year.name}`}>
        {periods.map((period) => (
          <PeriodCell
            key={period.id}
            period={period}
            onSelect={handlePeriodSelect}
            isSelected={selectedPeriod?.id === period.id}
          />
        ))}
      </div>

      {/* Period detail panel */}
      {selectedPeriod && (
        <PeriodPanel
          period={selectedPeriod}
          onClose={() => setSelectedPeriod(null)}
          onActionDone={onRefetch}
        />
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function FiscalSkeleton() {
  return (
    <div className="fp-page__skeleton" aria-label="Carregando exercícios fiscais..." aria-busy="true">
      {[1, 2].map((i) => (
        <div key={i} className="fp-page__skeleton-card">
          <div className="fp-page__skeleton-header" />
          <div className="fp-page__skeleton-grid">
            {Array.from({ length: 12 }).map((_, j) => (
              <div key={j} className="fp-page__skeleton-cell" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function FiscalPeriodsPage() {
  const { data: years, isLoading, error, refetch } = useFiscalYears();
  const { mutate: createYear } = useCreateFiscalYear();

  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleCreate = useCallback(
    async (data: CreateFiscalYearInput) => {
      await createYear(data);
      setShowModal(false);
      showToast('Exercício fiscal criado com sucesso');
      void refetch();
    },
    [createYear, refetch],
  );

  return (
    <main className="fp-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="fp-page__breadcrumb" aria-label="Caminho da página">
        <span className="fp-page__breadcrumb-item">Contabilidade</span>
        <span className="fp-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="fp-page__breadcrumb-item fp-page__breadcrumb-item--current">
          Períodos Fiscais
        </span>
      </nav>

      {/* Header */}
      <header className="fp-page__header">
        <div className="fp-page__header-left">
          <Calendar size={24} aria-hidden="true" className="fp-page__header-icon" />
          <h1 className="fp-page__title">Períodos Fiscais</h1>
        </div>
        <button
          type="button"
          className="fp-page__btn fp-page__btn--primary"
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} aria-hidden="true" />
          Novo Exercício Fiscal
        </button>
      </header>

      {/* Body */}
      <section className="fp-page__body" aria-label="Exercícios fiscais">
        {isLoading && <FiscalSkeleton />}

        {!isLoading && error && (
          <div className="fp-page__error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && !error && years.length === 0 && (
          <div className="fp-page__empty">
            <Calendar size={48} aria-hidden="true" className="fp-page__empty-icon" />
            <h2 className="fp-page__empty-title">Nenhum exercício fiscal cadastrado</h2>
            <p className="fp-page__empty-desc">
              Crie o primeiro exercício fiscal para gerenciar os períodos contábeis da sua
              organização.
            </p>
            <button
              type="button"
              className="fp-page__btn fp-page__btn--primary"
              onClick={() => setShowModal(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Criar Exercício
            </button>
          </div>
        )}

        {!isLoading && !error && years.length > 0 && (
          <div className="fp-page__years">
            {years.map((year) => (
              <FiscalYearCard key={year.id} year={year} onRefetch={() => { void refetch(); }} />
            ))}
          </div>
        )}
      </section>

      {/* Create modal */}
      <FiscalYearModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
      />

      {/* Toast */}
      {toast && (
        <div className="fp-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
