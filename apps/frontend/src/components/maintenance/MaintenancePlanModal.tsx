import { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useMaintenancePlans } from '@/hooks/useMaintenancePlans';
import { useAssets } from '@/hooks/useAssets';
import type { MaintenancePlan, MaintenanceTriggerType } from '@/types/maintenance';
import './MaintenancePlanModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface MaintenancePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan?: MaintenancePlan;
  assetId?: string; // pre-fill when opened from AssetMaintenanceTab
}

// ─── Field helpers ──────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mp-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mp-modal__label">
      {children}
      {required && (
        <span className="mp-modal__required" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
}

// ─── Interval label helper ──────────────────────────────────────────────

function intervalLabel(triggerType: MaintenanceTriggerType): string {
  if (triggerType === 'HOURMETER') return 'Intervalo (horas)';
  if (triggerType === 'ODOMETER') return 'Intervalo (km)';
  return 'Intervalo (dias)';
}

function alertLabel(triggerType: MaintenanceTriggerType): string {
  if (triggerType === 'HOURMETER') return 'Alertar com antecedencia de (horas)';
  if (triggerType === 'ODOMETER') return 'Alertar com antecedencia de (km)';
  return 'Alertar com antecedencia de (dias)';
}

// ─── Form state ─────────────────────────────────────────────────────────

interface FormData {
  name: string;
  assetId: string;
  triggerType: MaintenanceTriggerType;
  intervalValue: string;
  alertBeforeValue: string;
  description: string;
}

interface FormErrors {
  name?: string;
  assetId?: string;
  intervalValue?: string;
  alertBeforeValue?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function MaintenancePlanModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
  assetId: prefillAssetId,
}: MaintenancePlanModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const { createPlan, updatePlan } = useMaintenancePlans();
  const { assets, fetchAssets } = useAssets();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    assetId: prefillAssetId ?? '',
    triggerType: 'CALENDAR',
    intervalValue: '',
    alertBeforeValue: '',
    description: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load assets list for selector
  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  // Populate form when editing
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        assetId: plan.assetId,
        triggerType: plan.triggerType,
        intervalValue: String(plan.intervalValue),
        alertBeforeValue: String(plan.alertBeforeValue),
        description: plan.description ?? '',
      });
    } else {
      setFormData({
        name: '',
        assetId: prefillAssetId ?? '',
        triggerType: 'CALENDAR',
        intervalValue: '',
        alertBeforeValue: '',
        description: '',
      });
    }
    setErrors({});
    setSubmitError(null);
  }, [plan, prefillAssetId, isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function setField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Nome e obrigatorio.';
    if (!formData.assetId) newErrors.assetId = 'Selecione um ativo.';
    const intervalNum = Number(formData.intervalValue);
    if (!formData.intervalValue || isNaN(intervalNum) || intervalNum <= 0) {
      newErrors.intervalValue = 'Intervalo deve ser um numero positivo.';
    }
    const alertNum = Number(formData.alertBeforeValue);
    if (!formData.alertBeforeValue || isNaN(alertNum) || alertNum < 0) {
      newErrors.alertBeforeValue = 'Antecedencia deve ser um numero nao negativo.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        name: formData.name.trim(),
        assetId: formData.assetId,
        triggerType: formData.triggerType,
        intervalValue: Number(formData.intervalValue),
        alertBeforeValue: Number(formData.alertBeforeValue),
        description: formData.description.trim() || undefined,
      };
      if (plan) {
        await updatePlan(plan.id, input);
      } else {
        await createPlan(input);
      }
      onSuccess();
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="mp-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={plan ? 'Editar plano de manutencao' : 'Novo plano de manutencao'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mp-modal__dialog" ref={modalRef}>
        {/* Header */}
        <header className="mp-modal__header">
          <h2 className="mp-modal__title">
            {plan ? 'Editar plano de manutencao' : 'Novo plano de manutencao'}
          </h2>
          <button type="button" className="mp-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="mp-modal__body">
            {submitError && (
              <div className="mp-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Nome */}
            <div className="mp-modal__field">
              <Label htmlFor="mp-name" required>
                Nome do plano
              </Label>
              <input
                ref={firstFocusRef}
                id="mp-name"
                type="text"
                className={`mp-modal__input ${errors.name ? 'mp-modal__input--error' : ''}`}
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => {
                  if (!formData.name.trim()) {
                    setErrors((prev) => ({ ...prev, name: 'Nome e obrigatorio.' }));
                  }
                }}
                aria-required="true"
                aria-describedby={errors.name ? 'mp-name-error' : undefined}
                placeholder="Ex: Revisao de 500h — Colheitadeira"
              />
              {errors.name && <FieldError message={errors.name} />}
            </div>

            {/* Ativo vinculado */}
            <div className="mp-modal__field">
              <Label htmlFor="mp-asset" required>
                Ativo vinculado
              </Label>
              <select
                id="mp-asset"
                className={`mp-modal__select ${errors.assetId ? 'mp-modal__select--error' : ''}`}
                value={formData.assetId}
                onChange={(e) => setField('assetId', e.target.value)}
                onBlur={() => {
                  if (!formData.assetId) {
                    setErrors((prev) => ({ ...prev, assetId: 'Selecione um ativo.' }));
                  }
                }}
                aria-required="true"
              >
                <option value="">Selecione um ativo...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetTag})
                  </option>
                ))}
              </select>
              {errors.assetId && <FieldError message={errors.assetId} />}
            </div>

            {/* Tipo de gatilho */}
            <fieldset className="mp-modal__fieldset">
              <legend className="mp-modal__legend">
                Tipo de gatilho{' '}
                <span className="mp-modal__required" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="mp-modal__radio-group">
                {(['CALENDAR', 'HOURMETER', 'ODOMETER'] as MaintenanceTriggerType[]).map((type) => {
                  const label =
                    type === 'CALENDAR' ? 'Calendario' : type === 'HOURMETER' ? 'Horimetro' : 'Km';
                  return (
                    <label key={type} className="mp-modal__radio-label">
                      <input
                        type="radio"
                        name="triggerType"
                        value={type}
                        checked={formData.triggerType === type}
                        onChange={() => setField('triggerType', type)}
                        className="mp-modal__radio"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Intervalo */}
            <div className="mp-modal__field">
              <Label htmlFor="mp-interval" required>
                {intervalLabel(formData.triggerType)}
              </Label>
              <input
                id="mp-interval"
                type="number"
                min="1"
                className={`mp-modal__input ${errors.intervalValue ? 'mp-modal__input--error' : ''}`}
                value={formData.intervalValue}
                onChange={(e) => setField('intervalValue', e.target.value)}
                onBlur={() => {
                  const n = Number(formData.intervalValue);
                  if (!formData.intervalValue || isNaN(n) || n <= 0) {
                    setErrors((prev) => ({
                      ...prev,
                      intervalValue: 'Intervalo deve ser um numero positivo.',
                    }));
                  }
                }}
                aria-required="true"
              />
              {errors.intervalValue && <FieldError message={errors.intervalValue} />}
            </div>

            {/* Alertar antecedencia */}
            <div className="mp-modal__field">
              <Label htmlFor="mp-alert" required>
                {alertLabel(formData.triggerType)}
              </Label>
              <input
                id="mp-alert"
                type="number"
                min="0"
                className={`mp-modal__input ${errors.alertBeforeValue ? 'mp-modal__input--error' : ''}`}
                value={formData.alertBeforeValue}
                onChange={(e) => setField('alertBeforeValue', e.target.value)}
                onBlur={() => {
                  const n = Number(formData.alertBeforeValue);
                  if (formData.alertBeforeValue === '' || isNaN(n) || n < 0) {
                    setErrors((prev) => ({
                      ...prev,
                      alertBeforeValue: 'Antecedencia deve ser um numero nao negativo.',
                    }));
                  }
                }}
                aria-required="true"
              />
              {errors.alertBeforeValue && <FieldError message={errors.alertBeforeValue} />}
            </div>

            {/* Descricao */}
            <div className="mp-modal__field">
              <label htmlFor="mp-description" className="mp-modal__label">
                Descricao
              </label>
              <textarea
                id="mp-description"
                className="mp-modal__textarea"
                value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
                placeholder="Detalhes sobre o plano de manutencao (opcional)"
              />
            </div>
          </div>

          {/* Footer */}
          <footer className="mp-modal__footer">
            <button
              type="button"
              className="mp-modal__btn mp-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mp-modal__btn mp-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Plano'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
