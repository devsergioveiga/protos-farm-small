import { useEffect, useCallback, useRef, useState } from 'react';
import { X, AlertCircle, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import { useIeForm } from '@/hooks/useIeForm';
import { VALID_UF } from '@/constants/states';
import { parseIeDocument } from '@/utils/parseIeDocument';
import type { ProducerStateRegistration } from '@/types/producer';
import './IeFormModal.css';

const SITUATION_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'SUSPENDED', label: 'Suspensa' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

const CATEGORY_OPTIONS = [
  { value: 'PRIMEIRO_ESTABELECIMENTO', label: 'Primeiro Estabelecimento' },
  { value: 'DEMAIS', label: 'Demais' },
  { value: 'UNICO', label: 'Unico' },
];

interface IeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  producerId: string;
  existingIe?: ProducerStateRegistration;
}

function IeFormModal({ isOpen, onClose, onSuccess, producerId, existingIe }: IeFormModalProps) {
  const {
    formData,
    errors,
    touched,
    isSubmitting,
    submitError,
    isEditMode,
    setField,
    touchField,
    submit,
    reset,
  } = useIeForm({ onSuccess, producerId, existingIe });

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
        const ie = parsed.ie;
        if (ie.number) setField('number', ie.number);
        if (ie.state) setField('state', ie.state);
        if (ie.situation) setField('situation', ie.situation);
        if (ie.category) setField('category', ie.category);
        if (ie.inscriptionDate) setField('inscriptionDate', ie.inscriptionDate);
        if (ie.contractEndDate) setField('contractEndDate', ie.contractEndDate);
        if (ie.cnaeActivity) setField('cnaeActivity', ie.cnaeActivity);
        if (ie.assessmentRegime) setField('assessmentRegime', ie.assessmentRegime);
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

  const numberError = touched.number && errors.number;
  const stateError = touched.state && errors.state;

  return (
    <div
      className="ie-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ie-form-title"
    >
      <div className="ie-modal">
        <header className="ie-modal__header">
          <h2 id="ie-form-title" className="ie-modal__title">
            {isEditMode ? 'Editar inscricao estadual' : 'Nova inscricao estadual'}
          </h2>
          <button
            type="button"
            className="ie-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="ie-modal__body">
          {/* Upload de documento */}
          {!isEditMode && (
            <div className="ie-modal__upload-section">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="ie-modal__file-input"
                onChange={onFileChange}
                aria-label="Anexar comprovante de Inscrição Estadual (PDF)"
              />
              <button
                type="button"
                className="ie-modal__upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
              >
                {isParsing ? (
                  <>
                    <Loader2 size={18} aria-hidden="true" className="ie-modal__spinner" />
                    Lendo documento...
                  </>
                ) : (
                  <>
                    <Upload size={18} aria-hidden="true" />
                    Importar dados do PDF
                  </>
                )}
              </button>
              {parseStatus === 'success' && (
                <span className="ie-modal__upload-status ie-modal__upload-status--success">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Dados importados. Revise antes de salvar.
                </span>
              )}
              {parseStatus === 'error' && (
                <span
                  className="ie-modal__upload-status ie-modal__upload-status--error"
                  role="alert"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  Não foi possível ler o documento.
                </span>
              )}
            </div>
          )}

          <div className="ie-modal__fields">
            {/* Numero IE */}
            <div className="ie-modal__field">
              <label htmlFor="ie-number" className="ie-modal__label">
                Numero IE
                <span className="ie-modal__required"> *</span>
              </label>
              <input
                id="ie-number"
                type="text"
                className={`ie-modal__input${numberError ? ' ie-modal__input--error' : ''}`}
                value={formData.number}
                placeholder="Ex: 123456789"
                aria-required="true"
                aria-invalid={!!numberError}
                aria-describedby={numberError ? 'ie-number-error' : undefined}
                onChange={(e) => setField('number', e.target.value)}
                onBlur={() => touchField('number')}
              />
              {numberError && (
                <span id="ie-number-error" className="ie-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.number}
                </span>
              )}
            </div>

            {/* UF */}
            <div className="ie-modal__field">
              <label htmlFor="ie-state" className="ie-modal__label">
                UF
                <span className="ie-modal__required"> *</span>
              </label>
              <select
                id="ie-state"
                className={`ie-modal__select${stateError ? ' ie-modal__select--error' : ''}`}
                value={formData.state}
                aria-required="true"
                aria-invalid={!!stateError}
                aria-describedby={stateError ? 'ie-state-error' : undefined}
                onChange={(e) => setField('state', e.target.value)}
                onBlur={() => touchField('state')}
              >
                <option value="">Selecione...</option>
                {VALID_UF.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {stateError && (
                <span id="ie-state-error" className="ie-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.state}
                </span>
              )}
            </div>

            {/* Situacao */}
            <div className="ie-modal__field">
              <label htmlFor="ie-situation" className="ie-modal__label">
                Situacao
              </label>
              <select
                id="ie-situation"
                className="ie-modal__select"
                value={formData.situation}
                onChange={(e) => setField('situation', e.target.value)}
                onBlur={() => touchField('situation')}
              >
                <option value="">Selecione...</option>
                {SITUATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria */}
            <div className="ie-modal__field">
              <label htmlFor="ie-category" className="ie-modal__label">
                Categoria
              </label>
              <select
                id="ie-category"
                className="ie-modal__select"
                value={formData.category}
                onChange={(e) => setField('category', e.target.value)}
                onBlur={() => touchField('category')}
              >
                <option value="">Selecione...</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Inscricao */}
            <div className="ie-modal__field">
              <label htmlFor="ie-inscription-date" className="ie-modal__label">
                Data de inscricao
              </label>
              <input
                id="ie-inscription-date"
                type="date"
                className="ie-modal__input"
                value={formData.inscriptionDate}
                onChange={(e) => setField('inscriptionDate', e.target.value)}
                onBlur={() => touchField('inscriptionDate')}
              />
            </div>

            {/* Termino de Contrato */}
            <div className="ie-modal__field">
              <label htmlFor="ie-contract-end" className="ie-modal__label">
                Termino de contrato
              </label>
              <input
                id="ie-contract-end"
                type="date"
                className="ie-modal__input"
                value={formData.contractEndDate}
                onChange={(e) => setField('contractEndDate', e.target.value)}
                onBlur={() => touchField('contractEndDate')}
              />
            </div>

            {/* CNAE */}
            <div className="ie-modal__field">
              <label htmlFor="ie-cnae" className="ie-modal__label">
                CNAE
              </label>
              <input
                id="ie-cnae"
                type="text"
                className="ie-modal__input"
                value={formData.cnaeActivity}
                placeholder="Ex: 0111-3/01"
                onChange={(e) => setField('cnaeActivity', e.target.value)}
                onBlur={() => touchField('cnaeActivity')}
              />
            </div>

            {/* Regime de Apuracao */}
            <div className="ie-modal__field">
              <label htmlFor="ie-assessment" className="ie-modal__label">
                Regime de apuracao
              </label>
              <input
                id="ie-assessment"
                type="text"
                className="ie-modal__input"
                value={formData.assessmentRegime}
                placeholder="Ex: Normal"
                onChange={(e) => setField('assessmentRegime', e.target.value)}
                onBlur={() => touchField('assessmentRegime')}
              />
            </div>

            {/* Programa do Leite */}
            <div className="ie-modal__checkbox-row">
              <input
                id="ie-milk"
                type="checkbox"
                className="ie-modal__checkbox"
                checked={formData.milkProgramOptIn}
                onChange={(e) => setField('milkProgramOptIn', e.target.checked)}
              />
              <label htmlFor="ie-milk" className="ie-modal__checkbox-label">
                Programa do Leite
              </label>
            </div>
          </div>

          {submitError && (
            <div className="ie-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}
        </div>

        <footer className="ie-modal__footer">
          <button
            type="button"
            className="ie-modal__btn ie-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ie-modal__btn ie-modal__btn--primary"
            onClick={() => void submit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="ie-modal__spinner" />
                Salvando...
              </>
            ) : isEditMode ? (
              'Salvar alteracoes'
            ) : (
              'Cadastrar'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default IeFormModal;
