import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Employee } from '@/types/employee';
import type { CreateTimeEntryInput } from '@/types/attendance';

// Employee imported for the employees list prop type

interface ManualPunchModalProps {
  isOpen: boolean;
  employees: Employee[];
  onSave: (employeeId: string, data: CreateTimeEntryInput) => Promise<boolean>;
  onClose: () => void;
}

interface FormErrors {
  employeeId?: string;
  farmId?: string;
  date?: string;
  clockIn?: string;
  justification?: string;
}

const PUNCH_TYPES = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'INTERVALO_INICIO', label: 'Início de Intervalo' },
  { value: 'INTERVALO_FIM', label: 'Fim de Intervalo' },
];

export default function ManualPunchModal({ isOpen, employees, onSave, onClose }: ManualPunchModalProps) {
  const firstInputRef = useRef<HTMLSelectElement>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [punchType, setPunchType] = useState('ENTRADA');
  const [time, setTime] = useState('');
  const [justification, setJustification] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    } else {
      setEmployeeId('');
      setDate(new Date().toISOString().split('T')[0]);
      setPunchType('ENTRADA');
      setTime('');
      setJustification('');
      setErrors({});
      setTouched({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!employeeId) errs.employeeId = 'Selecione um colaborador';
    if (!date) errs.date = 'Informe a data';
    if (!time) errs.clockIn = 'Informe o horário';
    if (time && !/^\d{2}:\d{2}$/.test(time)) errs.clockIn = 'Formato inválido (HH:MM)';
    if (!justification || justification.trim().length < 10)
      errs.justification = 'Justificativa deve ter no mínimo 10 caracteres';
    return errs;
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors(errs);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ employeeId: true, date: true, clockIn: true, justification: true });
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      const data: CreateTimeEntryInput = {
        date,
        clockIn: `${date}T${time}:00`,
        source: 'MANAGER',
        managerNote: justification,
        farmId: '',
      };
      const success = await onSave(employeeId, data);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="manual-punch-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-punch-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="manual-punch-modal">
        <header className="manual-punch-modal__header">
          <h2 id="manual-punch-title" className="manual-punch-modal__title">
            Registrar Ponto Manual
          </h2>
          <button
            type="button"
            className="manual-punch-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="manual-punch-modal__form" onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="manual-punch-modal__body">
            {/* Colaborador */}
            <div className="manual-punch-modal__field">
              <label htmlFor="punch-employee" className="manual-punch-modal__label">
                Colaborador <span aria-hidden="true">*</span>
              </label>
              <select
                id="punch-employee"
                ref={firstInputRef}
                className={`manual-punch-modal__select ${touched.employeeId && errors.employeeId ? 'manual-punch-modal__select--error' : ''}`}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                onBlur={() => handleBlur('employeeId')}
                aria-required="true"
                aria-describedby={touched.employeeId && errors.employeeId ? 'punch-employee-error' : undefined}
              >
                <option value="">Selecione o colaborador...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              {touched.employeeId && errors.employeeId && (
                <span id="punch-employee-error" className="manual-punch-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.employeeId}
                </span>
              )}
            </div>

            {/* Data */}
            <div className="manual-punch-modal__field">
              <label htmlFor="punch-date" className="manual-punch-modal__label">
                Data <span aria-hidden="true">*</span>
              </label>
              <input
                id="punch-date"
                type="date"
                className={`manual-punch-modal__input ${touched.date && errors.date ? 'manual-punch-modal__input--error' : ''}`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onBlur={() => handleBlur('date')}
                aria-required="true"
                aria-describedby={touched.date && errors.date ? 'punch-date-error' : undefined}
              />
              {touched.date && errors.date && (
                <span id="punch-date-error" className="manual-punch-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.date}
                </span>
              )}
            </div>

            {/* Tipo */}
            <div className="manual-punch-modal__field">
              <label htmlFor="punch-type" className="manual-punch-modal__label">
                Tipo <span aria-hidden="true">*</span>
              </label>
              <select
                id="punch-type"
                className="manual-punch-modal__select"
                value={punchType}
                onChange={(e) => setPunchType(e.target.value)}
                aria-required="true"
              >
                {PUNCH_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Horário */}
            <div className="manual-punch-modal__field">
              <label htmlFor="punch-time" className="manual-punch-modal__label">
                Horário <span aria-hidden="true">*</span>
              </label>
              <input
                id="punch-time"
                type="time"
                className={`manual-punch-modal__input manual-punch-modal__input--mono ${touched.clockIn && errors.clockIn ? 'manual-punch-modal__input--error' : ''}`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onBlur={() => handleBlur('clockIn')}
                aria-required="true"
                aria-describedby={touched.clockIn && errors.clockIn ? 'punch-time-error' : undefined}
              />
              {touched.clockIn && errors.clockIn && (
                <span id="punch-time-error" className="manual-punch-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.clockIn}
                </span>
              )}
            </div>

            {/* Justificativa */}
            <div className="manual-punch-modal__field manual-punch-modal__field--full">
              <label htmlFor="punch-justification" className="manual-punch-modal__label">
                Justificativa <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="punch-justification"
                className={`manual-punch-modal__textarea ${touched.justification && errors.justification ? 'manual-punch-modal__textarea--error' : ''}`}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                onBlur={() => handleBlur('justification')}
                rows={3}
                placeholder="Descreva o motivo do registro manual (mínimo 10 caracteres)"
                aria-required="true"
                aria-describedby={touched.justification && errors.justification ? 'punch-justification-error' : undefined}
              />
              <div className="manual-punch-modal__char-count">
                {justification.length} caracteres
              </div>
              {touched.justification && errors.justification && (
                <span id="punch-justification-error" className="manual-punch-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.justification}
                </span>
              )}
            </div>
          </div>

          <footer className="manual-punch-modal__footer">
            <button
              type="button"
              className="manual-punch-modal__btn manual-punch-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="manual-punch-modal__btn manual-punch-modal__btn--primary"
              disabled={isSubmitting}
              aria-label="Salvar registro de ponto"
            >
              {isSubmitting ? 'Salvando...' : 'Registrar Ponto'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
