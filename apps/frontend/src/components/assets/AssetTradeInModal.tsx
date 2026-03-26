import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { useAssetTradeIns } from '@/hooks/useAssetTradeIns';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Asset, CreateTradeInInput } from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_CLASSIFICATION_LABELS } from '@/types/asset';
import './AssetTradeInModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetTradeInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tradedAsset: Asset;          // pre-selected asset to trade in
}

// ─── Helpers ───────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ─────────────────────────────────────────────────────────

export default function AssetTradeInModal({
  isOpen,
  onClose,
  onSuccess,
  tradedAsset,
}: AssetTradeInModalProps) {
  const { createTradeIn, loading } = useAssetTradeIns();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Section 1 — Old asset
  const [tradedAssetValue, setTradedAssetValue] = useState('');
  const [tradeInDate, setTradeInDate] = useState(today());

  // Section 2 — New asset
  const [newAssetType, setNewAssetType] = useState('MAQUINA');
  const [newAssetClassification, setNewAssetClassification] = useState('DEPRECIABLE_CPC27');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetValue, setNewAssetValue] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Form state
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTradedAssetValue('');
      setTradeInDate(today());
      setNewAssetType('MAQUINA');
      setNewAssetClassification('DEPRECIABLE_CPC27');
      setNewAssetName('');
      setNewAssetValue('');
      setSupplierName('');
      setDueDate('');
      setFormError(null);
      setShowConfirm(false);
      setTimeout(() => closeRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showConfirm) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, showConfirm]);

  if (!isOpen) return null;

  // ─── Computed financials ─────────────────────────────────────────────

  const tradedValueNum = parseFloat(tradedAssetValue) || 0;
  const newValueNum = parseFloat(newAssetValue) || 0;
  const acquisitionValueNum = tradedAsset.acquisitionValue ? parseFloat(tradedAsset.acquisitionValue) : 0;

  // Estimated NBV (approximate — backend will use actual depreciation)
  const estimatedNbv = acquisitionValueNum;
  const estimatedGainLoss = tradedValueNum > 0 ? tradedValueNum - estimatedNbv : 0;
  const netPayable = newValueNum - tradedValueNum;
  const hasNetPayable = netPayable > 0;

  // ─── Validation ──────────────────────────────────────────────────────

  function handleSubmitAttempt(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!tradedAssetValue || tradedValueNum <= 0) {
      setFormError('Valor acordado para o ativo antigo e obrigatorio.');
      return;
    }
    if (!tradeInDate) {
      setFormError('Data da troca e obrigatoria.');
      return;
    }
    if (!newAssetName.trim()) {
      setFormError('Nome do novo ativo e obrigatorio.');
      return;
    }
    if (!newAssetValue || newValueNum <= 0) {
      setFormError('Valor do novo ativo e obrigatorio.');
      return;
    }
    if (hasNetPayable && !dueDate) {
      setFormError('Vencimento do saldo a pagar e obrigatorio.');
      return;
    }

    setShowConfirm(true);
  }

  async function handleConfirm() {
    setFormError(null);
    const input: CreateTradeInInput = {
      farmId: tradedAsset.farmId,
      tradedAssetId: tradedAsset.id,
      tradeInDate,
      tradedAssetValue: tradedValueNum,
      newAssetType,
      newAssetClassification,
      newAssetName: newAssetName.trim(),
      newAssetValue: newValueNum,
      ...(supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      ...(hasNetPayable && dueDate ? { dueDate } : {}),
    };

    try {
      await createTradeIn(input);
      setShowConfirm(false);
      onSuccess();
    } catch (err) {
      setShowConfirm(false);
      setFormError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel registrar a troca. Tente novamente.',
      );
    }
  }

  return (
    <div
      className="trade-in-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-in-modal-title"
    >
      <div className="trade-in-modal">
        {/* Header */}
        <div className="trade-in-modal__header">
          <h2 id="trade-in-modal-title" className="trade-in-modal__title">
            Trocar ativo
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="trade-in-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitAttempt} noValidate>
          <div className="trade-in-modal__body">

            {/* Section 1 — Ativo para Troca */}
            <section className="trade-in-section">
              <h3 className="trade-in-section__title">Ativo para troca (ativo antigo)</h3>

              {/* Readonly asset info */}
              <div className="trade-in-section__field">
                <label className="trade-in-section__label">Ativo selecionado</label>
                <input
                  type="text"
                  className="trade-in-section__input"
                  value={`${tradedAsset.assetTag} — ${tradedAsset.name}`}
                  readOnly
                  aria-readonly="true"
                />
              </div>

              {acquisitionValueNum > 0 && (
                <div className="trade-in-section__field">
                  <label className="trade-in-section__label">Valor de aquisicao (referencia)</label>
                  <input
                    type="text"
                    className="trade-in-section__input"
                    value={currencyFmt.format(acquisitionValueNum)}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              )}

              <div className="trade-in-section__field">
                <label htmlFor="traded-asset-value" className="trade-in-section__label">
                  Valor acordado para o ativo (R$) *
                </label>
                <input
                  id="traded-asset-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="trade-in-section__input"
                  value={tradedAssetValue}
                  onChange={(e) => setTradedAssetValue(e.target.value)}
                  placeholder="0,00"
                  required
                  aria-required="true"
                />
              </div>

              <div className="trade-in-section__field">
                <label htmlFor="trade-in-date" className="trade-in-section__label">
                  Data da troca *
                </label>
                <input
                  id="trade-in-date"
                  type="date"
                  className="trade-in-section__input"
                  value={tradeInDate}
                  onChange={(e) => setTradeInDate(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
            </section>

            {/* Section 2 — Ativo Novo */}
            <section className="trade-in-section">
              <h3 className="trade-in-section__title">Ativo novo</h3>

              <div className="trade-in-section__field">
                <label htmlFor="new-asset-type" className="trade-in-section__label">
                  Tipo do novo ativo *
                </label>
                <select
                  id="new-asset-type"
                  className="trade-in-section__select"
                  value={newAssetType}
                  onChange={(e) => setNewAssetType(e.target.value)}
                  required
                  aria-required="true"
                >
                  {Object.entries(ASSET_TYPE_LABELS)
                    .filter(([key]) => key !== 'TERRA')
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </div>

              <div className="trade-in-section__field">
                <label htmlFor="new-asset-classification" className="trade-in-section__label">
                  Classificacao *
                </label>
                <select
                  id="new-asset-classification"
                  className="trade-in-section__select"
                  value={newAssetClassification}
                  onChange={(e) => setNewAssetClassification(e.target.value)}
                  required
                  aria-required="true"
                >
                  {Object.entries(ASSET_CLASSIFICATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="trade-in-section__field">
                <label htmlFor="new-asset-name" className="trade-in-section__label">
                  Nome do novo ativo *
                </label>
                <input
                  id="new-asset-name"
                  type="text"
                  className="trade-in-section__input"
                  value={newAssetName}
                  onChange={(e) => setNewAssetName(e.target.value)}
                  placeholder="Ex: Trator New Holland T7"
                  required
                  aria-required="true"
                />
              </div>

              <div className="trade-in-section__field">
                <label htmlFor="new-asset-value" className="trade-in-section__label">
                  Valor do novo ativo (R$) *
                </label>
                <input
                  id="new-asset-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="trade-in-section__input"
                  value={newAssetValue}
                  onChange={(e) => setNewAssetValue(e.target.value)}
                  placeholder="0,00"
                  required
                  aria-required="true"
                />
              </div>

              <div className="trade-in-section__field">
                <label htmlFor="supplier-name" className="trade-in-section__label">
                  Fornecedor/Vendedor
                </label>
                <input
                  id="supplier-name"
                  type="text"
                  className="trade-in-section__input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Nome da revenda ou vendedor"
                />
              </div>
            </section>

            {/* Section 3 — Resumo Financeiro */}
            {(tradedValueNum > 0 || newValueNum > 0) && (
              <section className="trade-in-section">
                <h3 className="trade-in-section__title">Resumo financeiro</h3>
                <div className="trade-in-summary">
                  <dl className="trade-in-summary__dl">
                    <div className="trade-in-summary__row">
                      <dt>Valor do ativo antigo (acordado)</dt>
                      <dd>{tradedValueNum > 0 ? currencyFmt.format(tradedValueNum) : '—'}</dd>
                    </div>
                    <div className="trade-in-summary__row">
                      <dt>Valor do ativo novo</dt>
                      <dd>{newValueNum > 0 ? currencyFmt.format(newValueNum) : '—'}</dd>
                    </div>
                    <div className="trade-in-summary__row trade-in-summary__row--highlight">
                      <dt>Saldo a pagar</dt>
                      <dd>
                        {hasNetPayable ? currencyFmt.format(netPayable) : 'R$ 0,00 (troca favoravel)'}
                      </dd>
                    </div>
                    {tradedValueNum > 0 && acquisitionValueNum > 0 && (
                      <div className="trade-in-summary__row">
                        <dt>Ganho/Perda estimada *</dt>
                        <dd
                          className={
                            estimatedGainLoss >= 0
                              ? 'trade-in-summary__gain'
                              : 'trade-in-summary__loss'
                          }
                        >
                          {estimatedGainLoss >= 0 ? (
                            <TrendingUp size={14} aria-hidden="true" />
                          ) : (
                            <TrendingDown size={14} aria-hidden="true" />
                          )}
                          {currencyFmt.format(Math.abs(estimatedGainLoss))}
                          {estimatedGainLoss >= 0 ? ' (ganho)' : ' (perda)'}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {acquisitionValueNum > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)', marginTop: '4px' }}>
                      * O ganho/perda real sera calculado com base na depreciacao acumulada.
                    </p>
                  )}
                  {hasNetPayable && (
                    <div className="trade-in-summary__payable-alert">
                      <Info size={14} aria-hidden="true" />
                      Uma conta a pagar sera gerada automaticamente para o saldo de {currencyFmt.format(netPayable)}.
                    </div>
                  )}
                </div>

                {/* Due date — only when there's a net payable */}
                {hasNetPayable && (
                  <div className="trade-in-section__field">
                    <label htmlFor="due-date" className="trade-in-section__label">
                      Vencimento do saldo *
                    </label>
                    <input
                      id="due-date"
                      type="date"
                      className="trade-in-section__input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                )}
              </section>
            )}

            {/* Error */}
            {formError && (
              <div className="trade-in-section__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="trade-in-modal__footer">
            <button
              type="button"
              className="trade-in-modal__btn trade-in-modal__btn--cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="trade-in-modal__btn trade-in-modal__btn--primary"
              disabled={loading}
            >
              {loading ? 'Registrando...' : 'Registrar Troca'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Confirmar troca de ativo"
        message={`Confirma a troca? O ativo "${tradedAsset.assetTag} — ${tradedAsset.name}" sera baixado permanentemente e um novo ativo sera criado.`}
        confirmLabel="Sim, registrar troca"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={loading}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
