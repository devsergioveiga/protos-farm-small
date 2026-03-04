import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useCreatePlot } from '@/hooks/useCreatePlot';
import type { FarmRegistration } from '@/types/farm';
import { CROP_COLORS } from '@/components/map/FarmMap';
import './CreatePlotModal.css';

const SOIL_TYPE_OPTIONS = [
  { value: 'LATOSSOLO_VERMELHO', label: 'Latossolo Vermelho' },
  { value: 'LATOSSOLO_AMARELO', label: 'Latossolo Amarelo' },
  { value: 'ARGISSOLO', label: 'Argissolo' },
  { value: 'NEOSSOLO', label: 'Neossolo' },
  { value: 'CAMBISSOLO', label: 'Cambissolo' },
  { value: 'GLEISSOLO', label: 'Gleissolo' },
  { value: 'PLANOSSOLO', label: 'Planossolo' },
  { value: 'NITOSSOLO', label: 'Nitossolo' },
  { value: 'OUTRO', label: 'Outro' },
];

const CROP_SUGGESTIONS = Object.keys(CROP_COLORS).filter((k) => k !== 'Sem cultura');

const ACCEPTED_EXTENSIONS = '.geojson,.json,.kml,.kmz,.zip';

interface CreatePlotModalProps {
  isOpen: boolean;
  farmId: string;
  registrations: FarmRegistration[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePlotModal({
  isOpen,
  farmId,
  registrations,
  onClose,
  onSuccess,
}: CreatePlotModalProps) {
  const {
    formData,
    errors,
    touched,
    boundaryFile,
    boundaryError,
    isSubmitting,
    submitError,
    setField,
    touchField,
    setFile,
    submit,
    reset,
  } = useCreatePlot();

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) setFile(file);
    },
    [setFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setFile(file);
    },
    [setFile],
  );

  const handleSubmit = useCallback(async () => {
    const ok = await submit(farmId);
    if (ok) {
      reset();
      onSuccess();
      onClose();
    }
  }, [submit, farmId, reset, onSuccess, onClose]);

  if (!isOpen) return null;

  const cropListId = 'create-plot-crop-list';

  return (
    <div
      className="create-plot-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-plot-title"
    >
      <div className="create-plot-modal">
        <header className="create-plot-modal__header">
          <h2 id="create-plot-title" className="create-plot-modal__title">
            Novo talhão
          </h2>
          <button
            type="button"
            className="create-plot-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="create-plot-modal__body">
          {submitError && (
            <div className="create-plot-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          {/* Upload section */}
          <section>
            <h3 className="create-plot-modal__section-title">Perímetro do talhão</h3>
            {boundaryFile ? (
              <div className="create-plot-modal__file-selected">
                <FileText size={20} aria-hidden="true" />
                <span className="create-plot-modal__file-name">{boundaryFile.name}</span>
                <button
                  type="button"
                  className="create-plot-modal__file-remove"
                  aria-label="Remover arquivo"
                  onClick={() => setFile(null)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div
                className={`create-plot-modal__dropzone${isDragging ? ' create-plot-modal__dropzone--dragging' : ''}${boundaryError ? ' create-plot-modal__dropzone--error' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Selecionar arquivo de perímetro"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload size={40} aria-hidden="true" className="create-plot-modal__dropzone-icon" />
                <p className="create-plot-modal__dropzone-text">
                  Arraste um arquivo ou{' '}
                  <span className="create-plot-modal__dropzone-browse">clique para selecionar</span>
                </p>
                <p className="create-plot-modal__dropzone-hint">
                  GeoJSON, KML, KMZ ou Shapefile (.zip)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileChange}
                  className="create-plot-modal__file-input"
                  aria-label="Selecionar arquivo de perímetro"
                />
              </div>
            )}
            {boundaryError && (
              <span className="create-plot-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {boundaryError}
              </span>
            )}
          </section>

          {/* Form fields */}
          <section>
            <h3 className="create-plot-modal__section-title">Dados do talhão</h3>
            <div className="create-plot-modal__fields">
              <FieldInput
                id="plot-name"
                label="Nome"
                value={formData.name}
                error={errors.name}
                touched={touched.name}
                required
                placeholder="Ex: Talhão 1"
                onChange={(v) => setField('name', v)}
                onBlur={() => touchField('name')}
              />
              <FieldInput
                id="plot-code"
                label="Código"
                value={formData.code}
                placeholder="Código interno"
                onChange={(v) => setField('code', v)}
                onBlur={() => touchField('code')}
              />
              <div className="create-plot-modal__field">
                <label htmlFor="plot-soilType" className="create-plot-modal__label">
                  Tipo de solo
                </label>
                <select
                  id="plot-soilType"
                  className="create-plot-modal__select"
                  value={formData.soilType}
                  onChange={(e) => setField('soilType', e.target.value)}
                  onBlur={() => touchField('soilType')}
                >
                  <option value="">Selecione...</option>
                  {SOIL_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="create-plot-modal__field">
                <label htmlFor="plot-currentCrop" className="create-plot-modal__label">
                  Cultura atual
                </label>
                <input
                  id="plot-currentCrop"
                  type="text"
                  className="create-plot-modal__input"
                  value={formData.currentCrop}
                  placeholder="Ex: Soja"
                  list={cropListId}
                  onChange={(e) => setField('currentCrop', e.target.value)}
                  onBlur={() => touchField('currentCrop')}
                />
                <datalist id={cropListId}>
                  {CROP_SUGGESTIONS.map((crop) => (
                    <option key={crop} value={crop} />
                  ))}
                </datalist>
              </div>
              <FieldInput
                id="plot-previousCrop"
                label="Cultura anterior"
                value={formData.previousCrop}
                placeholder="Ex: Milho"
                onChange={(v) => setField('previousCrop', v)}
                onBlur={() => touchField('previousCrop')}
              />
              {registrations.length > 0 && (
                <div className="create-plot-modal__field">
                  <label htmlFor="plot-registrationId" className="create-plot-modal__label">
                    Matrícula vinculada
                  </label>
                  <select
                    id="plot-registrationId"
                    className="create-plot-modal__select"
                    value={formData.registrationId}
                    onChange={(e) => setField('registrationId', e.target.value)}
                    onBlur={() => touchField('registrationId')}
                  >
                    <option value="">Nenhuma</option>
                    {registrations.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.number} — {reg.cartorioName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="create-plot-modal__field create-plot-modal__field--full">
                <label htmlFor="plot-notes" className="create-plot-modal__label">
                  Notas
                </label>
                <textarea
                  id="plot-notes"
                  className="create-plot-modal__textarea"
                  value={formData.notes}
                  placeholder="Observações sobre o talhão..."
                  rows={3}
                  onChange={(e) => setField('notes', e.target.value)}
                  onBlur={() => touchField('notes')}
                />
              </div>
            </div>
          </section>
        </div>

        <footer className="create-plot-modal__footer">
          <button
            type="button"
            className="create-plot-modal__btn create-plot-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="create-plot-modal__btn create-plot-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="create-plot-modal__spinner" />
                Criando...
              </>
            ) : (
              'Criar talhão'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ─── Field Input helper ─── */

interface FieldInputProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  placeholder?: string;
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
  placeholder,
  onChange,
  onBlur,
}: FieldInputProps) {
  const hasError = touched && !!error;
  return (
    <div className="create-plot-modal__field">
      <label htmlFor={id} className="create-plot-modal__label">
        {label}
        {required && <span className="create-plot-modal__required"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        className={`create-plot-modal__input${hasError ? ' create-plot-modal__input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {hasError && (
        <span id={`${id}-error`} className="create-plot-modal__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

export default CreatePlotModal;
