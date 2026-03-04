import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { CROP_SUGGESTIONS, SEASON_TYPE_OPTIONS } from '@/constants/plot';
import type { CreateCropSeasonPayload, CropSeasonItem } from '@/types/farm';
import './AddCropSeasonModal.css';

interface AddCropSeasonModalProps {
  isOpen: boolean;
  farmId: string;
  plotId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  crop: string;
  seasonType: string;
  seasonYear: string;
  varietyName: string;
  startDate: string;
  endDate: string;
  plantedAreaHa: string;
  productivityKgHa: string;
  totalProductionKg: string;
  notes: string;
}

interface FormErrors {
  crop?: string;
  seasonYear?: string;
}

const INITIAL_FORM: FormData = {
  crop: '',
  seasonType: 'SAFRA',
  seasonYear: '',
  varietyName: '',
  startDate: '',
  endDate: '',
  plantedAreaHa: '',
  productivityKgHa: '',
  totalProductionKg: '',
  notes: '',
};

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.crop.trim()) errors.crop = 'Cultura é obrigatória';
  if (!form.seasonYear.trim()) errors.seasonYear = 'Ano da safra é obrigatório';
  return errors;
}

function AddCropSeasonModal({
  isOpen,
  farmId,
  plotId,
  onClose,
  onSuccess,
}: AddCropSeasonModalProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validate(form);

  const reset = useCallback(() => {
    setForm(INITIAL_FORM);
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, []);

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

  const setField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-calc totalProductionKg
      if (key === 'plantedAreaHa' || key === 'productivityKgHa') {
        const area = parseFloat(key === 'plantedAreaHa' ? (value as string) : next.plantedAreaHa);
        const prod = parseFloat(
          key === 'productivityKgHa' ? (value as string) : next.productivityKgHa,
        );
        if (!isNaN(area) && !isNaN(prod) && area > 0 && prod > 0) {
          next.totalProductionKg = String(Math.round(area * prod));
        }
      }
      return next;
    });
  }, []);

  const touchField = useCallback((key: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Touch required fields
    setTouched({ crop: true, seasonYear: true });

    const errs = validate(form);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateCropSeasonPayload = {
      crop: form.crop.trim(),
      seasonType: form.seasonType,
      seasonYear: form.seasonYear.trim(),
    };

    if (form.varietyName.trim()) payload.varietyName = form.varietyName.trim();
    if (form.startDate) payload.startDate = form.startDate;
    if (form.endDate) payload.endDate = form.endDate;
    if (form.plantedAreaHa) {
      const v = parseFloat(form.plantedAreaHa);
      if (!isNaN(v)) payload.plantedAreaHa = v;
    }
    if (form.productivityKgHa) {
      const v = parseFloat(form.productivityKgHa);
      if (!isNaN(v)) payload.productivityKgHa = v;
    }
    if (form.totalProductionKg) {
      const v = parseFloat(form.totalProductionKg);
      if (!isNaN(v)) payload.totalProductionKg = v;
    }
    if (form.notes.trim()) payload.notes = form.notes.trim();

    try {
      await api.post<CropSeasonItem>(`/org/farms/${farmId}/plots/${plotId}/crop-seasons`, payload);
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar a safra. Tente novamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, farmId, plotId, reset, onSuccess, onClose]);

  if (!isOpen) return null;

  const cropListId = 'add-crop-season-crop-list';

  return (
    <div
      className="add-crop-season-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-crop-season-title"
    >
      <div className="add-crop-season-modal">
        <header className="add-crop-season-modal__header">
          <h2 id="add-crop-season-title" className="add-crop-season-modal__title">
            Nova safra
          </h2>
          <button
            type="button"
            className="add-crop-season-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="add-crop-season-modal__body">
          {submitError && (
            <div className="add-crop-season-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="add-crop-season-modal__fields">
            {/* Cultura * */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-crop" className="add-crop-season-modal__label">
                Cultura<span className="add-crop-season-modal__required"> *</span>
              </label>
              <input
                id="season-crop"
                type="text"
                className={`add-crop-season-modal__input${touched.crop && errors.crop ? ' add-crop-season-modal__input--error' : ''}`}
                value={form.crop}
                placeholder="Ex: Soja"
                list={cropListId}
                aria-required="true"
                aria-invalid={touched.crop && !!errors.crop}
                aria-describedby={touched.crop && errors.crop ? 'season-crop-error' : undefined}
                onChange={(e) => setField('crop', e.target.value)}
                onBlur={() => touchField('crop')}
              />
              <datalist id={cropListId}>
                {CROP_SUGGESTIONS.map((crop) => (
                  <option key={crop} value={crop} />
                ))}
              </datalist>
              {touched.crop && errors.crop && (
                <span id="season-crop-error" className="add-crop-season-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.crop}
                </span>
              )}
            </div>

            {/* Tipo de safra * */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-type" className="add-crop-season-modal__label">
                Tipo de safra<span className="add-crop-season-modal__required"> *</span>
              </label>
              <select
                id="season-type"
                className="add-crop-season-modal__select"
                value={form.seasonType}
                aria-required="true"
                onChange={(e) => setField('seasonType', e.target.value)}
              >
                {SEASON_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ano * */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-year" className="add-crop-season-modal__label">
                Ano<span className="add-crop-season-modal__required"> *</span>
              </label>
              <input
                id="season-year"
                type="text"
                className={`add-crop-season-modal__input${touched.seasonYear && errors.seasonYear ? ' add-crop-season-modal__input--error' : ''}`}
                value={form.seasonYear}
                placeholder="Ex: 2025/2026"
                aria-required="true"
                aria-invalid={touched.seasonYear && !!errors.seasonYear}
                aria-describedby={
                  touched.seasonYear && errors.seasonYear ? 'season-year-error' : undefined
                }
                onChange={(e) => setField('seasonYear', e.target.value)}
                onBlur={() => touchField('seasonYear')}
              />
              {touched.seasonYear && errors.seasonYear && (
                <span id="season-year-error" className="add-crop-season-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.seasonYear}
                </span>
              )}
            </div>

            {/* Variedade */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-variety" className="add-crop-season-modal__label">
                Variedade
              </label>
              <input
                id="season-variety"
                type="text"
                className="add-crop-season-modal__input"
                value={form.varietyName}
                placeholder="Ex: TMG 2381"
                onChange={(e) => setField('varietyName', e.target.value)}
              />
            </div>

            {/* Data plantio */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-start-date" className="add-crop-season-modal__label">
                Data plantio
              </label>
              <input
                id="season-start-date"
                type="date"
                className="add-crop-season-modal__input"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </div>

            {/* Data colheita */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-end-date" className="add-crop-season-modal__label">
                Data colheita
              </label>
              <input
                id="season-end-date"
                type="date"
                className="add-crop-season-modal__input"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </div>

            {/* Área plantada */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-area" className="add-crop-season-modal__label">
                Área plantada (ha)
              </label>
              <input
                id="season-area"
                type="number"
                className="add-crop-season-modal__input"
                value={form.plantedAreaHa}
                placeholder="Ex: 50"
                min="0"
                step="0.01"
                onChange={(e) => setField('plantedAreaHa', e.target.value)}
              />
            </div>

            {/* Produtividade */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-productivity" className="add-crop-season-modal__label">
                Produtividade (kg/ha)
              </label>
              <input
                id="season-productivity"
                type="number"
                className="add-crop-season-modal__input"
                value={form.productivityKgHa}
                placeholder="Ex: 3600"
                min="0"
                step="0.01"
                onChange={(e) => setField('productivityKgHa', e.target.value)}
              />
            </div>

            {/* Produção total */}
            <div className="add-crop-season-modal__field">
              <label htmlFor="season-production" className="add-crop-season-modal__label">
                Produção total (kg)
              </label>
              <input
                id="season-production"
                type="number"
                className="add-crop-season-modal__input"
                value={form.totalProductionKg}
                placeholder="Ex: 180000"
                min="0"
                step="1"
                onChange={(e) => setField('totalProductionKg', e.target.value)}
              />
              <span className="add-crop-season-modal__hint">
                Calculado automaticamente a partir de área x produtividade
              </span>
            </div>

            {/* Observações */}
            <div className="add-crop-season-modal__field add-crop-season-modal__field--full">
              <label htmlFor="season-notes" className="add-crop-season-modal__label">
                Observações
              </label>
              <textarea
                id="season-notes"
                className="add-crop-season-modal__textarea"
                value={form.notes}
                placeholder="Notas sobre a safra..."
                rows={3}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="add-crop-season-modal__footer">
          <button
            type="button"
            className="add-crop-season-modal__btn add-crop-season-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="add-crop-season-modal__btn add-crop-season-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="add-crop-season-modal__spinner" />
                Salvando...
              </>
            ) : (
              'Salvar safra'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default AddCropSeasonModal;
