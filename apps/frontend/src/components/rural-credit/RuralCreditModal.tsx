import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useFarms } from '@/hooks/useFarms';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  createContract,
  updateContract,
  simulateSchedule,
  useRuralCreditDetail,
  type CreateContractData,
  type SimulateData,
} from '@/hooks/useRuralCredit';
import type { ScheduleRow, RuralCreditLine, AmortizationSystem } from '@/types/rural-credit';
import { CREDIT_LINE_LABELS, AMORTIZATION_LABELS } from '@/types/rural-credit';
import SchedulePreviewTable from './SchedulePreviewTable';
import './RuralCreditModal.css';

// ─── Month names ──────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// ─── Helpers ──────────────────────────────────────────────────────

function parseCurrency(value: string): number {
  const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// ─── Types ────────────────────────────────────────────────────────

interface FormState {
  farmId: string;
  bankAccountId: string;
  creditLine: string;
  contractNumber: string;
  principalAmount: string;
  annualRate: string;
  amortizationSystem: string;
  termMonths: string;
  gracePeriodMonths: string;
  firstPaymentYear: string;
  firstPaymentMonth: string;
  paymentDayOfMonth: string;
  releasedAt: string;
  iofAmount: string;
  tacAmount: string;
  alertDaysBefore: string;
  guaranteeDescription: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function emptyForm(): FormState {
  return {
    farmId: '',
    bankAccountId: '',
    creditLine: '',
    contractNumber: '',
    principalAmount: '',
    annualRate: '',
    amortizationSystem: '',
    termMonths: '',
    gracePeriodMonths: '0',
    firstPaymentYear: String(CURRENT_YEAR),
    firstPaymentMonth: String(CURRENT_MONTH),
    paymentDayOfMonth: '1',
    releasedAt: TODAY,
    iofAmount: '',
    tacAmount: '',
    alertDaysBefore: '15',
    guaranteeDescription: '',
    notes: '',
  };
}

// ─── Validation ───────────────────────────────────────────────────

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.farmId) errors.farmId = 'Fazenda obrigatoria';
  if (!form.bankAccountId) errors.bankAccountId = 'Conta bancaria obrigatoria';
  if (!form.creditLine) errors.creditLine = 'Linha de credito obrigatoria';
  if (!form.principalAmount || parseCurrency(form.principalAmount) <= 0)
    errors.principalAmount = 'Valor principal deve ser maior que zero';
  if (!form.annualRate || parseFloat(form.annualRate) <= 0)
    errors.annualRate = 'Taxa anual deve ser maior que zero';
  if (!form.amortizationSystem) errors.amortizationSystem = 'Sistema de amortizacao obrigatorio';
  if (!form.termMonths || parseInt(form.termMonths) <= 0)
    errors.termMonths = 'Prazo deve ser maior que zero';
  if (!form.firstPaymentYear) errors.firstPaymentYear = 'Ano obrigatorio';
  if (!form.firstPaymentMonth) errors.firstPaymentMonth = 'Mes obrigatorio';
  if (!form.releasedAt) errors.releasedAt = 'Data de liberacao obrigatoria';
  return errors;
}

// ─── Props ────────────────────────────────────────────────────────

interface RuralCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractId?: string;
}

// ─── Component ───────────────────────────────────────────────────

export default function RuralCreditModal({
  isOpen,
  onClose,
  onSuccess,
  contractId,
}: RuralCreditModalProps) {
  const isEdit = Boolean(contractId);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [hasSimulated, setHasSimulated] = useState(false);

  const { farms } = useFarms();
  const { accounts } = useBankAccounts();
  const { contract: existingContract } = useRuralCreditDetail(contractId);

  // Filter bank accounts by selected farm
  const filteredAccounts = form.farmId
    ? accounts.filter((a) => a.farms.some((f) => f.id === form.farmId))
    : accounts;

  // Populate form when editing
  useEffect(() => {
    if (isEdit && existingContract) {
      setForm({
        farmId: existingContract.farmId,
        bankAccountId: existingContract.bankAccountId,
        creditLine: existingContract.creditLine,
        contractNumber: existingContract.contractNumber ?? '',
        principalAmount: new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(existingContract.principalAmount),
        annualRate: String(existingContract.annualRate),
        amortizationSystem: existingContract.amortizationSystem,
        termMonths: String(existingContract.termMonths),
        gracePeriodMonths: String(existingContract.gracePeriodMonths),
        firstPaymentYear: String(existingContract.firstPaymentYear),
        firstPaymentMonth: String(existingContract.firstPaymentMonth),
        paymentDayOfMonth: String(existingContract.paymentDayOfMonth),
        releasedAt: existingContract.releasedAt.split('T')[0],
        iofAmount: existingContract.iofAmount
          ? new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(existingContract.iofAmount)
          : '',
        tacAmount: existingContract.tacAmount
          ? new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(existingContract.tacAmount)
          : '',
        alertDaysBefore: String(existingContract.alertDaysBefore),
        guaranteeDescription: existingContract.guaranteeDescription ?? '',
        notes: existingContract.notes ?? '',
      });
      setHasSimulated(true); // edit mode: allow save without re-simulation
    }
  }, [isEdit, existingContract]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSchedule(null); // reset simulation on form change
    setHasSimulated(false);
  }, []);

  const handleBlur = useCallback(
    (field: keyof FormState) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const newErrors = validate({ ...form, [field]: form[field] });
      setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
    },
    [form],
  );

  const handleSimulate = useCallback(async () => {
    const data: SimulateData = {
      principalAmount: parseCurrency(form.principalAmount),
      annualRate: parseFloat(form.annualRate),
      amortizationSystem: form.amortizationSystem,
      termMonths: parseInt(form.termMonths),
      gracePeriodMonths: parseInt(form.gracePeriodMonths) || 0,
      firstPaymentYear: parseInt(form.firstPaymentYear),
      firstPaymentMonth: parseInt(form.firstPaymentMonth),
      paymentDayOfMonth: parseInt(form.paymentDayOfMonth) || 1,
    };

    setSimulating(true);
    setSimError(null);
    try {
      const result = await simulateSchedule(data);
      setSchedule(result.schedule);
      setHasSimulated(true);
    } catch (err) {
      setSimError(
        err instanceof Error ? err.message : 'Nao foi possivel simular. Verifique os dados.',
      );
      setSchedule(null);
    } finally {
      setSimulating(false);
    }
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const allTouched: Partial<Record<keyof FormState, boolean>> = {};
    (Object.keys(form) as Array<keyof FormState>).forEach((k) => {
      allTouched[k] = true;
    });
    setTouched(allTouched);

    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const data: CreateContractData = {
        farmId: form.farmId,
        bankAccountId: form.bankAccountId,
        creditLine: form.creditLine,
        contractNumber: form.contractNumber || undefined,
        principalAmount: parseCurrency(form.principalAmount),
        annualRate: parseFloat(form.annualRate),
        amortizationSystem: form.amortizationSystem,
        termMonths: parseInt(form.termMonths),
        gracePeriodMonths: parseInt(form.gracePeriodMonths) || 0,
        firstPaymentYear: parseInt(form.firstPaymentYear),
        firstPaymentMonth: parseInt(form.firstPaymentMonth),
        paymentDayOfMonth: parseInt(form.paymentDayOfMonth) || 1,
        releasedAt: form.releasedAt,
        iofAmount: form.iofAmount ? parseCurrency(form.iofAmount) : undefined,
        tacAmount: form.tacAmount ? parseCurrency(form.tacAmount) : undefined,
        alertDaysBefore: parseInt(form.alertDaysBefore) || 15,
        guaranteeDescription: form.guaranteeDescription || undefined,
        notes: form.notes || undefined,
      };

      if (isEdit && contractId) {
        await updateContract(contractId, data);
      } else {
        await createContract(data);
      }
      onSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel salvar o contrato. Verifique sua conexao.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, isEdit, contractId, onSuccess]);

  if (!isOpen) return null;

  // Determine if simulation can be run (required fields are filled)
  const canSimulate =
    form.principalAmount &&
    form.annualRate &&
    form.amortizationSystem &&
    form.termMonths &&
    form.firstPaymentYear &&
    form.firstPaymentMonth;

  return (
    <div
      className="rcm__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rcm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rcm__panel">
        {/* Header */}
        <header className="rcm__header">
          <h2 id="rcm-title" className="rcm__title">
            {isEdit ? 'Editar contrato' : 'Novo contrato de credito rural'}
          </h2>
          <button
            type="button"
            className="rcm__close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="rcm__body">
          {submitError && (
            <div className="rcm__submit-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="rcm__grid">
            {/* Fazenda */}
            <div className="rcm__field">
              <label htmlFor="rcm-farm" className="rcm__label">
                Fazenda <span className="rcm__required">*</span>
              </label>
              <select
                id="rcm-farm"
                className={`rcm__select${touched.farmId && errors.farmId ? ' rcm__select--error' : ''}`}
                value={form.farmId}
                onChange={(e) => setField('farmId', e.target.value)}
                onBlur={() => handleBlur('farmId')}
                aria-required="true"
                aria-describedby={touched.farmId && errors.farmId ? 'rcm-farm-err' : undefined}
              >
                <option value="">Selecione...</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {touched.farmId && errors.farmId && (
                <span id="rcm-farm-err" className="rcm__field-error" role="alert">
                  {errors.farmId}
                </span>
              )}
            </div>

            {/* Conta bancaria */}
            <div className="rcm__field">
              <label htmlFor="rcm-bank" className="rcm__label">
                Conta bancaria <span className="rcm__required">*</span>
              </label>
              <select
                id="rcm-bank"
                className={`rcm__select${touched.bankAccountId && errors.bankAccountId ? ' rcm__select--error' : ''}`}
                value={form.bankAccountId}
                onChange={(e) => setField('bankAccountId', e.target.value)}
                onBlur={() => handleBlur('bankAccountId')}
                aria-required="true"
                aria-describedby={
                  touched.bankAccountId && errors.bankAccountId ? 'rcm-bank-err' : undefined
                }
              >
                <option value="">Selecione...</option>
                {filteredAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.bankName} — {a.name}
                  </option>
                ))}
              </select>
              {touched.bankAccountId && errors.bankAccountId && (
                <span id="rcm-bank-err" className="rcm__field-error" role="alert">
                  {errors.bankAccountId}
                </span>
              )}
            </div>

            {/* Linha de credito */}
            <div className="rcm__field">
              <label htmlFor="rcm-credit-line" className="rcm__label">
                Linha de credito <span className="rcm__required">*</span>
              </label>
              <select
                id="rcm-credit-line"
                className={`rcm__select${touched.creditLine && errors.creditLine ? ' rcm__select--error' : ''}`}
                value={form.creditLine}
                onChange={(e) => setField('creditLine', e.target.value)}
                onBlur={() => handleBlur('creditLine')}
                aria-required="true"
              >
                <option value="">Selecione...</option>
                {(Object.keys(CREDIT_LINE_LABELS) as RuralCreditLine[]).map((line) => (
                  <option key={line} value={line}>
                    {CREDIT_LINE_LABELS[line]}
                  </option>
                ))}
              </select>
              {touched.creditLine && errors.creditLine && (
                <span className="rcm__field-error" role="alert">
                  {errors.creditLine}
                </span>
              )}
            </div>

            {/* Numero do contrato */}
            <div className="rcm__field">
              <label htmlFor="rcm-contract-num" className="rcm__label">
                Numero do contrato
              </label>
              <input
                id="rcm-contract-num"
                type="text"
                className="rcm__input"
                value={form.contractNumber}
                onChange={(e) => setField('contractNumber', e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {/* Valor principal */}
            <div className="rcm__field">
              <label htmlFor="rcm-principal" className="rcm__label">
                Valor principal <span className="rcm__required">*</span>
              </label>
              <input
                id="rcm-principal"
                type="text"
                inputMode="numeric"
                className={`rcm__input rcm__input--mono${touched.principalAmount && errors.principalAmount ? ' rcm__input--error' : ''}`}
                value={form.principalAmount}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setField('principalAmount', formatted);
                }}
                onBlur={() => handleBlur('principalAmount')}
                aria-required="true"
                placeholder="0,00"
              />
              {touched.principalAmount && errors.principalAmount && (
                <span className="rcm__field-error" role="alert">
                  {errors.principalAmount}
                </span>
              )}
            </div>

            {/* Taxa anual */}
            <div className="rcm__field">
              <label htmlFor="rcm-rate" className="rcm__label">
                Taxa anual (% a.a.) <span className="rcm__required">*</span>
              </label>
              <input
                id="rcm-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className={`rcm__input${touched.annualRate && errors.annualRate ? ' rcm__input--error' : ''}`}
                value={form.annualRate}
                onChange={(e) => setField('annualRate', e.target.value)}
                onBlur={() => handleBlur('annualRate')}
                aria-required="true"
                placeholder="Ex: 6.5"
              />
              {touched.annualRate && errors.annualRate && (
                <span className="rcm__field-error" role="alert">
                  {errors.annualRate}
                </span>
              )}
            </div>

            {/* Sistema de amortizacao */}
            <div className="rcm__field">
              <label htmlFor="rcm-system" className="rcm__label">
                Sistema de amortizacao <span className="rcm__required">*</span>
              </label>
              <select
                id="rcm-system"
                className={`rcm__select${touched.amortizationSystem && errors.amortizationSystem ? ' rcm__select--error' : ''}`}
                value={form.amortizationSystem}
                onChange={(e) => setField('amortizationSystem', e.target.value)}
                onBlur={() => handleBlur('amortizationSystem')}
                aria-required="true"
              >
                <option value="">Selecione...</option>
                {(Object.keys(AMORTIZATION_LABELS) as AmortizationSystem[]).map((sys) => (
                  <option key={sys} value={sys}>
                    {AMORTIZATION_LABELS[sys]}
                  </option>
                ))}
              </select>
              {touched.amortizationSystem && errors.amortizationSystem && (
                <span className="rcm__field-error" role="alert">
                  {errors.amortizationSystem}
                </span>
              )}
            </div>

            {/* Prazo de amortizacao */}
            <div className="rcm__field">
              <label htmlFor="rcm-term" className="rcm__label">
                Prazo de amortizacao (meses) <span className="rcm__required">*</span>
              </label>
              <input
                id="rcm-term"
                type="number"
                min="1"
                className={`rcm__input${touched.termMonths && errors.termMonths ? ' rcm__input--error' : ''}`}
                value={form.termMonths}
                onChange={(e) => setField('termMonths', e.target.value)}
                onBlur={() => handleBlur('termMonths')}
                aria-required="true"
                placeholder="Ex: 60"
              />
              {touched.termMonths && errors.termMonths && (
                <span className="rcm__field-error" role="alert">
                  {errors.termMonths}
                </span>
              )}
            </div>

            {/* Carencia */}
            <div className="rcm__field">
              <label htmlFor="rcm-grace" className="rcm__label">
                Carencia (meses)
              </label>
              <input
                id="rcm-grace"
                type="number"
                min="0"
                className="rcm__input"
                value={form.gracePeriodMonths}
                onChange={(e) => setField('gracePeriodMonths', e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Ano primeira parcela */}
            <div className="rcm__field">
              <label htmlFor="rcm-year" className="rcm__label">
                Ano primeira parcela <span className="rcm__required">*</span>
              </label>
              <input
                id="rcm-year"
                type="number"
                min="2020"
                max="2050"
                className={`rcm__input${touched.firstPaymentYear && errors.firstPaymentYear ? ' rcm__input--error' : ''}`}
                value={form.firstPaymentYear}
                onChange={(e) => setField('firstPaymentYear', e.target.value)}
                onBlur={() => handleBlur('firstPaymentYear')}
                aria-required="true"
              />
              {touched.firstPaymentYear && errors.firstPaymentYear && (
                <span className="rcm__field-error" role="alert">
                  {errors.firstPaymentYear}
                </span>
              )}
            </div>

            {/* Mes primeira parcela */}
            <div className="rcm__field">
              <label htmlFor="rcm-month" className="rcm__label">
                Mes primeira parcela <span className="rcm__required">*</span>
              </label>
              <select
                id="rcm-month"
                className={`rcm__select${touched.firstPaymentMonth && errors.firstPaymentMonth ? ' rcm__select--error' : ''}`}
                value={form.firstPaymentMonth}
                onChange={(e) => setField('firstPaymentMonth', e.target.value)}
                onBlur={() => handleBlur('firstPaymentMonth')}
                aria-required="true"
              >
                <option value="">Selecione...</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </select>
              {touched.firstPaymentMonth && errors.firstPaymentMonth && (
                <span className="rcm__field-error" role="alert">
                  {errors.firstPaymentMonth}
                </span>
              )}
            </div>

            {/* Dia vencimento */}
            <div className="rcm__field">
              <label htmlFor="rcm-day" className="rcm__label">
                Dia de vencimento
              </label>
              <input
                id="rcm-day"
                type="number"
                min="1"
                max="31"
                className="rcm__input"
                value={form.paymentDayOfMonth}
                onChange={(e) => setField('paymentDayOfMonth', e.target.value)}
                placeholder="1"
              />
            </div>

            {/* Data de liberacao */}
            <div className="rcm__field">
              <label htmlFor="rcm-released" className="rcm__label">
                Data de liberacao <span className="rcm__required">*</span>
              </label>
              <input
                id="rcm-released"
                type="date"
                className={`rcm__input${touched.releasedAt && errors.releasedAt ? ' rcm__input--error' : ''}`}
                value={form.releasedAt}
                onChange={(e) => setField('releasedAt', e.target.value)}
                onBlur={() => handleBlur('releasedAt')}
                aria-required="true"
              />
              {touched.releasedAt && errors.releasedAt && (
                <span className="rcm__field-error" role="alert">
                  {errors.releasedAt}
                </span>
              )}
            </div>

            {/* IOF */}
            <div className="rcm__field">
              <label htmlFor="rcm-iof" className="rcm__label">
                IOF
              </label>
              <input
                id="rcm-iof"
                type="text"
                inputMode="numeric"
                className="rcm__input rcm__input--mono"
                value={form.iofAmount}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setField('iofAmount', formatted);
                }}
                placeholder="0,00"
              />
            </div>

            {/* TAC */}
            <div className="rcm__field">
              <label htmlFor="rcm-tac" className="rcm__label">
                TAC
              </label>
              <input
                id="rcm-tac"
                type="text"
                inputMode="numeric"
                className="rcm__input rcm__input--mono"
                value={form.tacAmount}
                onChange={(e) => {
                  const formatted = formatCurrencyInput(e.target.value);
                  setField('tacAmount', formatted);
                }}
                placeholder="0,00"
              />
            </div>

            {/* Antecedencia alerta */}
            <div className="rcm__field">
              <label htmlFor="rcm-alert" className="rcm__label">
                Antecedencia alerta (dias)
              </label>
              <input
                id="rcm-alert"
                type="number"
                min="1"
                className="rcm__input"
                value={form.alertDaysBefore}
                onChange={(e) => setField('alertDaysBefore', e.target.value)}
              />
            </div>
          </div>

          {/* Garantia */}
          <div className="rcm__field rcm__field--full">
            <label htmlFor="rcm-guarantee" className="rcm__label">
              Garantia
            </label>
            <textarea
              id="rcm-guarantee"
              className="rcm__textarea"
              value={form.guaranteeDescription}
              onChange={(e) => setField('guaranteeDescription', e.target.value)}
              placeholder="Descreva as garantias do contrato..."
              rows={3}
            />
          </div>

          {/* Observacoes */}
          <div className="rcm__field rcm__field--full">
            <label htmlFor="rcm-notes" className="rcm__label">
              Observacoes
            </label>
            <textarea
              id="rcm-notes"
              className="rcm__textarea"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Observacoes adicionais..."
              rows={2}
            />
          </div>

          {/* Simulate button */}
          <div className="rcm__simulate-section">
            <button
              type="button"
              className="rcm__btn-secondary"
              onClick={() => void handleSimulate()}
              disabled={!canSimulate || simulating}
              aria-busy={simulating}
            >
              {simulating && <Loader2 size={16} className="rcm__spinner" aria-hidden="true" />}
              Simular cronograma
            </button>
            {simError && (
              <span className="rcm__sim-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {simError}
              </span>
            )}
          </div>

          {/* Schedule preview */}
          {schedule && schedule.length > 0 && (
            <div className="rcm__schedule-wrap">
              <SchedulePreviewTable
                schedule={schedule}
                principalAmount={parseCurrency(form.principalAmount)}
                gracePeriodMonths={parseInt(form.gracePeriodMonths) || 0}
              />
            </div>
          )}

          {!hasSimulated && !isEdit && (
            <p className="rcm__simulate-hint">Simule o cronograma antes de salvar o contrato.</p>
          )}
        </div>

        {/* Footer */}
        <footer className="rcm__footer">
          <button type="button" className="rcm__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="rcm__btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || (!hasSimulated && !isEdit)}
            aria-busy={submitting}
          >
            {submitting && <Loader2 size={16} className="rcm__spinner" aria-hidden="true" />}
            {isEdit ? 'Atualizar contrato' : 'Salvar contrato'}
          </button>
        </footer>
      </div>
    </div>
  );
}
