import { useEffect, useRef, useState, useCallback } from 'react';
import { X, AlertCircle, ChevronDown, ChevronUp, Info, FileUp } from 'lucide-react';
import { useAssetForm } from '@/hooks/useAssetForm';
import { useFarms } from '@/hooks/useFarms';
import { useAssets } from '@/hooks/useAssets';
import { useAssetAcquisition } from '@/hooks/useAssetAcquisition';
import InstallmentPreviewTable from './InstallmentPreviewTable';
import type {
  Asset,
  AssetType,
  AssetClassification,
  AssetStatus,
  PaymentType,
  InstallmentPreview,
} from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_CLASSIFICATION_LABELS, ASSET_STATUS_LABELS } from '@/types/asset';
import AssetNfeImportModal from './AssetNfeImportModal';
import './AssetModal.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset?: Asset;
}

// ─── Fuel type options ─────────────────────────────────────────────────

const FUEL_TYPES = [
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Gasolina', label: 'Gasolina' },
  { value: 'Etanol', label: 'Etanol' },
  { value: 'GNV', label: 'GNV' },
  { value: 'Eletrico', label: 'Eletrico' },
];

// ─── Section heading ───────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return <h3 className="asset-modal__section-heading">{children}</h3>;
}

// ─── Field error ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="asset-modal__field-error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </span>
  );
}

// ─── Label ─────────────────────────────────────────────────────────────

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
    <label htmlFor={htmlFor} className="asset-modal__label">
      {children}
      {required && (
        <span className="asset-modal__required" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────

export default function AssetModal({ isOpen, onClose, onSuccess, asset }: AssetModalProps) {
  const { formData, errors, isSubmitting, setField, handleSubmit, resetForm, loadAsset } =
    useAssetForm();
  const { farms } = useFarms();
  const { assets: machineAssets, fetchAssets } = useAssets();
  const { createAcquisition, isLoading: isAcquisitionLoading } = useAssetAcquisition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [collapsedAcquisition, setCollapsedAcquisition] = useState(false);
  const [collapsedPhotos, setCollapsedPhotos] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ─── Financial section state ─────────────────────────────────────────
  const [financialExpanded, setFinancialExpanded] = useState(true);
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [installmentCount, setInstallmentCount] = useState<number | ''>('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [installmentPreviews, setInstallmentPreviews] = useState<InstallmentPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [infoBannerDismissed, setInfoBannerDismissed] = useState(false);
  const [installmentError, setInstallmentError] = useState<string | null>(null);
  const [showNfeModal, setShowNfeModal] = useState(false);

  const isEdit = Boolean(asset?.id);

  // Load machine assets for IMPLEMENTO parent picker
  const loadMachines = useCallback(() => {
    void fetchAssets({ assetType: 'MAQUINA', limit: 100 });
  }, [fetchAssets]);

  // ─── Installment preview calculation ───────────────────────────────
  const recalculateInstallments = useCallback(
    (countOverride?: number, firstDueDateOverride?: string) => {
      const count = countOverride ?? (typeof installmentCount === 'number' ? installmentCount : 0);
      const firstDue = firstDueDateOverride ?? firstDueDate;
      const total = parseFloat(formData.acquisitionValue ?? '0') || 0;

      if (paymentType !== 'FINANCIADO' || count < 2 || !firstDue || total <= 0) {
        setInstallmentPreviews([]);
        return;
      }

      setPreviewLoading(true);
      try {
        const baseAmount = Math.floor((total / count) * 100) / 100;
        const residual = Math.round((total - baseAmount * count) * 100) / 100;
        const previews: InstallmentPreview[] = [];
        for (let i = 0; i < count; i++) {
          const d = new Date(firstDue + 'T00:00:00Z');
          d.setUTCMonth(d.getUTCMonth() + i);
          previews.push({
            number: i + 1,
            dueDate: d,
            amount: i === 0 ? baseAmount + residual : baseAmount,
          });
        }
        setInstallmentPreviews(previews);
      } finally {
        setPreviewLoading(false);
      }
    },
    [installmentCount, firstDueDate, formData.acquisitionValue, paymentType],
  );

  // Reset / load asset on open
  useEffect(() => {
    if (!isOpen) return;
    if (asset) {
      loadAsset(asset);
    } else {
      resetForm();
    }
    // Reset financial section
    setPaymentType('');
    setDueDate('');
    setInstallmentCount('');
    setFirstDueDate('');
    setInterestRate('');
    setInstallmentPreviews([]);
    setInfoBannerDismissed(false);
    setInstallmentError(null);
    // Load machines for IMPLEMENTO parent picker
    loadMachines();
    // Focus first input after open animation
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 100);
  }, [isOpen, asset, loadAsset, resetForm, loadMachines]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Trap focus
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [isOpen, formData.assetType]);

  if (!isOpen) return null;

  const currentType = formData.assetType;
  const acquisitionValue = parseFloat(formData.acquisitionValue ?? '0') || 0;
  const hasFinancialData = paymentType !== '' && acquisitionValue > 0;
  const showInfoBanner =
    !infoBannerDismissed &&
    acquisitionValue > 0 &&
    Boolean(formData.supplierId) &&
    paymentType !== '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      if (hasFinancialData && !isEdit) {
        // Route through asset-acquisitions endpoint for automatic CP creation
        if (!formData.name?.trim() || !formData.assetType || !formData.classification || !formData.farmId) {
          setSubmitError('Preencha os campos obrigatorios antes de continuar.');
          return;
        }
        const result = await createAcquisition({
          name: formData.name ?? '',
          assetType: formData.assetType as AssetType,
          classification: formData.classification as AssetClassification,
          farmId: formData.farmId ?? '',
          description: formData.description,
          acquisitionDate: formData.acquisitionDate,
          acquisitionValue: formData.acquisitionValue,
          supplierId: formData.supplierId,
          invoiceNumber: formData.invoiceNumber,
          costCenterId: formData.costCenterId,
          serialNumber: formData.serialNumber,
          manufacturer: formData.manufacturer,
          model: formData.model,
          yearOfManufacture: formData.yearOfManufacture,
          engineHp: formData.engineHp,
          fuelType: formData.fuelType,
          renavamCode: formData.renavamCode,
          licensePlate: formData.licensePlate,
          parentAssetId: formData.parentAssetId,
          constructionMaterial: formData.constructionMaterial,
          areaM2: formData.areaM2,
          capacity: formData.capacity,
          registrationNumber: formData.registrationNumber,
          areaHa: formData.areaHa,
          carCode: formData.carCode,
          currentHourmeter: formData.currentHourmeter,
          currentOdometer: formData.currentOdometer,
          notes: formData.notes,
          paymentType: paymentType as PaymentType,
          dueDate: paymentType === 'AVISTA' ? dueDate || undefined : undefined,
          installmentCount: paymentType === 'FINANCIADO' && typeof installmentCount === 'number' ? installmentCount : undefined,
          firstDueDate: paymentType === 'FINANCIADO' ? firstDueDate || undefined : undefined,
          interestRate: paymentType === 'FINANCIADO' && interestRate ? parseFloat(interestRate.replace(',', '.')) || undefined : undefined,
        });
        const toastMessage = result.payableId
          ? 'Ativo registrado. Conta a pagar criada automaticamente.'
          : 'Ativo registrado com sucesso.';
        // Use a simple alert-style notification since toast pattern varies by project
        console.info(toastMessage);
        onSuccess();
      } else {
        await handleSubmit(onSuccess);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar o ativo.';
      setSubmitError(message);
    }
  }

  return (
    <>
    <div
      className="asset-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
    >
      <div className="asset-modal" ref={dialogRef}>
        {/* Header */}
        <div className="asset-modal__header">
          <h2 id="asset-modal-title" className="asset-modal__title">
            {isEdit ? 'Editar ativo' : 'Cadastrar ativo'}
          </h2>
          <div className="asset-modal__header-actions">
            {!isEdit && (
              <button
                type="button"
                className="asset-modal__nfe-btn"
                onClick={() => setShowNfeModal(true)}
                aria-label="Importar NF-e"
              >
                <FileUp size={20} aria-hidden="true" />
                Importar NF-e
              </button>
            )}
            <button
              type="button"
              className="asset-modal__close"
              onClick={onClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form
          className="asset-modal__body"
          onSubmit={(e) => void onSubmit(e)}
          noValidate
          id="asset-modal-form"
        >
          {submitError && (
            <div className="asset-modal__submit-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {/* Section 1: Tipo de Ativo */}
          <section className="asset-modal__section">
            <SectionHeading>Tipo de Ativo</SectionHeading>
            <div className="asset-modal__type-grid" role="group" aria-label="Tipo de ativo">
              {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className={`asset-modal__type-btn ${currentType === type ? 'asset-modal__type-btn--selected' : ''}`}
                  aria-pressed={currentType === type}
                  onClick={() => setField('assetType', type)}
                  disabled={isEdit}
                >
                  {label}
                </button>
              ))}
            </div>
            <FieldError message={errors.assetType} />
          </section>

          {/* Section 2: Identificacao */}
          <section className="asset-modal__section">
            <SectionHeading>Identificacao</SectionHeading>

            <div className="asset-modal__field">
              <Label htmlFor="asset-name" required>
                Nome
              </Label>
              <input
                ref={firstInputRef}
                type="text"
                id="asset-name"
                className={`asset-modal__input ${errors.name ? 'asset-modal__input--error' : ''}`}
                value={formData.name ?? ''}
                onChange={(e) => setField('name', e.target.value)}
                aria-required="true"
                aria-describedby={errors.name ? 'asset-name-error' : undefined}
              />
              <FieldError message={errors.name} />
            </div>

            {/* Tag — read-only, shown only in edit mode */}
            {isEdit && asset?.assetTag && (
              <div className="asset-modal__field">
                <Label htmlFor="asset-tag">Tag</Label>
                <input
                  type="text"
                  id="asset-tag"
                  className="asset-modal__input asset-modal__input--mono asset-modal__input--readonly"
                  value={asset.assetTag}
                  readOnly
                  aria-readonly="true"
                />
                <span className="asset-modal__hint">
                  Codigo gerado automaticamente pelo sistema.
                </span>
              </div>
            )}

            <div className="asset-modal__field">
              <Label htmlFor="asset-farm" required>
                Fazenda
              </Label>
              <select
                id="asset-farm"
                className={`asset-modal__select ${errors.farmId ? 'asset-modal__select--error' : ''}`}
                value={formData.farmId ?? ''}
                onChange={(e) => setField('farmId', e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione a fazenda</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.farmId} />
            </div>

            {isEdit && (
              <div className="asset-modal__field">
                <Label htmlFor="asset-status">Status</Label>
                <select
                  id="asset-status"
                  className="asset-modal__select"
                  value={formData.status ?? 'ATIVO'}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  {(Object.entries(ASSET_STATUS_LABELS) as [AssetStatus, string][]).map(
                    ([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}

            <div className="asset-modal__field">
              <Label htmlFor="asset-classification" required>
                Classificacao CPC
              </Label>
              <select
                id="asset-classification"
                className={`asset-modal__select ${errors.classification ? 'asset-modal__select--error' : ''}`}
                value={formData.classification ?? ''}
                onChange={(e) => setField('classification', e.target.value as AssetClassification)}
                disabled={currentType === 'TERRA'}
                aria-required="true"
              >
                <option value="">Selecione a classificacao</option>
                {(
                  Object.entries(ASSET_CLASSIFICATION_LABELS) as [AssetClassification, string][]
                ).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.classification} />
            </div>

            <div className="asset-modal__field">
              <Label htmlFor="asset-description">Descricao</Label>
              <textarea
                id="asset-description"
                className="asset-modal__textarea"
                value={formData.description ?? ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
              />
            </div>
          </section>

          {/* Section 3: Aquisicao (collapsible) */}
          <section className="asset-modal__section">
            <button
              type="button"
              className="asset-modal__collapse-header"
              onClick={() => setCollapsedAcquisition((v) => !v)}
              aria-expanded={!collapsedAcquisition}
            >
              <SectionHeading>Aquisicao</SectionHeading>
              <span className="asset-modal__collapse-chevron">
                {collapsedAcquisition ? '▸' : '▾'}
              </span>
            </button>

            {!collapsedAcquisition && (
              <div className="asset-modal__collapse-body">
                <div className="asset-modal__field">
                  <Label htmlFor="asset-acquisition-date">Data aquisicao</Label>
                  <input
                    type="date"
                    id="asset-acquisition-date"
                    className="asset-modal__input"
                    value={formData.acquisitionDate ?? ''}
                    onChange={(e) => setField('acquisitionDate', e.target.value)}
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-acquisition-value">Valor aquisicao (R$)</Label>
                  <input
                    type="number"
                    id="asset-acquisition-value"
                    className="asset-modal__input"
                    value={formData.acquisitionValue ?? ''}
                    onChange={(e) => setField('acquisitionValue', e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-invoice">Numero NF</Label>
                  <input
                    type="text"
                    id="asset-invoice"
                    className="asset-modal__input"
                    value={formData.invoiceNumber ?? ''}
                    onChange={(e) => setField('invoiceNumber', e.target.value)}
                  />
                </div>

                <div className="asset-modal__field">
                  <Label htmlFor="asset-notes">Observacoes</Label>
                  <textarea
                    id="asset-notes"
                    className="asset-modal__textarea"
                    value={formData.notes ?? ''}
                    onChange={(e) => setField('notes', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 3b: Dados Financeiros (collapsible, shown when acquisitionValue > 0 and not editing) */}
          {acquisitionValue > 0 && !isEdit && (
            <section className="asset-modal__section asset-modal__financial-section">
              <button
                type="button"
                className="asset-modal__financial-header"
                onClick={() => setFinancialExpanded((v) => !v)}
                aria-expanded={financialExpanded}
                aria-label={financialExpanded ? 'Recolher Dados Financeiros' : 'Expandir Dados Financeiros'}
              >
                <span className="asset-modal__section-heading" style={{ margin: 0 }}>
                  Dados Financeiros
                </span>
                {financialExpanded ? (
                  <ChevronUp size={16} aria-hidden="true" />
                ) : (
                  <ChevronDown size={16} aria-hidden="true" />
                )}
              </button>

              <div className="asset-modal__financial-body" style={{ display: financialExpanded ? 'block' : 'none' }}>

                {/* Payment type radio cards */}
                <fieldset className="asset-modal__fieldset">
                  <legend className="asset-modal__legend">Tipo de pagamento</legend>
                  <div className="asset-modal__payment-cards">

                    {/* A Vista card */}
                    <label
                      className={`asset-modal__payment-card ${paymentType === 'AVISTA' ? 'asset-modal__payment-card--selected-avista' : ''}`}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="AVISTA"
                        checked={paymentType === 'AVISTA'}
                        onChange={() => {
                          setPaymentType('AVISTA');
                          setInstallmentPreviews([]);
                        }}
                        aria-required="true"
                        className="asset-modal__payment-radio"
                      />
                      <span className="asset-modal__payment-card-label">A Vista</span>
                      <span className="asset-modal__payment-card-desc">Pagamento em parcela unica</span>
                    </label>

                    {/* Financiado card */}
                    <label
                      className={`asset-modal__payment-card ${paymentType === 'FINANCIADO' ? 'asset-modal__payment-card--selected-financiado' : ''}`}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value="FINANCIADO"
                        checked={paymentType === 'FINANCIADO'}
                        onChange={() => {
                          setPaymentType('FINANCIADO');
                          setDueDate('');
                        }}
                        aria-required="true"
                        className="asset-modal__payment-radio"
                      />
                      <span className="asset-modal__payment-card-label">Financiado</span>
                      <span className="asset-modal__payment-card-desc">Pagamento parcelado com financiamento</span>
                    </label>

                  </div>
                </fieldset>

                {/* A Vista: single due date */}
                <div style={{ display: paymentType === 'AVISTA' ? 'block' : 'none' }}>
                  <div className="asset-modal__field">
                    <label htmlFor="acq-due-date" className="asset-modal__label">
                      Data de vencimento <span className="asset-modal__required" aria-hidden="true">*</span>
                    </label>
                    <input
                      type="date"
                      id="acq-due-date"
                      className="asset-modal__input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      aria-label="Data de vencimento"
                      required={paymentType === 'AVISTA'}
                    />
                  </div>
                </div>

                {/* Financiado: installment fields */}
                <div style={{ display: paymentType === 'FINANCIADO' ? 'block' : 'none' }}>
                  <div className="asset-modal__financing-fields">
                    <div className="asset-modal__field">
                      <label htmlFor="acq-installment-count" className="asset-modal__label">
                        Numero de parcelas <span className="asset-modal__required" aria-hidden="true">*</span>
                      </label>
                      <input
                        type="number"
                        id="acq-installment-count"
                        className={`asset-modal__input ${installmentError ? 'asset-modal__input--error' : ''}`}
                        value={installmentCount}
                        min={2}
                        max={360}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : '';
                          setInstallmentCount(val);
                          setInstallmentError(null);
                        }}
                        onBlur={() => {
                          if (typeof installmentCount === 'number' && installmentCount < 2) {
                            setInstallmentError('Minimo 2 parcelas para financiamento');
                          } else {
                            setInstallmentError(null);
                            recalculateInstallments();
                          }
                        }}
                        required={paymentType === 'FINANCIADO'}
                      />
                      {installmentError && (
                        <span className="asset-modal__field-error" role="alert">
                          <AlertCircle size={14} aria-hidden="true" />
                          {installmentError}
                        </span>
                      )}
                    </div>

                    <div className="asset-modal__field">
                      <label htmlFor="acq-first-due-date" className="asset-modal__label">
                        Vencimento da 1a parcela <span className="asset-modal__required" aria-hidden="true">*</span>
                      </label>
                      <input
                        type="date"
                        id="acq-first-due-date"
                        className="asset-modal__input"
                        value={firstDueDate}
                        onChange={(e) => setFirstDueDate(e.target.value)}
                        onBlur={() => recalculateInstallments()}
                        required={paymentType === 'FINANCIADO'}
                      />
                    </div>

                    <div className="asset-modal__field asset-modal__field--full">
                      <label htmlFor="acq-interest-rate" className="asset-modal__label">
                        Taxa de juros a.m. (%)
                      </label>
                      <input
                        type="text"
                        id="acq-interest-rate"
                        className="asset-modal__input"
                        value={interestRate}
                        placeholder="0,00 — deixe em branco para parcelas iguais"
                        onChange={(e) => setInterestRate(e.target.value)}
                        onBlur={() => {
                          if (interestRate) {
                            const num = parseFloat(interestRate.replace(',', '.'));
                            if (!isNaN(num)) {
                              setInterestRate(num.toFixed(2).replace('.', ',') + '%');
                            }
                          }
                          recalculateInstallments();
                        }}
                      />
                    </div>
                  </div>

                  <InstallmentPreviewTable
                    installments={installmentPreviews}
                    totalAmount={acquisitionValue}
                    isLoading={previewLoading}
                  />
                </div>

                {/* Classification chip */}
                {formData.classification && (
                  <div className="asset-modal__field" style={{ marginTop: 'var(--space-3)' }}>
                    <span className="asset-modal__label">Classificacao</span>
                    <span className="asset-modal__classification-chip">
                      {ASSET_CLASSIFICATION_LABELS[formData.classification as AssetClassification]}
                    </span>
                  </div>
                )}

                {/* CP auto-generation info banner */}
                {showInfoBanner && (
                  <div className="asset-modal__info-banner" role="status">
                    <Info size={16} aria-hidden="true" />
                    <span style={{ flex: 1 }}>
                      Uma conta a pagar sera criada automaticamente ao salvar este ativo.
                    </span>
                    <button
                      type="button"
                      className="asset-modal__info-banner-close"
                      onClick={() => setInfoBannerDismissed(true)}
                      aria-label="Fechar aviso"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}

              </div>
            </section>
          )}

          {/* Section 4: Dados Especificos (conditional) */}
          {currentType && (
            <section className="asset-modal__section">
              <SectionHeading>Dados Especificos</SectionHeading>

              {/* MAQUINA */}
              {currentType === 'MAQUINA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-engine-hp">Potencia HP</Label>
                    <input
                      type="number"
                      id="asset-engine-hp"
                      className="asset-modal__input"
                      value={formData.engineHp ?? ''}
                      onChange={(e) => setField('engineHp', e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-fuel-type">Tipo combustivel</Label>
                    <select
                      id="asset-fuel-type"
                      className="asset-modal__select"
                      value={formData.fuelType ?? ''}
                      onChange={(e) => setField('fuelType', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FUEL_TYPES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year">Ano</Label>
                    <input
                      type="number"
                      id="asset-year"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-serial">Numero serie</Label>
                    <input
                      type="text"
                      id="asset-serial"
                      className="asset-modal__input"
                      value={formData.serialNumber ?? ''}
                      onChange={(e) => setField('serialNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-hourmeter">Horimetro atual</Label>
                    <input
                      type="number"
                      id="asset-hourmeter"
                      className="asset-modal__input"
                      value={formData.currentHourmeter ?? ''}
                      onChange={(e) => setField('currentHourmeter', e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              )}

              {/* VEICULO */}
              {currentType === 'VEICULO' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-renavam">RENAVAM</Label>
                    <input
                      type="text"
                      id="asset-renavam"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.renavamCode ?? ''}
                      onChange={(e) => setField('renavamCode', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-plate">Placa</Label>
                    <input
                      type="text"
                      id="asset-plate"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.licensePlate ?? ''}
                      onChange={(e) => setField('licensePlate', e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer-v">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer-v"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model-v">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model-v"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year-v">Ano</Label>
                    <input
                      type="number"
                      id="asset-year-v"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-odometer">Odometro atual (km)</Label>
                    <input
                      type="number"
                      id="asset-odometer"
                      className="asset-modal__input"
                      value={formData.currentOdometer ?? ''}
                      onChange={(e) => setField('currentOdometer', e.target.value)}
                      min="0"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-fuel-type-v">Tipo combustivel</Label>
                    <select
                      id="asset-fuel-type-v"
                      className="asset-modal__select"
                      value={formData.fuelType ?? ''}
                      onChange={(e) => setField('fuelType', e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FUEL_TYPES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* IMPLEMENTO */}
              {currentType === 'IMPLEMENTO' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-manufacturer-i">Fabricante</Label>
                    <input
                      type="text"
                      id="asset-manufacturer-i"
                      className="asset-modal__input"
                      value={formData.manufacturer ?? ''}
                      onChange={(e) => setField('manufacturer', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-model-i">Modelo</Label>
                    <input
                      type="text"
                      id="asset-model-i"
                      className="asset-modal__input"
                      value={formData.model ?? ''}
                      onChange={(e) => setField('model', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-year-i">Ano</Label>
                    <input
                      type="number"
                      id="asset-year-i"
                      className="asset-modal__input"
                      value={formData.yearOfManufacture ?? ''}
                      onChange={(e) =>
                        setField(
                          'yearOfManufacture',
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-serial-i">Numero serie</Label>
                    <input
                      type="text"
                      id="asset-serial-i"
                      className="asset-modal__input"
                      value={formData.serialNumber ?? ''}
                      onChange={(e) => setField('serialNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field asset-modal__field--full">
                    <Label htmlFor="asset-parent">Vinculo maquina pai (opcional)</Label>
                    <select
                      id="asset-parent"
                      className="asset-modal__select"
                      value={formData.parentAssetId ?? ''}
                      onChange={(e) => setField('parentAssetId', e.target.value || undefined)}
                    >
                      <option value="">Nenhuma</option>
                      {machineAssets
                        .filter((a) => a.assetType === 'MAQUINA')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.assetTag} — {m.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* BENFEITORIA */}
              {currentType === 'BENFEITORIA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-material">Material construcao</Label>
                    <input
                      type="text"
                      id="asset-material"
                      className="asset-modal__input"
                      value={formData.constructionMaterial ?? ''}
                      onChange={(e) => setField('constructionMaterial', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-area-m2">Area (m2)</Label>
                    <input
                      type="number"
                      id="asset-area-m2"
                      className="asset-modal__input"
                      value={formData.areaM2 ?? ''}
                      onChange={(e) => setField('areaM2', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-capacity">Capacidade</Label>
                    <input
                      type="text"
                      id="asset-capacity"
                      className="asset-modal__input"
                      value={formData.capacity ?? ''}
                      onChange={(e) => setField('capacity', e.target.value)}
                      placeholder="Ex: 1.000 sacas"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-geo-lat">Latitude</Label>
                    <input
                      type="number"
                      id="asset-geo-lat"
                      className="asset-modal__input"
                      value={formData.geoLat ?? ''}
                      onChange={(e) =>
                        setField('geoLat', e.target.value ? Number(e.target.value) : undefined)
                      }
                      step="0.000001"
                      placeholder="-15.123456"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-geo-lon">Longitude</Label>
                    <input
                      type="number"
                      id="asset-geo-lon"
                      className="asset-modal__input"
                      value={formData.geoLon ?? ''}
                      onChange={(e) =>
                        setField('geoLon', e.target.value ? Number(e.target.value) : undefined)
                      }
                      step="0.000001"
                      placeholder="-48.123456"
                    />
                  </div>
                </div>
              )}

              {/* TERRA */}
              {currentType === 'TERRA' && (
                <div className="asset-modal__field-grid">
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-registration">Matricula</Label>
                    <input
                      type="text"
                      id="asset-registration"
                      className="asset-modal__input asset-modal__input--mono"
                      value={formData.registrationNumber ?? ''}
                      onChange={(e) => setField('registrationNumber', e.target.value)}
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-area-ha">Area (ha)</Label>
                    <input
                      type="number"
                      id="asset-area-ha"
                      className="asset-modal__input"
                      value={formData.areaHa ?? ''}
                      onChange={(e) => setField('areaHa', e.target.value)}
                      min="0"
                      step="0.0001"
                    />
                  </div>
                  <div className="asset-modal__field">
                    <Label htmlFor="asset-car">Codigo CAR</Label>
                    <input
                      type="text"
                      id="asset-car"
                      className="asset-modal__input"
                      value={formData.carCode ?? ''}
                      onChange={(e) => setField('carCode', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section 5: Fotos (collapsible) */}
          <section className="asset-modal__section">
            <button
              type="button"
              className="asset-modal__collapse-header"
              onClick={() => setCollapsedPhotos((v) => !v)}
              aria-expanded={!collapsedPhotos}
            >
              <SectionHeading>Fotos</SectionHeading>
              <span className="asset-modal__collapse-chevron">{collapsedPhotos ? '▸' : '▾'}</span>
            </button>

            {!collapsedPhotos && (
              <div className="asset-modal__collapse-body">
                <div className="asset-modal__dropzone">
                  <p className="asset-modal__dropzone-hint">
                    Arraste fotos ou clique para selecionar. Maximo 5 imagens.
                  </p>
                  {isEdit ? (
                    <input
                      type="file"
                      className="asset-modal__file-input"
                      accept="image/*"
                      multiple
                      aria-label="Selecionar fotos"
                    />
                  ) : (
                    <p className="asset-modal__dropzone-hint asset-modal__dropzone-hint--info">
                      Salve o ativo primeiro para adicionar fotos.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </form>

        {/* Footer */}
        <div className="asset-modal__footer">
          <button
            type="button"
            className="asset-modal__btn asset-modal__btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="asset-modal-form"
            className="asset-modal__btn asset-modal__btn--primary"
            disabled={isSubmitting || isAcquisitionLoading}
          >
            {isSubmitting || isAcquisitionLoading
              ? 'Salvando...'
              : isEdit
                ? 'Salvar alteracoes'
                : hasFinancialData
                  ? 'Registrar Ativo'
                  : 'Cadastrar ativo'}
          </button>
        </div>
      </div>
    </div>

    {showNfeModal && (
      <AssetNfeImportModal
        isOpen={showNfeModal}
        onClose={() => setShowNfeModal(false)}
        onSuccess={() => {
          setShowNfeModal(false);
          onSuccess();
        }}
        farmId={formData.farmId ?? undefined}
        costCenterId={formData.costCenterId ?? undefined}
      />
    )}
    </>
  );
}
