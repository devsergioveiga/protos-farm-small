import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { TrainingType, CreateTrainingTypeInput } from '@/types/training';
import './TrainingTypeModal.css';

interface Props {
  isOpen: boolean;
  trainingType?: TrainingType | null;
  onClose: () => void;
  onSave: (input: CreateTrainingTypeInput) => Promise<boolean>;
}

interface FormState {
  name: string;
  description: string;
  minHours: string;
  defaultValidityMonths: string;
  nrReference: string;
  isGlobal: boolean;
}

interface FormErrors {
  name?: string;
  minHours?: string;
  defaultValidityMonths?: string;
}

const INITIAL: FormState = {
  name: '',
  description: '',
  minHours: '',
  defaultValidityMonths: '',
  nrReference: '',
  isGlobal: false,
};

export default function TrainingTypeModal({ isOpen, trainingType, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (trainingType) {
        setForm({
          name: trainingType.name,
          description: trainingType.description ?? '',
          minHours: String(trainingType.minHours),
          defaultValidityMonths: String(trainingType.defaultValidityMonths),
          nrReference: trainingType.nrReference ?? '',
          isGlobal: trainingType.isGlobal,
        });
      } else {
        setForm(INITIAL);
      }
      setErrors({});
      setApiError(null);
      setTimeout(() => firstRef.current?.focus(), 100);
    }
  }, [isOpen, trainingType]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = 'Nome é obrigatório.';
    if (!form.minHours || Number(form.minHours) < 1)
      next.minHours = 'Carga horária mínima deve ser ao menos 1h.';
    if (!form.defaultValidityMonths || Number(form.defaultValidityMonths) < 1)
      next.defaultValidityMonths = 'Validade padrão deve ser ao menos 1 mês.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBlur = (field: keyof FormErrors) => {
    validate();
    // only show error for this specific field
    setErrors((prev) => {
      const next: FormErrors = {};
      if (field === 'name' && !form.name.trim()) next.name = 'Nome é obrigatório.';
      if (field === 'minHours' && (!form.minHours || Number(form.minHours) < 1))
        next.minHours = 'Carga horária mínima deve ser ao menos 1h.';
      if (
        field === 'defaultValidityMonths' &&
        (!form.defaultValidityMonths || Number(form.defaultValidityMonths) < 1)
      )
        next.defaultValidityMonths = 'Validade padrão deve ser ao menos 1 mês.';
      return { ...prev, ...next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    const ok = await onSave({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      minHours: Number(form.minHours),
      defaultValidityMonths: Number(form.defaultValidityMonths),
      nrReference: form.nrReference.trim() || undefined,
      isGlobal: form.isGlobal,
    });
    setSaving(false);
    if (!ok) setApiError('Não foi possível salvar. Verifique os dados e tente novamente.');
  };

  if (!isOpen) return null;

  const title = trainingType ? 'Editar Tipo de Treinamento' : 'Novo Tipo de Treinamento';

  return (
    <div
      className="training-type-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-type-modal-title"
    >
      <div className="training-type-modal">
        <div className="training-type-modal__header">
          <h2 id="training-type-modal-title" className="training-type-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="training-type-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="training-type-modal__body">
            {apiError && (
              <div className="training-type-modal__api-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {apiError}
              </div>
            )}

            <div className="training-type-modal__field">
              <label htmlFor="tt-name" className="training-type-modal__label">
                Nome <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstRef}
                id="tt-name"
                type="text"
                className={`training-type-modal__input ${errors.name ? 'training-type-modal__input--error' : ''}`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onBlur={() => handleBlur('name')}
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'tt-name-error' : undefined}
              />
              {errors.name && (
                <span id="tt-name-error" className="training-type-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.name}
                </span>
              )}
            </div>

            <div className="training-type-modal__field">
              <label htmlFor="tt-desc" className="training-type-modal__label">
                Descrição
              </label>
              <textarea
                id="tt-desc"
                className="training-type-modal__textarea"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="training-type-modal__row">
              <div className="training-type-modal__field">
                <label htmlFor="tt-min-hours" className="training-type-modal__label">
                  Carga horária mínima (h) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="tt-min-hours"
                  type="number"
                  min="1"
                  className={`training-type-modal__input ${errors.minHours ? 'training-type-modal__input--error' : ''}`}
                  value={form.minHours}
                  onChange={(e) => setForm((f) => ({ ...f, minHours: e.target.value }))}
                  onBlur={() => handleBlur('minHours')}
                  aria-required="true"
                  aria-invalid={!!errors.minHours}
                  aria-describedby={errors.minHours ? 'tt-min-hours-error' : undefined}
                />
                {errors.minHours && (
                  <span
                    id="tt-min-hours-error"
                    className="training-type-modal__error"
                    role="alert"
                  >
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.minHours}
                  </span>
                )}
              </div>

              <div className="training-type-modal__field">
                <label htmlFor="tt-validity" className="training-type-modal__label">
                  Validade padrão (meses) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="tt-validity"
                  type="number"
                  min="1"
                  className={`training-type-modal__input ${errors.defaultValidityMonths ? 'training-type-modal__input--error' : ''}`}
                  value={form.defaultValidityMonths}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, defaultValidityMonths: e.target.value }))
                  }
                  onBlur={() => handleBlur('defaultValidityMonths')}
                  aria-required="true"
                  aria-invalid={!!errors.defaultValidityMonths}
                  aria-describedby={
                    errors.defaultValidityMonths ? 'tt-validity-error' : undefined
                  }
                />
                {errors.defaultValidityMonths && (
                  <span id="tt-validity-error" className="training-type-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.defaultValidityMonths}
                  </span>
                )}
              </div>
            </div>

            <div className="training-type-modal__field">
              <label htmlFor="tt-nr" className="training-type-modal__label">
                Referência NR
              </label>
              <input
                id="tt-nr"
                type="text"
                className="training-type-modal__input"
                placeholder="Ex.: NR-31"
                value={form.nrReference}
                onChange={(e) => setForm((f) => ({ ...f, nrReference: e.target.value }))}
              />
            </div>

            <div className="training-type-modal__checkbox-field">
              <input
                id="tt-global"
                type="checkbox"
                className="training-type-modal__checkbox"
                checked={form.isGlobal}
                onChange={(e) => setForm((f) => ({ ...f, isGlobal: e.target.checked }))}
              />
              <label htmlFor="tt-global" className="training-type-modal__checkbox-label">
                Obrigatório para todos os cargos
              </label>
            </div>
          </div>

          <div className="training-type-modal__footer">
            <button
              type="button"
              className="training-type-modal__btn training-type-modal__btn--cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="training-type-modal__btn training-type-modal__btn--primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
