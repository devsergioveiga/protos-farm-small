import { useState, useEffect, useRef } from 'react';
import { X, Loader2, UserCheck, Power } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Delegation, CreateDelegationInput } from '@/hooks/useApprovalRules';
import './DelegationModal.css';

interface DelegationModalProps {
  isOpen: boolean;
  delegations: Delegation[];
  onClose: () => void;
  onCreate: (input: CreateDelegationInput) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}

interface FormState {
  startDate: string;
  endDate: string;
  delegateId: string;
  delegateName: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  startDate: '',
  endDate: '',
  delegateId: '',
  delegateName: '',
  notes: '',
};

function formatDateBR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function DelegationModal({
  isOpen,
  delegations,
  onClose,
  onCreate,
  onDeactivate,
}: DelegationModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY_FORM);
      setErrors({});
      setApiError(null);
      setTimeout(() => firstFocusRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    const today = todayISO();

    if (!form.startDate) {
      newErrors.startDate = 'Data de inicio e obrigatoria';
    } else if (form.startDate < today) {
      newErrors.startDate = 'Data de inicio deve ser hoje ou futura';
    }

    if (!form.endDate) {
      newErrors.endDate = 'Data de termino e obrigatoria';
    } else if (form.startDate && form.endDate <= form.startDate) {
      newErrors.endDate = 'Data de termino deve ser apos a data de inicio';
    }

    if (!form.delegateId.trim() && !form.delegateName.trim()) {
      newErrors.delegateId = 'Substituto e obrigatorio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setApiError(null);
    try {
      await onCreate({
        delegateId: form.delegateId.trim() || form.delegateName.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao criar delegacao');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    setIsLoading(true);
    try {
      await onDeactivate(deactivateId);
    } finally {
      setIsLoading(false);
      setDeactivateId(null);
    }
  }

  if (!isOpen) return null;

  const activeDelegations = delegations.filter((d) => d.isActive);
  const pastDelegations = delegations.filter((d) => !d.isActive);

  return (
    <>
      <div
        className="dlgm-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlgm-title"
      >
        <div className="dlgm-modal">
          <header className="dlgm-modal__header">
            <h2 id="dlgm-title" className="dlgm-modal__title">
              Configurar Delegacao
            </h2>
            <button
              type="button"
              className="dlgm-modal__close"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="dlgm-modal__body">
            {/* Create delegation form */}
            <section aria-labelledby="dlgm-new-heading">
              <h3 id="dlgm-new-heading" className="dlgm-section__title">
                Nova Delegacao
              </h3>

              {apiError && (
                <p className="dlgm-error-msg dlgm-error-msg--block" role="alert">
                  {apiError}
                </p>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {/* Period */}
                <div className="dlgm-field-row">
                  <div className="dlgm-field">
                    <label htmlFor="dlgm-start" className="dlgm-label">
                      De <span aria-hidden="true">*</span>
                    </label>
                    <input
                      ref={firstFocusRef}
                      id="dlgm-start"
                      type="date"
                      className={`dlgm-input${errors.startDate ? ' dlgm-input--error' : ''}`}
                      value={form.startDate}
                      min={todayISO()}
                      onChange={(e) => updateField('startDate', e.target.value)}
                      aria-required="true"
                      aria-describedby={errors.startDate ? 'dlgm-start-error' : undefined}
                    />
                    {errors.startDate && (
                      <span id="dlgm-start-error" className="dlgm-error-msg" role="alert">
                        {errors.startDate}
                      </span>
                    )}
                  </div>

                  <div className="dlgm-field">
                    <label htmlFor="dlgm-end" className="dlgm-label">
                      Ate <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="dlgm-end"
                      type="date"
                      className={`dlgm-input${errors.endDate ? ' dlgm-input--error' : ''}`}
                      value={form.endDate}
                      min={form.startDate || todayISO()}
                      onChange={(e) => updateField('endDate', e.target.value)}
                      aria-required="true"
                      aria-describedby={errors.endDate ? 'dlgm-end-error' : undefined}
                    />
                    {errors.endDate && (
                      <span id="dlgm-end-error" className="dlgm-error-msg" role="alert">
                        {errors.endDate}
                      </span>
                    )}
                  </div>
                </div>

                {/* Substituto */}
                <div className="dlgm-field">
                  <label htmlFor="dlgm-delegate" className="dlgm-label">
                    Substituto <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="dlgm-delegate"
                    type="text"
                    className={`dlgm-input${errors.delegateId ? ' dlgm-input--error' : ''}`}
                    value={form.delegateName || form.delegateId}
                    onChange={(e) => {
                      updateField('delegateName', e.target.value);
                      updateField('delegateId', e.target.value);
                    }}
                    placeholder="Nome ou ID do usuario substituto"
                    aria-required="true"
                    aria-describedby={errors.delegateId ? 'dlgm-delegate-error' : undefined}
                  />
                  {errors.delegateId && (
                    <span id="dlgm-delegate-error" className="dlgm-error-msg" role="alert">
                      {errors.delegateId}
                    </span>
                  )}
                </div>

                {/* Observacao */}
                <div className="dlgm-field">
                  <label htmlFor="dlgm-notes" className="dlgm-label">
                    Observacao
                  </label>
                  <textarea
                    id="dlgm-notes"
                    className="dlgm-textarea"
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={3}
                    placeholder="Motivo da delegacao, instrucoes para o substituto..."
                  />
                </div>

                <div className="dlgm-form__footer">
                  <button
                    type="button"
                    className="dlgm-btn dlgm-btn--ghost"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="dlgm-btn dlgm-btn--primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="dlgm-spin" aria-hidden="true" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} aria-hidden="true" />
                        Salvar Delegacao
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Delegacoes ativas */}
            {activeDelegations.length > 0 && (
              <section aria-labelledby="dlgm-active-heading" className="dlgm-list-section">
                <hr className="dlgm-divider" />
                <h3 id="dlgm-active-heading" className="dlgm-section__title">
                  Delegacoes Ativas
                </h3>
                <ul className="dlgm-delegation-list">
                  {activeDelegations.map((d) => (
                    <li key={d.id} className="dlgm-delegation-item dlgm-delegation-item--active">
                      <div className="dlgm-delegation-item__info">
                        <span className="dlgm-delegation-item__delegate">{d.delegate.name}</span>
                        <span className="dlgm-delegation-item__period">
                          {formatDateBR(d.startDate)} – {formatDateBR(d.endDate)}
                        </span>
                        {d.notes && <span className="dlgm-delegation-item__notes">{d.notes}</span>}
                      </div>
                      <span className="dlgm-status-badge dlgm-status-badge--active">Ativa</span>
                      <button
                        type="button"
                        className="dlgm-btn dlgm-btn--outlined-danger dlgm-btn--sm"
                        onClick={() => setDeactivateId(d.id)}
                        aria-label={`Encerrar delegacao para ${d.delegate.name}`}
                      >
                        <Power size={14} aria-hidden="true" />
                        Encerrar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Delegacoes encerradas */}
            {pastDelegations.length > 0 && (
              <section aria-labelledby="dlgm-past-heading" className="dlgm-list-section">
                <hr className="dlgm-divider" />
                <h3
                  id="dlgm-past-heading"
                  className="dlgm-section__title dlgm-section__title--muted"
                >
                  Historico de Delegacoes
                </h3>
                <ul className="dlgm-delegation-list">
                  {pastDelegations.map((d) => (
                    <li key={d.id} className="dlgm-delegation-item dlgm-delegation-item--inactive">
                      <div className="dlgm-delegation-item__info">
                        <span className="dlgm-delegation-item__delegate">{d.delegate.name}</span>
                        <span className="dlgm-delegation-item__period">
                          {formatDateBR(d.startDate)} – {formatDateBR(d.endDate)}
                        </span>
                      </div>
                      <span className="dlgm-status-badge dlgm-status-badge--inactive">
                        Encerrada
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deactivateId != null}
        title="Encerrar delegacao?"
        message="Esta delegacao sera encerrada imediatamente. O aprovador original voltara a receber as requisicoes."
        confirmLabel="Encerrar"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={isLoading}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateId(null)}
      />
    </>
  );
}
