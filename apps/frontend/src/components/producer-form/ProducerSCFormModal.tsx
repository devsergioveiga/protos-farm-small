import { useEffect, useCallback } from 'react';
import { X, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import { formatCpfInput } from '@/hooks/useCreateProducer';
import { useCreateProducerSC } from '@/hooks/useCreateProducerSC';
import './ProducerSCFormModal.css';

const TAX_REGIME_OPTIONS = [
  { value: 'REAL', label: 'Lucro Real' },
  { value: 'PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'SIMPLES', label: 'Simples Nacional' },
  { value: 'ISENTO', label: 'Isento' },
];

interface ProducerSCFormModalProps {
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
    <div className={`sc-form-modal__field${fullWidth ? ' sc-form-modal__field--full' : ''}`}>
      <label htmlFor={id} className="sc-form-modal__label">
        {label}
        {required && <span className="sc-form-modal__required"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className={`sc-form-modal__input${mono ? ' sc-form-modal__input--mono' : ''}${hasError ? ' sc-form-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="sc-form-modal__error" role="alert">
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
    <div className="sc-form-modal__field">
      <label htmlFor={id} className="sc-form-modal__label">
        {label}
        {required && <span className="sc-form-modal__required"> *</span>}
      </label>
      <select
        id={id}
        className={`sc-form-modal__select${hasError ? ' sc-form-modal__select--error' : ''}`}
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
        <span id={`${id}-error`} className="sc-form-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

function ProducerSCFormModal({ isOpen, onClose, onSuccess, producerId }: ProducerSCFormModalProps) {
  const {
    formData,
    participants,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    isLoadingDetail,
    totalPct,
    setField,
    touchField,
    addParticipant,
    removeParticipant,
    setParticipantField,
    submit,
    reset,
  } = useCreateProducerSC({ onSuccess, producerId });

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
      className="sc-form-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sc-form-title"
    >
      <div className="sc-form-modal">
        <header className="sc-form-modal__header">
          <h2 id="sc-form-title" className="sc-form-modal__title">
            {isEditMode
              ? 'Editar produtor — Sociedade em Comum'
              : 'Novo produtor — Sociedade em Comum'}
          </h2>
          <button
            type="button"
            className="sc-form-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="sc-form-modal__body">
          {isLoadingDetail ? (
            <div data-testid="sc-form-skeleton">
              <div
                className="sc-form-modal__skeleton"
                style={{ width: '40%', height: 20, marginBottom: 16 }}
              />
              <div
                className="sc-form-modal__skeleton"
                style={{ width: '100%', height: 120, marginBottom: 24 }}
              />
              <div
                className="sc-form-modal__skeleton"
                style={{ width: '50%', height: 20, marginBottom: 16 }}
              />
              <div className="sc-form-modal__skeleton" style={{ width: '100%', height: 80 }} />
            </div>
          ) : (
            <>
              {/* Dados da Sociedade */}
              <fieldset className="sc-form-modal__section">
                <legend className="sc-form-modal__section-title">Dados da Sociedade</legend>
                <div className="sc-form-modal__fields">
                  <FieldInput
                    id="sc-name"
                    label="Nome da sociedade"
                    value={formData.name}
                    error={errors.fields.name}
                    touched={touched.name}
                    required
                    placeholder="Ex: Irmãos Silva"
                    fullWidth
                    onChange={(v) => setField('name', v)}
                    onBlur={() => touchField('name')}
                  />
                  <FieldInput
                    id="sc-trade-name"
                    label="Nome fantasia"
                    value={formData.tradeName}
                    placeholder="Opcional"
                    onChange={(v) => setField('tradeName', v)}
                    onBlur={() => touchField('tradeName')}
                  />
                  <FieldInput
                    id="sc-address"
                    label="Endereço"
                    value={formData.address}
                    placeholder="Rua, número, complemento"
                    fullWidth
                    onChange={(v) => setField('address', v)}
                    onBlur={() => touchField('address')}
                  />
                  <FieldInput
                    id="sc-city"
                    label="Município"
                    value={formData.city}
                    placeholder="Ex: Uberlândia"
                    onChange={(v) => setField('city', v)}
                    onBlur={() => touchField('city')}
                  />
                  <FieldSelect
                    id="sc-state"
                    label="UF"
                    value={formData.state}
                    error={errors.fields.state}
                    touched={touched.state}
                    placeholder="Selecione a UF"
                    options={VALID_UF.map((uf) => ({ value: uf, label: uf }))}
                    onChange={(v) => setField('state', v)}
                    onBlur={() => touchField('state')}
                  />
                  <FieldInput
                    id="sc-zip-code"
                    label="CEP"
                    value={formData.zipCode}
                    error={errors.fields.zipCode}
                    touched={touched.zipCode}
                    placeholder="00000-000"
                    onChange={(v) => setField('zipCode', v)}
                    onBlur={() => touchField('zipCode')}
                  />
                  <FieldSelect
                    id="sc-tax-regime"
                    label="Regime tributário"
                    value={formData.taxRegime}
                    placeholder="Selecione..."
                    options={TAX_REGIME_OPTIONS}
                    onChange={(v) => setField('taxRegime', v)}
                    onBlur={() => touchField('taxRegime')}
                  />
                </div>
              </fieldset>

              {/* Participantes */}
              <fieldset className="sc-form-modal__section">
                <legend className="sc-form-modal__section-title">Participantes (Sócios)</legend>
                <div className="sc-form-modal__participant-list">
                  {participants.map((p, index) => (
                    <div
                      key={index}
                      className="sc-form-modal__participant-row"
                      data-testid={`participant-row-${index}`}
                    >
                      <div className="sc-form-modal__participant-header">
                        <span className="sc-form-modal__participant-number">
                          Participante {index + 1}
                        </span>
                        <button
                          type="button"
                          className="sc-form-modal__participant-remove"
                          aria-label={`Remover participante ${index + 1}`}
                          disabled={participants.length <= 2}
                          onClick={() => removeParticipant(index)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="sc-form-modal__field">
                        <label htmlFor={`sc-p-name-${index}`} className="sc-form-modal__label">
                          Nome <span className="sc-form-modal__required">*</span>
                        </label>
                        <input
                          id={`sc-p-name-${index}`}
                          type="text"
                          className="sc-form-modal__input"
                          value={p.name}
                          placeholder="Nome do participante"
                          aria-required="true"
                          onChange={(e) => setParticipantField(index, 'name', e.target.value)}
                        />
                      </div>

                      <div className="sc-form-modal__field">
                        <label htmlFor={`sc-p-cpf-${index}`} className="sc-form-modal__label">
                          CPF <span className="sc-form-modal__required">*</span>
                        </label>
                        <input
                          id={`sc-p-cpf-${index}`}
                          type="text"
                          className="sc-form-modal__input sc-form-modal__input--mono"
                          value={p.cpf}
                          placeholder="000.000.000-00"
                          aria-required="true"
                          onChange={(e) =>
                            setParticipantField(index, 'cpf', formatCpfInput(e.target.value))
                          }
                        />
                      </div>

                      <div className="sc-form-modal__field">
                        <label htmlFor={`sc-p-pct-${index}`} className="sc-form-modal__label">
                          % <span className="sc-form-modal__required">*</span>
                        </label>
                        <input
                          id={`sc-p-pct-${index}`}
                          type="number"
                          className="sc-form-modal__input"
                          value={p.participationPct}
                          placeholder="50"
                          min="0.01"
                          max="100"
                          step="0.01"
                          aria-required="true"
                          aria-label={`Percentual do participante ${index + 1}`}
                          onChange={(e) =>
                            setParticipantField(index, 'participationPct', e.target.value)
                          }
                        />
                      </div>

                      <div className="sc-form-modal__checkbox-row">
                        <input
                          id={`sc-p-main-${index}`}
                          type="checkbox"
                          className="sc-form-modal__checkbox"
                          checked={p.isMainResponsible}
                          onChange={(e) =>
                            setParticipantField(index, 'isMainResponsible', e.target.checked)
                          }
                        />
                        <label
                          htmlFor={`sc-p-main-${index}`}
                          className="sc-form-modal__checkbox-label"
                        >
                          Responsável principal
                        </label>
                      </div>

                      {errors.participants[index] && (
                        <div
                          className="sc-form-modal__error"
                          role="alert"
                          style={{ gridColumn: '1 / -1' }}
                        >
                          <AlertCircle size={16} aria-hidden="true" />
                          {errors.participants[index]}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    className="sc-form-modal__add-participant"
                    onClick={addParticipant}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Adicionar participante
                  </button>

                  <div
                    className={`sc-form-modal__pct-summary${totalPct > 100 ? ' sc-form-modal__pct-summary--over' : ''}`}
                  >
                    Total: {totalPct.toFixed(2)}%
                  </div>

                  {errors.global && (
                    <div className="sc-form-modal__global-error" role="alert">
                      <AlertCircle size={16} aria-hidden="true" />
                      {errors.global}
                    </div>
                  )}
                </div>
              </fieldset>

              {submitError && (
                <div className="sc-form-modal__submit-error" role="alert">
                  <AlertCircle size={20} aria-hidden="true" />
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="sc-form-modal__footer">
          <button
            type="button"
            className="sc-form-modal__btn sc-form-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="sc-form-modal__btn sc-form-modal__btn--primary"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="sc-form-modal__spinner" />
                {isEditMode ? 'Salvando...' : 'Cadastrando...'}
              </>
            ) : isEditMode ? (
              'Salvar alterações'
            ) : (
              'Cadastrar sociedade'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ProducerSCFormModal;
