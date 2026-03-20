import { useEffect, useCallback, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Plus, Trash2, Upload, CheckCircle2, Users } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import { formatCpfInput, formatCepInput } from '@/hooks/useCreateProducer';
import { useCreateProducerSC } from '@/hooks/useCreateProducerSC';
import { parseIeDocument } from '@/utils/parseIeDocument';
import './ProducerSCFormModal.css';

const CATEGORY_OPTIONS = [
  { value: 'PRIMEIRO_ESTABELECIMENTO', label: 'Primeiro Estabelecimento' },
  { value: 'DEMAIS', label: 'Demais' },
  { value: 'UNICO', label: 'Único' },
];

const SITUATION_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'SUSPENDED', label: 'Suspenso' },
  { value: 'CANCELLED', label: 'Cancelado' },
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
    replaceAllParticipants,
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

  // ─── PDF upload / auto-fill ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handlePdfUpload = useCallback(
    async (file: File) => {
      setIsParsing(true);
      setParseStatus('idle');
      try {
        const parsed = await parseIeDocument(file);
        const p = parsed.producer;
        const ie = parsed.ie;
        // Dados Cadastrais
        if (ie.number) setField('ieNumber', ie.number);
        if (p.name) setField('name', p.name);
        if (p.tradeName) setField('tradeName', p.tradeName);
        if (ie.cnaeActivity) setField('cnaeActivity', ie.cnaeActivity);
        if (ie.assessmentRegime) setField('assessmentRegime', ie.assessmentRegime);
        if (ie.category) setField('category', ie.category);
        if (ie.inscriptionDate) setField('inscriptionDate', ie.inscriptionDate);
        if (ie.contractEndDate) setField('contractEndDate', ie.contractEndDate);
        if (ie.situation) setField('situation', ie.situation);
        // Endereço
        if (p.zipCode) setField('zipCode', p.zipCode);
        if (p.state) setField('state', p.state);
        if (p.city) setField('city', p.city);
        if (p.district) setField('district', p.district);
        if (p.neighborhood) setField('neighborhood', p.neighborhood);
        if (p.street) setField('street', p.street);
        if (p.addressNumber) setField('addressNumber', p.addressNumber);
        if (p.complement) setField('complement', p.complement);
        if (p.locationReference) setField('locationReference', p.locationReference);
        // Extra
        setField('milkProgramOptIn', ie.milkProgramOptIn);

        // Fill participants from document
        if (parsed.participants.length >= 2) {
          const pct = (100 / parsed.participants.length).toFixed(2);
          const rows = parsed.participants.map((part, i) => ({
            name: part.name,
            cpf: formatCpfInput(part.cpf.replace(/\D/g, '')),
            participationPct: pct,
            isMainResponsible: i === 0,
          }));
          replaceAllParticipants(rows);
        }

        setParseStatus('success');
      } catch {
        setParseStatus('error');
      } finally {
        setIsParsing(false);
      }
    },
    [setField, replaceAllParticipants],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type === 'application/pdf') {
        void handlePdfUpload(file);
      }
      e.target.value = '';
    },
    [handlePdfUpload],
  );

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
          <div className="sc-form-modal__header-info">
            <h2 id="sc-form-title" className="sc-form-modal__title">
              {isEditMode ? 'Editar produtor' : 'Novo produtor'}
            </h2>
            <span className="sc-form-modal__type-badge">
              <Users size={14} aria-hidden="true" />
              Sociedade em Comum
            </span>
          </div>
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
              {/* Upload de documento */}
              {!isEditMode && (
                <div className="sc-form-modal__upload-section">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sc-form-modal__file-input"
                    onChange={onFileChange}
                    aria-label="Anexar comprovante de Inscrição Estadual (PDF)"
                  />
                  <button
                    type="button"
                    className="sc-form-modal__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 size={18} aria-hidden="true" className="sc-form-modal__spinner" />
                        Lendo documento...
                      </>
                    ) : (
                      <>
                        <Upload size={18} aria-hidden="true" />
                        Importar dados da Inscrição Estadual (PDF)
                      </>
                    )}
                  </button>
                  {parseStatus === 'success' && (
                    <span className="sc-form-modal__upload-status sc-form-modal__upload-status--success">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Dados importados com sucesso. Revise os campos antes de salvar.
                    </span>
                  )}
                  {parseStatus === 'error' && (
                    <span
                      className="sc-form-modal__upload-status sc-form-modal__upload-status--error"
                      role="alert"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      Não foi possível ler o documento. Verifique se é um PDF de Inscrição Estadual.
                    </span>
                  )}
                </div>
              )}

              {/* Dados Cadastrais */}
              <fieldset className="sc-form-modal__section">
                <legend className="sc-form-modal__section-title">Dados Cadastrais</legend>
                <div className="sc-form-modal__fields">
                  <FieldInput
                    id="sc-ie-number"
                    label="Inscrição Estadual"
                    value={formData.ieNumber}
                    placeholder="Ex: 001418131.00-86"
                    mono
                    fullWidth
                    onChange={(v) => setField('ieNumber', v)}
                    onBlur={() => touchField('ieNumber')}
                  />
                  <FieldInput
                    id="sc-name"
                    label="Nome do Responsável"
                    value={formData.name}
                    error={errors.fields.name}
                    touched={touched.name}
                    required
                    placeholder="Ex: Lucas Pimenta Veiga e outro(s)"
                    fullWidth
                    onChange={(v) => setField('name', v)}
                    onBlur={() => touchField('name')}
                  />
                  <FieldInput
                    id="sc-trade-name"
                    label="Nome do Estabelecimento / Propriedade Rural"
                    value={formData.tradeName}
                    placeholder="Ex: Fazenda Limeira"
                    fullWidth
                    onChange={(v) => setField('tradeName', v)}
                    onBlur={() => touchField('tradeName')}
                  />
                  <FieldInput
                    id="sc-cnae"
                    label="CNAE/Descrição"
                    value={formData.cnaeActivity}
                    placeholder="Ex: 0134-2/00 - Cultivo de café"
                    fullWidth
                    onChange={(v) => setField('cnaeActivity', v)}
                    onBlur={() => touchField('cnaeActivity')}
                  />
                  <FieldInput
                    id="sc-assessment"
                    label="Regime de Apuração"
                    value={formData.assessmentRegime}
                    placeholder="Ex: Débito e Crédito"
                    onChange={(v) => setField('assessmentRegime', v)}
                    onBlur={() => touchField('assessmentRegime')}
                  />
                  <FieldSelect
                    id="sc-category"
                    label="Categoria"
                    value={formData.category}
                    placeholder="Selecione..."
                    options={CATEGORY_OPTIONS}
                    onChange={(v) => setField('category', v)}
                    onBlur={() => touchField('category')}
                  />
                  <FieldInput
                    id="sc-inscription-date"
                    label="Data da Inscrição"
                    value={formData.inscriptionDate}
                    type="date"
                    onChange={(v) => setField('inscriptionDate', v)}
                    onBlur={() => touchField('inscriptionDate')}
                  />
                  <FieldInput
                    id="sc-contract-end"
                    label="Data do Fim do Contrato"
                    value={formData.contractEndDate}
                    type="date"
                    onChange={(v) => setField('contractEndDate', v)}
                    onBlur={() => touchField('contractEndDate')}
                  />
                  <FieldSelect
                    id="sc-situation"
                    label="Situação da Inscrição"
                    value={formData.situation}
                    placeholder="Selecione..."
                    options={SITUATION_OPTIONS}
                    onChange={(v) => setField('situation', v)}
                    onBlur={() => touchField('situation')}
                  />
                </div>
              </fieldset>

              {/* Endereço do Estabelecimento */}
              <fieldset className="sc-form-modal__section">
                <legend className="sc-form-modal__section-title">
                  Endereço do Estabelecimento
                </legend>
                <div className="sc-form-modal__fields">
                  <FieldInput
                    id="sc-zip-code"
                    label="CEP"
                    value={formData.zipCode}
                    error={errors.fields.zipCode}
                    touched={touched.zipCode}
                    placeholder="00000-000"
                    onChange={(v) => setField('zipCode', formatCepInput(v))}
                    onBlur={() => touchField('zipCode')}
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
                    id="sc-city"
                    label="Município"
                    value={formData.city}
                    placeholder="Ex: Nepomuceno"
                    onChange={(v) => setField('city', v)}
                    onBlur={() => touchField('city')}
                  />
                  <FieldInput
                    id="sc-district"
                    label="Distrito/Povoado"
                    value={formData.district}
                    placeholder="Opcional"
                    onChange={(v) => setField('district', v)}
                    onBlur={() => touchField('district')}
                  />
                  <FieldInput
                    id="sc-neighborhood"
                    label="Bairro"
                    value={formData.neighborhood}
                    placeholder="Ex: Zona Rural"
                    fullWidth
                    onChange={(v) => setField('neighborhood', v)}
                    onBlur={() => touchField('neighborhood')}
                  />
                  <FieldInput
                    id="sc-street"
                    label="Logradouro"
                    value={formData.street}
                    placeholder="Ex: Fazenda Limeira"
                    fullWidth
                    onChange={(v) => setField('street', v)}
                    onBlur={() => touchField('street')}
                  />
                  <FieldInput
                    id="sc-address-number"
                    label="Número"
                    value={formData.addressNumber}
                    placeholder="Ex: S/N"
                    onChange={(v) => setField('addressNumber', v)}
                    onBlur={() => touchField('addressNumber')}
                  />
                  <FieldInput
                    id="sc-complement"
                    label="Complemento"
                    value={formData.complement}
                    placeholder="Opcional"
                    onChange={(v) => setField('complement', v)}
                    onBlur={() => touchField('complement')}
                  />
                  <FieldInput
                    id="sc-location-reference"
                    label="Referência de Localização"
                    value={formData.locationReference}
                    placeholder="Ex: Km 2 Estrada Porto do Faria"
                    fullWidth
                    onChange={(v) => setField('locationReference', v)}
                    onBlur={() => touchField('locationReference')}
                  />
                </div>
              </fieldset>

              {/* Participantes */}
              <fieldset className="sc-form-modal__section">
                <legend className="sc-form-modal__section-title">
                  Participantes da Sociedade em Comum
                </legend>
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

              {/* Optante pelo Programa de Leite */}
              <div className="sc-form-modal__milk-checkbox-row">
                <input
                  id="sc-milk"
                  type="checkbox"
                  className="sc-form-modal__checkbox"
                  checked={formData.milkProgramOptIn}
                  onChange={(e) => setField('milkProgramOptIn', e.target.checked)}
                />
                <label htmlFor="sc-milk" className="sc-form-modal__checkbox-label">
                  Optante pelo Programa de Leite
                </label>
              </div>

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
          <span className="sc-form-modal__required-hint">
            <span className="sc-form-modal__required">*</span> Campos obrigatórios
          </span>
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
