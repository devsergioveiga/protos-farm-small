import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { useSalaryAdvances } from '@/hooks/useSalaryAdvances';
import './SalaryAdvanceModal.css';

interface SalaryAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  mode: 'individual' | 'batch';
  onSuccess?: () => void;
}

interface IndividualFormErrors {
  employeeId?: string;
  referenceMonth?: string;
  amount?: string;
  advanceDate?: string;
}

interface BatchFormErrors {
  referenceMonth?: string;
  advanceDate?: string;
  percentOfSalary?: string;
}

export default function SalaryAdvanceModal({
  isOpen,
  onClose,
  mode,
  onSuccess,
}: SalaryAdvanceModalProps) {
  const { createAdvance, createBatchAdvances } = useSalaryAdvances();
  const { employees } = useEmployees({ status: 'ATIVO', limit: 500 });

  const firstFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  // Individual form state
  const [employeeId, setEmployeeId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [individualErrors, setIndividualErrors] = useState<IndividualFormErrors>({});

  // Batch form state
  const [batchReferenceMonth, setBatchReferenceMonth] = useState('');
  const [batchAdvanceDate, setBatchAdvanceDate] = useState('');
  const [percentOfSalary, setPercentOfSalary] = useState('40');
  const [batchErrors, setBatchErrors] = useState<BatchFormErrors>({});

  // Shared state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Capture trigger for focus return
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      setTimeout(() => {
        (firstFieldRef.current as HTMLElement | null)?.focus();
      }, 50);
    } else {
      (triggerRef.current as HTMLElement | null)?.focus();
    }
  }, [isOpen]);

  // Set default batch advance date to 15th of current month on open
  useEffect(() => {
    if (isOpen && mode === 'batch') {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      setBatchReferenceMonth(`${yyyy}-${mm}`);
      setBatchAdvanceDate(`${yyyy}-${mm}-15`);
    }
  }, [isOpen, mode]);

  // Keyboard: Escape closes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function resetState() {
    setEmployeeId('');
    setReferenceMonth('');
    setAmount('');
    setAdvanceDate('');
    setNotes('');
    setIndividualErrors({});
    setBatchReferenceMonth('');
    setBatchAdvanceDate('');
    setPercentOfSalary('40');
    setBatchErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  // ── Individual validation ──────────────────────────────────────────

  function validateIndividualField(field: keyof IndividualFormErrors, value: string) {
    const errors: IndividualFormErrors = { ...individualErrors };
    if (field === 'employeeId') {
      errors.employeeId = value ? undefined : 'Selecione um colaborador';
    } else if (field === 'referenceMonth') {
      errors.referenceMonth = value ? undefined : 'Informe a competencia';
    } else if (field === 'amount') {
      const n = parseFloat(value);
      if (!value) errors.amount = 'Informe o valor';
      else if (isNaN(n) || n <= 0) errors.amount = 'O valor deve ser maior que zero';
      else errors.amount = undefined;
    } else if (field === 'advanceDate') {
      errors.advanceDate = value ? undefined : 'Informe a data do adiantamento';
    }
    setIndividualErrors(errors);
  }

  function validateAllIndividual(): boolean {
    const errors: IndividualFormErrors = {};
    if (!employeeId) errors.employeeId = 'Selecione um colaborador';
    if (!referenceMonth) errors.referenceMonth = 'Informe a competencia';
    const n = parseFloat(amount);
    if (!amount) errors.amount = 'Informe o valor';
    else if (isNaN(n) || n <= 0) errors.amount = 'O valor deve ser maior que zero';
    if (!advanceDate) errors.advanceDate = 'Informe a data do adiantamento';
    setIndividualErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Batch validation ───────────────────────────────────────────────

  function validateBatchField(field: keyof BatchFormErrors, value: string) {
    const errors: BatchFormErrors = { ...batchErrors };
    if (field === 'referenceMonth') {
      errors.referenceMonth = value ? undefined : 'Informe a competencia';
    } else if (field === 'advanceDate') {
      errors.advanceDate = value ? undefined : 'Informe a data do adiantamento';
    } else if (field === 'percentOfSalary') {
      const n = parseFloat(value);
      if (!value) errors.percentOfSalary = 'Informe o percentual';
      else if (isNaN(n) || n < 1 || n > 100)
        errors.percentOfSalary = 'O percentual deve estar entre 1 e 100';
      else errors.percentOfSalary = undefined;
    }
    setBatchErrors(errors);
  }

  function validateAllBatch(): boolean {
    const errors: BatchFormErrors = {};
    if (!batchReferenceMonth) errors.referenceMonth = 'Informe a competencia';
    if (!batchAdvanceDate) errors.advanceDate = 'Informe a data do adiantamento';
    const n = parseFloat(percentOfSalary);
    if (!percentOfSalary) errors.percentOfSalary = 'Informe o percentual';
    else if (isNaN(n) || n < 1 || n > 100)
      errors.percentOfSalary = 'O percentual deve estar entre 1 e 100';
    setBatchErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (mode === 'individual') {
      if (!validateAllIndividual()) return;
      setIsSubmitting(true);
      try {
        const result = await createAdvance({
          employeeId,
          referenceMonth,
          amount: parseFloat(amount),
          advanceDate,
          notes: notes || undefined,
        });
        if (result) {
          setSuccessMessage('Adiantamento registrado. Recibo disponivel para download.');
          setTimeout(() => {
            resetState();
            onSuccess?.();
            onClose();
          }, 1500);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar adiantamento';
        if (msg.toLowerCase().includes('limit') || msg.toLowerCase().includes('limite')) {
          setSubmitError('Valor excede o limite configurado');
        } else {
          setSubmitError(msg);
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!validateAllBatch()) return;
      setIsSubmitting(true);
      try {
        const result = await createBatchAdvances({
          referenceMonth: batchReferenceMonth,
          advanceDate: batchAdvanceDate,
          percentOfSalary: parseFloat(percentOfSalary),
        });
        if (result) {
          const count = result.count ?? result.advances?.length ?? 0;
          setSuccessMessage(
            `Adiantamento em lote registrado para ${count} colaboradores.`,
          );
          setTimeout(() => {
            resetState();
            onSuccess?.();
            onClose();
          }, 1500);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar adiantamento em lote';
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="salary-advance-modal__backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="salary-advance-modal-title"
        className="salary-advance-modal"
      >
        {/* Header */}
        <div className="salary-advance-modal__header">
          <h2 id="salary-advance-modal-title" className="salary-advance-modal__title">
            {mode === 'individual' ? 'Registrar Adiantamento Individual' : 'Adiantamento em Lote'}
          </h2>
          <button
            type="button"
            className="salary-advance-modal__close"
            onClick={handleClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form
          id="salary-advance-form"
          className="salary-advance-modal__body"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          {/* Success message */}
          {successMessage && (
            <div className="salary-advance-modal__success" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="salary-advance-modal__error-banner" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {mode === 'individual' ? (
            <>
              {/* Employee select */}
              <div className="salary-advance-modal__field">
                <label htmlFor="advance-employee" className="salary-advance-modal__label">
                  Colaborador <span aria-hidden="true">*</span>
                </label>
                <select
                  id="advance-employee"
                  ref={firstFieldRef as React.RefObject<HTMLSelectElement>}
                  className={`salary-advance-modal__select${individualErrors.employeeId ? ' salary-advance-modal__select--error' : ''}`}
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  onBlur={(e) => validateIndividualField('employeeId', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    individualErrors.employeeId ? 'advance-employee-error' : undefined
                  }
                >
                  <option value="">Selecione um colaborador</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                {individualErrors.employeeId && (
                  <span
                    id="advance-employee-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {individualErrors.employeeId}
                  </span>
                )}
              </div>

              {/* Reference month */}
              <div className="salary-advance-modal__field">
                <label htmlFor="advance-ref-month" className="salary-advance-modal__label">
                  Competencia (mes/ano) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="advance-ref-month"
                  type="month"
                  className={`salary-advance-modal__input${individualErrors.referenceMonth ? ' salary-advance-modal__input--error' : ''}`}
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                  onBlur={(e) => validateIndividualField('referenceMonth', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    individualErrors.referenceMonth ? 'advance-ref-month-error' : undefined
                  }
                />
                {individualErrors.referenceMonth && (
                  <span
                    id="advance-ref-month-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {individualErrors.referenceMonth}
                  </span>
                )}
              </div>

              {/* Amount */}
              <div className="salary-advance-modal__field">
                <label htmlFor="advance-amount" className="salary-advance-modal__label">
                  Valor (R$) <span aria-hidden="true">*</span>
                </label>
                <div className="salary-advance-modal__amount-wrapper">
                  <span className="salary-advance-modal__amount-prefix" aria-hidden="true">
                    R$
                  </span>
                  <input
                    id="advance-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={`salary-advance-modal__input salary-advance-modal__input--amount${individualErrors.amount ? ' salary-advance-modal__input--error' : ''}`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={(e) => validateIndividualField('amount', e.target.value)}
                    placeholder="0,00"
                    aria-required="true"
                    aria-describedby={
                      individualErrors.amount ? 'advance-amount-error' : undefined
                    }
                  />
                </div>
                {individualErrors.amount && (
                  <span
                    id="advance-amount-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {individualErrors.amount}
                  </span>
                )}
              </div>

              {/* Advance date */}
              <div className="salary-advance-modal__field">
                <label htmlFor="advance-date" className="salary-advance-modal__label">
                  Data do adiantamento <span aria-hidden="true">*</span>
                </label>
                <input
                  id="advance-date"
                  type="date"
                  className={`salary-advance-modal__input${individualErrors.advanceDate ? ' salary-advance-modal__input--error' : ''}`}
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  onBlur={(e) => validateIndividualField('advanceDate', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    individualErrors.advanceDate ? 'advance-date-error' : undefined
                  }
                />
                {individualErrors.advanceDate && (
                  <span
                    id="advance-date-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {individualErrors.advanceDate}
                  </span>
                )}
              </div>

              {/* Notes (optional) */}
              <div className="salary-advance-modal__field">
                <label htmlFor="advance-notes" className="salary-advance-modal__label">
                  Observacoes
                </label>
                <textarea
                  id="advance-notes"
                  className="salary-advance-modal__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Observacoes opcionais sobre o adiantamento"
                />
              </div>
            </>
          ) : (
            <>
              {/* Batch summary */}
              <p className="salary-advance-modal__batch-summary">
                Sera criado adiantamento de{' '}
                <strong>{percentOfSalary || '40'}%</strong> do salario para todos os
                colaboradores ativos.
              </p>

              {/* Batch reference month */}
              <div className="salary-advance-modal__field">
                <label htmlFor="batch-ref-month" className="salary-advance-modal__label">
                  Competencia (mes/ano) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="batch-ref-month"
                  ref={firstFieldRef as React.RefObject<HTMLInputElement>}
                  type="month"
                  className={`salary-advance-modal__input${batchErrors.referenceMonth ? ' salary-advance-modal__input--error' : ''}`}
                  value={batchReferenceMonth}
                  onChange={(e) => setBatchReferenceMonth(e.target.value)}
                  onBlur={(e) => validateBatchField('referenceMonth', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    batchErrors.referenceMonth ? 'batch-ref-month-error' : undefined
                  }
                />
                {batchErrors.referenceMonth && (
                  <span
                    id="batch-ref-month-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {batchErrors.referenceMonth}
                  </span>
                )}
              </div>

              {/* Batch advance date */}
              <div className="salary-advance-modal__field">
                <label htmlFor="batch-advance-date" className="salary-advance-modal__label">
                  Data do adiantamento <span aria-hidden="true">*</span>
                </label>
                <input
                  id="batch-advance-date"
                  type="date"
                  className={`salary-advance-modal__input${batchErrors.advanceDate ? ' salary-advance-modal__input--error' : ''}`}
                  value={batchAdvanceDate}
                  onChange={(e) => setBatchAdvanceDate(e.target.value)}
                  onBlur={(e) => validateBatchField('advanceDate', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    batchErrors.advanceDate ? 'batch-advance-date-error' : undefined
                  }
                />
                {batchErrors.advanceDate && (
                  <span
                    id="batch-advance-date-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {batchErrors.advanceDate}
                  </span>
                )}
              </div>

              {/* Percent of salary */}
              <div className="salary-advance-modal__field">
                <label htmlFor="batch-percent" className="salary-advance-modal__label">
                  Percentual do salario (%) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="batch-percent"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  className={`salary-advance-modal__input${batchErrors.percentOfSalary ? ' salary-advance-modal__input--error' : ''}`}
                  value={percentOfSalary}
                  onChange={(e) => setPercentOfSalary(e.target.value)}
                  onBlur={(e) => validateBatchField('percentOfSalary', e.target.value)}
                  aria-required="true"
                  aria-describedby={
                    batchErrors.percentOfSalary ? 'batch-percent-error' : undefined
                  }
                />
                {batchErrors.percentOfSalary && (
                  <span
                    id="batch-percent-error"
                    className="salary-advance-modal__field-error"
                    role="alert"
                  >
                    {batchErrors.percentOfSalary}
                  </span>
                )}
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="salary-advance-modal__footer">
          <button
            type="button"
            className="salary-advance-modal__btn-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="salary-advance-form"
            className="salary-advance-modal__btn-primary"
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? 'Registrando...' : 'Registrar Adiantamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
