import { useEffect, useCallback } from 'react';
import { X, AlertCircle, Check, ChevronRight, Loader2, Info } from 'lucide-react';
import { useFarmForm, TOTAL_STEPS } from '@/hooks/useFarmForm';
import type { FormFields } from '@/hooks/useFarmForm';
import { VALID_UF } from '@/constants/states';
import './FarmFormModal.css';

const STEP_LABELS = ['Dados Básicos', 'Confirmação'];

function maskArea(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '0,' + digits.padStart(4, '0');
  const intPart = digits.slice(0, digits.length - 4).replace(/^0+/, '') || '0';
  const decPart = digits.slice(digits.length - 4);
  // Format integer part with dot as thousands separator
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intFormatted + ',' + decPart;
}

function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

interface FarmFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  farmId?: string;
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
  max?: string;
  step?: string;
  maxLength?: number;
  tooltip?: string;
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
  max,
  step,
  maxLength,
  tooltip,
  onChange,
  onBlur,
}: FieldInputProps) {
  const hasError = touched && !!error;
  return (
    <div className="farm-form-modal__field">
      <label htmlFor={id} className="farm-form-modal__label">
        {label}
        {required && <span className="farm-form-modal__required"> *</span>}
        {tooltip && (
          <span className="farm-form-modal__tooltip-wrapper">
            <Info
              size={14}
              aria-hidden="true"
              tabIndex={0}
              className="farm-form-modal__tooltip-icon"
            />
            <span className="farm-form-modal__tooltip" role="tooltip">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        className={`farm-form-modal__input ${hasError ? 'farm-form-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="farm-form-modal__error" role="alert">
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
    <div className="farm-form-modal__field">
      <label htmlFor={id} className="farm-form-modal__label">
        {label}
        {required && <span className="farm-form-modal__required"> *</span>}
      </label>
      <select
        id={id}
        className={`farm-form-modal__select ${hasError ? 'farm-form-modal__select--error' : ''}`}
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
        <span id={`${id}-error`} className="farm-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

interface StepIndicatorProps {
  currentStep: number;
  visitedSteps: Set<number>;
  onGoToStep: (step: number) => void;
}

function StepIndicator({ currentStep, visitedSteps, onGoToStep }: StepIndicatorProps) {
  return (
    <nav className="farm-form-modal__stepper" aria-label="Etapas do formulário">
      <ol className="farm-form-modal__steps">
        {STEP_LABELS.map((label, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          const isVisited = visitedSteps.has(i);

          return (
            <li
              key={i}
              className={`farm-form-modal__step ${isCurrent ? 'farm-form-modal__step--current' : ''} ${isComplete ? 'farm-form-modal__step--complete' : ''}`}
            >
              {i > 0 && <span className="farm-form-modal__step-connector" aria-hidden="true" />}
              <button
                type="button"
                className="farm-form-modal__step-btn"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Etapa ${i + 1}: ${label}${isComplete ? ' (concluída)' : ''}`}
                disabled={!isVisited}
                onClick={() => onGoToStep(i)}
              >
                <span className="farm-form-modal__step-dot">
                  {isComplete ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <span className="farm-form-modal__step-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="farm-form-modal__summary-section">
      <h3 className="farm-form-modal__summary-title">{title}</h3>
      <dl className="farm-form-modal__summary-list">{children}</dl>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="farm-form-modal__summary-dt">{label}</dt>
      <dd className="farm-form-modal__summary-dd">{value}</dd>
    </>
  );
}

function formatArea(value: string): string {
  if (!value) return '';
  return `${Number(value).toLocaleString('pt-BR')} ha`;
}

interface StepProps {
  formData: FormFields;
  errors: Partial<Record<keyof FormFields, string>>;
  touched: Partial<Record<keyof FormFields, boolean>>;
  setField: (field: keyof FormFields, value: string) => void;
  touchField: (field: keyof FormFields) => void;
}

function Step0({ formData, errors, touched, setField, touchField }: StepProps) {
  return (
    <div className="farm-form-modal__fields">
      <FieldInput
        id="name"
        label="Nome da fazenda"
        value={formData.name}
        error={errors.name}
        touched={touched.name}
        required
        placeholder="Ex: Fazenda Santa Helena"
        onChange={(v) => setField('name', v)}
        onBlur={() => touchField('name')}
      />
      <FieldInput
        id="nickname"
        label="Apelido"
        value={formData.nickname}
        placeholder="Nome curto ou sigla"
        onChange={(v) => setField('nickname', v)}
        onBlur={() => touchField('nickname')}
      />
      <FieldInput
        id="address"
        label="Endereço"
        value={formData.address}
        placeholder="Estrada, rodovia, etc."
        onChange={(v) => setField('address', v)}
        onBlur={() => touchField('address')}
      />
      <FieldInput
        id="city"
        label="Município"
        value={formData.city}
        placeholder="Ex: Uberlândia"
        onChange={(v) => setField('city', v)}
        onBlur={() => touchField('city')}
      />
      <FieldSelect
        id="state"
        label="UF"
        value={formData.state}
        error={errors.state}
        touched={touched.state}
        required
        placeholder="Selecione a UF"
        options={VALID_UF.map((uf) => ({ value: uf, label: uf }))}
        onChange={(v) => setField('state', v)}
        onBlur={() => touchField('state')}
      />
      <FieldInput
        id="zipCode"
        label="CEP"
        value={formData.zipCode}
        error={errors.zipCode}
        touched={touched.zipCode}
        placeholder="00000-000"
        maxLength={9}
        onChange={(v) => setField('zipCode', maskCep(v))}
        onBlur={() => touchField('zipCode')}
      />
      <FieldInput
        id="totalAreaHa"
        label="Área total (ha)"
        value={formData.totalAreaHa}
        error={errors.totalAreaHa}
        touched={touched.totalAreaHa}
        required
        placeholder="Ex: 150,0000"
        onChange={(v) => setField('totalAreaHa', maskArea(v))}
        onBlur={() => touchField('totalAreaHa')}
      />
    </div>
  );
}

function Step1({ formData }: { formData: FormFields }) {
  return (
    <div className="farm-form-modal__confirmation">
      <SummarySection title="Dados Básicos">
        <SummaryItem label="Nome" value={formData.name} />
        <SummaryItem label="Apelido" value={formData.nickname} />
        <SummaryItem label="Endereço" value={formData.address} />
        <SummaryItem label="Município" value={formData.city} />
        <SummaryItem label="UF" value={formData.state} />
        <SummaryItem label="CEP" value={formData.zipCode} />
        <SummaryItem label="Área total" value={formatArea(formData.totalAreaHa)} />
      </SummarySection>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="farm-form-modal__loading"
      aria-busy="true"
      aria-label="Carregando dados da fazenda"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="farm-form-modal__skeleton-field">
          <div className="farm-form-modal__skeleton-label" />
          <div className="farm-form-modal__skeleton-input" />
        </div>
      ))}
    </div>
  );
}

function FarmFormModal({ isOpen, onClose, onSuccess, farmId }: FarmFormModalProps) {
  const {
    formData,
    errors,
    touched,
    currentStep,
    visitedSteps,
    isSubmitting,
    submitError,
    isLoadingFarm,
    loadError,
    isEditMode,
    stepRef,
    setField,
    touchField,
    goNext,
    goBack,
    goToStep,
    submit,
    reset,
  } = useFarmForm({ farmId: isOpen ? farmId : undefined, onSuccess });

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const title = isEditMode ? 'Editar fazenda' : 'Nova fazenda';
  const submitLabel = isEditMode ? 'Salvar alterações' : 'Cadastrar fazenda';
  const submittingLabel = isEditMode ? 'Salvando...' : 'Cadastrando...';

  const stepProps: StepProps = { formData, errors, touched, setField, touchField };
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <div
      className="farm-form-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="farm-form-title"
    >
      <div className="farm-form-modal">
        <header className="farm-form-modal__header">
          <h2 id="farm-form-title" className="farm-form-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="farm-form-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <StepIndicator
          currentStep={currentStep}
          visitedSteps={visitedSteps}
          onGoToStep={goToStep}
        />

        <div className="farm-form-modal__body" ref={stepRef}>
          {isLoadingFarm ? (
            <LoadingSkeleton />
          ) : loadError ? (
            <div className="farm-form-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {loadError}
            </div>
          ) : (
            <>
              <h3 className="farm-form-modal__step-title">{STEP_LABELS[currentStep]}</h3>

              {currentStep === 0 && <Step0 {...stepProps} />}
              {currentStep === 1 && <Step1 formData={formData} />}

              {submitError && (
                <div className="farm-form-modal__submit-error" role="alert">
                  <AlertCircle size={20} aria-hidden="true" />
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="farm-form-modal__footer">
          {currentStep === 0 ? (
            <button
              type="button"
              className="farm-form-modal__btn farm-form-modal__btn--secondary"
              onClick={handleClose}
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              className="farm-form-modal__btn farm-form-modal__btn--secondary"
              onClick={goBack}
              disabled={isLoadingFarm}
            >
              Anterior
            </button>
          )}

          {isLastStep ? (
            <button
              type="button"
              className="farm-form-modal__btn farm-form-modal__btn--primary"
              onClick={submit}
              disabled={isSubmitting || isLoadingFarm}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} aria-hidden="true" className="farm-form-modal__spinner" />
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          ) : (
            <button
              type="button"
              className="farm-form-modal__btn farm-form-modal__btn--secondary"
              onClick={goNext}
              disabled={isLoadingFarm}
            >
              Próximo
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default FarmFormModal;
