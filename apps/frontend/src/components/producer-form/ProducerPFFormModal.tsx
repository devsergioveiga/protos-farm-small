import { useEffect, useCallback, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Upload, CheckCircle2, User } from 'lucide-react';
import { VALID_UF } from '@/constants/states';
import {
  useCreateProducer,
  formatCpfInput,
  formatCepInput,
  type PFFieldKey,
} from '@/hooks/useCreateProducer';
import { parseIeDocument } from '@/utils/parseIeDocument';
import './ProducerPFFormModal.css';

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

interface ProducerPFFormModalProps {
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

function ProducerPFFormModal({ isOpen, onClose, onSuccess, producerId }: ProducerPFFormModalProps) {
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
    submit,
    reset,
  } = useCreateProducer({ onSuccess, producerId });

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
        if (p.cpf) setField('document', formatCpfInput(p.cpf.replace(/\D/g, '')));
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
        setParseStatus('success');
      } catch {
        setParseStatus('error');
      } finally {
        setIsParsing(false);
      }
    },
    [setField],
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
          <div className="pf-form-modal__header-info">
            <h2 id="pf-form-title" className="pf-form-modal__title">
              {isEditMode ? 'Editar produtor' : 'Novo produtor'}
            </h2>
            <span className="pf-form-modal__type-badge">
              <User size={14} aria-hidden="true" />
              Pessoa Física
            </span>
          </div>
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
          {isLoadingDetail ? (
            <div data-testid="pf-form-skeleton">
              <div
                className="pf-form-modal__skeleton"
                style={{ width: '40%', height: 20, marginBottom: 16 }}
              />
              <div
                className="pf-form-modal__skeleton"
                style={{ width: '100%', height: 120, marginBottom: 24 }}
              />
              <div
                className="pf-form-modal__skeleton"
                style={{ width: '50%', height: 20, marginBottom: 16 }}
              />
              <div className="pf-form-modal__skeleton" style={{ width: '100%', height: 80 }} />
            </div>
          ) : (
            <>
              {/* Upload de documento */}
              {!isEditMode && (
                <div className="pf-form-modal__upload-section">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="pf-form-modal__file-input"
                    onChange={onFileChange}
                    aria-label="Anexar comprovante de Inscrição Estadual (PDF)"
                  />
                  <button
                    type="button"
                    className="pf-form-modal__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsing}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 size={18} aria-hidden="true" className="pf-form-modal__spinner" />
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
                    <span className="pf-form-modal__upload-status pf-form-modal__upload-status--success">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Dados importados com sucesso. Revise os campos antes de salvar.
                    </span>
                  )}
                  {parseStatus === 'error' && (
                    <span
                      className="pf-form-modal__upload-status pf-form-modal__upload-status--error"
                      role="alert"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      Não foi possível ler o documento. Verifique se é um PDF de Inscrição Estadual.
                    </span>
                  )}
                </div>
              )}

              {/* Dados Cadastrais */}
              <fieldset className="pf-form-modal__section">
                <legend className="pf-form-modal__section-title">Dados Cadastrais</legend>
                <div className="pf-form-modal__fields">
                  <FieldInput
                    id="pf-ie-number"
                    label="Inscrição Estadual"
                    value={formData.ieNumber}
                    placeholder="Ex: 004382845.00-24"
                    mono
                    onChange={(v) => setField('ieNumber', v)}
                    onBlur={() => touchField('ieNumber')}
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
                    id="pf-name"
                    label="Nome do Responsável"
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
                    id="pf-trade-name"
                    label="Nome do Estabelecimento / Propriedade Rural"
                    value={formData.tradeName}
                    placeholder="Ex: Fazenda Limeira"
                    fullWidth
                    onChange={(v) => setField('tradeName', v)}
                    onBlur={() => touchField('tradeName')}
                  />
                  <FieldInput
                    id="pf-cnae"
                    label="CNAE/Descrição"
                    value={formData.cnaeActivity}
                    placeholder="Ex: 0151-2/02 - Criação de bovinos para leite"
                    fullWidth
                    onChange={(v) => setField('cnaeActivity', v)}
                    onBlur={() => touchField('cnaeActivity')}
                  />
                  <FieldInput
                    id="pf-assessment"
                    label="Regime de Apuração"
                    value={formData.assessmentRegime}
                    placeholder="Ex: Débito e Crédito"
                    onChange={(v) => setField('assessmentRegime', v)}
                    onBlur={() => touchField('assessmentRegime')}
                  />
                  <FieldSelect
                    id="pf-category"
                    label="Categoria"
                    value={formData.category}
                    placeholder="Selecione..."
                    options={CATEGORY_OPTIONS}
                    onChange={(v) => setField('category', v)}
                    onBlur={() => touchField('category')}
                  />
                  <FieldInput
                    id="pf-inscription-date"
                    label="Data da Inscrição"
                    value={formData.inscriptionDate}
                    type="date"
                    onChange={(v) => setField('inscriptionDate', v)}
                    onBlur={() => touchField('inscriptionDate')}
                  />
                  <FieldInput
                    id="pf-contract-end"
                    label="Data do Fim do Contrato"
                    value={formData.contractEndDate}
                    type="date"
                    onChange={(v) => setField('contractEndDate', v)}
                    onBlur={() => touchField('contractEndDate')}
                  />
                  <FieldSelect
                    id="pf-situation"
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
              <fieldset className="pf-form-modal__section">
                <legend className="pf-form-modal__section-title">
                  Endereço do Estabelecimento
                </legend>
                <div className="pf-form-modal__fields">
                  <FieldInput
                    id="pf-zip-code"
                    label="CEP"
                    value={formData.zipCode}
                    error={errors.zipCode}
                    touched={touched.zipCode}
                    placeholder="00000-000"
                    onChange={(v) => setField('zipCode', formatCepInput(v))}
                    onBlur={() => touchField('zipCode')}
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
                    id="pf-city"
                    label="Município"
                    value={formData.city}
                    placeholder="Ex: Nepomuceno"
                    onChange={(v) => setField('city', v)}
                    onBlur={() => touchField('city')}
                  />
                  <FieldInput
                    id="pf-district"
                    label="Distrito/Povoado"
                    value={formData.district}
                    placeholder="Opcional"
                    onChange={(v) => setField('district', v)}
                    onBlur={() => touchField('district')}
                  />
                  <FieldInput
                    id="pf-neighborhood"
                    label="Bairro"
                    value={formData.neighborhood}
                    placeholder="Ex: Zona Rural"
                    fullWidth
                    onChange={(v) => setField('neighborhood', v)}
                    onBlur={() => touchField('neighborhood')}
                  />
                  <FieldInput
                    id="pf-street"
                    label="Logradouro"
                    value={formData.street}
                    placeholder="Ex: Fazenda Limeira"
                    fullWidth
                    onChange={(v) => setField('street', v)}
                    onBlur={() => touchField('street')}
                  />
                  <FieldInput
                    id="pf-address-number"
                    label="Número"
                    value={formData.addressNumber}
                    placeholder="Ex: S/N"
                    onChange={(v) => setField('addressNumber', v)}
                    onBlur={() => touchField('addressNumber')}
                  />
                  <FieldInput
                    id="pf-complement"
                    label="Complemento"
                    value={formData.complement}
                    placeholder="Opcional"
                    onChange={(v) => setField('complement', v)}
                    onBlur={() => touchField('complement')}
                  />
                  <FieldInput
                    id="pf-location-reference"
                    label="Referência de Localização"
                    value={formData.locationReference}
                    placeholder="Ex: Km 2 Estrada Porto do Faria"
                    fullWidth
                    onChange={(v) => setField('locationReference', v)}
                    onBlur={() => touchField('locationReference')}
                  />
                </div>
              </fieldset>

              {/* Optante pelo Programa de Leite */}
              <div className="pf-form-modal__checkbox-row">
                <input
                  id="pf-milk"
                  type="checkbox"
                  className="pf-form-modal__checkbox"
                  checked={formData.milkProgramOptIn}
                  onChange={(e) => setField('milkProgramOptIn', e.target.checked)}
                />
                <label htmlFor="pf-milk" className="pf-form-modal__checkbox-label">
                  Optante pelo Programa de Leite
                </label>
              </div>

              {submitError && (
                <div className="pf-form-modal__submit-error" role="alert">
                  <AlertCircle size={20} aria-hidden="true" />
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="pf-form-modal__footer">
          <span className="pf-form-modal__required-hint">
            <span className="pf-form-modal__required">*</span> Campos obrigatórios
          </span>
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

export default ProducerPFFormModal;
