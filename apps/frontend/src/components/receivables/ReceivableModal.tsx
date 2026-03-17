import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, ReceiptText, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/services/api';
import type { Receivable, ReceivableCategory } from '@/hooks/useReceivables';
import './ReceivableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface FarmOption {
  id: string;
  name: string;
}

interface ProducerOption {
  id: string;
  name: string;
}

interface BankAccountOption {
  id: string;
  name: string;
}

interface InstallmentRow {
  installmentNumber: number;
  dueDate: string;
  amount: string;
}

interface CostCenterRow {
  costCenter: string;
  percentage: string;
  fixedAmount: string;
  mode: 'percentage' | 'fixed';
}

interface ReceivableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  receivable?: Receivable;
}

interface FormErrors {
  clientName?: string;
  category?: string;
  description?: string;
  totalAmount?: string;
  dueDate?: string;
  farmId?: string;
  funruralRate?: string;
  nfeKey?: string;
  costCenter?: string;
}

const CATEGORY_LABELS: Record<ReceivableCategory, string> = {
  GRAIN_SALE: 'Venda de Grãos',
  CATTLE_SALE: 'Venda de Gado',
  MILK_SALE: 'Venda de Leite',
  LEASE: 'Arrendamento Recebido',
  SERVICES: 'Serviços',
  OTHER: 'Outros',
};

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Sem recorrência' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'YEARLY', label: 'Anual' },
];

function parseBRL(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function generateInstallments(
  totalAmountRaw: number,
  count: number,
  firstDueDate: string,
): InstallmentRow[] {
  if (count <= 1 || !firstDueDate) return [];
  const base = Math.floor((totalAmountRaw / count) * 100) / 100;
  const residual = Math.round((totalAmountRaw - base * (count - 1)) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    installmentNumber: i + 1,
    dueDate: addMonths(firstDueDate, i),
    amount: (i === 0 ? residual : base).toFixed(2).replace('.', ','),
  }));
}

// ─── Component ───────────────────────────────────────────────────────

const ReceivableModal = ({ isOpen, onClose, onSuccess, receivable }: ReceivableModalProps) => {
  const isEditMode = Boolean(receivable);

  // Core fields
  const [clientName, setClientName] = useState('');
  const [category, setCategory] = useState<ReceivableCategory | ''>('');
  const [description, setDescription] = useState('');
  const [totalAmountDisplay, setTotalAmountDisplay] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [farmId, setFarmId] = useState('');
  const [producerId, setProducerId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');

  // FUNRURAL
  const [showFunrural, setShowFunrural] = useState(false);
  const [funruralRateDisplay, setFunruralRateDisplay] = useState('');
  const funruralAmount = (() => {
    const rate = parseFloat(funruralRateDisplay.replace(',', '.')) || 0;
    const total = parseBRL(totalAmountDisplay);
    if (rate > 0 && total > 0) return (total * rate) / 100;
    return null;
  })();

  // NF-e
  const [nfeKey, setNfeKey] = useState('');

  // Installments
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);

  // Cost center
  const [costCenterItems, setCostCenterItems] = useState<CostCenterRow[]>([]);

  // Recurrence
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Options
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [producers, setProducers] = useState<ProducerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Load options
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<{ data: FarmOption[] }>('/org/farms?limit=100')
      .then((r) => setFarms(r.data))
      .catch(() => {});
    void api
      .get<{ data: ProducerOption[] }>('/org/producers?limit=100')
      .then((r) => setProducers(r.data))
      .catch(() => {});
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Load receivable for edit
  useEffect(() => {
    if (!isOpen || !receivable) return;
    setClientName(receivable.clientName);
    setCategory(receivable.category);
    setDescription(receivable.description);
    setTotalAmountDisplay(formatBRL(receivable.totalAmount));
    setDueDate(receivable.dueDate.slice(0, 10));
    setDocumentNumber(receivable.documentNumber ?? '');
    setFarmId(receivable.farm?.id ?? '');
    setProducerId(receivable.producer?.id ?? '');
    setBankAccountId(receivable.bankAccount?.id ?? '');
    setNotes(receivable.notes ?? '');
    if (receivable.funruralRate != null) {
      setShowFunrural(true);
      setFunruralRateDisplay(receivable.funruralRate.toFixed(2).replace('.', ','));
    }
    setNfeKey(receivable.nfeKey ?? '');
    setInstallmentCount(receivable.installmentCount || 1);
    if (receivable.installments.length > 0) {
      setInstallments(
        receivable.installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate.slice(0, 10),
          amount: inst.amount.toFixed(2).replace('.', ','),
        })),
      );
    }
    if (receivable.costCenterItems.length > 0) {
      setCostCenterItems(
        receivable.costCenterItems.map((item) => ({
          costCenter: item.costCenter,
          percentage: item.percentage != null ? String(item.percentage) : '',
          fixedAmount: item.fixedAmount != null ? String(item.fixedAmount) : '',
          mode: item.percentage != null ? 'percentage' : 'fixed',
        })),
      );
    }
  }, [isOpen, receivable]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setClientName('');
      setCategory('');
      setDescription('');
      setTotalAmountDisplay('');
      setDueDate('');
      setDocumentNumber('');
      setFarmId('');
      setProducerId('');
      setBankAccountId('');
      setNotes('');
      setShowFunrural(false);
      setFunruralRateDisplay('');
      setNfeKey('');
      setInstallmentCount(1);
      setInstallments([]);
      setCostCenterItems([]);
      setRecurrenceFrequency('');
      setRecurrenceEndDate('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus
  useEffect(() => {
    if (isOpen) setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Auto-generate installments when count or dueDate changes
  useEffect(() => {
    if (installmentCount > 1 && dueDate) {
      const total = parseBRL(totalAmountDisplay);
      setInstallments(generateInstallments(total, installmentCount, dueDate));
    } else {
      setInstallments([]);
    }
  }, [installmentCount, dueDate]); // totalAmount excluded — only regenerate on count/date change

  const nfeKeyError =
    nfeKey.length > 0 && nfeKey.length !== 44
      ? 'A chave NF-e deve ter exatamente 44 caracteres'
      : undefined;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!clientName.trim()) newErrors.clientName = 'Cliente é obrigatório';
    if (!category) newErrors.category = 'Categoria é obrigatória';
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    const total = parseBRL(totalAmountDisplay);
    if (!totalAmountDisplay || total <= 0) newErrors.totalAmount = 'Valor total é obrigatório';
    if (!dueDate) newErrors.dueDate = 'Data de vencimento é obrigatória';
    if (!farmId) newErrors.farmId = 'Fazenda é obrigatória';
    if (showFunrural && funruralRateDisplay) {
      const rate = parseFloat(funruralRateDisplay.replace(',', '.'));
      if (isNaN(rate) || rate < 0 || rate > 100)
        newErrors.funruralRate = 'Taxa FUNRURAL deve ser entre 0 e 100%';
    }
    if (nfeKey.length > 0 && nfeKey.length !== 44)
      newErrors.nfeKey = 'A chave NF-e deve ter 44 caracteres';

    // Cost center validation: if any items, sum must be 100% or amounts must sum to total
    if (costCenterItems.length > 0) {
      const hasPercentage = costCenterItems.some((i) => i.mode === 'percentage');
      if (hasPercentage) {
        const sum = costCenterItems.reduce((acc, i) => acc + (parseFloat(i.percentage) || 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
          newErrors.costCenter = `Rateio percentual deve totalizar 100% (atual: ${sum.toFixed(2)}%)`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const total = parseBRL(totalAmountDisplay);
      const funruralRate = showFunrural
        ? parseFloat(funruralRateDisplay.replace(',', '.')) || undefined
        : undefined;
      const funruralAmountVal =
        funruralRate != null && funruralRate > 0 ? (total * funruralRate) / 100 : undefined;

      const payload: Record<string, unknown> = {
        clientName: clientName.trim(),
        category,
        description: description.trim(),
        totalAmount: total,
        dueDate,
        farmId,
        documentNumber: documentNumber.trim() || undefined,
        producerId: producerId || undefined,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim() || undefined,
        funruralRate: funruralRate,
        funruralAmount: funruralAmountVal,
        nfeKey: nfeKey.trim() || undefined,
        installmentCount,
      };

      if (installments.length > 0) {
        payload.installments = installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          amount: parseBRL(inst.amount),
        }));
      }

      if (costCenterItems.length > 0) {
        payload.costCenterItems = costCenterItems
          .filter((i) => i.costCenter.trim())
          .map((i) => ({
            costCenter: i.costCenter.trim(),
            percentage: i.mode === 'percentage' ? parseFloat(i.percentage) || undefined : undefined,
            fixedAmount: i.mode === 'fixed' ? parseBRL(i.fixedAmount) || undefined : undefined,
          }));
      }

      if (recurrenceFrequency) {
        payload.recurrenceFrequency = recurrenceFrequency;
        if (recurrenceEndDate) payload.recurrenceEndDate = recurrenceEndDate;
      }

      try {
        if (isEditMode && receivable) {
          await api.patch(`/org/receivables/${receivable.id}`, payload);
        } else {
          await api.post('/org/receivables', payload);
        }
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar';
        setSubmitError(`Não foi possível salvar a conta a receber. ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      clientName,
      category,
      description,
      totalAmountDisplay,
      dueDate,
      farmId,
      documentNumber,
      producerId,
      bankAccountId,
      notes,
      showFunrural,
      funruralRateDisplay,
      nfeKey,
      installmentCount,
      installments,
      costCenterItems,
      recurrenceFrequency,
      recurrenceEndDate,
      isEditMode,
      receivable,
      onSuccess,
    ],
  );

  const addCostCenterRow = () => {
    setCostCenterItems((prev) => [
      ...prev,
      { costCenter: '', percentage: '', fixedAmount: '', mode: 'percentage' },
    ]);
  };

  const removeCostCenterRow = (idx: number) => {
    setCostCenterItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCostCenterRow = (idx: number, field: keyof CostCenterRow, value: string) => {
    setCostCenterItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="cr-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? 'Editar conta a receber' : 'Nova conta a receber'}
    >
      <div className="cr-modal__panel">
        <header className="cr-modal__header">
          <div className="cr-modal__header-icon" aria-hidden="true">
            <ReceiptText size={20} />
          </div>
          <h2 className="cr-modal__title">
            {isEditMode ? 'Editar conta a receber' : 'Nova conta a receber'}
          </h2>
          <button type="button" className="cr-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="cr-modal__body">
            {submitError && (
              <div className="cr-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Cliente */}
            <div className="cr-modal__field">
              <label htmlFor="cr-clientName" className="cr-modal__label">
                Cliente <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-clientName"
                ref={firstFieldRef}
                type="text"
                className={`cr-modal__input ${errors.clientName ? 'cr-modal__input--error' : ''}`}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => {
                  if (!clientName.trim())
                    setErrors((p) => ({ ...p, clientName: 'Cliente é obrigatório' }));
                  else setErrors((p) => ({ ...p, clientName: undefined }));
                }}
                aria-required="true"
                placeholder="Nome do cliente ou comprador"
              />
              {errors.clientName && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.clientName}
                </span>
              )}
            </div>

            {/* Categoria */}
            <div className="cr-modal__field">
              <label htmlFor="cr-category" className="cr-modal__label">
                Categoria rural <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="cr-category"
                className={`cr-modal__input ${errors.category ? 'cr-modal__input--error' : ''}`}
                value={category}
                onChange={(e) => setCategory(e.target.value as ReceivableCategory)}
                onBlur={() => {
                  if (!category) setErrors((p) => ({ ...p, category: 'Categoria é obrigatória' }));
                  else setErrors((p) => ({ ...p, category: undefined }));
                }}
                aria-required="true"
              >
                <option value="">Selecione a categoria</option>
                {(Object.entries(CATEGORY_LABELS) as [ReceivableCategory, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              {errors.category && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.category}
                </span>
              )}
            </div>

            {/* Descrição */}
            <div className="cr-modal__field">
              <label htmlFor="cr-description" className="cr-modal__label">
                Descrição <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-description"
                type="text"
                className={`cr-modal__input ${errors.description ? 'cr-modal__input--error' : ''}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (!description.trim())
                    setErrors((p) => ({ ...p, description: 'Descrição é obrigatória' }));
                  else setErrors((p) => ({ ...p, description: undefined }));
                }}
                aria-required="true"
                placeholder="Venda de soja safra 2025, etc."
              />
              {errors.description && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.description}
                </span>
              )}
            </div>

            {/* Valor total + Vencimento */}
            <div className="cr-modal__row">
              <div className="cr-modal__field cr-modal__field--grow">
                <label htmlFor="cr-totalAmount" className="cr-modal__label">
                  Valor total <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="cr-totalAmount"
                  type="text"
                  className={`cr-modal__input cr-modal__input--mono ${errors.totalAmount ? 'cr-modal__input--error' : ''}`}
                  value={totalAmountDisplay}
                  onChange={(e) => setTotalAmountDisplay(e.target.value)}
                  onBlur={(e) => {
                    const num = parseBRL(e.target.value);
                    if (num > 0) {
                      setTotalAmountDisplay(formatBRL(num));
                      setErrors((p) => ({ ...p, totalAmount: undefined }));
                    } else {
                      setErrors((p) => ({ ...p, totalAmount: 'Valor total é obrigatório' }));
                    }
                  }}
                  aria-required="true"
                  placeholder="R$ 0,00"
                />
                {errors.totalAmount && (
                  <span className="cr-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.totalAmount}
                  </span>
                )}
              </div>

              <div className="cr-modal__field cr-modal__field--date">
                <label htmlFor="cr-dueDate" className="cr-modal__label">
                  Vencimento <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="cr-dueDate"
                  type="date"
                  className={`cr-modal__input ${errors.dueDate ? 'cr-modal__input--error' : ''}`}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => {
                    if (!dueDate) setErrors((p) => ({ ...p, dueDate: 'Vencimento é obrigatório' }));
                    else setErrors((p) => ({ ...p, dueDate: undefined }));
                  }}
                  aria-required="true"
                />
                {errors.dueDate && (
                  <span className="cr-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.dueDate}
                  </span>
                )}
              </div>
            </div>

            {/* Num documento */}
            <div className="cr-modal__field">
              <label htmlFor="cr-docNumber" className="cr-modal__label">
                Número do documento
              </label>
              <input
                id="cr-docNumber"
                type="text"
                className="cr-modal__input"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Nota fiscal, contrato, etc."
              />
            </div>

            {/* Fazenda */}
            <div className="cr-modal__field">
              <label htmlFor="cr-farmId" className="cr-modal__label">
                Fazenda <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="cr-farmId"
                className={`cr-modal__input ${errors.farmId ? 'cr-modal__input--error' : ''}`}
                value={farmId}
                onChange={(e) => setFarmId(e.target.value)}
                onBlur={() => {
                  if (!farmId) setErrors((p) => ({ ...p, farmId: 'Fazenda é obrigatória' }));
                  else setErrors((p) => ({ ...p, farmId: undefined }));
                }}
                aria-required="true"
              >
                <option value="">Selecione a fazenda</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {errors.farmId && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.farmId}
                </span>
              )}
            </div>

            {/* Produtor rural emitente */}
            <div className="cr-modal__field">
              <label htmlFor="cr-producerId" className="cr-modal__label">
                Produtor rural emitente
              </label>
              <select
                id="cr-producerId"
                className="cr-modal__input"
                value={producerId}
                onChange={(e) => setProducerId(e.target.value)}
              >
                <option value="">Selecione o produtor (opcional)</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Conta bancária */}
            <div className="cr-modal__field">
              <label htmlFor="cr-bankAccount" className="cr-modal__label">
                Conta bancária
              </label>
              <select
                id="cr-bankAccount"
                className="cr-modal__input"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                <option value="">Selecione (opcional)</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── FUNRURAL section ────────────────────────── */}
            <div className="cr-modal__section">
              <button
                type="button"
                className="cr-modal__section-toggle"
                onClick={() => setShowFunrural((v) => !v)}
                aria-expanded={showFunrural}
              >
                FUNRURAL
                {showFunrural ? (
                  <ChevronUp size={16} aria-hidden="true" />
                ) : (
                  <ChevronDown size={16} aria-hidden="true" />
                )}
              </button>

              {showFunrural && (
                <div className="cr-modal__section-body">
                  <div className="cr-modal__field">
                    <label htmlFor="cr-funruralRate" className="cr-modal__label">
                      Taxa FUNRURAL (%)
                    </label>
                    <input
                      id="cr-funruralRate"
                      type="text"
                      className={`cr-modal__input cr-modal__input--mono ${errors.funruralRate ? 'cr-modal__input--error' : ''}`}
                      value={funruralRateDisplay}
                      onChange={(e) => setFunruralRateDisplay(e.target.value)}
                      placeholder="1,50"
                    />
                    {errors.funruralRate && (
                      <span className="cr-modal__error" role="alert">
                        <AlertCircle size={12} aria-hidden="true" /> {errors.funruralRate}
                      </span>
                    )}
                  </div>
                  {funruralAmount != null && funruralAmount > 0 && (
                    <div className="cr-modal__funrural-preview">
                      <span className="cr-modal__funrural-label">FUNRURAL retido:</span>
                      <span className="cr-modal__funrural-value cr-modal__input--mono">
                        {formatBRL(funruralAmount)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── NF-e key ──────────────────────────────── */}
            <div className="cr-modal__field">
              <label htmlFor="cr-nfeKey" className="cr-modal__label">
                Chave NF-e
              </label>
              <input
                id="cr-nfeKey"
                type="text"
                className={`cr-modal__input cr-modal__input--mono ${nfeKeyError ? 'cr-modal__input--error' : ''}`}
                value={nfeKey}
                onChange={(e) => setNfeKey(e.target.value.replace(/\D/g, ''))}
                maxLength={44}
                placeholder="44 dígitos"
                aria-describedby="cr-nfeKey-hint"
              />
              <span id="cr-nfeKey-hint" className="cr-modal__hint">
                {nfeKey.length}/44 caracteres
              </span>
              {nfeKeyError && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {nfeKeyError}
                </span>
              )}
            </div>

            {/* ── Parcelamento ──────────────────────────── */}
            <div className="cr-modal__section">
              <div className="cr-modal__section-header">
                <span className="cr-modal__section-label">Parcelamento</span>
              </div>
              <div className="cr-modal__section-body">
                <div className="cr-modal__field">
                  <label htmlFor="cr-installmentCount" className="cr-modal__label">
                    Número de parcelas
                  </label>
                  <input
                    id="cr-installmentCount"
                    type="number"
                    className="cr-modal__input"
                    value={installmentCount}
                    min={1}
                    max={60}
                    onChange={(e) =>
                      setInstallmentCount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                </div>

                {installments.length > 0 && (
                  <div className="cr-modal__installments">
                    <p className="cr-modal__installments-note">
                      A primeira parcela absorve o resíduo do arredondamento.
                    </p>
                    <table className="cr-modal__installments-table">
                      <caption className="sr-only">Parcelas geradas</caption>
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Vencimento</th>
                          <th scope="col" className="cr-modal__col-right">
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, idx) => (
                          <tr key={inst.installmentNumber}>
                            <td>{inst.installmentNumber}</td>
                            <td>
                              <input
                                type="date"
                                className="cr-modal__input cr-modal__input--sm"
                                value={inst.dueDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInstallments((prev) =>
                                    prev.map((row, i) =>
                                      i === idx ? { ...row, dueDate: val } : row,
                                    ),
                                  );
                                }}
                                aria-label={`Vencimento parcela ${inst.installmentNumber}`}
                              />
                            </td>
                            <td className="cr-modal__col-right">
                              <input
                                type="text"
                                className="cr-modal__input cr-modal__input--sm cr-modal__input--mono"
                                value={inst.amount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInstallments((prev) =>
                                    prev.map((row, i) =>
                                      i === idx ? { ...row, amount: val } : row,
                                    ),
                                  );
                                }}
                                aria-label={`Valor parcela ${inst.installmentNumber}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Rateio por centro de custo ────────────── */}
            <div className="cr-modal__section">
              <div className="cr-modal__section-header">
                <span className="cr-modal__section-label">Rateio por centro de custo</span>
                <button type="button" className="cr-modal__section-add" onClick={addCostCenterRow}>
                  + Adicionar
                </button>
              </div>

              {errors.costCenter && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.costCenter}
                </span>
              )}

              {costCenterItems.length > 0 && (
                <div className="cr-modal__section-body">
                  {costCenterItems.map((row, idx) => (
                    <div key={idx} className="cr-modal__cc-row">
                      <input
                        type="text"
                        className="cr-modal__input cr-modal__cc-name"
                        value={row.costCenter}
                        onChange={(e) => updateCostCenterRow(idx, 'costCenter', e.target.value)}
                        placeholder="Centro de custo"
                        aria-label={`Centro de custo ${idx + 1}`}
                      />
                      <select
                        className="cr-modal__input cr-modal__cc-mode"
                        value={row.mode}
                        onChange={(e) =>
                          updateCostCenterRow(idx, 'mode', e.target.value as 'percentage' | 'fixed')
                        }
                        aria-label={`Modo de rateio ${idx + 1}`}
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">R$</option>
                      </select>
                      {row.mode === 'percentage' ? (
                        <input
                          type="number"
                          className="cr-modal__input cr-modal__cc-value"
                          value={row.percentage}
                          min={0}
                          max={100}
                          step={0.01}
                          onChange={(e) => updateCostCenterRow(idx, 'percentage', e.target.value)}
                          placeholder="0"
                          aria-label={`Percentual ${idx + 1}`}
                        />
                      ) : (
                        <input
                          type="text"
                          className="cr-modal__input cr-modal__cc-value cr-modal__input--mono"
                          value={row.fixedAmount}
                          onChange={(e) => updateCostCenterRow(idx, 'fixedAmount', e.target.value)}
                          placeholder="0,00"
                          aria-label={`Valor fixo ${idx + 1}`}
                        />
                      )}
                      <button
                        type="button"
                        className="cr-modal__cc-remove"
                        onClick={() => removeCostCenterRow(idx)}
                        aria-label={`Remover centro de custo ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recorrência ──────────────────────────── */}
            <div className="cr-modal__section">
              <div className="cr-modal__section-header">
                <span className="cr-modal__section-label">Recorrência</span>
              </div>
              <div className="cr-modal__section-body">
                <div className="cr-modal__row">
                  <div className="cr-modal__field cr-modal__field--grow">
                    <label htmlFor="cr-recurrence" className="cr-modal__label">
                      Frequência
                    </label>
                    <select
                      id="cr-recurrence"
                      className="cr-modal__input"
                      value={recurrenceFrequency}
                      onChange={(e) => setRecurrenceFrequency(e.target.value)}
                    >
                      {RECURRENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {recurrenceFrequency && (
                    <div className="cr-modal__field cr-modal__field--date">
                      <label htmlFor="cr-recurrence-end" className="cr-modal__label">
                        Data fim
                      </label>
                      <input
                        id="cr-recurrence-end"
                        type="date"
                        className="cr-modal__input"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="cr-modal__field">
              <label htmlFor="cr-notes" className="cr-modal__label">
                Observações
              </label>
              <textarea
                id="cr-notes"
                className="cr-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <footer className="cr-modal__footer">
            <button type="button" className="cr-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cr-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Salvando...'
                : isEditMode
                  ? 'Salvar alterações'
                  : 'Cadastrar conta a receber'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ReceivableModal;
