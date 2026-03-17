import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CheckOutput } from '@/hooks/useChecks';
import './CompensateCheckModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface CompensateCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (compensationDate: string) => void;
  check: CheckOutput | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ─────────────────────────────────────────────────────

const CompensateCheckModal = ({ isOpen, onClose, onSuccess, check }: CompensateCheckModalProps) => {
  const [compensationDate, setCompensationDate] = useState(todayIso());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCompensationDate(todayIso());
      setDateError(null);
      setTimeout(() => dateInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!compensationDate) {
        setDateError('Data de compensação é obrigatória');
        return;
      }
      setIsSubmitting(true);
      try {
        await onSuccess(compensationDate);
      } finally {
        setIsSubmitting(false);
      }
    },
    [compensationDate, onSuccess],
  );

  if (!isOpen || !check) return null;

  return (
    <div
      className="comp-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comp-modal-title"
    >
      <div className="comp-modal__panel">
        <header className="comp-modal__header">
          <div className="comp-modal__header-icon" aria-hidden="true">
            <CheckCircle2 size={20} />
          </div>
          <h2 id="comp-modal-title" className="comp-modal__title">
            Compensar Cheque
          </h2>
          <button type="button" className="comp-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="comp-modal__body">
            {/* Check summary */}
            <div className="comp-modal__summary">
              <span className="comp-modal__summary-label">Cheque N°</span>
              <span className="comp-modal__summary-value">{check.checkNumber}</span>
              <span className="comp-modal__summary-label">Valor</span>
              <span className="comp-modal__summary-value comp-modal__summary-value--mono">
                {formatBRL(check.amount)}
              </span>
              <span className="comp-modal__summary-label">
                {check.type === 'EMITIDO' ? 'Beneficiário' : 'Emitente'}
              </span>
              <span className="comp-modal__summary-value">{check.payeeName}</span>
            </div>

            {/* Date field */}
            <div className="comp-modal__field">
              <label htmlFor="comp-date" className="comp-modal__label">
                Data de Compensação <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="comp-date"
                ref={dateInputRef}
                type="date"
                className={`comp-modal__input${dateError ? ' comp-modal__input--error' : ''}`}
                value={compensationDate}
                onChange={(e) => {
                  setCompensationDate(e.target.value);
                  if (e.target.value) setDateError(null);
                }}
                aria-required="true"
              />
              {dateError && (
                <span className="comp-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {dateError}
                </span>
              )}
            </div>

            {/* Balance note */}
            <p className="comp-modal__note">O saldo bancário real será atualizado neste momento.</p>
          </div>

          <footer className="comp-modal__footer">
            <button type="button" className="comp-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="comp-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processando...' : 'Confirmar compensação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CompensateCheckModal;
