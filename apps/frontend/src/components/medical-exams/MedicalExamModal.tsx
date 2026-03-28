import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X, Info } from 'lucide-react';
import type { CreateMedicalExamInput, AsoType, AsoResult } from '@/types/medical-exam';
import { ASO_TYPE_LABELS, ASO_RESULT_LABELS } from '@/types/medical-exam';
import './MedicalExamModal.css';

interface Employee {
  id: string;
  name: string;
  positionName: string | null;
  asoPeriodicityMonths?: number | null;
}

interface Props {
  isOpen: boolean;
  employees: Employee[];
  onClose: () => void;
  onSave: (input: CreateMedicalExamInput) => Promise<boolean>;
}

interface FormState {
  employeeId: string;
  type: AsoType;
  date: string;
  doctorName: string;
  doctorCrm: string;
  result: AsoResult;
  restrictions: string;
  nextExamDate: string;
  observations: string;
}

interface FormErrors {
  employeeId?: string;
  date?: string;
  doctorName?: string;
  doctorCrm?: string;
  restrictions?: string;
  nextExamDate?: string;
}

const INITIAL: FormState = {
  employeeId: '',
  type: 'ADMISSIONAL',
  date: '',
  doctorName: '',
  doctorCrm: '',
  result: 'APTO',
  restrictions: '',
  nextExamDate: '',
  observations: '',
};

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

const CRM_PATTERN = /^CRM\/[A-Z]{2}\s?\d{4,6}$/;

export default function MedicalExamModal({ isOpen, employees, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(INITIAL);
      setErrors({});
      setApiError(null);
      setEmployeeSearch('');
      setShowDropdown(false);
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

  // Auto-calculate nextExamDate when employee and date change
  useEffect(() => {
    if (form.employeeId && form.date) {
      const emp = employees.find((e) => e.id === form.employeeId);
      const months = emp?.asoPeriodicityMonths ?? 12;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, nextExamDate: addMonths(form.date, months) }));
    }
  }, [form.employeeId, form.date, employees]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.employeeId) next.employeeId = 'Selecione um colaborador.';
    if (!form.date) {
      next.date = 'Data é obrigatória.';
    } else if (new Date(form.date) > new Date()) {
      next.date = 'A data não pode ser no futuro.';
    }
    if (!form.doctorName.trim()) next.doctorName = 'Nome do médico é obrigatório.';
    if (!form.doctorCrm.trim()) {
      next.doctorCrm = 'Informe o CRM no formato CRM/UF 00000.';
    } else if (!CRM_PATTERN.test(form.doctorCrm.trim())) {
      next.doctorCrm = 'Informe o CRM no formato CRM/UF 00000.';
    }
    if (form.result === 'APTO_COM_RESTRICAO' && !form.restrictions.trim()) {
      next.restrictions = 'Descreva as restrições para este resultado.';
    }
    if (form.nextExamDate && form.date && form.nextExamDate <= form.date) {
      next.nextExamDate = 'A data do próximo exame deve ser após a data do exame.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    const ok = await onSave({
      employeeId: form.employeeId,
      type: form.type,
      date: form.date,
      doctorName: form.doctorName.trim(),
      doctorCrm: form.doctorCrm.trim(),
      result: form.result,
      restrictions: form.result === 'APTO_COM_RESTRICAO' ? form.restrictions.trim() : undefined,
      nextExamDate: form.nextExamDate || undefined,
      observations: form.observations.trim() || undefined,
    });
    setSaving(false);
    if (!ok) setApiError('Não foi possível salvar. Verifique os dados e tente novamente.');
  };

  if (!isOpen) return null;

  const selectedEmployee = employees.find((e) => e.id === form.employeeId);
  const filteredEmployees = employeeSearch
    ? employees.filter(
        (e) =>
          e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
          (e.positionName ?? '').toLowerCase().includes(employeeSearch.toLowerCase()),
      )
    : employees;

  return (
    <div
      className="medical-exam-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medical-exam-modal-title"
    >
      <div className="medical-exam-modal">
        <div className="medical-exam-modal__header">
          <h2 id="medical-exam-modal-title" className="medical-exam-modal__title">
            Registrar ASO
          </h2>
          <button
            type="button"
            className="medical-exam-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="medical-exam-modal__body">
            {apiError && (
              <div className="medical-exam-modal__api-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {apiError}
              </div>
            )}

            {/* INAPTO banner */}
            {form.result === 'INAPTO' && (
              <div className="medical-exam-modal__inapto-banner" role="note">
                <Info size={16} aria-hidden="true" />
                <span>
                  Colaborador inapto para trabalho. O gestor será notificado via dashboard de
                  conformidade.
                </span>
              </div>
            )}

            {/* Employee picker */}
            <div className="medical-exam-modal__field" style={{ position: 'relative' }}>
              <label htmlFor="me-employee" className="medical-exam-modal__label">
                Colaborador <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstRef}
                id="me-employee"
                type="search"
                className={`medical-exam-modal__input ${errors.employeeId ? 'medical-exam-modal__input--error' : ''}`}
                placeholder="Buscar colaborador..."
                value={selectedEmployee ? selectedEmployee.name : employeeSearch}
                onChange={(e) => {
                  setEmployeeSearch(e.target.value);
                  setForm((f) => ({ ...f, employeeId: '' }));
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                aria-required="true"
                aria-invalid={!!errors.employeeId}
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
                role="combobox"
                aria-autocomplete="list"
              />
              {showDropdown && filteredEmployees.length > 0 && !form.employeeId && (
                <ul
                  className="medical-exam-modal__dropdown"
                  role="listbox"
                  aria-label="Colaboradores"
                >
                  {filteredEmployees.slice(0, 8).map((emp) => (
                    <li
                      key={emp.id}
                      role="option"
                      aria-selected={false}
                      className="medical-exam-modal__dropdown-item"
                      onMouseDown={() => {
                        setForm((f) => ({ ...f, employeeId: emp.id }));
                        setEmployeeSearch('');
                        setShowDropdown(false);
                      }}
                    >
                      <span className="medical-exam-modal__dropdown-name">{emp.name}</span>
                      {emp.positionName && (
                        <span className="medical-exam-modal__dropdown-pos">{emp.positionName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {errors.employeeId && (
                <span className="medical-exam-modal__error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  {errors.employeeId}
                </span>
              )}
            </div>

            {/* ASO Type */}
            <div className="medical-exam-modal__field">
              <label htmlFor="me-type" className="medical-exam-modal__label">
                Tipo de ASO <span aria-hidden="true">*</span>
              </label>
              <select
                id="me-type"
                className="medical-exam-modal__select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AsoType }))}
                aria-required="true"
              >
                {(Object.keys(ASO_TYPE_LABELS) as AsoType[]).map((key) => (
                  <option key={key} value={key}>
                    {ASO_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="medical-exam-modal__row">
              {/* Date */}
              <div className="medical-exam-modal__field">
                <label htmlFor="me-date" className="medical-exam-modal__label">
                  Data do exame <span aria-hidden="true">*</span>
                </label>
                <input
                  id="me-date"
                  type="date"
                  className={`medical-exam-modal__input ${errors.date ? 'medical-exam-modal__input--error' : ''}`}
                  value={form.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  aria-required="true"
                  aria-invalid={!!errors.date}
                />
                {errors.date && (
                  <span className="medical-exam-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.date}
                  </span>
                )}
              </div>

              {/* Next exam date */}
              <div className="medical-exam-modal__field">
                <label htmlFor="me-next-date" className="medical-exam-modal__label">
                  Data do próximo exame
                </label>
                <input
                  id="me-next-date"
                  type="date"
                  className={`medical-exam-modal__input ${errors.nextExamDate ? 'medical-exam-modal__input--error' : ''}`}
                  value={form.nextExamDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextExamDate: e.target.value }))}
                  aria-describedby="me-next-date-hint"
                />
                <span id="me-next-date-hint" className="medical-exam-modal__hint">
                  Calculado automaticamente com base na periodicidade do cargo
                  {form.employeeId &&
                    ` (${employees.find((e) => e.id === form.employeeId)?.asoPeriodicityMonths ?? 12} meses)`}
                </span>
                {errors.nextExamDate && (
                  <span className="medical-exam-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.nextExamDate}
                  </span>
                )}
              </div>
            </div>

            <div className="medical-exam-modal__row">
              {/* Doctor name */}
              <div className="medical-exam-modal__field">
                <label htmlFor="me-doctor" className="medical-exam-modal__label">
                  Nome do médico <span aria-hidden="true">*</span>
                </label>
                <input
                  id="me-doctor"
                  type="text"
                  className={`medical-exam-modal__input ${errors.doctorName ? 'medical-exam-modal__input--error' : ''}`}
                  value={form.doctorName}
                  onChange={(e) => setForm((f) => ({ ...f, doctorName: e.target.value }))}
                  aria-required="true"
                />
                {errors.doctorName && (
                  <span className="medical-exam-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.doctorName}
                  </span>
                )}
              </div>

              {/* CRM */}
              <div className="medical-exam-modal__field">
                <label htmlFor="me-crm" className="medical-exam-modal__label">
                  CRM <span aria-hidden="true">*</span>
                </label>
                <input
                  id="me-crm"
                  type="text"
                  className={`medical-exam-modal__input medical-exam-modal__input--mono ${errors.doctorCrm ? 'medical-exam-modal__input--error' : ''}`}
                  placeholder="CRM/UF 00000"
                  value={form.doctorCrm}
                  onChange={(e) => setForm((f) => ({ ...f, doctorCrm: e.target.value }))}
                  aria-required="true"
                  aria-invalid={!!errors.doctorCrm}
                />
                {errors.doctorCrm && (
                  <span className="medical-exam-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.doctorCrm}
                  </span>
                )}
              </div>
            </div>

            {/* Result */}
            <div className="medical-exam-modal__field">
              <fieldset className="medical-exam-modal__fieldset">
                <legend className="medical-exam-modal__label">
                  Resultado <span aria-hidden="true">*</span>
                </legend>
                <div className="medical-exam-modal__radio-group">
                  {(Object.keys(ASO_RESULT_LABELS) as AsoResult[]).map((r) => (
                    <label key={r} className="medical-exam-modal__radio-label">
                      <input
                        type="radio"
                        name="asoResult"
                        value={r}
                        checked={form.result === r}
                        onChange={() => setForm((f) => ({ ...f, result: r }))}
                      />
                      {ASO_RESULT_LABELS[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Restrictions — only for APTO_COM_RESTRICAO */}
            {form.result === 'APTO_COM_RESTRICAO' && (
              <div className="medical-exam-modal__field">
                <label htmlFor="me-restrictions" className="medical-exam-modal__label">
                  Restrições <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="me-restrictions"
                  className={`medical-exam-modal__textarea ${errors.restrictions ? 'medical-exam-modal__input--error' : ''}`}
                  value={form.restrictions}
                  onChange={(e) => setForm((f) => ({ ...f, restrictions: e.target.value }))}
                  rows={3}
                  aria-required="true"
                  aria-invalid={!!errors.restrictions}
                />
                {errors.restrictions && (
                  <span className="medical-exam-modal__error" role="alert">
                    <AlertCircle size={14} aria-hidden="true" />
                    {errors.restrictions}
                  </span>
                )}
              </div>
            )}

            {/* Observations */}
            <div className="medical-exam-modal__field">
              <label htmlFor="me-obs" className="medical-exam-modal__label">
                Observações
              </label>
              <textarea
                id="me-obs"
                className="medical-exam-modal__textarea"
                value={form.observations}
                onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <div className="medical-exam-modal__footer">
            <button
              type="button"
              className="medical-exam-modal__btn medical-exam-modal__btn--cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="medical-exam-modal__btn medical-exam-modal__btn--primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
