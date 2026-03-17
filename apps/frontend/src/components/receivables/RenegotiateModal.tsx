import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';
import type { Receivable } from '@/hooks/useReceivables';
import './ReceivableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface RenegotiateModalProps {
  receivable: Receivable;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  newDueDate?: string;
  newAmount?: string;
}

function parseBRL(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function daysDiff(isoDate: string): number {
  const due = new Date(isoDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Component ───────────────────────────────────────────────────────

const RenegotiateModal = ({ receivable, onClose, onSuccess }: RenegotiateModalProps) => {
  const [newDueDate, setNewDueDate] = useState('');
  const [newAmountDisplay, setNewAmountDisplay] = useState(formatBRL(receivable.totalAmount));
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const daysLate = daysDiff(receivable.dueDate.slice(0, 10));

  // Focus
  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!newDueDate) {
      newErrors.newDueDate = 'Nova data de vencimento é obrigatória';
    } else if (newDueDate <= today) {
      newErrors.newDueDate = 'A nova data de vencimento deve ser futura';
    }
    const amount = parseBRL(newAmountDisplay);
    if (amount <= 0) {
      newErrors.newAmount = 'Novo valor deve ser maior que zero';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const payload: Record<string, unknown> = {
        newDueDate,
        newAmount: parseBRL(newAmountDisplay),
      };
      if (notes.trim()) payload.notes = notes.trim();

      try {
        await api.post(`/org/receivables/${receivable.id}/renegotiate`, payload);
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao renegociar';
        setSubmitError(`Não foi possível renegociar o título. ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [newDueDate, newAmountDisplay, notes, receivable.id, onSuccess],
  );

  return (
    <div
      className="cr-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Renegociar título"
    >
      <div className="cr-modal__panel">
        <header className="cr-modal__header">
          <div className="cr-modal__header-icon" aria-hidden="true">
            <RefreshCw size={20} />
          </div>
          <h2 className="cr-modal__title">Renegociar título</h2>
          <button type="button" className="cr-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="cr-modal__body">
            {submitError && (
              <div className="cr-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Info panel */}
            <div className="cr-receipt__info">
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Cliente</span>
                <span className="cr-receipt__info-value">{receivable.clientName}</span>
              </div>
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Valor original</span>
                <span className="cr-receipt__info-value cr-receipt__info-mono">
                  {formatBRL(receivable.totalAmount)}
                </span>
              </div>
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Vencimento original</span>
                <span className="cr-receipt__info-value cr-receipt__info-mono">
                  {formatDate(receivable.dueDate)}
                </span>
              </div>
              {daysLate > 0 && (
                <div className="cr-receipt__info-row">
                  <span className="cr-receipt__info-label">Dias em atraso</span>
                  <span className="cr-receipt__info-value cr-receipt__info-overdue">
                    {daysLate} {daysLate === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
              )}
            </div>

            {/* Informational note */}
            <div className="cr-renegotiate__note">
              <AlertCircle size={16} aria-hidden="true" />
              <p>
                O título original será marcado como <strong>&quot;Renegociado&quot;</strong> e um
                novo título será criado com as novas condições.
              </p>
            </div>

            {/* Nova data de vencimento */}
            <div className="cr-modal__field">
              <label htmlFor="cr-renegotiate-duedate" className="cr-modal__label">
                Nova data de vencimento <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-renegotiate-duedate"
                ref={firstFieldRef}
                type="date"
                className={`cr-modal__input ${errors.newDueDate ? 'cr-modal__input--error' : ''}`}
                value={newDueDate}
                min={today}
                onChange={(e) => setNewDueDate(e.target.value)}
                onBlur={() => {
                  if (!newDueDate) {
                    setErrors((p) => ({
                      ...p,
                      newDueDate: 'Nova data de vencimento é obrigatória',
                    }));
                  } else if (newDueDate <= today) {
                    setErrors((p) => ({
                      ...p,
                      newDueDate: 'A nova data de vencimento deve ser futura',
                    }));
                  } else {
                    setErrors((p) => ({ ...p, newDueDate: undefined }));
                  }
                }}
                aria-required="true"
              />
              {errors.newDueDate && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.newDueDate}
                </span>
              )}
            </div>

            {/* Novo valor */}
            <div className="cr-modal__field">
              <label htmlFor="cr-renegotiate-amount" className="cr-modal__label">
                Novo valor <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-renegotiate-amount"
                type="text"
                className={`cr-modal__input cr-modal__input--mono ${errors.newAmount ? 'cr-modal__input--error' : ''}`}
                value={newAmountDisplay}
                onChange={(e) => setNewAmountDisplay(e.target.value)}
                onBlur={(e) => {
                  const num = parseBRL(e.target.value);
                  if (num > 0) {
                    setNewAmountDisplay(formatBRL(num));
                    setErrors((p) => ({ ...p, newAmount: undefined }));
                  } else {
                    setErrors((p) => ({ ...p, newAmount: 'Novo valor deve ser maior que zero' }));
                  }
                }}
                aria-required="true"
                placeholder="R$ 0,00"
              />
              {errors.newAmount && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.newAmount}
                </span>
              )}
            </div>

            {/* Observações */}
            <div className="cr-modal__field">
              <label htmlFor="cr-renegotiate-notes" className="cr-modal__label">
                Observações sobre a renegociação
              </label>
              <textarea
                id="cr-renegotiate-notes"
                className="cr-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Motivo da renegociação, condições acordadas, etc."
              />
            </div>
          </div>

          <footer className="cr-modal__footer">
            <button type="button" className="cr-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cr-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Renegociando...' : 'Confirmar renegociação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default RenegotiateModal;
