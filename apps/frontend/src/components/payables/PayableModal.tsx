import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { api } from '@/services/api';
import './PayableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

type PayableCategory =
  | 'SUPPLIER'
  | 'EMPLOYEE'
  | 'TAXES'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'FUEL'
  | 'FEED'
  | 'VETERINARY'
  | 'AGROCHEMICAL'
  | 'FERTILIZER'
  | 'SEED'
  | 'EQUIPMENT'
  | 'FINANCE'
  | 'OTHER';

const CATEGORY_LABELS: Record<PayableCategory, string> = {
  SUPPLIER: 'Fornecedor',
  EMPLOYEE: 'Funcionário',
  TAXES: 'Impostos',
  UTILITIES: 'Serviços básicos',
  MAINTENANCE: 'Manutenção',
  FUEL: 'Combustível',
  FEED: 'Ração/Alimentação',
  VETERINARY: 'Veterinário',
  AGROCHEMICAL: 'Defensivo',
  FERTILIZER: 'Fertilizante',
  SEED: 'Semente',
  EQUIPMENT: 'Equipamento',
  FINANCE: 'Financeiro',
  OTHER: 'Outros',
};

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

interface Installment {
  number: number;
  amount: string; // display BRL
  dueDate: string;
}

interface CostCenterRow {
  id: string; // local key
  costCenter: string;
  farmId: string;
  value: string; // percentage or BRL
}

interface PayableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payableId?: string;
}

interface FormErrors {
  supplierName?: string;
  category?: string;
  totalAmount?: string;
  dueDate?: string;
  farmId?: string;
  rateio?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function genId() {
  return Math.random().toString(36).slice(2);
}

// ─── Component ────────────────────────────────────────────────────

const PayableModal = ({ isOpen, onClose, onSuccess, payableId }: PayableModalProps) => {
  const isEdit = Boolean(payableId);

  // Form fields
  const [supplierName, setSupplierName] = useState('');
  const [category, setCategory] = useState<PayableCategory | ''>('');
  const [description, setDescription] = useState('');
  const [totalAmountDisplay, setTotalAmountDisplay] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [farmId, setFarmId] = useState('');
  const [producerId, setProducerId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');

  // Installments
  const [installmentCount, setInstallmentCount] = useState(1);
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Rateio
  const [rateioMode, setRateioMode] = useState<'PERCENTAGE' | 'AMOUNT'>('PERCENTAGE');
  const [costCenterRows, setCostCenterRows] = useState<CostCenterRow[]>([]);
  const [rateioError, setRateioError] = useState<string | null>(null);

  // Recurrence (create only)
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'MONTHLY' | 'BIWEEKLY' | 'WEEKLY'>(
    'MONTHLY',
  );
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
      .then((r) => setFarms(r.data ?? []))
      .catch(() => {});
    void api
      .get<{ data: ProducerOption[] }>('/org/producers?limit=100')
      .then((r) => setProducers(r.data ?? []))
      .catch(() => {});
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, [isOpen]);

  // Load for edit
  useEffect(() => {
    if (!isOpen || !payableId) return;
    void api
      .get<Record<string, unknown>>(`/org/payables/${payableId}`)
      .then((p) => {
        setSupplierName(String(p.supplierName ?? ''));
        setCategory((p.category as PayableCategory) ?? '');
        setDescription(String(p.description ?? ''));
        setTotalAmountDisplay(formatBRL(Number(p.totalAmount ?? 0)));
        setDueDate(String(p.dueDate ?? '').split('T')[0]);
        setDocumentNumber(String(p.documentNumber ?? ''));
        setFarmId(String(p.farmId ?? ''));
        setProducerId(String(p.producerId ?? ''));
        setBankAccountId(String(p.bankAccountId ?? ''));
        setNotes(String(p.notes ?? ''));
      })
      .catch(() => {});
  }, [isOpen, payableId]);

  // Reset
  useEffect(() => {
    if (!isOpen) {
      setSupplierName('');
      setCategory('');
      setDescription('');
      setTotalAmountDisplay('');
      setDueDate('');
      setDocumentNumber('');
      setFarmId('');
      setProducerId('');
      setBankAccountId('');
      setNotes('');
      setInstallmentCount(1);
      setInstallments([]);
      setCostCenterRows([]);
      setRateioError(null);
      setRateioMode('PERCENTAGE');
      setShowRecurrence(false);
      setRecurrenceFreq('MONTHLY');
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

  // Generate installments from total + due date + count
  const generateInstallments = useCallback((total: number, firstDue: string, count: number) => {
    if (!firstDue || count < 1) return;
    const baseAmount = Math.floor((total / count) * 100) / 100;
    const residual = Math.round((total - baseAmount * count) * 100) / 100;
    const rows: Installment[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(firstDue + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + i);
      const iso = d.toISOString().split('T')[0];
      const amount = i === 0 ? baseAmount + residual : baseAmount;
      rows.push({ number: i + 1, amount: formatBRL(amount), dueDate: iso });
    }
    setInstallments(rows);
  }, []);

  const handleTotalBlur = useCallback(() => {
    const num = parseBRL(totalAmountDisplay);
    if (num > 0) {
      setTotalAmountDisplay(formatBRL(num));
      setErrors((p) => ({ ...p, totalAmount: undefined }));
      if (installmentCount > 1 && dueDate) generateInstallments(num, dueDate, installmentCount);
    } else {
      setErrors((p) => ({ ...p, totalAmount: 'Valor é obrigatório' }));
    }
  }, [totalAmountDisplay, installmentCount, dueDate, generateInstallments]);

  const handleInstallmentCountChange = useCallback(
    (count: number) => {
      setInstallmentCount(count);
      const total = parseBRL(totalAmountDisplay);
      if (count > 1 && total > 0 && dueDate) generateInstallments(total, dueDate, count);
      else setInstallments([]);
    },
    [totalAmountDisplay, dueDate, generateInstallments],
  );

  // Installment amount sum warning
  const installmentSum = installments.reduce((s, i) => s + parseBRL(i.amount), 0);
  const totalAmount = parseBRL(totalAmountDisplay);
  const installmentMismatch =
    installments.length > 0 && Math.abs(installmentSum - totalAmount) > 0.01;

  // Rateio validation
  const validateRateio = useCallback(() => {
    if (costCenterRows.length === 0) {
      setRateioError(null);
      return true;
    }
    const sum = costCenterRows.reduce((s, r) => s + parseBRL(r.value), 0);
    if (rateioMode === 'PERCENTAGE') {
      if (Math.abs(sum - 100) > 0.01) {
        setRateioError(`Soma dos percentuais deve ser 100%. Atual: ${sum.toFixed(2)}%`);
        return false;
      }
    } else {
      const total = parseBRL(totalAmountDisplay);
      if (Math.abs(sum - total) > 0.01) {
        setRateioError(
          `Soma dos valores deve ser igual ao total (${formatBRL(total)}). Atual: ${formatBRL(sum)}`,
        );
        return false;
      }
    }
    setRateioError(null);
    return true;
  }, [costCenterRows, rateioMode, totalAmountDisplay]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!supplierName.trim()) newErrors.supplierName = 'Fornecedor é obrigatório';
    if (!category) newErrors.category = 'Categoria é obrigatória';
    const total = parseBRL(totalAmountDisplay);
    if (!total) newErrors.totalAmount = 'Valor é obrigatório';
    if (!dueDate) newErrors.dueDate = 'Vencimento é obrigatório';
    setErrors(newErrors);
    const rateioOk = validateRateio();
    return Object.keys(newErrors).length === 0 && rateioOk;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const costCenterItems = costCenterRows.map((r) => ({
        costCenter: r.costCenter,
        farmId: r.farmId || undefined,
        ...(rateioMode === 'PERCENTAGE'
          ? { percentage: parseBRL(r.value) }
          : { amount: parseBRL(r.value) }),
      }));

      const payload = {
        supplierName: supplierName.trim(),
        category,
        description: description.trim() || undefined,
        totalAmount: parseBRL(totalAmountDisplay),
        dueDate,
        documentNumber: documentNumber.trim() || undefined,
        farmId: farmId || undefined,
        producerId: producerId || undefined,
        bankAccountId: bankAccountId || undefined,
        notes: notes.trim() || undefined,
        installmentCount: installmentCount > 1 ? installmentCount : undefined,
        installments:
          installments.length > 1
            ? installments.map((i) => ({ amount: parseBRL(i.amount), dueDate: i.dueDate }))
            : undefined,
        costCenterItems: costCenterItems.length > 0 ? costCenterItems : undefined,
        recurrence:
          showRecurrence && !isEdit
            ? { frequency: recurrenceFreq, endDate: recurrenceEndDate || undefined }
            : undefined,
      };

      try {
        if (isEdit && payableId) {
          await api.put(`/org/payables/${payableId}`, payload);
        } else {
          await api.post('/org/payables', payload);
        }
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar';
        setSubmitError(`Não foi possível salvar. ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      supplierName,
      category,
      description,
      totalAmountDisplay,
      dueDate,
      documentNumber,
      farmId,
      producerId,
      bankAccountId,
      notes,
      installmentCount,
      installments,
      costCenterRows,
      rateioMode,
      showRecurrence,
      recurrenceFreq,
      recurrenceEndDate,
      isEdit,
      payableId,
      onSuccess,
    ],
  );

  const addCostCenterRow = useCallback(() => {
    setCostCenterRows((prev) => [...prev, { id: genId(), costCenter: '', farmId: '', value: '' }]);
  }, []);

  const removeCostCenterRow = useCallback((id: string) => {
    setCostCenterRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateCostCenterRow = useCallback((id: string, field: keyof CostCenterRow, val: string) => {
    setCostCenterRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="pm-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Editar conta a pagar' : 'Nova conta a pagar'}
    >
      <div className="pm-modal__panel">
        <header className="pm-modal__header">
          <div className="pm-modal__header-icon" aria-hidden="true">
            <Receipt size={20} />
          </div>
          <h2 className="pm-modal__title">
            {isEdit ? 'Editar conta a pagar' : 'Nova conta a pagar'}
          </h2>
          <button type="button" className="pm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="pm-modal__body">
            {submitError && (
              <div className="pm-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Fornecedor */}
            <div className="pm-modal__field">
              <label htmlFor="pm-supplier" className="pm-modal__label">
                Fornecedor <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="pm-supplier"
                ref={firstFieldRef}
                type="text"
                className={`pm-modal__input${errors.supplierName ? ' pm-modal__input--error' : ''}`}
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                onBlur={() => {
                  if (!supplierName.trim())
                    setErrors((p) => ({ ...p, supplierName: 'Fornecedor é obrigatório' }));
                  else setErrors((p) => ({ ...p, supplierName: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.supplierName ? 'pm-supplier-err' : undefined}
                placeholder="Nome do fornecedor ou credor"
              />
              {errors.supplierName && (
                <span id="pm-supplier-err" className="pm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.supplierName}
                </span>
              )}
            </div>

            {/* Categoria + Fazenda */}
            <div className="pm-modal__row">
              <div className="pm-modal__field">
                <label htmlFor="pm-category" className="pm-modal__label">
                  Categoria <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="pm-category"
                  className={`pm-modal__input${errors.category ? ' pm-modal__input--error' : ''}`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PayableCategory)}
                  onBlur={() => {
                    if (!category)
                      setErrors((p) => ({ ...p, category: 'Categoria é obrigatória' }));
                    else setErrors((p) => ({ ...p, category: undefined }));
                  }}
                  aria-required="true"
                >
                  <option value="">Selecione a categoria</option>
                  {(Object.keys(CATEGORY_LABELS) as PayableCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <span className="pm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.category}
                  </span>
                )}
              </div>

              <div className="pm-modal__field">
                <label htmlFor="pm-farm" className="pm-modal__label">
                  Fazenda
                </label>
                <select
                  id="pm-farm"
                  className="pm-modal__input"
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                >
                  <option value="">Sem fazenda específica</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Valor + Vencimento */}
            <div className="pm-modal__row">
              <div className="pm-modal__field">
                <label htmlFor="pm-amount" className="pm-modal__label">
                  Valor total <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="pm-amount"
                  type="text"
                  className={`pm-modal__input pm-modal__input--mono${errors.totalAmount ? ' pm-modal__input--error' : ''}`}
                  value={totalAmountDisplay}
                  onChange={(e) => setTotalAmountDisplay(e.target.value)}
                  onBlur={handleTotalBlur}
                  aria-required="true"
                  placeholder="R$ 0,00"
                />
                {errors.totalAmount && (
                  <span className="pm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.totalAmount}
                  </span>
                )}
              </div>

              <div className="pm-modal__field">
                <label htmlFor="pm-due" className="pm-modal__label">
                  Vencimento <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="pm-due"
                  type="date"
                  className={`pm-modal__input${errors.dueDate ? ' pm-modal__input--error' : ''}`}
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    const total = parseBRL(totalAmountDisplay);
                    if (installmentCount > 1 && total > 0 && e.target.value) {
                      generateInstallments(total, e.target.value, installmentCount);
                    }
                  }}
                  aria-required="true"
                />
                {errors.dueDate && (
                  <span className="pm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.dueDate}
                  </span>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="pm-modal__field">
              <label htmlFor="pm-desc" className="pm-modal__label">
                Descrição
              </label>
              <textarea
                id="pm-desc"
                className="pm-modal__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Descrição do título..."
              />
            </div>

            {/* Num documento + Conta bancária */}
            <div className="pm-modal__row">
              <div className="pm-modal__field">
                <label htmlFor="pm-doc" className="pm-modal__label">
                  Nº do documento
                </label>
                <input
                  id="pm-doc"
                  type="text"
                  className="pm-modal__input"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="NF, boleto..."
                />
              </div>

              <div className="pm-modal__field">
                <label htmlFor="pm-bank" className="pm-modal__label">
                  Conta bancária
                </label>
                <select
                  id="pm-bank"
                  className="pm-modal__input"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">Sem conta específica</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Produtor */}
            {producers.length > 0 && (
              <div className="pm-modal__field">
                <label htmlFor="pm-producer" className="pm-modal__label">
                  Produtor rural
                </label>
                <select
                  id="pm-producer"
                  className="pm-modal__input"
                  value={producerId}
                  onChange={(e) => setProducerId(e.target.value)}
                >
                  <option value="">Sem produtor específico</option>
                  {producers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Parcelas ── */}
            <h3 className="pm-modal__section-title">Parcelamento</h3>

            <div className="pm-modal__field" style={{ maxWidth: 200 }}>
              <label htmlFor="pm-inst-count" className="pm-modal__label">
                Número de parcelas
              </label>
              <input
                id="pm-inst-count"
                type="number"
                min={1}
                max={60}
                className="pm-modal__input"
                value={installmentCount}
                onChange={(e) =>
                  handleInstallmentCountChange(Math.max(1, parseInt(e.target.value) || 1))
                }
              />
            </div>

            {installments.length > 1 && (
              <>
                {installmentMismatch && (
                  <div className="pm-modal__installments-warning" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    Soma das parcelas (
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      installmentSum,
                    )}
                    ) difere do total ({formatBRL(totalAmount)})
                  </div>
                )}
                <div className="pm-modal__installments-wrap">
                  <table className="pm-modal__installments-table">
                    <caption className="sr-only">Parcelas do título</caption>
                    <thead>
                      <tr>
                        <th scope="col">Parcela</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst, idx) => (
                        <tr key={inst.number}>
                          <td>
                            {inst.number}/{installmentCount}
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pm-modal__input pm-modal__input--mono"
                              value={inst.amount}
                              onChange={(e) => {
                                const updated = [...installments];
                                updated[idx] = { ...updated[idx], amount: e.target.value };
                                setInstallments(updated);
                              }}
                              onBlur={(e) => {
                                const num = parseBRL(e.target.value);
                                if (num > 0) {
                                  const updated = [...installments];
                                  updated[idx] = { ...updated[idx], amount: formatBRL(num) };
                                  setInstallments(updated);
                                }
                              }}
                              aria-label={`Valor da parcela ${inst.number}`}
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              className="pm-modal__input"
                              value={inst.dueDate}
                              onChange={(e) => {
                                const updated = [...installments];
                                updated[idx] = { ...updated[idx], dueDate: e.target.value };
                                setInstallments(updated);
                              }}
                              aria-label={`Vencimento da parcela ${inst.number}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── Centro de custo ── */}
            <h3 className="pm-modal__section-title">Rateio por centro de custo</h3>

            <div className="pm-modal__rateio-mode" role="group" aria-label="Modo de rateio">
              <button
                type="button"
                className={`pm-modal__rateio-mode-btn${rateioMode === 'PERCENTAGE' ? ' pm-modal__rateio-mode-btn--active' : ''}`}
                onClick={() => setRateioMode('PERCENTAGE')}
              >
                Percentual
              </button>
              <button
                type="button"
                className={`pm-modal__rateio-mode-btn${rateioMode === 'AMOUNT' ? ' pm-modal__rateio-mode-btn--active' : ''}`}
                onClick={() => setRateioMode('AMOUNT')}
              >
                Valor fixo
              </button>
            </div>

            {costCenterRows.map((row, idx) => (
              <div key={row.id} className="pm-modal__rateio-row">
                <div className="pm-modal__field">
                  <label htmlFor={`pm-cc-name-${row.id}`} className="pm-modal__label">
                    Centro de custo
                  </label>
                  <input
                    id={`pm-cc-name-${row.id}`}
                    type="text"
                    className="pm-modal__input"
                    value={row.costCenter}
                    onChange={(e) => updateCostCenterRow(row.id, 'costCenter', e.target.value)}
                    placeholder="Nome do centro de custo"
                    aria-label={`Centro de custo linha ${idx + 1}`}
                  />
                </div>

                <div className="pm-modal__field">
                  <label htmlFor={`pm-cc-farm-${row.id}`} className="pm-modal__label">
                    Fazenda
                  </label>
                  <select
                    id={`pm-cc-farm-${row.id}`}
                    className="pm-modal__input"
                    value={row.farmId}
                    onChange={(e) => updateCostCenterRow(row.id, 'farmId', e.target.value)}
                  >
                    <option value="">Todas</option>
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pm-modal__field pm-modal__field--narrow">
                  <label htmlFor={`pm-cc-val-${row.id}`} className="pm-modal__label">
                    {rateioMode === 'PERCENTAGE' ? '%' : 'Valor'}
                  </label>
                  <input
                    id={`pm-cc-val-${row.id}`}
                    type="text"
                    className="pm-modal__input pm-modal__input--mono"
                    value={row.value}
                    onChange={(e) => updateCostCenterRow(row.id, 'value', e.target.value)}
                    placeholder={rateioMode === 'PERCENTAGE' ? '0,00' : 'R$ 0,00'}
                    aria-label={`${rateioMode === 'PERCENTAGE' ? 'Percentual' : 'Valor'} linha ${idx + 1}`}
                  />
                </div>

                <button
                  type="button"
                  className="pm-modal__rateio-row-del"
                  onClick={() => removeCostCenterRow(row.id)}
                  aria-label={`Remover linha ${idx + 1} do rateio`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}

            <button type="button" className="pm-modal__rateio-add" onClick={addCostCenterRow}>
              <Plus size={16} aria-hidden="true" />
              Adicionar centro de custo
            </button>

            {rateioError && (
              <div className="pm-modal__rateio-warning" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {rateioError}
              </div>
            )}

            {/* ── Recorrência (create only) ── */}
            {!isEdit && (
              <>
                <button
                  type="button"
                  className="pm-modal__collapse-toggle"
                  onClick={() => setShowRecurrence((v) => !v)}
                  aria-expanded={showRecurrence}
                >
                  {showRecurrence ? (
                    <ChevronUp size={16} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                  )}
                  Recorrência (opcional)
                </button>

                {showRecurrence && (
                  <div className="pm-modal__row">
                    <div className="pm-modal__field">
                      <label htmlFor="pm-recurrence-freq" className="pm-modal__label">
                        Frequência
                      </label>
                      <select
                        id="pm-recurrence-freq"
                        className="pm-modal__input"
                        value={recurrenceFreq}
                        onChange={(e) => setRecurrenceFreq(e.target.value as typeof recurrenceFreq)}
                      >
                        <option value="WEEKLY">Semanal</option>
                        <option value="BIWEEKLY">Quinzenal</option>
                        <option value="MONTHLY">Mensal</option>
                      </select>
                    </div>

                    <div className="pm-modal__field">
                      <label htmlFor="pm-recurrence-end" className="pm-modal__label">
                        Data de encerramento
                      </label>
                      <input
                        id="pm-recurrence-end"
                        type="date"
                        className="pm-modal__input"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Observações */}
            <div className="pm-modal__field">
              <label htmlFor="pm-notes" className="pm-modal__label">
                Observações
              </label>
              <textarea
                id="pm-notes"
                className="pm-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <footer className="pm-modal__footer">
            <button type="button" className="pm-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="pm-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar conta'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default PayableModal;
