import { useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import { useCreateProducer, formatCpfInput, type PFFieldKey } from '@/hooks/useCreateProducer';
import './ProducerPFFormModal.css';

const TAX_REGIME_OPTIONS = [
  { value: 'REAL', label: 'Lucro Real' },
  { value: 'PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'SIMPLES', label: 'Simples Nacional' },
  { value: 'ISENTO', label: 'Isento' },
];

interface ProducerPFFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  mono?: boolean;
  fullWidth?: boolean;
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
  mono,
  fullWidth,
  onChange,
  onBlur,
}: FieldInputProps) {
  const hasError = touched && !!error;
  return (
    <div className={`pf-form-modal__field${fullWidth ? ' pf-form-modal__field--full' : ''}`}>
      <label htmlFor={id} className="pf-form-modal__label">
        {label}
        {required && <span className="pf-form-modal__required"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`pf-form-modal__input${mono ? ' pf-form-modal__input--mono' : ''}${hasError ? ' pf-form-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="pf-form-modal__error" role="alert">
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
    <div className="pf-form-modal__field">
      <label htmlFor={id} className="pf-form-modal__label">
        {label}
        {required && <span className="pf-form-modal__required"> *</span>}
      </label>
      <select
        id={id}
        className={`pf-form-modal__select${hasError ? ' pf-form-modal__select--error' : ''}`}
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
        <span id={`${id}-error`} className="pf-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

function ProducerPFFormModal({ isOpen, onClose, onSuccess }: ProducerPFFormModalProps) {
  const {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    setField,
    touchField,
    submit,
    reset,
  } = useCreateProducer({ onSuccess });

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleCpfChange = (key: PFFieldKey, value: string) => {
    setField(key, formatCpfInput(value));
  };

  if (!isOpen) return null;

  return (
    <div
      className="pf-form-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pf-form-title"
    >
      <div className="pf-form-modal">
        <header className="pf-form-modal__header">
          <h2 id="pf-form-title" className="pf-form-modal__title">
            Novo produtor — Pessoa Física
          </h2>
          <button
            type="button"
            className="pf-form-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pf-form-modal__body">
          {/* Dados Pessoais */}
          <fieldset className="pf-form-modal__section">
            <legend className="pf-form-modal__section-title">Dados Pessoais</legend>
            <div className="pf-form-modal__fields">
              <FieldInput
                id="pf-name"
                label="Nome completo"
                value={formData.name}
                error={errors.name}
                touched={touched.name}
                required
                placeholder="Ex: João da Silva"
                fullWidth
                onChange={(v) => setField('name', v)}
                onBlur={() => touchField('name')}
              />
              <FieldInput
                id="pf-document"
                label="CPF"
                value={formData.document}
                error={errors.document}
                touched={touched.document}
                required
                placeholder="000.000.000-00"
                mono
                onChange={(v) => handleCpfChange('document', v)}
                onBlur={() => touchField('document')}
              />
              <FieldInput
                id="pf-trade-name"
                label="Nome fantasia"
                value={formData.tradeName}
                placeholder="Opcional"
                onChange={(v) => setField('tradeName', v)}
                onBlur={() => touchField('tradeName')}
              />
              <FieldInput
                id="pf-birth-date"
                label="Data de nascimento"
                value={formData.birthDate}
                type="date"
                onChange={(v) => setField('birthDate', v)}
                onBlur={() => touchField('birthDate')}
              />
              <FieldInput
                id="pf-spouse-cpf"
                label="CPF do cônjuge"
                value={formData.spouseCpf}
                error={errors.spouseCpf}
                touched={touched.spouseCpf}
                placeholder="000.000.000-00"
                mono
                onChange={(v) => handleCpfChange('spouseCpf', v)}
                onBlur={() => touchField('spouseCpf')}
              />
            </div>
          </fieldset>

          {/* Endereço Fiscal */}
          <fieldset className="pf-form-modal__section">
            <legend className="pf-form-modal__section-title">Endereço Fiscal</legend>
            <div className="pf-form-modal__fields">
              <FieldInput
                id="pf-address"
                label="Endereço"
                value={formData.address}
                placeholder="Rua, número, complemento"
                fullWidth
                onChange={(v) => setField('address', v)}
                onBlur={() => touchField('address')}
              />
              <FieldInput
                id="pf-city"
                label="Município"
                value={formData.city}
                placeholder="Ex: Uberlândia"
                onChange={(v) => setField('city', v)}
                onBlur={() => touchField('city')}
              />
              <FieldSelect
                id="pf-state"
                label="UF"
                value={formData.state}
                error={errors.state}
                touched={touched.state}
                placeholder="Selecione a UF"
                options={VALID_UF.map((uf) => ({ value: uf, label: uf }))}
                onChange={(v) => setField('state', v)}
                onBlur={() => touchField('state')}
              />
              <FieldInput
                id="pf-zip-code"
                label="CEP"
                value={formData.zipCode}
                error={errors.zipCode}
                touched={touched.zipCode}
                placeholder="00000-000"
                onChange={(v) => setField('zipCode', v)}
                onBlur={() => touchField('zipCode')}
              />
            </div>
          </fieldset>

          {/* Informações Adicionais */}
          <fieldset className="pf-form-modal__section">
            <legend className="pf-form-modal__section-title">Informações Adicionais</legend>
            <div className="pf-form-modal__fields">
              <FieldInput
                id="pf-incra"
                label="Registro INCRA"
                value={formData.incraRegistration}
                placeholder="Opcional"
                onChange={(v) => setField('incraRegistration', v)}
                onBlur={() => touchField('incraRegistration')}
              />
              <FieldInput
                id="pf-legal-rep"
                label="Representante legal"
                value={formData.legalRepresentative}
                placeholder="Opcional"
                onChange={(v) => setField('legalRepresentative', v)}
                onBlur={() => touchField('legalRepresentative')}
              />
              <FieldInput
                id="pf-legal-rep-cpf"
                label="CPF do representante"
                value={formData.legalRepCpf}
                error={errors.legalRepCpf}
                touched={touched.legalRepCpf}
                placeholder="000.000.000-00"
                mono
                onChange={(v) => handleCpfChange('legalRepCpf', v)}
                onBlur={() => touchField('legalRepCpf')}
              />
              <FieldSelect
                id="pf-tax-regime"
                label="Regime tributário"
                value={formData.taxRegime}
                placeholder="Selecione..."
                options={TAX_REGIME_OPTIONS}
                onChange={(v) => setField('taxRegime', v)}
                onBlur={() => touchField('taxRegime')}
              />
            </div>
          </fieldset>

          {submitError && (
            <div className="pf-form-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}
        </div>

        <footer className="pf-form-modal__footer">
          <button
            type="button"
            className="pf-form-modal__btn pf-form-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pf-form-modal__btn pf-form-modal__btn--primary"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="pf-form-modal__spinner" />
                Cadastrando...
              </>
            ) : (
              'Cadastrar produtor'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ProducerPFFormModal;
