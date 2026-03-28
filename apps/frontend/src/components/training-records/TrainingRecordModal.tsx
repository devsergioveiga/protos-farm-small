import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X, AlertTriangle } from 'lucide-react';
import type { TrainingType, CreateTrainingRecordInput } from '@/types/training';
import { INSTRUCTOR_TYPE_LABELS } from '@/types/training';
import './TrainingRecordModal.css';

interface Employee {
  id: string;
  name: string;
  positionName: string | null;
}

interface Props {
  isOpen: boolean;
  trainingTypes: TrainingType[];
  employees: Employee[];
  onClose: () => void;
  onSave: (input: CreateTrainingRecordInput) => Promise<boolean>;
}

type Step = 1 | 2;

interface Step1Form {
  trainingTypeId: string;
  date: string;
  instructorName: string;
  instructorType: 'INTERNO' | 'EXTERNO';
  instructorRegistration: string;
  effectiveHours: string;
  location: string;
  observations: string;
}

interface Step1Errors {
  trainingTypeId?: string;
  date?: string;
  instructorName?: string;
  effectiveHours?: string;
}

const INITIAL_STEP1: Step1Form = {
  trainingTypeId: '',
  date: '',
  instructorName: '',
  instructorType: 'INTERNO',
  instructorRegistration: '',
  effectiveHours: '',
  location: '',
  observations: '',
};

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export default function TrainingRecordModal({
  isOpen,
  trainingTypes,
  employees,
  onClose,
  onSave,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Step1Form>(INITIAL_STEP1);
  const [errors, setErrors] = useState<Step1Errors>({});
  const [hoursWarning, setHoursWarning] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setForm(INITIAL_STEP1);
      setErrors({});
      setHoursWarning(null);
      setSelectedEmployeeIds(new Set());
      setEmployeeSearch('');
      setApiError(null);
      setTimeout(() => firstRef.current?.focus(), 100);
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

  const selectedType = trainingTypes.find((t) => t.id === form.trainingTypeId);

  // Hours warning check
  useEffect(() => {
    if (selectedType && form.effectiveHours) {
      const hours = Number(form.effectiveHours);
      if (hours < selectedType.minHours) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHoursWarning(
          `Carga horária abaixo do mínimo exigido (${selectedType.minHours}h) para este tipo de treinamento.`,
        );
      } else {
        setHoursWarning(null);
      }
    } else {
      setHoursWarning(null);
    }
  }, [form.effectiveHours, selectedType]);

  const validateStep1 = (): boolean => {
    const next: Step1Errors = {};
    if (!form.trainingTypeId) next.trainingTypeId = 'Selecione o tipo de treinamento.';
    if (!form.date) {
      next.date = 'Data é obrigatória.';
    } else if (new Date(form.date) > new Date()) {
      next.date = 'A data não pode ser no futuro.';
    }
    if (!form.instructorName.trim()) next.instructorName = 'Nome do instrutor é obrigatório.';
    if (!form.effectiveHours || Number(form.effectiveHours) <= 0)
      next.effectiveHours = 'Carga horária é obrigatória.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleBack = () => setStep(1);

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedEmployeeIds.size === 0) {
      setApiError('Selecione ao menos um participante.');
      return;
    }
    setSaving(true);
    setApiError(null);
    const ok = await onSave({
      trainingTypeId: form.trainingTypeId,
      date: form.date,
      instructorName: form.instructorName.trim(),
      instructorType: form.instructorType,
      instructorRegistration: form.instructorRegistration.trim() || undefined,
      effectiveHours: Number(form.effectiveHours),
      location: form.location.trim() || undefined,
      observations: form.observations.trim() || undefined,
      employeeIds: Array.from(selectedEmployeeIds),
    });
    setSaving(false);
    if (!ok) setApiError('Não foi possível salvar. Verifique os dados e tente novamente.');
  };

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(
    (e) =>
      !employeeSearch ||
      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      (e.positionName ?? '').toLowerCase().includes(employeeSearch.toLowerCase()),
  );

  const _expiryDate =
    form.date && selectedType ? addMonths(form.date, selectedType.defaultValidityMonths) : null;

  return (
    <div
      className="training-record-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-record-modal-title"
    >
      <div className="training-record-modal">
        {/* Header */}
        <div className="training-record-modal__header">
          <div>
            <h2 id="training-record-modal-title" className="training-record-modal__title">
              Registrar Treinamento
            </h2>
            <div className="training-record-modal__stepper" aria-label="Etapas">
              <span
                className={`training-record-modal__step ${step === 1 ? 'training-record-modal__step--active' : 'training-record-modal__step--done'}`}
              >
                1. Dados do Treinamento
              </span>
              <span className="training-record-modal__step-sep" aria-hidden="true">
                ›
              </span>
              <span
                className={`training-record-modal__step ${step === 2 ? 'training-record-modal__step--active' : ''}`}
              >
                2. Participantes
              </span>
            </div>
          </div>
          <button
            type="button"
            className="training-record-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="training-record-modal__body">
          {apiError && (
            <div className="training-record-modal__api-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {apiError}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="training-record-modal__step-content">
              {/* Training type */}
              <div className="training-record-modal__field">
                <label htmlFor="tr-type" className="training-record-modal__label">
                  Tipo de treinamento <span aria-hidden="true">*</span>
                </label>
                <select
                  ref={firstRef}
                  id="tr-type"
                  className={`training-record-modal__select ${errors.trainingTypeId ? 'training-record-modal__input--error' : ''}`}
                  value={form.trainingTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, trainingTypeId: e.target.value }))}
                  aria-required="true"
                  aria-invalid={!!errors.trainingTypeId}
                >
                  <option value="">Selecione...</option>
                  {trainingTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {errors.trainingTypeId && (
                  <span className="training-record-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.trainingTypeId}
                  </span>
                )}
              </div>

              {/* Date */}
              <div className="training-record-modal__field">
                <label htmlFor="tr-date" className="training-record-modal__label">
                  Data <span aria-hidden="true">*</span>
                </label>
                <input
                  id="tr-date"
                  type="date"
                  className={`training-record-modal__input ${errors.date ? 'training-record-modal__input--error' : ''}`}
                  value={form.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  aria-required="true"
                  aria-invalid={!!errors.date}
                />
                {errors.date && (
                  <span className="training-record-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.date}
                  </span>
                )}
              </div>

              {/* Instructor */}
              <div className="training-record-modal__row">
                <div className="training-record-modal__field">
                  <label htmlFor="tr-instructor" className="training-record-modal__label">
                    Nome do instrutor <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="tr-instructor"
                    type="text"
                    className={`training-record-modal__input ${errors.instructorName ? 'training-record-modal__input--error' : ''}`}
                    value={form.instructorName}
                    onChange={(e) => setForm((f) => ({ ...f, instructorName: e.target.value }))}
                    aria-required="true"
                  />
                  {errors.instructorName && (
                    <span className="training-record-modal__error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      {errors.instructorName}
                    </span>
                  )}
                </div>

                <div className="training-record-modal__field">
                  <fieldset className="training-record-modal__fieldset">
                    <legend className="training-record-modal__label">Tipo de instrutor</legend>
                    <div className="training-record-modal__radio-group">
                      {(['INTERNO', 'EXTERNO'] as const).map((type) => (
                        <label key={type} className="training-record-modal__radio-label">
                          <input
                            type="radio"
                            name="instructorType"
                            value={type}
                            checked={form.instructorType === type}
                            onChange={() => setForm((f) => ({ ...f, instructorType: type }))}
                          />
                          {INSTRUCTOR_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>

              {/* CRM/CREA — only for EXTERNO */}
              {form.instructorType === 'EXTERNO' && (
                <div className="training-record-modal__field">
                  <label htmlFor="tr-registration" className="training-record-modal__label">
                    Registro CRM/CREA
                  </label>
                  <input
                    id="tr-registration"
                    type="text"
                    className="training-record-modal__input"
                    placeholder="Ex.: CREA/SP 123456"
                    value={form.instructorRegistration}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, instructorRegistration: e.target.value }))
                    }
                  />
                </div>
              )}

              {/* Effective hours */}
              <div className="training-record-modal__row">
                <div className="training-record-modal__field">
                  <label htmlFor="tr-hours" className="training-record-modal__label">
                    Carga horária realizada (h) <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="tr-hours"
                    type="number"
                    min="1"
                    step="0.5"
                    className={`training-record-modal__input ${errors.effectiveHours ? 'training-record-modal__input--error' : ''}`}
                    value={form.effectiveHours}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveHours: e.target.value }))}
                    aria-required="true"
                  />
                  {errors.effectiveHours && (
                    <span className="training-record-modal__error" role="alert">
                      <AlertCircle size={14} aria-hidden="true" />
                      {errors.effectiveHours}
                    </span>
                  )}
                  {hoursWarning && !errors.effectiveHours && (
                    <span className="training-record-modal__warning">
                      <AlertTriangle size={14} aria-hidden="true" />
                      {hoursWarning}
                    </span>
                  )}
                </div>

                <div className="training-record-modal__field">
                  <label htmlFor="tr-location" className="training-record-modal__label">
                    Local
                  </label>
                  <input
                    id="tr-location"
                    type="text"
                    className="training-record-modal__input"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>

              {/* Observations */}
              <div className="training-record-modal__field">
                <label htmlFor="tr-obs" className="training-record-modal__label">
                  Observações
                </label>
                <textarea
                  id="tr-obs"
                  className="training-record-modal__textarea"
                  value={form.observations}
                  onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="training-record-modal__step-content">
              <div className="training-record-modal__field">
                <label htmlFor="tr-emp-search" className="training-record-modal__label">
                  Buscar colaborador
                </label>
                <input
                  id="tr-emp-search"
                  type="search"
                  className="training-record-modal__input"
                  placeholder="Nome ou cargo..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />
              </div>

              <p className="training-record-modal__selected-count">
                {selectedEmployeeIds.size} participante(s) selecionado(s)
              </p>

              <ul
                className="training-record-modal__employee-list"
                role="group"
                aria-label="Participantes"
              >
                {filteredEmployees.length === 0 ? (
                  <li className="training-record-modal__no-employees">
                    Nenhum colaborador encontrado.
                  </li>
                ) : (
                  filteredEmployees.map((emp) => {
                    const checked = selectedEmployeeIds.has(emp.id);
                    const expiry =
                      form.date && selectedType && checked
                        ? addMonths(form.date, selectedType.defaultValidityMonths)
                        : null;
                    return (
                      <li key={emp.id} className="training-record-modal__employee-item">
                        <label className="training-record-modal__employee-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEmployee(emp.id)}
                            className="training-record-modal__checkbox"
                          />
                          <div>
                            <span className="training-record-modal__employee-name">{emp.name}</span>
                            {emp.positionName && (
                              <span className="training-record-modal__employee-position">
                                {emp.positionName}
                              </span>
                            )}
                            {expiry && (
                              <span className="training-record-modal__employee-expiry">
                                Validade até: {formatDateBR(expiry)}
                              </span>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="training-record-modal__footer">
          {step === 1 ? (
            <>
              <button
                type="button"
                className="training-record-modal__btn training-record-modal__btn--cancel"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="training-record-modal__btn training-record-modal__btn--primary"
                onClick={handleNext}
              >
                Próximo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="training-record-modal__btn training-record-modal__btn--cancel"
                onClick={handleBack}
                disabled={saving}
              >
                Voltar
              </button>
              <button
                type="button"
                className="training-record-modal__btn training-record-modal__btn--primary"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Registrando...' : 'Registrar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
