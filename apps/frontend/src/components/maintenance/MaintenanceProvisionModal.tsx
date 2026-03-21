import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useMaintenanceProvisions } from '@/hooks/useMaintenanceProvisions';
import { useAssets } from '@/hooks/useAssets';
import type { MaintenanceProvision } from '@/types/maintenance';
import './MaintenanceProvisionModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface MaintenanceProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  provision?: MaintenanceProvision;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="provision-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function MaintenanceProvisionModal({
  isOpen,
  onClose,
  onSuccess,
  provision,
}: MaintenanceProvisionModalProps) {
  const { createProvision, updateProvision } = useMaintenanceProvisions();
  const { assets, fetchAssets } = useAssets();

  const [assetId, setAssetId] = useState<string>('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  useEffect(() => {
    if (!isOpen) return;
    if (provision) {
      setAssetId(provision.assetId ?? '');
      setMonthlyAmount(String(provision.monthlyAmount));
      setCostCenterId(provision.costCenterId ?? '');
      setDescription(provision.description ?? '');
      setIsActive(provision.isActive);
    } else {
      setAssetId('');
      setMonthlyAmount('');
      setCostCenterId('');
      setDescription('');
      setIsActive(true);
    }
    setErrors({});
    setSubmitError(null);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen, provision]);

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
    if (!monthlyAmount || Number(monthlyAmount) <= 0) {
      next.monthlyAmount = 'Informe um valor mensal valido.';
    }
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
        assetId: assetId || null,
        monthlyAmount: Number(monthlyAmount),
        costCenterId: costCenterId || null,
        description: description.trim() || null,
        isActive,
      };
      if (provision) {
        await updateProvision(provision.id, input, onSuccess);
      } else {
        await createProvision(input, onSuccess);
      }
    } catch {
      setSubmitError('Nao foi possivel salvar. Verifique sua conexao e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="provision-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provision-modal-title"
    >
      <div className="provision-modal">
        {/* Header */}
        <header className="provision-modal__header">
          <h2 className="provision-modal__title" id="provision-modal-title">
            {provision ? 'Editar Provisao' : 'Nova Provisao de Manutencao'}
          </h2>
          <button
            type="button"
            className="provision-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="provision-modal__body">
            {/* Ativo (optional) */}
            <div className="provision-modal__field">
              <label htmlFor="provision-asset" className="provision-modal__label">
                Ativo (opcional — vazio = toda a frota)
              </label>
              <select
                ref={firstFieldRef}
                id="provision-asset"
                className="provision-modal__select"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              >
                <option value="">Todos os ativos (frota)</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.assetTag})
                  </option>
                ))}
              </select>
            </div>

            {/* Valor mensal */}
            <div className="provision-modal__field">
              <label htmlFor="provision-amount" className="provision-modal__label">
                Valor mensal (R$){' '}
                <span className="provision-modal__required" aria-hidden="true">*</span>
              </label>
              <input
                id="provision-amount"
                type="number"
                min="0"
                step="0.01"
                className={`provision-modal__input${errors.monthlyAmount ? ' provision-modal__input--error' : ''}`}
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                aria-required="true"
              />
              <FieldError message={errors.monthlyAmount} />
            </div>

            {/* Centro de custo */}
            <div className="provision-modal__field">
              <label htmlFor="provision-cost-center" className="provision-modal__label">
                Centro de custo (opcional)
              </label>
              <input
                id="provision-cost-center"
                type="text"
                className="provision-modal__input"
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                placeholder="ID do centro de custo"
              />
            </div>

            {/* Descricao */}
            <div className="provision-modal__field">
              <label htmlFor="provision-desc" className="provision-modal__label">Descricao</label>
              <textarea
                id="provision-desc"
                className="provision-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Ativo toggle */}
            <div className="provision-modal__toggle-field">
              <span className="provision-modal__toggle-label">Ativo</span>
              <label className="provision-modal__toggle" htmlFor="provision-active">
                <input
                  id="provision-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  role="switch"
                  aria-checked={isActive}
                />
                <span className="provision-modal__toggle-track" aria-hidden="true" />
                <span className="provision-modal__toggle-thumb" aria-hidden="true" />
              </label>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="provision-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="provision-modal__footer">
            <button
              type="button"
              className="provision-modal__btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="provision-modal__btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
