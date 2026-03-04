import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { SOIL_TYPE_OPTIONS, CROP_SUGGESTIONS } from '@/constants/plot';
import type { FieldPlot, FarmRegistration } from '@/types/farm';
import './EditPlotModal.css';

interface EditPlotModalProps {
  plot: FieldPlot;
  farmId: string;
  registrations: FarmRegistration[];
  onClose: () => void;
  onSuccess: () => void;
}

function EditPlotModal({ plot, farmId, registrations, onClose, onSuccess }: EditPlotModalProps) {
  const [name, setName] = useState(plot.name);
  const [code, setCode] = useState(plot.code ?? '');
  const [soilType, setSoilType] = useState(plot.soilType ?? '');
  const [currentCrop, setCurrentCrop] = useState(plot.currentCrop ?? '');
  const [previousCrop, setPreviousCrop] = useState(plot.previousCrop ?? '');
  const [registrationId, setRegistrationId] = useState(plot.registrationId ?? '');
  const [notes, setNotes] = useState(plot.notes ?? '');

  const [nameTouched, setNameTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const nameError = nameTouched && !name.trim() ? 'Nome é obrigatório' : '';

  const handleClose = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSubmit = useCallback(async () => {
    setNameTouched(true);
    if (!name.trim()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (code.trim()) body.code = code.trim();
      else body.code = null;
      if (soilType) body.soilType = soilType;
      else body.soilType = null;
      if (currentCrop.trim()) body.currentCrop = currentCrop.trim();
      else body.currentCrop = null;
      if (previousCrop.trim()) body.previousCrop = previousCrop.trim();
      else body.previousCrop = null;
      if (registrationId) body.registrationId = registrationId;
      else body.registrationId = null;
      if (notes.trim()) body.notes = notes.trim();
      else body.notes = null;

      await api.patch<FieldPlot>(`/org/farms/${farmId}/plots/${plot.id}`, body);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    name,
    code,
    soilType,
    currentCrop,
    previousCrop,
    registrationId,
    notes,
    farmId,
    plot.id,
    onSuccess,
    onClose,
  ]);

  const cropListId = 'edit-plot-crop-list';

  return (
    <div
      className="edit-plot-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-plot-title"
    >
      <div className="edit-plot-modal">
        <header className="edit-plot-modal__header">
          <h2 id="edit-plot-title" className="edit-plot-modal__title">
            Editar talhão
          </h2>
          <button
            type="button"
            className="edit-plot-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="edit-plot-modal__body">
          {submitError && (
            <div className="edit-plot-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="edit-plot-modal__fields">
            {/* Nome */}
            <div className="edit-plot-modal__field">
              <label htmlFor="edit-plot-name" className="edit-plot-modal__label">
                Nome <span className="edit-plot-modal__required">*</span>
              </label>
              <input
                id="edit-plot-name"
                type="text"
                className={`edit-plot-modal__input${nameError ? ' edit-plot-modal__input--error' : ''}`}
                value={name}
                placeholder="Ex: Talhão 1"
                aria-required="true"
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'edit-plot-name-error' : undefined}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
              />
              {nameError && (
                <span id="edit-plot-name-error" className="edit-plot-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {nameError}
                </span>
              )}
            </div>

            {/* Código */}
            <div className="edit-plot-modal__field">
              <label htmlFor="edit-plot-code" className="edit-plot-modal__label">
                Código
              </label>
              <input
                id="edit-plot-code"
                type="text"
                className="edit-plot-modal__input"
                value={code}
                placeholder="Código interno"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            {/* Tipo de solo */}
            <div className="edit-plot-modal__field">
              <label htmlFor="edit-plot-soilType" className="edit-plot-modal__label">
                Tipo de solo
              </label>
              <select
                id="edit-plot-soilType"
                className="edit-plot-modal__select"
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
              >
                <option value="">Selecione...</option>
                {SOIL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Cultura atual */}
            <div className="edit-plot-modal__field">
              <label htmlFor="edit-plot-currentCrop" className="edit-plot-modal__label">
                Cultura atual
              </label>
              <input
                id="edit-plot-currentCrop"
                type="text"
                className="edit-plot-modal__input"
                value={currentCrop}
                placeholder="Ex: Soja"
                list={cropListId}
                onChange={(e) => setCurrentCrop(e.target.value)}
              />
              <datalist id={cropListId}>
                {CROP_SUGGESTIONS.map((crop) => (
                  <option key={crop} value={crop} />
                ))}
              </datalist>
            </div>

            {/* Cultura anterior */}
            <div className="edit-plot-modal__field">
              <label htmlFor="edit-plot-previousCrop" className="edit-plot-modal__label">
                Cultura anterior
              </label>
              <input
                id="edit-plot-previousCrop"
                type="text"
                className="edit-plot-modal__input"
                value={previousCrop}
                placeholder="Ex: Milho"
                onChange={(e) => setPreviousCrop(e.target.value)}
              />
            </div>

            {/* Matrícula vinculada */}
            {registrations.length > 0 && (
              <div className="edit-plot-modal__field">
                <label htmlFor="edit-plot-registrationId" className="edit-plot-modal__label">
                  Matrícula vinculada
                </label>
                <select
                  id="edit-plot-registrationId"
                  className="edit-plot-modal__select"
                  value={registrationId}
                  onChange={(e) => setRegistrationId(e.target.value)}
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

            {/* Notas */}
            <div className="edit-plot-modal__field edit-plot-modal__field--full">
              <label htmlFor="edit-plot-notes" className="edit-plot-modal__label">
                Notas
              </label>
              <textarea
                id="edit-plot-notes"
                className="edit-plot-modal__textarea"
                value={notes}
                placeholder="Observações sobre o talhão..."
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="edit-plot-modal__footer">
          <button
            type="button"
            className="edit-plot-modal__btn edit-plot-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="edit-plot-modal__btn edit-plot-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="edit-plot-modal__spinner" />
                Salvando...
              </>
            ) : (
              'Salvar alterações'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default EditPlotModal;
