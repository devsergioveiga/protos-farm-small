import { useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import { useCreateProducerPJ } from '@/hooks/useCreateProducerPJ';
import './ProducerPJFormModal.css';

const TAX_REGIME_OPTIONS = [
  { value: 'REAL', label: 'Lucro Real' },
  { value: 'PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'SIMPLES', label: 'Simples Nacional' },
  { value: 'ISENTO', label: 'Isento' },
];

interface ProducerPJFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producerId?: string;
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
    <div className={`pj-form-modal__field${fullWidth ? ' pj-form-modal__field--full' : ''}`}>
      <label htmlFor={id} className="pj-form-modal__label">
        {label}
        {required && <span className="pj-form-modal__required"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`pj-form-modal__input${mono ? ' pj-form-modal__input--mono' : ''}${hasError ? ' pj-form-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="pj-form-modal__error" role="alert">
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
    <div className="pj-form-modal__field">
      <label htmlFor={id} className="pj-form-modal__label">
        {label}
        {required && <span className="pj-form-modal__required"> *</span>}
      </label>
      <select
        id={id}
        className={`pj-form-modal__select${hasError ? ' pj-form-modal__select--error' : ''}`}
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
        <span id={`${id}-error`} className="pj-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

function ProducerPJFormModal({ isOpen, onClose, onSuccess, producerId }: ProducerPJFormModalProps) {
  const {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    isLoadingDetail,
    setField,
    touchField,
    handleCnpjChange,
    handleCpfChange,
    submit,
    reset,
  } = useCreateProducerPJ({ onSuccess, producerId });

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

  if (!isOpen) return null;

  return (
    <div
      className="pj-form-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pj-form-title"
    >
      <div className="pj-form-modal">
        <header className="pj-form-modal__header">
          <h2 id="pj-form-title" className="pj-form-modal__title">
            {isEditMode ? 'Editar produtor — Pessoa Jurídica' : 'Novo produtor — Pessoa Jurídica'}
          </h2>
          <button
            type="button"
            className="pj-form-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pj-form-modal__body">
          {isLoadingDetail ? (
            <div data-testid="pj-form-skeleton">
              <div
                className="pj-form-modal__skeleton"
                style={{ width: '40%', height: 20, marginBottom: 16 }}
              />
              <div
                className="pj-form-modal__skeleton"
                style={{ width: '100%', height: 120, marginBottom: 24 }}
              />
              <div
                className="pj-form-modal__skeleton"
                style={{ width: '50%', height: 20, marginBottom: 16 }}
              />
              <div className="pj-form-modal__skeleton" style={{ width: '100%', height: 80 }} />
            </div>
          ) : (
            <>
              {/* Dados da Empresa */}
              <fieldset className="pj-form-modal__section">
                <legend className="pj-form-modal__section-title">Dados da Empresa</legend>
                <div className="pj-form-modal__fields">
                  <FieldInput
                    id="pj-name"
                    label="Razão social"
                    value={formData.name}
                    error={errors.name}
                    touched={touched.name}
                    required
                    placeholder="Ex: Agropecuária São João Ltda"
                    fullWidth
                    onChange={(v) => setField('name', v)}
                    onBlur={() => touchField('name')}
                  />
                  <FieldInput
                    id="pj-document"
                    label="CNPJ"
                    value={formData.document}
                    error={errors.document}
                    touched={touched.document}
                    required
                    placeholder="00.000.000/0000-00"
                    mono
                    onChange={(v) => handleCnpjChange(v)}
                    onBlur={() => touchField('document')}
                  />
                  <FieldInput
                    id="pj-trade-name"
                    label="Nome fantasia"
                    value={formData.tradeName}
                    placeholder="Opcional"
                    onChange={(v) => setField('tradeName', v)}
                    onBlur={() => touchField('tradeName')}
                  />
                </div>
              </fieldset>

              {/* Endereço Fiscal */}
              <fieldset className="pj-form-modal__section">
                <legend className="pj-form-modal__section-title">Endereço Fiscal</legend>
                <div className="pj-form-modal__fields">
                  <FieldInput
                    id="pj-address"
                    label="Endereço"
                    value={formData.address}
                    placeholder="Rua, número, complemento"
                    fullWidth
                    onChange={(v) => setField('address', v)}
                    onBlur={() => touchField('address')}
                  />
                  <FieldInput
                    id="pj-city"
                    label="Município"
                    value={formData.city}
                    placeholder="Ex: Uberlândia"
                    onChange={(v) => setField('city', v)}
                    onBlur={() => touchField('city')}
                  />
                  <FieldSelect
                    id="pj-state"
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
                    id="pj-zip-code"
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
              <fieldset className="pj-form-modal__section">
                <legend className="pj-form-modal__section-title">Informações Adicionais</legend>
                <div className="pj-form-modal__fields">
                  <FieldInput
                    id="pj-incra"
                    label="Registro INCRA"
                    value={formData.incraRegistration}
                    placeholder="Opcional"
                    onChange={(v) => setField('incraRegistration', v)}
                    onBlur={() => touchField('incraRegistration')}
                  />
                  <FieldInput
                    id="pj-legal-rep"
                    label="Representante legal"
                    value={formData.legalRepresentative}
                    placeholder="Opcional"
                    onChange={(v) => setField('legalRepresentative', v)}
                    onBlur={() => touchField('legalRepresentative')}
                  />
                  <FieldInput
                    id="pj-legal-rep-cpf"
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
                    id="pj-tax-regime"
                    label="Regime tributário"
                    value={formData.taxRegime}
                    placeholder="Selecione..."
                    options={TAX_REGIME_OPTIONS}
                    onChange={(v) => setField('taxRegime', v)}
                    onBlur={() => touchField('taxRegime')}
                  />
                  <FieldInput
                    id="pj-main-cnae"
                    label="CNAE principal"
                    value={formData.mainCnae}
                    placeholder="Ex: 0115-6/00"
                    onChange={(v) => setField('mainCnae', v)}
                    onBlur={() => touchField('mainCnae')}
                  />
                  <FieldInput
                    id="pj-rural-activity"
                    label="Tipo de atividade rural"
                    value={formData.ruralActivityType}
                    placeholder="Ex: Agricultura, Pecuária"
                    onChange={(v) => setField('ruralActivityType', v)}
                    onBlur={() => touchField('ruralActivityType')}
                  />
                </div>
              </fieldset>

              {submitError && (
                <div className="pj-form-modal__submit-error" role="alert">
                  <AlertCircle size={20} aria-hidden="true" />
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="pj-form-modal__footer">
          <button
            type="button"
            className="pj-form-modal__btn pj-form-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pj-form-modal__btn pj-form-modal__btn--primary"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="pj-form-modal__spinner" />
                {isEditMode ? 'Salvando...' : 'Cadastrando...'}
              </>
            ) : isEditMode ? (
              'Salvar alterações'
            ) : (
              'Cadastrar produtor'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ProducerPJFormModal;
