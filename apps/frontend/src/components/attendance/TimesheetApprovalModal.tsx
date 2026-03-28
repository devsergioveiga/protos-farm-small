import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { Timesheet, TimesheetStatus } from '@/types/attendance';
import './TimesheetApprovalModal.css';

interface TimesheetApprovalModalProps {
  isOpen: boolean;
  timesheet: Timesheet | null;
  action: 'approve' | 'reject';
  onConfirm: (
    action: 'APPROVE_MANAGER' | 'APPROVE_RH' | 'REJECT',
    justification?: string,
  ) => Promise<boolean>;
  onClose: () => void;
}

function getApproveAction(status: TimesheetStatus): 'APPROVE_MANAGER' | 'APPROVE_RH' {
  if (status === 'PENDING_RH' || status === 'MANAGER_APPROVED') return 'APPROVE_RH';
  return 'APPROVE_MANAGER';
}

function getMonthName(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function TimesheetApprovalModal({
  isOpen,
  timesheet,
  action,
  onConfirm,
  onClose,
}: TimesheetApprovalModalProps) {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustification('');
      setError(null);
      setTimeout(() => {
        if (action === 'reject') {
          textareaRef.current?.focus();
        } else {
          primaryBtnRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, action]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  async function handleSubmit() {
    if (!timesheet) return;

    if (action === 'reject') {
      if (justification.trim().length < 20) {
        setError('Informe o motivo da rejeicao (minimo 20 caracteres).');
        textareaRef.current?.focus();
        return;
      }
      setIsLoading(true);
      setError(null);
      const ok = await onConfirm('REJECT', justification.trim());
      setIsLoading(false);
      if (!ok) {
        setError('Nao foi possivel rejeitar o espelho. Tente novamente.');
      }
    } else {
      const approveAction = getApproveAction(timesheet.status);
      setIsLoading(true);
      setError(null);
      const ok = await onConfirm(approveAction);
      setIsLoading(false);
      if (!ok) {
        setError('Nao foi possivel aprovar o espelho. Tente novamente.');
      }
    }
  }

  if (!isOpen || !timesheet) return null;

  const monthLabel = getMonthName(timesheet.referenceMonth);
  const isReject = action === 'reject';
  const charsLeft = Math.max(0, 20 - justification.trim().length);

  return (
    <div
      className="ts-approval-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-approval-modal-title"
    >
      <div className="ts-approval-modal">
        {/* Icon */}
        <div className={`ts-approval-modal__icon ${isReject ? 'ts-approval-modal__icon--reject' : 'ts-approval-modal__icon--approve'}`}>
          {isReject ? (
            <AlertCircle size={28} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={28} aria-hidden="true" />
          )}
        </div>

        {/* Title */}
        <h2 id="ts-approval-modal-title" className="ts-approval-modal__title">
          {isReject
            ? `Rejeitar espelho de ${timesheet.employeeName}?`
            : `Aprovar espelho de ${timesheet.employeeName}?`}
        </h2>

        {/* Subtitle */}
        <p className="ts-approval-modal__subtitle">
          {isReject
            ? `Mes de referencia: ${monthLabel}. O colaborador sera notificado para corrigir os apontamentos.`
            : `Mes de referencia: ${monthLabel}. Esta acao ira avanciar o espelho para a proxima etapa de aprovacao.`}
        </p>

        {/* Justification textarea (only for reject) */}
        {isReject && (
          <div className="ts-approval-modal__field">
            <label htmlFor="ts-justification" className="ts-approval-modal__label">
              Motivo da rejeicao *
            </label>
            <textarea
              ref={textareaRef}
              id="ts-justification"
              className="ts-approval-modal__textarea"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Descreva o motivo para devolver o espelho ao colaborador..."
              rows={4}
              aria-required="true"
              aria-describedby={error ? 'ts-justification-error' : 'ts-justification-hint'}
            />
            {charsLeft > 0 ? (
              <p id="ts-justification-hint" className="ts-approval-modal__hint">
                Minimo de 20 caracteres ({charsLeft} restantes)
              </p>
            ) : (
              <p id="ts-justification-hint" className="ts-approval-modal__hint ts-approval-modal__hint--ok">
                {justification.trim().length} caracteres
              </p>
            )}
            {error && (
              <p id="ts-justification-error" className="ts-approval-modal__field-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        )}

        {/* General error */}
        {!isReject && error && (
          <p className="ts-approval-modal__general-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="ts-approval-modal__actions">
          <button
            type="button"
            className="ts-approval-modal__btn ts-approval-modal__btn--cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>

          {isReject ? (
            <button
              ref={primaryBtnRef}
              type="button"
              className="ts-approval-modal__btn ts-approval-modal__btn--reject"
              onClick={() => void handleSubmit()}
              disabled={isLoading || justification.trim().length < 20}
              aria-busy={isLoading}
            >
              {isLoading ? 'Aguarde...' : 'Rejeitar e Devolver'}
            </button>
          ) : (
            <button
              ref={primaryBtnRef}
              type="button"
              className="ts-approval-modal__btn ts-approval-modal__btn--approve"
              onClick={() => void handleSubmit()}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'Aguarde...' : 'Aprovar Espelho'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
