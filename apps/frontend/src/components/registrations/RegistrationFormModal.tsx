import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import type { FarmRegistration, CreateRegistrationPayload } from '@/types/farm';
import './RegistrationFormModal.css';

interface RegistrationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateRegistrationPayload) => Promise<void>;
  registration?: FarmRegistration;
  isSubmitting: boolean;
  submitError: string | null;
}

interface FormFields {
  number: string;
  cartorioName: string;
  comarca: string;
  state: string;
  areaHa: string;
  cnsCode: string;
  livro: string;
  registrationDate: string;
}

type FieldKey = keyof FormFields;

const INITIAL_FIELDS: FormFields = {
  number: '',
  cartorioName: '',
  comarca: '',
  state: '',
  areaHa: '',
  cnsCode: '',
  livro: '',
  registrationDate: '',
};

function validate(fields: FormFields): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};

  if (!fields.number.trim()) {
    errors.number = 'Número da matrícula é obrigatório';
  }
  if (!fields.cartorioName.trim()) {
    errors.cartorioName = 'Nome do cartório é obrigatório';
  }
  if (!fields.comarca.trim()) {
    errors.comarca = 'Comarca é obrigatória';
  }
  if (!fields.state) {
    errors.state = 'UF é obrigatória';
  } else if (!(VALID_UF as readonly string[]).includes(fields.state)) {
    errors.state = 'UF inválida';
  }
  if (!fields.areaHa.trim()) {
    errors.areaHa = 'Área é obrigatória';
  } else if (Number(fields.areaHa) <= 0) {
    errors.areaHa = 'Área deve ser maior que zero';
  }

  return errors;
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

interface FieldInputProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: string;
  step?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function FieldInput({
  id,
  label,
  value,
  error,
  touched,
  required,
  type = 'text',
  placeholder,
  min,
  step,
  onChange,
  onBlur,
}: FieldInputProps) {
  const hasError = touched && !!error;
  return (
    <div className="reg-form-modal__field">
      <label htmlFor={id} className="reg-form-modal__label">
        {label}
        {required && <span className="reg-form-modal__required"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`reg-form-modal__input ${hasError ? 'reg-form-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        min={min}
        step={step}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="reg-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

interface FieldSelectProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
  touched?: boolean;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function FieldSelect({
  id,
  label,
  value,
  options,
  error,
  touched,
  required,
  placeholder,
  onChange,
  onBlur,
}: FieldSelectProps) {
  const hasError = touched && !!error;
  return (
    <div className="reg-form-modal__field">
      <label htmlFor={id} className="reg-form-modal__label">
        {label}
        {required && <span className="reg-form-modal__required"> *</span>}
      </label>
      <select
        id={id}
        className={`reg-form-modal__select ${hasError ? 'reg-form-modal__select--error' : ''}`}
        value={value}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      >
        <option value="">{placeholder ?? 'Selecione...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasError && (
        <span id={`${id}-error`} className="reg-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

function RegistrationFormModal({
  isOpen,
  onClose,
  onSubmit,
  registration,
  isSubmitting,
  submitError,
}: RegistrationFormModalProps) {
  const isEditMode = !!registration;
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    if (registration) {
      setFields({
        number: registration.number,
        cartorioName: registration.cartorioName,
        comarca: registration.comarca,
        state: registration.state,
        areaHa: String(registration.areaHa),
        cnsCode: registration.cnsCode ?? '',
        livro: registration.livro ?? '',
        registrationDate: formatDateForInput(registration.registrationDate),
      });
    } else {
      setFields(INITIAL_FIELDS);
    }
    setTouched({});
    setErrors({});
  }, [isOpen, registration]);

  const handleClose = useCallback(() => {
    setFields(INITIAL_FIELDS);
    setTouched({});
    setErrors({});
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const setField = (key: FieldKey, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (touched[key]) {
      const newFields = { ...fields, [key]: value };
      setErrors(validate(newFields));
    }
  };

  const touchField = (key: FieldKey) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors(validate(fields));
  };

  const handleSubmit = async () => {
    const allTouched: Record<FieldKey, boolean> = {
      number: true,
      cartorioName: true,
      comarca: true,
      state: true,
      areaHa: true,
      cnsCode: true,
      livro: true,
      registrationDate: true,
    };
    setTouched(allTouched);

    const validationErrors = validate(fields);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    const payload: CreateRegistrationPayload = {
      number: fields.number.trim(),
      cartorioName: fields.cartorioName.trim(),
      comarca: fields.comarca.trim(),
      state: fields.state,
      areaHa: Number(fields.areaHa),
    };

    if (fields.cnsCode.trim()) payload.cnsCode = fields.cnsCode.trim();
    if (fields.livro.trim()) payload.livro = fields.livro.trim();
    if (fields.registrationDate) payload.registrationDate = fields.registrationDate;

    try {
      await onSubmit(payload);
      handleClose();
    } catch {
      // submitError already handled by parent hook
    }
  };

  if (!isOpen) return null;

  const title = isEditMode ? 'Editar matrícula' : 'Nova matrícula';
  const submitLabel = isEditMode ? 'Salvar alterações' : 'Adicionar matrícula';
  const submittingLabel = isEditMode ? 'Salvando...' : 'Adicionando...';

  return (
    <div
      className="reg-form-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-form-title"
    >
      <div className="reg-form-modal">
        <header className="reg-form-modal__header">
          <h2 id="reg-form-title" className="reg-form-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="reg-form-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="reg-form-modal__body">
          <div className="reg-form-modal__fields">
            <FieldInput
              id="reg-number"
              label="Número da matrícula"
              value={fields.number}
              error={errors.number}
              touched={touched.number}
              required
              placeholder="Ex: 12345"
              onChange={(v) => setField('number', v)}
              onBlur={() => touchField('number')}
            />
            <FieldInput
              id="reg-cartorio"
              label="Cartório"
              value={fields.cartorioName}
              error={errors.cartorioName}
              touched={touched.cartorioName}
              required
              placeholder="Ex: 1º Ofício de Registro de Imóveis"
              onChange={(v) => setField('cartorioName', v)}
              onBlur={() => touchField('cartorioName')}
            />
            <FieldInput
              id="reg-comarca"
              label="Comarca"
              value={fields.comarca}
              error={errors.comarca}
              touched={touched.comarca}
              required
              placeholder="Ex: Uberlândia"
              onChange={(v) => setField('comarca', v)}
              onBlur={() => touchField('comarca')}
            />
            <FieldSelect
              id="reg-state"
              label="UF"
              value={fields.state}
              error={errors.state}
              touched={touched.state}
              required
              placeholder="Selecione a UF"
              options={VALID_UF.map((uf) => ({ value: uf, label: uf }))}
              onChange={(v) => setField('state', v)}
              onBlur={() => touchField('state')}
            />
            <FieldInput
              id="reg-area"
              label="Área (ha)"
              value={fields.areaHa}
              error={errors.areaHa}
              touched={touched.areaHa}
              required
              type="number"
              placeholder="Ex: 50.5"
              min="0.01"
              step="0.01"
              onChange={(v) => setField('areaHa', v)}
              onBlur={() => touchField('areaHa')}
            />
            <FieldInput
              id="reg-cns"
              label="Código CNS"
              value={fields.cnsCode}
              placeholder="Opcional"
              onChange={(v) => setField('cnsCode', v)}
              onBlur={() => touchField('cnsCode')}
            />
            <FieldInput
              id="reg-livro"
              label="Livro"
              value={fields.livro}
              placeholder="Opcional"
              onChange={(v) => setField('livro', v)}
              onBlur={() => touchField('livro')}
            />
            <FieldInput
              id="reg-date"
              label="Data de registro"
              value={fields.registrationDate}
              type="date"
              onChange={(v) => setField('registrationDate', v)}
              onBlur={() => touchField('registrationDate')}
            />
          </div>

          {submitError && (
            <div className="reg-form-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}
        </div>

        <footer className="reg-form-modal__footer">
          <button
            type="button"
            className="reg-form-modal__btn reg-form-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="reg-form-modal__btn reg-form-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="reg-form-modal__spinner" />
                {submittingLabel}
              </>
            ) : (
              submitLabel
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default RegistrationFormModal;
