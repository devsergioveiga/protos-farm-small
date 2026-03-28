import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { PayrollRunType, WizardEmployeePreview } from '@/types/payroll-runs';
import { RUN_TYPE_LABELS } from '@/types/payroll-runs';
import './PayrollRunWizard.css';

const MONTH_OPTIONS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const RUN_TYPES: PayrollRunType[] = ['MONTHLY', 'ADVANCE', 'THIRTEENTH_FIRST', 'THIRTEENTH_SECOND'];

type Step = 1 | 2 | 3 | 4;

interface PayrollRunWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRun: (data: {
    referenceMonth: string;
    runType: PayrollRunType;
    notes?: string;
  }) => Promise<{ id: string } | null>;
  onGetPreview: (runId: string) => Promise<WizardEmployeePreview[]>;
  onProcessRun: (runId: string, employeeIds: string[]) => Promise<unknown>;
  onSuccess: () => void;
}

export default function PayrollRunWizard({
  isOpen,
  onClose,
  onCreateRun,
  onGetPreview,
  onProcessRun,
  onSuccess,
}: PayrollRunWizardProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initiateButtonRef = useRef<HTMLButtonElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [step, setStep] = useState<Step>(1);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [runType, setRunType] = useState<PayrollRunType>('MONTHLY');
  const [notes, setNotes] = useState('');

  const [createdRunId, setCreatedRunId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<WizardEmployeePreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [loadingStep, setLoadingStep] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processTotal, setProcessTotal] = useState(0);

  const referenceMonth = `${selectedYear}-${selectedMonth}`;

  function resetWizard() {
    setStep(1);
    setSelectedMonth(currentMonth);
    setSelectedYear(String(currentYear));
    setRunType('MONTHLY');
    setNotes('');
    setCreatedRunId(null);
    setEmployees([]);
    setSelectedIds(new Set());
    setLoadingStep(false);
    setErrorMsg(null);
  }

  function handleClose() {
    if (step === 4) return; // Cannot cancel while processing
    resetWizard();
    onClose();
  }

  // Focus trap + Escape handling
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && step !== 4) {
        handleClose();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus first element on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), select, input',
        );
        focusable?.focus();
      }, 100);
    }
  }, [isOpen, step]);

  const handleStep1Next = useCallback(async () => {
    setErrorMsg(null);
    setLoadingStep(true);
    try {
      const result = await onCreateRun({ referenceMonth, runType, notes: notes || undefined });
      if (!result) {
        setErrorMsg('Não foi possível criar a folha. Tente novamente.');
        setLoadingStep(false);
        return;
      }
      setCreatedRunId(result.id);

      const preview = await onGetPreview(result.id);
      setEmployees(preview);

      // Pre-select eligible employees
      const eligibleIds = new Set(preview.filter((e) => e.eligible).map((e) => e.id));
      setSelectedIds(eligibleIds);

      setStep(2);
    } catch {
      setErrorMsg('Erro ao carregar colaboradores. Tente novamente.');
    } finally {
      setLoadingStep(false);
    }
  }, [referenceMonth, runType, notes, onCreateRun, onGetPreview]);

  function handleStep2Next() {
    setErrorMsg(null);
    if (selectedIds.size === 0) {
      setErrorMsg('Selecione pelo menos um colaborador para processar.');
      return;
    }
    setStep(3);
  }

  const handleProcess = useCallback(async () => {
    if (!createdRunId) return;
    setStep(4);
    setErrorMsg(null);
    setProcessTotal(selectedIds.size);
    try {
      await onProcessRun(createdRunId, Array.from(selectedIds));
      // Success
      setTimeout(() => {
        resetWizard();
        onClose();
        onSuccess();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar folha';
      setErrorMsg(message);
      setStep(3); // Allow retry
    }
  }, [createdRunId, selectedIds, onProcessRun, onClose, onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const approvedCount = employees.filter((e) => e.timesheetStatus === 'APPROVED').length;

  const yearOptions = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ];

  if (!isOpen) return null;

  return (
    <div
      className="payroll-wizard__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 4) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="payroll-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-wizard-title"
      >
        {/* Step indicator */}
        <div className="payroll-wizard__steps">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={`payroll-wizard__step-dot ${
                s < step
                  ? 'payroll-wizard__step-dot--completed'
                  : s === step
                    ? 'payroll-wizard__step-dot--active'
                    : 'payroll-wizard__step-dot--future'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Step label */}
        <div className="payroll-wizard__step-label">
          {step === 1 && 'Competência'}
          {step === 2 && 'Colaboradores'}
          {step === 3 && 'Confirmação'}
          {step === 4 && 'Processando'}
        </div>

        {/* Header */}
        <div className="payroll-wizard__header">
          <h2 id="payroll-wizard-title" className="payroll-wizard__title">
            {step === 1 && 'Iniciar Folha de Pagamento'}
            {step === 2 && 'Colaboradores Elegíveis'}
            {step === 3 && 'Confirmar Processamento'}
            {step === 4 && 'Processando Folha'}
          </h2>
          {step !== 4 && (
            <button
              ref={initiateButtonRef}
              type="button"
              className="payroll-wizard__close-btn"
              onClick={handleClose}
              aria-label="Cancelar e fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="payroll-wizard__body">
          {errorMsg && (
            <div className="payroll-wizard__error" role="alert" aria-live="polite">
              <AlertTriangle size={16} aria-hidden="true" />
              {errorMsg}
            </div>
          )}

          {/* Step 1: Competencia */}
          {step === 1 && (
            <div className="payroll-wizard__step-content">
              <div className="payroll-wizard__field-group">
                <label className="payroll-wizard__label" htmlFor="wizard-month">
                  Mês *
                </label>
                <select
                  id="wizard-month"
                  className="payroll-wizard__select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  aria-required="true"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="payroll-wizard__field-group">
                <label className="payroll-wizard__label" htmlFor="wizard-year">
                  Ano *
                </label>
                <select
                  id="wizard-year"
                  className="payroll-wizard__select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-required="true"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="payroll-wizard__fieldset">
                <legend className="payroll-wizard__label">Tipo de Folha *</legend>
                {RUN_TYPES.map((type) => (
                  <label key={type} className="payroll-wizard__radio-label">
                    <input
                      type="radio"
                      name="runType"
                      value={type}
                      checked={runType === type}
                      onChange={() => setRunType(type)}
                      className="payroll-wizard__radio"
                    />
                    {RUN_TYPE_LABELS[type]}
                  </label>
                ))}
              </fieldset>

              <div className="payroll-wizard__field-group">
                <label className="payroll-wizard__label" htmlFor="wizard-notes">
                  Observações
                </label>
                <textarea
                  id="wizard-notes"
                  className="payroll-wizard__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas opcionais sobre esta folha"
                />
              </div>
            </div>
          )}

          {/* Step 2: Colaboradores preview */}
          {step === 2 && (
            <div className="payroll-wizard__step-content">
              <p className="payroll-wizard__counter">
                <strong>{approvedCount}</strong> de <strong>{employees.length}</strong>{' '}
                colaboradores com espelho aprovado
              </p>
              <ul className="payroll-wizard__employee-list" role="list">
                {employees.map((emp) => (
                  <li key={emp.id} className="payroll-wizard__employee-item">
                    <span className="payroll-wizard__employee-name">{emp.name}</span>
                    <span className="payroll-wizard__employee-salary">
                      {emp.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {emp.timesheetStatus === 'APPROVED' ? (
                      <span className="payroll-wizard__ts-chip payroll-wizard__ts-chip--approved">
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Aprovado
                      </span>
                    ) : (
                      <span className="payroll-wizard__ts-chip payroll-wizard__ts-chip--pending">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Pendente
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 3: Confirmation checkbox list */}
          {step === 3 && (
            <div className="payroll-wizard__step-content">
              <p className="payroll-wizard__counter">
                <strong>{selectedIds.size}</strong> colaboradores serão processados
              </p>
              {employees.some((e) => !e.eligible) && (
                <p className="payroll-wizard__note">
                  Colaboradores sem espelho aprovado não entram no processamento. Você poderá
                  incluí-los via recálculo individual.
                </p>
              )}
              <ul className="payroll-wizard__check-list" role="list">
                {employees.map((emp) => (
                  <li key={emp.id} className="payroll-wizard__check-item">
                    <label
                      className={`payroll-wizard__check-label${!emp.eligible ? ' payroll-wizard__check-label--disabled' : ''}`}
                      title={!emp.eligible ? 'Espelho de ponto não aprovado' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => emp.eligible && toggleEmployee(emp.id)}
                        disabled={!emp.eligible}
                        aria-disabled={!emp.eligible}
                        className="payroll-wizard__checkbox"
                      />
                      <span className="payroll-wizard__check-name">{emp.name}</span>
                      <span className="payroll-wizard__check-salary">
                        {emp.salary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {!emp.eligible && (
                        <span className="payroll-wizard__ineligible-tag">
                          <AlertTriangle size={12} aria-hidden="true" />
                          Sem espelho
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 4: Processing */}
          {step === 4 && (
            <div className="payroll-wizard__processing">
              {!errorMsg ? (
                <>
                  <Loader2
                    size={48}
                    className="payroll-wizard__processing-spinner"
                    aria-hidden="true"
                  />
                  <p className="payroll-wizard__processing-text">
                    Processando {processTotal} colaborador{processTotal !== 1 ? 'es' : ''}...
                  </p>
                  <p className="payroll-wizard__processing-sub">
                    Aguarde enquanto calculamos a folha de pagamento.
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle
                    size={48}
                    className="payroll-wizard__processing-error-icon"
                    aria-hidden="true"
                  />
                  <p className="payroll-wizard__processing-text">Erro ao processar folha</p>
                  <p className="payroll-wizard__processing-sub">{errorMsg}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 4 && (
          <div className="payroll-wizard__footer">
            <div className="payroll-wizard__footer-left">
              {step === 1 ? (
                <button
                  type="button"
                  className="payroll-wizard__btn payroll-wizard__btn--text"
                  onClick={handleClose}
                >
                  Cancelar
                </button>
              ) : (
                <button
                  type="button"
                  className="payroll-wizard__btn payroll-wizard__btn--secondary"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep((prev) => (prev - 1) as Step);
                  }}
                  disabled={loadingStep}
                >
                  Voltar
                </button>
              )}
            </div>
            <div className="payroll-wizard__footer-right">
              {step === 1 && (
                <button
                  type="button"
                  className="payroll-wizard__btn payroll-wizard__btn--primary"
                  onClick={handleStep1Next}
                  disabled={loadingStep}
                >
                  {loadingStep ? (
                    <>
                      <Loader2
                        size={16}
                        className="payroll-wizard__btn-spinner"
                        aria-hidden="true"
                      />
                      Carregando...
                    </>
                  ) : (
                    'Próximo'
                  )}
                </button>
              )}
              {step === 2 && (
                <button
                  type="button"
                  className="payroll-wizard__btn payroll-wizard__btn--primary"
                  onClick={handleStep2Next}
                >
                  Próximo
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  className="payroll-wizard__btn payroll-wizard__btn--primary"
                  onClick={handleProcess}
                  disabled={selectedIds.size === 0}
                >
                  Processar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
