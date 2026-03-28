import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  FileCheck,
  Check,
  CheckCircle2,
  AlertTriangle,
  Package,
  Info,
} from 'lucide-react';
import { useAssetAcquisition } from '@/hooks/useAssetAcquisition';
import { useAssets } from '@/hooks/useAssets';
import { useFarms } from '@/hooks/useFarms';
import type {
  NfeParsedData,
  NfeItemAssignment,
  CreateFromNfeInput,
  NfeAcquisitionOutput,
  AssetType,
  AssetClassification,
  PaymentType,
} from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_CLASSIFICATION_LABELS } from '@/types/asset';
import './AssetNfeImportModal.css';

// ─── Types ─────────────────────────────────────────────────────────────

interface ItemAssignment {
  nfeItemIndex: number;
  mode: 'none' | 'new' | 'existing';
  assetName: string;
  assetType: AssetType | '';
  existingAssetId: string;
}

// ─── Props ─────────────────────────────────────────────────────────────

interface AssetNfeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  farmId?: string;
  costCenterId?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatBRL(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  try {
    return new Date(isoDate).toLocaleDateString('pt-BR');
  } catch {
    return isoDate;
  }
}

// ─── Step indicator ────────────────────────────────────────────────────

interface StepperProps {
  currentStep: 1 | 2 | 3;
}

function Stepper({ currentStep }: StepperProps) {
  const steps = [
    { num: 1, label: 'Enviar XML' },
    { num: 2, label: 'Revisar itens' },
    { num: 3, label: 'Confirmar' },
  ] as const;

  return (
    <div className="nfe-modal__stepper" role="list" aria-label="Etapas do assistente">
      {steps.map((step) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const dotClass = isCompleted
          ? 'nfe-modal__step-dot--completed'
          : isActive
            ? 'nfe-modal__step-dot--active'
            : 'nfe-modal__step-dot--inactive';

        return (
          <div
            key={step.num}
            className="nfe-modal__step"
            role="listitem"
            aria-current={isActive ? 'step' : undefined}
          >
            <div className={`nfe-modal__step-dot ${dotClass}`} aria-hidden="true">
              {isCompleted ? <Check size={14} /> : step.num}
            </div>
            <span className="nfe-modal__step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export default function AssetNfeImportModal({
  isOpen,
  onClose,
  onSuccess,
  farmId,
  costCenterId,
}: AssetNfeImportModalProps) {
  const { parseNfe, createFromNfe, isLoading } = useAssetAcquisition();
  const { assets: existingAssets, fetchAssets } = useAssets();
  const { farms } = useFarms();

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1: file upload
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<NfeParsedData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // ── Step 2: item assignments
  const [itemAssignments, setItemAssignments] = useState<ItemAssignment[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(farmId ?? '');
  const [showExpenses, setShowExpenses] = useState(false);

  // ── Step 3: payment + confirm
  const [classification, setClassification] = useState<AssetClassification | ''>('');
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [installmentCount, setInstallmentCount] = useState<number | ''>('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<NfeAcquisitionOutput | null>(null);

  // Load existing assets for assignment dropdown
  useEffect(() => {
    if (isOpen) {
      void fetchAssets({ limit: 200 });
    }
  }, [isOpen, fetchAssets]);

  // Reset state on open/close
  const prevIsOpen = useRef(isOpen);
  useEffect(() => {
    if (prevIsOpen.current !== isOpen) {
      prevIsOpen.current = isOpen;
      if (!isOpen) {
        setStep(1);
        setFile(null);
        setFileError(null);
        setParsedData(null);
        setParseError(null);
        setIsParsing(false);
        setItemAssignments([]);
        setSelectedFarmId(farmId ?? '');
        setShowExpenses(false);
        setClassification('');
        setPaymentType('');
        setDueDate('');
        setInstallmentCount('');
        setFirstDueDate('');
        setInterestRate('');
        setSubmitError(null);
        setSuccessData(null);
      }
    }
  }, [isOpen, farmId]);

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // ── File validation and parsing
  const validateAndParseFile = useCallback(
    async (selectedFile: File) => {
      setFileError(null);
      setParseError(null);
      setParsedData(null);

      // Type check
      const isXml =
        selectedFile.type === 'text/xml' ||
        selectedFile.type === 'application/xml' ||
        selectedFile.name.toLowerCase().endsWith('.xml');
      if (!isXml) {
        setFileError('Apenas arquivos XML sao aceitos.');
        return;
      }

      // Size check (2MB)
      if (selectedFile.size > 2 * 1024 * 1024) {
        setFileError('O arquivo e muito grande. Tamanho maximo permitido: 2 MB.');
        return;
      }

      setFile(selectedFile);
      setIsParsing(true);

      try {
        const data = await parseNfe(selectedFile);
        setParsedData(data);

        // Initialize item assignments
        if (data.items && data.items.length > 0) {
          setItemAssignments(
            data.items.map((_, idx) => ({
              nfeItemIndex: idx,
              mode: 'none',
              assetName: data.items[idx].description.slice(0, 80),
              assetType: '',
              existingAssetId: '',
            })),
          );
        }
      } catch {
        setParseError(
          'Nao foi possivel ler o XML. Verifique se o arquivo e uma NF-e valida e tente novamente.',
        );
        setFile(null);
      } finally {
        setIsParsing(false);
      }
    },
    [parseNfe],
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) void validateAndParseFile(selected);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) void validateAndParseFile(dropped);
  }

  function handleRemoveFile() {
    setFile(null);
    setParsedData(null);
    setParseError(null);
    setFileError(null);
    setItemAssignments([]);
  }

  // ── Item assignment handlers
  function updateItemMode(idx: number, mode: 'none' | 'new' | 'existing') {
    setItemAssignments((prev) =>
      prev.map((a, i) =>
        i === idx
          ? { ...a, mode, existingAssetId: mode === 'existing' ? a.existingAssetId : '' }
          : a,
      ),
    );
  }

  function updateItemAssetName(idx: number, name: string) {
    setItemAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, assetName: name } : a)));
  }

  function updateItemAssetType(idx: number, assetType: AssetType | '') {
    setItemAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, assetType } : a)));
  }

  function updateItemExistingAsset(idx: number, existingAssetId: string) {
    setItemAssignments((prev) => prev.map((a, i) => (i === idx ? { ...a, existingAssetId } : a)));
  }

  // ── Validation
  const allItemsMapped = itemAssignments.every((a) =>
    a.mode === 'existing'
      ? a.existingAssetId !== ''
      : a.mode === 'new'
        ? a.assetName.trim() !== '' && a.assetType !== ''
        : false,
  );

  const canProceedStep1 = Boolean(parsedData) && !isParsing;
  const canProceedStep2 = allItemsMapped && selectedFarmId !== '' && itemAssignments.length > 0;
  const canSubmit =
    classification !== '' &&
    paymentType !== '' &&
    (paymentType === 'AVISTA'
      ? dueDate !== ''
      : installmentCount !== '' && Number(installmentCount) >= 2 && firstDueDate !== '');

  // ── Submit
  async function handleSubmit() {
    if (!parsedData || !canSubmit) return;
    setSubmitError(null);

    const items: NfeItemAssignment[] = itemAssignments.map((a) => ({
      nfeItemIndex: a.nfeItemIndex,
      assetName: a.mode === 'new' ? a.assetName : '',
      assetType: a.mode === 'new' ? (a.assetType as string) : '',
      existingAssetId: a.mode === 'existing' ? a.existingAssetId : undefined,
    }));

    const input: CreateFromNfeInput = {
      farmId: selectedFarmId,
      costCenterId: costCenterId,
      classification: classification as string,
      paymentType: paymentType as PaymentType,
      dueDate: paymentType === 'AVISTA' ? dueDate : undefined,
      installmentCount: paymentType === 'FINANCIADO' ? Number(installmentCount) : undefined,
      firstDueDate: paymentType === 'FINANCIADO' ? firstDueDate : undefined,
      interestRate: interestRate ? parseFloat(interestRate.replace(',', '.')) : undefined,
      items,
    };

    try {
      const result = await createFromNfe(parsedData, input);
      setSuccessData(result);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel registrar o ativo. A conta a pagar nao foi criada. Verifique sua conexao e tente novamente.',
      );
    }
  }

  // ── Accessory expenses check
  const hasExpenses =
    parsedData &&
    (parseFloat(parsedData.freight ?? '0') > 0 ||
      parseFloat(parsedData.insurance ?? '0') > 0 ||
      parseFloat(parsedData.otherCosts ?? '0') > 0);

  if (!isOpen) return null;

  return (
    <div
      className="nfe-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfe-modal-title"
    >
      <div className="nfe-modal" ref={dialogRef} tabIndex={-1}>
        {/* Header */}
        <header className="nfe-modal__header">
          <h2 id="nfe-modal-title" className="nfe-modal__title">
            Importar NF-e
          </h2>
          <button
            type="button"
            className="nfe-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Stepper */}
        {!successData && <Stepper currentStep={step} />}

        {/* Body */}
        <div className="nfe-modal__body">
          {/* ── Success state ── */}
          {successData && (
            <div className="nfe-modal__success">
              <CheckCircle2 size={64} aria-hidden="true" className="nfe-modal__success-icon" />
              <h3 className="nfe-modal__success-title">
                {successData.assets.length}{' '}
                {successData.assets.length === 1 ? 'ativo criado' : 'ativos criados'} com sucesso.
              </h3>
              <p className="nfe-modal__success-body">Conta a pagar registrada automaticamente.</p>
              <button
                type="button"
                className="nfe-modal__btn nfe-modal__btn--primary"
                onClick={onSuccess}
              >
                Ver ativos
              </button>
            </div>
          )}

          {/* ── Step 1: Upload XML ── */}
          <div style={{ display: step === 1 && !successData ? 'block' : 'none' }}>
            {fileError && (
              <div className="nfe-modal__error-banner" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{fileError}</span>
              </div>
            )}
            {parseError && (
              <div className="nfe-modal__error-banner" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{parseError}</span>
              </div>
            )}

            {!file && !isParsing && (
              <div
                className={`nfe-modal__upload-zone${isDragOver ? ' nfe-modal__upload-zone--dragover' : ''}${fileError || parseError ? ' nfe-modal__upload-zone--error' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Zona de upload de arquivo XML"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload size={48} aria-hidden="true" className="nfe-modal__upload-icon" />
                <p className="nfe-modal__upload-text">Arraste o arquivo XML aqui</p>
                <p className="nfe-modal__upload-hint">ou</p>
                <button
                  type="button"
                  className="nfe-modal__link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Selecionar arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  className="sr-only"
                  onChange={handleFileInput}
                  aria-label="Selecionar arquivo XML da NF-e"
                />
              </div>
            )}

            {isParsing && (
              <div className="nfe-modal__upload-zone">
                <div className="nfe-modal__skeleton" role="status" aria-label="Processando arquivo">
                  <div className="nfe-modal__skeleton-bar" />
                  <div className="nfe-modal__skeleton-bar nfe-modal__skeleton-bar--short" />
                </div>
                <p className="nfe-modal__upload-hint">Processando arquivo...</p>
              </div>
            )}

            {file && parsedData && !isParsing && (
              <div className="nfe-modal__file-chip">
                <FileCheck size={20} aria-hidden="true" className="nfe-modal__file-chip-icon" />
                <span className="nfe-modal__file-chip-name">{file.name}</span>
                <button
                  type="button"
                  className="nfe-modal__file-chip-remove"
                  onClick={handleRemoveFile}
                  aria-label="Remover arquivo"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* ── Step 2: Review items ── */}
          <div style={{ display: step === 2 && !successData ? 'block' : 'none' }}>
            {parsedData && (
              <>
                {/* NF-e summary card */}
                <div className="nfe-modal__summary-card" aria-label="Resumo da NF-e">
                  <div className="nfe-modal__summary-row">
                    <span className="nfe-modal__summary-label">Fornecedor:</span>
                    <span className="nfe-modal__summary-value">
                      {parsedData.supplierName ?? '—'}
                    </span>
                  </div>
                  <div className="nfe-modal__summary-row">
                    <span className="nfe-modal__summary-label">
                      NF no{' '}
                      <span className="nfe-modal__mono">{parsedData.invoiceNumber ?? '—'}</span>
                    </span>
                    <span className="nfe-modal__summary-value">
                      Emissao: {formatDate(parsedData.issueDate)}
                    </span>
                  </div>
                  <div className="nfe-modal__summary-row nfe-modal__summary-row--total">
                    <span className="nfe-modal__summary-label">Total NF:</span>
                    <span className="nfe-modal__summary-total">
                      {formatBRL(parsedData.totalNf)}
                    </span>
                  </div>
                </div>

                {/* Item assignment list */}
                {parsedData.items.length === 0 ? (
                  <div className="nfe-modal__empty">
                    <Package size={48} aria-hidden="true" className="nfe-modal__empty-icon" />
                    <h3 className="nfe-modal__empty-title">Nenhum item encontrado no XML</h3>
                    <p className="nfe-modal__empty-desc">
                      O arquivo XML nao contem itens de produto. Verifique se e uma NF-e de
                      aquisicao de ativo.
                    </p>
                  </div>
                ) : (
                  <div className="nfe-modal__items-list">
                    {parsedData.items.map((item, idx) => {
                      const assignment = itemAssignments[idx];
                      if (!assignment) return null;
                      const isMapped =
                        (assignment.mode === 'existing' && assignment.existingAssetId !== '') ||
                        (assignment.mode === 'new' &&
                          assignment.assetName.trim() !== '' &&
                          assignment.assetType !== '');

                      return (
                        <article
                          key={idx}
                          className={`nfe-modal__item-card${isMapped ? ' nfe-modal__item-card--mapped' : ' nfe-modal__item-card--unmapped'}`}
                          aria-label={`Item ${idx + 1}: ${item.description}`}
                        >
                          <div className="nfe-modal__item-header">
                            <div className="nfe-modal__item-info">
                              <span className="nfe-modal__item-description">
                                {item.description}
                              </span>
                              {item.ncm && (
                                <span className="nfe-modal__item-ncm">NCM: {item.ncm}</span>
                              )}
                              <span className="nfe-modal__item-qty">
                                {item.quantity} {item.unit ?? 'un'}
                              </span>
                            </div>
                            <div className="nfe-modal__item-value">{formatBRL(item.value)}</div>
                            <div className="nfe-modal__item-status" aria-hidden="true">
                              {isMapped ? (
                                <CheckCircle2
                                  size={16}
                                  className="nfe-modal__item-status-icon--mapped"
                                />
                              ) : (
                                <AlertTriangle
                                  size={16}
                                  className="nfe-modal__item-status-icon--unmapped"
                                />
                              )}
                            </div>
                          </div>

                          <div className="nfe-modal__item-assignment">
                            <div className="nfe-modal__field">
                              <label htmlFor={`item-mode-${idx}`} className="nfe-modal__label">
                                Vincular a *
                              </label>
                              <select
                                id={`item-mode-${idx}`}
                                className="nfe-modal__select"
                                value={assignment.mode}
                                onChange={(e) =>
                                  updateItemMode(idx, e.target.value as 'none' | 'new' | 'existing')
                                }
                                aria-required="true"
                              >
                                <option value="none">Selecionar...</option>
                                <option value="new">Criar novo ativo</option>
                                <option value="existing">Ativo existente</option>
                              </select>
                            </div>

                            {assignment.mode === 'new' && (
                              <div className="nfe-modal__item-new-fields">
                                <div className="nfe-modal__field">
                                  <label htmlFor={`item-name-${idx}`} className="nfe-modal__label">
                                    Nome do ativo *
                                  </label>
                                  <input
                                    type="text"
                                    id={`item-name-${idx}`}
                                    className="nfe-modal__input"
                                    value={assignment.assetName}
                                    onChange={(e) => updateItemAssetName(idx, e.target.value)}
                                    aria-required="true"
                                    maxLength={80}
                                  />
                                </div>
                                <div className="nfe-modal__field">
                                  <label htmlFor={`item-type-${idx}`} className="nfe-modal__label">
                                    Tipo de ativo *
                                  </label>
                                  <select
                                    id={`item-type-${idx}`}
                                    className="nfe-modal__select"
                                    value={assignment.assetType}
                                    onChange={(e) =>
                                      updateItemAssetType(idx, e.target.value as AssetType | '')
                                    }
                                    aria-required="true"
                                  >
                                    <option value="">Selecione o tipo</option>
                                    {(
                                      Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]
                                    ).map(([val, label]) => (
                                      <option key={val} value={val}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {assignment.mode === 'existing' && (
                              <div className="nfe-modal__field">
                                <label
                                  htmlFor={`item-existing-${idx}`}
                                  className="nfe-modal__label"
                                >
                                  Ativo existente *
                                </label>
                                <select
                                  id={`item-existing-${idx}`}
                                  className="nfe-modal__select"
                                  value={assignment.existingAssetId}
                                  onChange={(e) => updateItemExistingAsset(idx, e.target.value)}
                                  aria-required="true"
                                >
                                  <option value="">Selecionar ativo...</option>
                                  {existingAssets.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.assetTag} — {a.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* Accessory expenses */}
                {hasExpenses && (
                  <div className="nfe-modal__expenses-section">
                    <button
                      type="button"
                      className="nfe-modal__expenses-toggle"
                      onClick={() => setShowExpenses((v) => !v)}
                      aria-expanded={showExpenses}
                    >
                      Despesas acessorias (rateio proporcional)
                      <span aria-hidden="true">{showExpenses ? ' ▾' : ' ▸'}</span>
                    </button>
                    {showExpenses && (
                      <div className="nfe-modal__expenses-body">
                        {parseFloat(parsedData.freight ?? '0') > 0 && (
                          <div className="nfe-modal__expense-row">
                            <span>Frete:</span>
                            <span className="nfe-modal__mono">{formatBRL(parsedData.freight)}</span>
                          </div>
                        )}
                        {parseFloat(parsedData.insurance ?? '0') > 0 && (
                          <div className="nfe-modal__expense-row">
                            <span>Seguro:</span>
                            <span className="nfe-modal__mono">
                              {formatBRL(parsedData.insurance)}
                            </span>
                          </div>
                        )}
                        {parseFloat(parsedData.otherCosts ?? '0') > 0 && (
                          <div className="nfe-modal__expense-row">
                            <span>Outros:</span>
                            <span className="nfe-modal__mono">
                              {formatBRL(parsedData.otherCosts)}
                            </span>
                          </div>
                        )}
                        <p className="nfe-modal__expenses-note">
                          Rateio proporcional ao valor de cada item
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Farm selector (if not pre-set) */}
                {!farmId && (
                  <div className="nfe-modal__field nfe-modal__field--farm">
                    <label htmlFor="nfe-farm" className="nfe-modal__label">
                      Fazenda *
                    </label>
                    <select
                      id="nfe-farm"
                      className="nfe-modal__select"
                      value={selectedFarmId}
                      onChange={(e) => setSelectedFarmId(e.target.value)}
                      aria-required="true"
                    >
                      <option value="">Selecione a fazenda</option>
                      {farms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Step 3: Confirm ── */}
          <div style={{ display: step === 3 && !successData ? 'block' : 'none' }}>
            {parsedData && (
              <>
                {/* Summary of assets */}
                <div className="nfe-modal__confirm-list">
                  <h3 className="nfe-modal__confirm-title">Ativos a serem criados</h3>
                  {itemAssignments
                    .filter((a) => a.mode === 'new')
                    .map((a, i) => {
                      const item = parsedData.items[a.nfeItemIndex];
                      return (
                        <div key={i} className="nfe-modal__confirm-row">
                          <span>{a.assetName}</span>
                          <span className="nfe-modal__mono">{formatBRL(item?.value)}</span>
                        </div>
                      );
                    })}
                  {itemAssignments.filter((a) => a.mode === 'existing').length > 0 && (
                    <>
                      <h3
                        className="nfe-modal__confirm-title"
                        style={{ marginTop: 'var(--space-4)' }}
                      >
                        Ativos a serem atualizados
                      </h3>
                      {itemAssignments
                        .filter((a) => a.mode === 'existing')
                        .map((a, i) => {
                          const existing = existingAssets.find((e) => e.id === a.existingAssetId);
                          const item = parsedData.items[a.nfeItemIndex];
                          return (
                            <div key={i} className="nfe-modal__confirm-row">
                              <span>{existing?.name ?? a.existingAssetId}</span>
                              <span className="nfe-modal__mono">{formatBRL(item?.value)}</span>
                            </div>
                          );
                        })}
                    </>
                  )}
                </div>

                {/* CP banner */}
                <div className="nfe-modal__info-banner" role="status">
                  <Info size={16} aria-hidden="true" />
                  <span>
                    1 conta a pagar de {formatBRL(parsedData.totalNf)} sera criada para{' '}
                    {parsedData.supplierName ?? 'o fornecedor'}.
                  </span>
                </div>

                {/* Payment type */}
                <div className="nfe-modal__payment-section">
                  <fieldset className="nfe-modal__fieldset">
                    <legend className="nfe-modal__legend">Tipo de pagamento *</legend>
                    <div className="nfe-modal__payment-cards">
                      {(['AVISTA', 'FINANCIADO'] as PaymentType[]).map((pt) => (
                        <label
                          key={pt}
                          className={`nfe-modal__payment-card${paymentType === pt ? ' nfe-modal__payment-card--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="nfe-payment-type"
                            value={pt}
                            checked={paymentType === pt}
                            onChange={() => setPaymentType(pt)}
                            className="sr-only"
                          />
                          <span className="nfe-modal__payment-card-label">
                            {pt === 'AVISTA' ? 'A Vista' : 'Financiado'}
                          </span>
                          <span className="nfe-modal__payment-card-desc">
                            {pt === 'AVISTA'
                              ? 'Pagamento em parcela unica'
                              : 'Pagamento parcelado com financiamento'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {paymentType === 'AVISTA' && (
                    <div className="nfe-modal__field">
                      <label htmlFor="nfe-due-date" className="nfe-modal__label">
                        Data de vencimento *
                      </label>
                      <input
                        type="date"
                        id="nfe-due-date"
                        className="nfe-modal__input"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        aria-required="true"
                      />
                    </div>
                  )}

                  {paymentType === 'FINANCIADO' && (
                    <div className="nfe-modal__financing-fields">
                      <div className="nfe-modal__field">
                        <label htmlFor="nfe-installments" className="nfe-modal__label">
                          Numero de parcelas *
                        </label>
                        <input
                          type="number"
                          id="nfe-installments"
                          className="nfe-modal__input"
                          value={installmentCount}
                          min={2}
                          max={360}
                          onChange={(e) =>
                            setInstallmentCount(e.target.value ? Number(e.target.value) : '')
                          }
                          aria-required="true"
                        />
                        {installmentCount !== '' && Number(installmentCount) < 2 && (
                          <span className="nfe-modal__field-error" role="alert">
                            Minimo 2 parcelas para financiamento
                          </span>
                        )}
                      </div>
                      <div className="nfe-modal__field">
                        <label htmlFor="nfe-first-due" className="nfe-modal__label">
                          Vencimento da 1a parcela *
                        </label>
                        <input
                          type="date"
                          id="nfe-first-due"
                          className="nfe-modal__input"
                          value={firstDueDate}
                          onChange={(e) => setFirstDueDate(e.target.value)}
                          aria-required="true"
                        />
                      </div>
                      <div className="nfe-modal__field">
                        <label htmlFor="nfe-interest" className="nfe-modal__label">
                          Taxa de juros a.m. (%)
                        </label>
                        <input
                          type="text"
                          id="nfe-interest"
                          className="nfe-modal__input"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          placeholder="0,00 — deixe em branco para parcelas iguais"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Classification */}
                <div className="nfe-modal__field">
                  <label htmlFor="nfe-classification" className="nfe-modal__label">
                    Classificacao CPC *
                  </label>
                  <select
                    id="nfe-classification"
                    className="nfe-modal__select"
                    value={classification}
                    onChange={(e) => setClassification(e.target.value as AssetClassification | '')}
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
                </div>

                {/* Submit error */}
                {submitError && (
                  <div className="nfe-modal__error-banner" role="alert">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        {!successData && (
          <footer className="nfe-modal__footer">
            {step === 1 && (
              <>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--secondary"
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--primary"
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1 || isParsing}
                >
                  Continuar
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--secondary"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--primary"
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                >
                  Confirmar e criar ativos
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--secondary"
                  onClick={() => setStep(2)}
                  disabled={isLoading}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="nfe-modal__btn nfe-modal__btn--primary"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || isLoading}
                >
                  {isLoading ? 'Criando ativos...' : 'Criar Ativos'}
                </button>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
