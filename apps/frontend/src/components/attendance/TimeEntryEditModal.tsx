import { useState, useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { TimesheetInconsistency } from '@/types/attendance';
import './TimeEntryEditModal.css';

interface TimeEntryEditModalProps {
  isOpen: boolean;
  inconsistency: TimesheetInconsistency | null;
  timesheetId: string;
  onSave: (
    justification: string,
    beforeJson: Record<string, unknown>,
    afterJson: Record<string, unknown>,
  ) => Promise<boolean>;
  onClose: () => void;
}

const INCONSISTENCY_TYPE_LABELS: Record<string, string> = {
  MISSING_CLOCK_OUT: 'Saida nao registrada',
  INTERJORNADA_VIOLATION: 'Violacao de interjornada',
  OUT_OF_RANGE: 'Fora do perimetro',
  NO_BOUNDARY: 'Sem perimetro definido',
};

export default function TimeEntryEditModal({
  isOpen,
  inconsistency,
  onSave,
  onClose,
}: TimeEntryEditModalProps) {
  const [correctedValue, setCorrectedValue] = useState('');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCorrectedValue('');
      setJustification('');
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showConfirm) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, showConfirm]);

  function handleSaveClick(e: React.MouseEvent<HTMLButtonElement>) {
    triggerRef.current = e.currentTarget;
    setError(null);

    if (!correctedValue.trim()) {
      setError('Informe o valor corrigido.');
      firstFieldRef.current?.focus();
      return;
    }
    if (!justification.trim()) {
      setError('A justificativa e obrigatoria para qualquer correcao.');
      return;
    }
    if (justification.trim().length < 10) {
      setError('A justificativa deve ter ao menos 10 caracteres.');
      return;
    }

    setShowConfirm(true);
  }

  async function handleConfirm() {
    if (!inconsistency) return;

    setShowConfirm(false);
    setIsLoading(true);
    setError(null);

    const beforeJson: Record<string, unknown> = {
      type: inconsistency.type,
      date: inconsistency.date,
      description: inconsistency.description,
      severity: inconsistency.severity,
    };
    const afterJson: Record<string, unknown> = {
      correctedValue: correctedValue.trim(),
      correctedAt: new Date().toISOString(),
    };

    const ok = await onSave(justification.trim(), beforeJson, afterJson);
    setIsLoading(false);

    if (!ok) {
      setError('Nao foi possivel salvar a correcao. Tente novamente.');
      // Return focus to trigger button
      triggerRef.current?.focus();
    }
  }

  if (!isOpen || !inconsistency) return null;

  const typeLabel = INCONSISTENCY_TYPE_LABELS[inconsistency.type] ?? inconsistency.type;
  const dateLabel = new Date(inconsistency.date).toLocaleDateString('pt-BR');

  return (
    <>
      <div
        className="te-edit-modal__overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !showConfirm) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="te-edit-modal-title"
      >
        <div className="te-edit-modal">
          {/* Header */}
          <div className="te-edit-modal__header">
            <h2 id="te-edit-modal-title" className="te-edit-modal__title">
              Corrigir Apontamento
            </h2>
            <button
              type="button"
              className="te-edit-modal__close"
              onClick={onClose}
              aria-label="Fechar modal"
              disabled={isLoading}
            >
              &times;
            </button>
          </div>

          {/* Original value (read-only) */}
          <div className="te-edit-modal__original">
            <div className="te-edit-modal__original-header">
              <span className="te-edit-modal__original-label">Tipo</span>
              <span className="te-edit-modal__original-value">{typeLabel}</span>
            </div>
            <div className="te-edit-modal__original-header">
              <span className="te-edit-modal__original-label">Data</span>
              <span className="te-edit-modal__original-value te-edit-modal__original-value--mono">{dateLabel}</span>
            </div>
            <div className="te-edit-modal__original-header">
              <span className="te-edit-modal__original-label">Descricao da inconsistencia</span>
              <span className="te-edit-modal__original-value">{inconsistency.description}</span>
            </div>
            <p className="te-edit-modal__original-hint">
              Valor original: <span className="te-edit-modal__original-value--mono">{inconsistency.description}</span>
            </p>
          </div>

          {/* Corrected value */}
          <div className="te-edit-modal__field">
            <label htmlFor="te-corrected-value" className="te-edit-modal__label">
              Valor corrigido *
            </label>
            <input
              ref={firstFieldRef}
              id="te-corrected-value"
              type="text"
              className="te-edit-modal__input"
              value={correctedValue}
              onChange={(e) => {
                setCorrectedValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: 17:30 ou descricao do dado corrigido"
              aria-required="true"
            />
          </div>

          {/* Justification */}
          <div className="te-edit-modal__field">
            <label htmlFor="te-justification" className="te-edit-modal__label">
              Justificativa * <span className="te-edit-modal__label-hint">(obrigatoria — ficara no historico de auditoria)</span>
            </label>
            <textarea
              id="te-justification"
              className="te-edit-modal__textarea"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Explique o motivo da correcao..."
              rows={3}
              aria-required="true"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="te-edit-modal__error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="te-edit-modal__actions">
            <button
              type="button"
              className="te-edit-modal__btn te-edit-modal__btn--cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="te-edit-modal__btn te-edit-modal__btn--save"
              onClick={handleSaveClick}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'Salvando...' : 'Salvar Correcao'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm before save */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Confirmar correcao?"
        message="Esta alteracao ficara registrada no historico de auditoria do espelho de ponto e nao podera ser desfeita automaticamente."
        confirmLabel="Confirmar e Salvar"
        cancelLabel="Voltar"
        variant="warning"
        isLoading={isLoading}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
