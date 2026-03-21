import { useEffect, useRef, useState } from 'react';
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
  prefilledAssetId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<MaintenanceTriggerType, string> = {
  HOURMETER: 'Horimetro',
  ODOMETER: 'Odometro (km)',
  CALENDAR: 'Calendario (dias)',
};

function getIntervalLabel(trigger: MaintenanceTriggerType): string {
  if (trigger === 'HOURMETER') return 'A cada X horas';
  if (trigger === 'ODOMETER') return 'A cada X km';
  return 'A cada X dias';
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="plan-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function MaintenancePlanModal({
  isOpen,
  onClose,
  onSuccess,
  plan,
  prefilledAssetId,
}: MaintenancePlanModalProps) {
  const { createPlan, updatePlan } = useMaintenancePlans();
  const { assets, fetchAssets } = useAssets();

  const [name, setName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [triggerType, setTriggerType] = useState<MaintenanceTriggerType>('HOURMETER');
  const [intervalValue, setIntervalValue] = useState('');
  const [alertBeforeValue, setAlertBeforeValue] = useState('');
  const [description, setDescription] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Load assets for selector
  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  // Populate form for edit or prefill
  useEffect(() => {
    if (!isOpen) return;
    if (plan) {
      setName(plan.name);
      setAssetId(plan.assetId);
      setTriggerType(plan.triggerType);
      setIntervalValue(String(plan.intervalValue));
      setAlertBeforeValue(String(plan.alertBeforeValue));
      setDescription(plan.description ?? '');
    } else {
      setName('');
      setAssetId(prefilledAssetId ?? '');
      setTriggerType('HOURMETER');
      setIntervalValue('');
      setAlertBeforeValue('');
      setDescription('');
    }
    setErrors({});
    setSubmitError(null);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen, plan, prefilledAssetId]);

  // Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Nome e obrigatorio.';
    if (!assetId) next.assetId = 'Selecione um ativo.';
    if (!intervalValue || Number(intervalValue) <= 0) next.intervalValue = 'Informe um intervalo valido.';
    if (!alertBeforeValue || Number(alertBeforeValue) < 0) next.alertBeforeValue = 'Informe a antecedencia.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        assetId,
        name: name.trim(),
        description: description.trim() || null,
        triggerType,
        intervalValue: Number(intervalValue),
        alertBeforeValue: Number(alertBeforeValue),
      };
      if (plan) {
        await updatePlan(plan.id, input, onSuccess);
      } else {
        await createPlan(input, onSuccess);
      }
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="plan-modal__overlay" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
      <div className="plan-modal">
        {/* Header */}
        <header className="plan-modal__header">
          <h2 className="plan-modal__title" id="plan-modal-title">
            {plan ? 'Editar Plano' : 'Novo Plano de Manutencao'}
          </h2>
          <button
            type="button"
            className="plan-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="plan-modal__body">
            {/* Nome */}
            <div className="plan-modal__field">
              <label htmlFor="plan-name" className="plan-modal__label">
                Nome{' '}
                <span className="plan-modal__required" aria-hidden="true">*</span>
              </label>
              <input
                ref={firstFieldRef}
                id="plan-name"
                type="text"
                className={`plan-modal__input${errors.name ? ' plan-modal__input--error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setErrors((p) => ({ ...p, name: 'Nome e obrigatorio.' }));
                  else setErrors((p) => { const n = { ...p }; delete n.name; return n; });
                }}
                aria-required="true"
                aria-describedby={errors.name ? 'plan-name-error' : undefined}
              />
              <FieldError message={errors.name} />
            </div>

            {/* Ativo */}
            <div className="plan-modal__field">
              <label htmlFor="plan-asset" className="plan-modal__label">
                Ativo vinculado{' '}
                <span className="plan-modal__required" aria-hidden="true">*</span>
              </label>
              <select
                id="plan-asset"
                className={`plan-modal__select${errors.assetId ? ' plan-modal__select--error' : ''}`}
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione um ativo</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetTag})
                  </option>
                ))}
              </select>
              <FieldError message={errors.assetId} />
            </div>

            {/* Tipo de gatilho */}
            <div className="plan-modal__field">
              <span className="plan-modal__label" id="trigger-group-label">Tipo de gatilho</span>
              <div
                className="plan-modal__radio-group"
                role="radiogroup"
                aria-labelledby="trigger-group-label"
              >
                {(Object.keys(TRIGGER_LABELS) as MaintenanceTriggerType[]).map((t) => (
                  <label
                    key={t}
                    className={`plan-modal__radio-card${triggerType === t ? ' plan-modal__radio-card--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="triggerType"
                      value={t}
                      checked={triggerType === t}
                      onChange={() => setTriggerType(t)}
                    />
                    {TRIGGER_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>

            {/* Intervalo */}
            <div className="plan-modal__field">
              <label htmlFor="plan-interval" className="plan-modal__label">
                {getIntervalLabel(triggerType)}{' '}
                <span className="plan-modal__required" aria-hidden="true">*</span>
              </label>
              <input
                id="plan-interval"
                type="number"
                min="1"
                className={`plan-modal__input${errors.intervalValue ? ' plan-modal__input--error' : ''}`}
                value={intervalValue}
                onChange={(e) => setIntervalValue(e.target.value)}
                aria-required="true"
              />
              <FieldError message={errors.intervalValue} />
            </div>

            {/* Alertar com antecedencia */}
            <div className="plan-modal__field">
              <label htmlFor="plan-alert" className="plan-modal__label">
                Alertar com antecedencia de{' '}
                <span className="plan-modal__required" aria-hidden="true">*</span>
              </label>
              <input
                id="plan-alert"
                type="number"
                min="0"
                className={`plan-modal__input${errors.alertBeforeValue ? ' plan-modal__input--error' : ''}`}
                value={alertBeforeValue}
                onChange={(e) => setAlertBeforeValue(e.target.value)}
                aria-required="true"
              />
              <FieldError message={errors.alertBeforeValue} />
            </div>

            {/* Descricao */}
            <div className="plan-modal__field">
              <label htmlFor="plan-desc" className="plan-modal__label">Descricao</label>
              <textarea
                id="plan-desc"
                className="plan-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="plan-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="plan-modal__footer">
            <button
              type="button"
              className="plan-modal__btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="plan-modal__btn-submit"
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
