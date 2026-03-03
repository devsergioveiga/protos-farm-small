import { Link } from 'react-router-dom';
import { AlertCircle, Check, ChevronRight, Loader2 } from 'lucide-react';
import { useCreateFarm, LAND_CLASSIFICATIONS, TOTAL_STEPS } from '@/hooks/useCreateFarm';
import type { FormFields } from '@/hooks/useCreateFarm';
import { VALID_UF } from '@/constants/states';
import './CreateFarmPage.css';

const STEP_LABELS = ['Dados Básicos', 'Identificadores', 'Dados Ambientais', 'Confirmação'];

const CLASSIFICATION_LABELS: Record<string, string> = {
  MINIFUNDIO: 'Minifúndio',
  PEQUENA: 'Pequena propriedade',
  MEDIA: 'Média propriedade',
  GRANDE: 'Grande propriedade',
};

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
  onChange,
  onBlur,
}: FieldInputProps) {
  const hasError = touched && !!error;
  return (
    <div className="create-farm__field">
      <label htmlFor={id} className="create-farm__label">
        {label}
        {required && <span className="create-farm__required"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`create-farm__input ${hasError ? 'create-farm__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="create-farm__error" role="alert">
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
    <div className="create-farm__field">
      <label htmlFor={id} className="create-farm__label">
        {label}
        {required && <span className="create-farm__required"> *</span>}
      </label>
      <select
        id={id}
        className={`create-farm__select ${hasError ? 'create-farm__select--error' : ''}`}
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
        <span id={`${id}-error`} className="create-farm__error" role="alert">
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
    <nav className="create-farm__stepper" aria-label="Etapas do formulário">
      <ol className="create-farm__steps">
        {STEP_LABELS.map((label, i) => {
          const isComplete = i < currentStep;
          const isCurrent = i === currentStep;
          const isVisited = visitedSteps.has(i);

          return (
            <li
              key={i}
              className={`create-farm__step ${isCurrent ? 'create-farm__step--current' : ''} ${isComplete ? 'create-farm__step--complete' : ''}`}
            >
              {i > 0 && <span className="create-farm__step-connector" aria-hidden="true" />}
              <button
                type="button"
                className="create-farm__step-btn"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Etapa ${i + 1}: ${label}${isComplete ? ' (concluída)' : ''}`}
                disabled={!isVisited}
                onClick={() => onGoToStep(i)}
              >
                <span className="create-farm__step-dot">
                  {isComplete ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <span className="create-farm__step-label">{label}</span>
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
    <section className="create-farm__summary-section">
      <h3 className="create-farm__summary-title">{title}</h3>
      <dl className="create-farm__summary-list">{children}</dl>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="create-farm__summary-dt">{label}</dt>
      <dd className="create-farm__summary-dd">{value}</dd>
    </>
  );
}

function formatArea(value: string): string {
  if (!value) return '';
  return `${Number(value).toLocaleString('pt-BR')} ha`;
}

function Step0({ formData, errors, touched, setField, touchField }: StepProps) {
  return (
    <div className="create-farm__fields">
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
        placeholder="XXXXX-XXX"
        onChange={(v) => setField('zipCode', v)}
        onBlur={() => touchField('zipCode')}
      />
      <FieldInput
        id="totalAreaHa"
        label="Área total (ha)"
        value={formData.totalAreaHa}
        error={errors.totalAreaHa}
        touched={touched.totalAreaHa}
        required
        type="number"
        placeholder="Ex: 150.5"
        min="0.01"
        step="0.01"
        onChange={(v) => setField('totalAreaHa', v)}
        onBlur={() => touchField('totalAreaHa')}
      />
    </div>
  );
}

function Step1({ formData, errors, touched, setField, touchField }: StepProps) {
  return (
    <div className="create-farm__fields">
      <FieldInput
        id="cib"
        label="CIB"
        value={formData.cib}
        error={errors.cib}
        touched={touched.cib}
        placeholder="XXX.XXX.XXX-X"
        onChange={(v) => setField('cib', v)}
        onBlur={() => touchField('cib')}
      />
      <FieldInput
        id="incraCode"
        label="Código INCRA"
        value={formData.incraCode}
        onChange={(v) => setField('incraCode', v)}
        onBlur={() => touchField('incraCode')}
      />
      <FieldInput
        id="ccirCode"
        label="Código CCIR"
        value={formData.ccirCode}
        onChange={(v) => setField('ccirCode', v)}
        onBlur={() => touchField('ccirCode')}
      />
      <FieldInput
        id="carCode"
        label="Código CAR"
        value={formData.carCode}
        onChange={(v) => setField('carCode', v)}
        onBlur={() => touchField('carCode')}
      />
    </div>
  );
}

function Step2({ formData, errors, touched, setField, touchField }: StepProps) {
  return (
    <div className="create-farm__fields">
      <FieldSelect
        id="landClassification"
        label="Classificação fundiária"
        value={formData.landClassification}
        error={errors.landClassification}
        touched={touched.landClassification}
        placeholder="Selecione..."
        options={LAND_CLASSIFICATIONS.map((c) => ({
          value: c,
          label: CLASSIFICATION_LABELS[c] || c,
        }))}
        onChange={(v) => setField('landClassification', v)}
        onBlur={() => touchField('landClassification')}
      />
      <div className="create-farm__field create-farm__field--checkbox">
        <label className="create-farm__checkbox-label">
          <input
            type="checkbox"
            className="create-farm__checkbox"
            checked={formData.productive === 'true'}
            onChange={(e) => setField('productive', String(e.target.checked))}
          />
          Produtiva
        </label>
      </div>
      <FieldInput
        id="appAreaHa"
        label="Área APP (ha)"
        value={formData.appAreaHa}
        error={errors.appAreaHa}
        touched={touched.appAreaHa}
        type="number"
        placeholder="0"
        min="0"
        step="0.01"
        onChange={(v) => setField('appAreaHa', v)}
        onBlur={() => touchField('appAreaHa')}
      />
      <FieldInput
        id="legalReserveHa"
        label="Reserva legal (ha)"
        value={formData.legalReserveHa}
        error={errors.legalReserveHa}
        touched={touched.legalReserveHa}
        type="number"
        placeholder="0"
        min="0"
        step="0.01"
        onChange={(v) => setField('legalReserveHa', v)}
        onBlur={() => touchField('legalReserveHa')}
      />
      <FieldInput
        id="taxableAreaHa"
        label="Área tributável (ha)"
        value={formData.taxableAreaHa}
        error={errors.taxableAreaHa}
        touched={touched.taxableAreaHa}
        type="number"
        placeholder="0"
        min="0"
        step="0.01"
        onChange={(v) => setField('taxableAreaHa', v)}
        onBlur={() => touchField('taxableAreaHa')}
      />
      <FieldInput
        id="usableAreaHa"
        label="Área utilizável (ha)"
        value={formData.usableAreaHa}
        error={errors.usableAreaHa}
        touched={touched.usableAreaHa}
        type="number"
        placeholder="0"
        min="0"
        step="0.01"
        onChange={(v) => setField('usableAreaHa', v)}
        onBlur={() => touchField('usableAreaHa')}
      />
      <FieldInput
        id="utilizationDegree"
        label="Grau de utilização (%)"
        value={formData.utilizationDegree}
        error={errors.utilizationDegree}
        touched={touched.utilizationDegree}
        type="number"
        placeholder="0-100"
        min="0"
        max="100"
        step="0.1"
        onChange={(v) => setField('utilizationDegree', v)}
        onBlur={() => touchField('utilizationDegree')}
      />
    </div>
  );
}

function Step3({ formData }: { formData: FormFields }) {
  return (
    <div className="create-farm__confirmation">
      <SummarySection title="Dados Básicos">
        <SummaryItem label="Nome" value={formData.name} />
        <SummaryItem label="Apelido" value={formData.nickname} />
        <SummaryItem label="Endereço" value={formData.address} />
        <SummaryItem label="Município" value={formData.city} />
        <SummaryItem label="UF" value={formData.state} />
        <SummaryItem label="CEP" value={formData.zipCode} />
        <SummaryItem label="Área total" value={formatArea(formData.totalAreaHa)} />
      </SummarySection>

      <SummarySection title="Identificadores">
        <SummaryItem label="CIB" value={formData.cib} />
        <SummaryItem label="Código INCRA" value={formData.incraCode} />
        <SummaryItem label="Código CCIR" value={formData.ccirCode} />
        <SummaryItem label="Código CAR" value={formData.carCode} />
      </SummarySection>

      <SummarySection title="Dados Ambientais">
        <SummaryItem
          label="Classificação"
          value={CLASSIFICATION_LABELS[formData.landClassification] || ''}
        />
        <SummaryItem label="Produtiva" value={formData.productive === 'true' ? 'Sim' : 'Não'} />
        <SummaryItem label="Área APP" value={formatArea(formData.appAreaHa)} />
        <SummaryItem label="Reserva legal" value={formatArea(formData.legalReserveHa)} />
        <SummaryItem label="Área tributável" value={formatArea(formData.taxableAreaHa)} />
        <SummaryItem label="Área utilizável" value={formatArea(formData.usableAreaHa)} />
        <SummaryItem
          label="Grau de utilização"
          value={formData.utilizationDegree ? `${formData.utilizationDegree}%` : ''}
        />
      </SummarySection>
    </div>
  );
}

interface StepProps {
  formData: FormFields;
  errors: Partial<Record<keyof FormFields, string>>;
  touched: Partial<Record<keyof FormFields, boolean>>;
  setField: (field: keyof FormFields, value: string) => void;
  touchField: (field: keyof FormFields) => void;
}

function CreateFarmPage() {
  const {
    formData,
    errors,
    touched,
    currentStep,
    visitedSteps,
    isSubmitting,
    submitError,
    stepRef,
    setField,
    touchField,
    goNext,
    goBack,
    goToStep,
    submit,
  } = useCreateFarm();

  const stepProps: StepProps = { formData, errors, touched, setField, touchField };

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  return (
    <main className="create-farm">
      <nav className="create-farm__breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Início</Link>
        <span aria-hidden="true">/</span>
        <Link to="/farms">Fazendas</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Nova fazenda</span>
      </nav>

      <h1 className="create-farm__title">Nova fazenda</h1>

      <StepIndicator currentStep={currentStep} visitedSteps={visitedSteps} onGoToStep={goToStep} />

      <div className="create-farm__body" ref={stepRef}>
        <h2 className="create-farm__step-title">{STEP_LABELS[currentStep]}</h2>

        {currentStep === 0 && <Step0 {...stepProps} />}
        {currentStep === 1 && <Step1 {...stepProps} />}
        {currentStep === 2 && <Step2 {...stepProps} />}
        {currentStep === 3 && <Step3 formData={formData} />}

        {submitError && (
          <div className="create-farm__submit-error" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            {submitError}
          </div>
        )}

        <div className="create-farm__actions">
          {currentStep === 0 ? (
            <Link to="/farms" className="create-farm__btn create-farm__btn--ghost">
              Cancelar
            </Link>
          ) : (
            <button
              type="button"
              className="create-farm__btn create-farm__btn--ghost"
              onClick={goBack}
            >
              Anterior
            </button>
          )}

          {isLastStep ? (
            <button
              type="button"
              className="create-farm__btn create-farm__btn--primary"
              onClick={submit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} aria-hidden="true" className="create-farm__spinner" />
                  Cadastrando...
                </>
              ) : (
                'Cadastrar fazenda'
              )}
            </button>
          ) : (
            <button
              type="button"
              className="create-farm__btn create-farm__btn--secondary"
              onClick={goNext}
            >
              Próximo
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default CreateFarmPage;
