import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useJournalEntryActions } from '@/hooks/useJournalEntries';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { JournalEntry } from '@/types/journal-entries';
import './ReversalModal.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReversalModalProps {
  isOpen: boolean;
  entry: JournalEntry;
  orgId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatAmount(lines: JournalEntry['lines']): string {
  const debitTotal = lines
    .filter((l) => l.side === 'DEBIT')
    .reduce((sum, l) => sum + parseFloat(l.amount), 0);
  return debitTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ReversalModal({
  isOpen,
  entry,
  onClose,
  onSuccess,
}: ReversalModalProps) {
  const { reverseEntry } = useJournalEntryActions();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = 'reversal-modal-heading';

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setReasonError(null);
      setShowConfirm(false);
      setTimeout(() => headingRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validateReason = () => {
    if (!reason.trim()) return 'O motivo do estorno é obrigatório';
    if (reason.trim().length < 10) return 'O motivo deve ter pelo menos 10 caracteres';
    return null;
  };

  const handleConfirmClick = () => {
    const err = validateReason();
    if (err) {
      setReasonError(err);
      return;
    }
    setReasonError(null);
    setShowConfirm(true);
  };

  const handleReverseConfirm = async () => {
    setIsReversing(true);
    try {
      const reversed = await reverseEntry(entry.id, reason);
      onSuccess(
        `Lançamento #${entry.entryNumber} estornado. Estorno #${reversed.entryNumber} criado.`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível estornar o lançamento.';
      setReasonError(msg);
      setShowConfirm(false);
    } finally {
      setIsReversing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="reversal-modal__overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="reversal-modal">
          {/* Header */}
          <div className="reversal-modal__header">
            <h2 id={headingId} className="reversal-modal__heading" ref={headingRef} tabIndex={-1}>
              Estornar Lançamento #{entry.entryNumber}
            </h2>
            <button
              type="button"
              className="reversal-modal__close"
              aria-label="Fechar modal"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="reversal-modal__body">
            {/* Entry summary */}
            <div className="reversal-modal__summary">
              <h3 className="reversal-modal__summary-heading">Lançamento original</h3>
              <dl className="reversal-modal__summary-dl">
                <div className="reversal-modal__summary-row">
                  <dt>Data</dt>
                  <dd className="reversal-modal__mono">{formatDate(entry.entryDate)}</dd>
                </div>
                <div className="reversal-modal__summary-row">
                  <dt>Histórico</dt>
                  <dd>{entry.description}</dd>
                </div>
                <div className="reversal-modal__summary-row">
                  <dt>Valor total</dt>
                  <dd className="reversal-modal__mono">{formatAmount(entry.lines)}</dd>
                </div>
                <div className="reversal-modal__summary-row">
                  <dt>Partidas</dt>
                  <dd className="reversal-modal__mono">{entry.lines.length} linhas</dd>
                </div>
              </dl>
            </div>

            {/* Reason field */}
            <div className="reversal-modal__field">
              <label htmlFor="reversal-reason" className="reversal-modal__label">
                Motivo do estorno <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="reversal-reason"
                className={`reversal-modal__textarea ${reasonError ? 'reversal-modal__textarea--error' : ''}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => {
                  const err = validateReason();
                  setReasonError(err);
                }}
                placeholder="Descreva o motivo do estorno"
                rows={3}
                required
                aria-required="true"
                aria-describedby={reasonError ? 'reversal-reason-error' : undefined}
              />
              {reasonError && (
                <span id="reversal-reason-error" className="reversal-modal__error" role="alert">
                  {reasonError}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="reversal-modal__footer">
            <button
              type="button"
              className="reversal-modal__btn reversal-modal__btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="reversal-modal__btn reversal-modal__btn--danger"
              onClick={handleConfirmClick}
              disabled={isReversing}
            >
              {isReversing ? 'Estornando...' : 'Confirmar Estorno'}
            </button>
          </div>
        </div>
      </div>

      {/* Final confirmation */}
      <ConfirmModal
        isOpen={showConfirm}
        title={`Estornar Lançamento #${entry.entryNumber}?`}
        message={`Tem certeza que deseja estornar o Lançamento #${entry.entryNumber}? Essa ação não pode ser desfeita.`}
        confirmLabel="Confirmar Estorno"
        variant="danger"
        isLoading={isReversing}
        onConfirm={() => { void handleReverseConfirm(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
