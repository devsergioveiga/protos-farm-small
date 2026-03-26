import { useState, useEffect, useRef } from 'react';
import { X, Info } from 'lucide-react';
import { useDepreciationConfig } from '@/hooks/useDepreciationConfig';
import type {
  DepreciationConfig,
  DepreciationMethod,
  DepreciationTrack,
} from '@/types/depreciation';
import { METHOD_LABELS, DEFAULT_RFB_RATES } from '@/types/depreciation';
import './DepreciationConfigModal.css';

// ─── DepreciationConfigModal ──────────────────────────────────────────────────

interface DepreciationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: { id: string; assetType: string; name: string };
  config?: DepreciationConfig | null;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  MAQUINA: 'Maquina',
  VEICULO: 'Veiculo',
  IMPLEMENTO: 'Implemento',
  BENFEITORIA: 'Benfeitoria',
  TERRA: 'Terra',
};

export default function DepreciationConfigModal({
  isOpen,
  onClose,
  onSuccess,
  asset,
  config,
}: DepreciationConfigModalProps) {
  const { createConfig, updateConfig } = useDepreciationConfig(null);

  const rfbDefaults = DEFAULT_RFB_RATES[asset.assetType];

  const [method, setMethod] = useState<DepreciationMethod>(config?.method ?? 'STRAIGHT_LINE');
  const [fiscalAnnualRate, setFiscalAnnualRate] = useState<string>(
    config?.fiscalAnnualRate != null
      ? String(config.fiscalAnnualRate)
      : rfbDefaults
        ? String(rfbDefaults.annualRate)
        : '',
  );
  const [managerialAnnualRate, setManagerialAnnualRate] = useState<string>(
    config?.managerialAnnualRate != null ? String(config.managerialAnnualRate) : '',
  );
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<string>(
    config?.usefulLifeMonths != null
      ? String(config.usefulLifeMonths)
      : rfbDefaults
        ? String(rfbDefaults.usefulLifeMonths)
        : '',
  );
  const [residualValue, setResidualValue] = useState<string>(
    config?.residualValue != null ? String(config.residualValue) : '0',
  );
  const [accelerationFactor, setAccelerationFactor] = useState<string>(
    config?.accelerationFactor != null ? String(config.accelerationFactor) : '2',
  );
  const [totalHours, setTotalHours] = useState<string>(
    config?.totalHours != null ? String(config.totalHours) : '',
  );
  const [totalUnits, setTotalUnits] = useState<string>(
    config?.totalUnits != null ? String(config.totalUnits) : '',
  );
  const [activeTrack, setActiveTrack] = useState<DepreciationTrack>(
    config?.activeTrack ?? 'FISCAL',
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = 'depreciation-config-modal-title';

  // Focus title when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isEdit = Boolean(config);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const payload = {
        assetId: asset.id,
        method,
        fiscalAnnualRate: fiscalAnnualRate !== '' ? parseFloat(fiscalAnnualRate) : null,
        managerialAnnualRate: managerialAnnualRate !== '' ? parseFloat(managerialAnnualRate) : null,
        usefulLifeMonths: usefulLifeMonths !== '' ? parseInt(usefulLifeMonths, 10) : null,
        residualValue: residualValue !== '' ? parseFloat(residualValue) : 0,
        accelerationFactor:
          method === 'ACCELERATED' && accelerationFactor !== ''
            ? parseFloat(accelerationFactor)
            : null,
        totalHours: method === 'HOURS_OF_USE' && totalHours !== '' ? parseFloat(totalHours) : null,
        totalUnits:
          method === 'UNITS_OF_PRODUCTION' && totalUnits !== '' ? parseFloat(totalUnits) : null,
        activeTrack,
      };

      if (isEdit) {
        await updateConfig(asset.id, payload);
      } else {
        await createConfig(payload);
      }

      onSuccess();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Nao foi possivel salvar a configuracao. Verifique sua conexao e tente novamente.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="depr-config-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="depr-config-modal">
        {/* Header */}
        <header className="depr-config-modal__header">
          <h2 id={titleId} ref={titleRef} className="depr-config-modal__title" tabIndex={-1}>
            {isEdit ? 'Editar configuracao de depreciacao' : 'Configurar depreciacao'} —{' '}
            {asset.name}
          </h2>
          <button
            type="button"
            className="depr-config-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="depr-config-modal__form">
          <div className="depr-config-modal__body">
            {/* Metodo */}
            <div className="depr-config-modal__field">
              <label htmlFor="depr-method" className="depr-config-modal__label">
                Metodo de depreciacao <span aria-hidden="true">*</span>
              </label>
              <select
                id="depr-method"
                className="depr-config-modal__select"
                value={method}
                onChange={(e) => setMethod(e.target.value as DepreciationMethod)}
                required
                aria-required="true"
              >
                {(Object.entries(METHOD_LABELS) as [DepreciationMethod, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Taxa anual fiscal */}
            <div className="depr-config-modal__field">
              <label htmlFor="depr-fiscal-rate" className="depr-config-modal__label">
                Taxa anual fiscal (%)
              </label>
              <input
                id="depr-fiscal-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="depr-config-modal__input"
                value={fiscalAnnualRate}
                onChange={(e) => setFiscalAnnualRate(e.target.value)}
                placeholder="Ex: 10"
              />
              {rfbDefaults && rfbDefaults.annualRate > 0 && (
                <p className="depr-config-modal__hint">
                  <Info size={14} aria-hidden="true" className="depr-config-modal__hint-icon" />
                  Taxa RFB padrao para {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}:{' '}
                  <strong>{rfbDefaults.annualRate}%</strong> ao ano (
                  {rfbDefaults.usefulLifeMonths / 12} anos de vida util)
                </p>
              )}
            </div>

            {/* Taxa anual gerencial */}
            <div className="depr-config-modal__field">
              <label htmlFor="depr-managerial-rate" className="depr-config-modal__label">
                Taxa anual gerencial (%)
              </label>
              <input
                id="depr-managerial-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="depr-config-modal__input"
                value={managerialAnnualRate}
                onChange={(e) => setManagerialAnnualRate(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Vida util — only for STRAIGHT_LINE */}
            <div
              className="depr-config-modal__field"
              style={{ display: method === 'STRAIGHT_LINE' ? undefined : 'none' }}
            >
              <label htmlFor="depr-useful-life" className="depr-config-modal__label">
                Vida util (meses)
              </label>
              <input
                id="depr-useful-life"
                type="number"
                min="1"
                className="depr-config-modal__input"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                placeholder="Ex: 120"
                aria-hidden={method !== 'STRAIGHT_LINE'}
              />
            </div>

            {/* Fator de aceleracao — only for ACCELERATED */}
            <div
              className="depr-config-modal__field"
              style={{ display: method === 'ACCELERATED' ? undefined : 'none' }}
            >
              <label htmlFor="depr-acceleration-factor" className="depr-config-modal__label">
                Fator de aceleracao
              </label>
              <input
                id="depr-acceleration-factor"
                type="number"
                step="0.1"
                min="1"
                className="depr-config-modal__input"
                value={accelerationFactor}
                onChange={(e) => setAccelerationFactor(e.target.value)}
                placeholder="Ex: 2.0"
                aria-hidden={method !== 'ACCELERATED'}
              />
            </div>

            {/* Total de horas — only for HOURS_OF_USE */}
            <div
              className="depr-config-modal__field"
              style={{ display: method === 'HOURS_OF_USE' ? undefined : 'none' }}
            >
              <label htmlFor="depr-total-hours" className="depr-config-modal__label">
                Total de horas
              </label>
              <input
                id="depr-total-hours"
                type="number"
                min="1"
                className="depr-config-modal__input"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                placeholder="Ex: 10000"
                aria-hidden={method !== 'HOURS_OF_USE'}
              />
            </div>

            {/* Total de unidades — only for UNITS_OF_PRODUCTION */}
            <div
              className="depr-config-modal__field"
              style={{ display: method === 'UNITS_OF_PRODUCTION' ? undefined : 'none' }}
            >
              <label htmlFor="depr-total-units" className="depr-config-modal__label">
                Total de unidades
              </label>
              <input
                id="depr-total-units"
                type="number"
                min="1"
                className="depr-config-modal__input"
                value={totalUnits}
                onChange={(e) => setTotalUnits(e.target.value)}
                placeholder="Ex: 50000"
                aria-hidden={method !== 'UNITS_OF_PRODUCTION'}
              />
            </div>

            {/* Valor residual */}
            <div className="depr-config-modal__field">
              <label htmlFor="depr-residual-value" className="depr-config-modal__label">
                Valor residual (R$)
              </label>
              <input
                id="depr-residual-value"
                type="number"
                step="0.01"
                min="0"
                className="depr-config-modal__input"
                value={residualValue}
                onChange={(e) => setResidualValue(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Track ativo */}
            <div className="depr-config-modal__field">
              <label htmlFor="depr-active-track" className="depr-config-modal__label">
                Track ativo <span aria-hidden="true">*</span>
              </label>
              <select
                id="depr-active-track"
                className="depr-config-modal__select"
                value={activeTrack}
                onChange={(e) => setActiveTrack(e.target.value as DepreciationTrack)}
                required
                aria-required="true"
              >
                <option value="FISCAL">Fiscal (RFB)</option>
                <option value="MANAGERIAL">Gerencial</option>
              </select>
            </div>

            {/* Error */}
            {submitError && (
              <p className="depr-config-modal__error" role="alert">
                {submitError}
              </p>
            )}
          </div>

          {/* Footer */}
          <footer className="depr-config-modal__footer">
            <button
              type="button"
              className="depr-config-modal__btn depr-config-modal__btn--cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="depr-config-modal__btn depr-config-modal__btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar configuracao'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
