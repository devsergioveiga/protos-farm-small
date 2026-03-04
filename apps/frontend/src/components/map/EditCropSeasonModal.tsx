import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { CROP_SUGGESTIONS, SEASON_TYPE_OPTIONS } from '@/constants/plot';
import type { CropSeasonItem, UpdateCropSeasonPayload } from '@/types/farm';
import './EditCropSeasonModal.css';

interface EditCropSeasonModalProps {
  isOpen: boolean;
  season: CropSeasonItem;
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

function seasonToForm(season: CropSeasonItem): FormData {
  return {
    crop: season.crop,
    seasonType: season.seasonType,
    seasonYear: season.seasonYear,
    varietyName: season.varietyName ?? '',
    startDate: season.startDate ?? '',
    endDate: season.endDate ?? '',
    plantedAreaHa: season.plantedAreaHa != null ? String(season.plantedAreaHa) : '',
    productivityKgHa: season.productivityKgHa != null ? String(season.productivityKgHa) : '',
    totalProductionKg: season.totalProductionKg != null ? String(season.totalProductionKg) : '',
    notes: season.notes ?? '',
  };
}

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.crop.trim()) errors.crop = 'Cultura é obrigatória';
  if (!form.seasonYear.trim()) errors.seasonYear = 'Ano da safra é obrigatório';
  return errors;
}

function EditCropSeasonModal({
  isOpen,
  season,
  farmId,
  plotId,
  onClose,
  onSuccess,
}: EditCropSeasonModalProps) {
  const [form, setForm] = useState<FormData>(() => seasonToForm(season));
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validate(form);

  // Reset form when season changes
  useEffect(() => {
    setForm(seasonToForm(season));
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, [season]);

  const handleClose = useCallback(() => {
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
    onClose();
  }, [onClose]);

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
    setTouched({ crop: true, seasonYear: true });

    const errs = validate(form);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: UpdateCropSeasonPayload = {
      crop: form.crop.trim(),
      seasonType: form.seasonType,
      seasonYear: form.seasonYear.trim(),
    };

    payload.varietyName = form.varietyName.trim() || null;
    payload.startDate = form.startDate || null;
    payload.endDate = form.endDate || null;
    payload.notes = form.notes.trim() || null;

    if (form.plantedAreaHa) {
      const v = parseFloat(form.plantedAreaHa);
      payload.plantedAreaHa = isNaN(v) ? null : v;
    } else {
      payload.plantedAreaHa = null;
    }

    if (form.productivityKgHa) {
      const v = parseFloat(form.productivityKgHa);
      payload.productivityKgHa = isNaN(v) ? null : v;
    } else {
      payload.productivityKgHa = null;
    }

    if (form.totalProductionKg) {
      const v = parseFloat(form.totalProductionKg);
      payload.totalProductionKg = isNaN(v) ? null : v;
    } else {
      payload.totalProductionKg = null;
    }

    try {
      await api.patch<CropSeasonItem>(
        `/org/farms/${farmId}/plots/${plotId}/crop-seasons/${season.id}`,
        payload,
      );
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar as alterações. Tente novamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, farmId, plotId, season.id, onSuccess, onClose]);

  if (!isOpen) return null;

  const cropListId = 'edit-crop-season-crop-list';

  return (
    <div
      className="edit-crop-season-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-crop-season-title"
    >
      <div className="edit-crop-season-modal">
        <header className="edit-crop-season-modal__header">
          <h2 id="edit-crop-season-title" className="edit-crop-season-modal__title">
            Editar safra
          </h2>
          <button
            type="button"
            className="edit-crop-season-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="edit-crop-season-modal__body">
          {submitError && (
            <div className="edit-crop-season-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="edit-crop-season-modal__fields">
            {/* Cultura * */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-crop" className="edit-crop-season-modal__label">
                Cultura<span className="edit-crop-season-modal__required"> *</span>
              </label>
              <input
                id="edit-season-crop"
                type="text"
                className={`edit-crop-season-modal__input${touched.crop && errors.crop ? ' edit-crop-season-modal__input--error' : ''}`}
                value={form.crop}
                placeholder="Ex: Soja"
                list={cropListId}
                aria-required="true"
                aria-invalid={touched.crop && !!errors.crop}
                aria-describedby={
                  touched.crop && errors.crop ? 'edit-season-crop-error' : undefined
                }
                onChange={(e) => setField('crop', e.target.value)}
                onBlur={() => touchField('crop')}
              />
              <datalist id={cropListId}>
                {CROP_SUGGESTIONS.map((crop) => (
                  <option key={crop} value={crop} />
                ))}
              </datalist>
              {touched.crop && errors.crop && (
                <span
                  id="edit-season-crop-error"
                  className="edit-crop-season-modal__error"
                  role="alert"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.crop}
                </span>
              )}
            </div>

            {/* Tipo de safra * */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-type" className="edit-crop-season-modal__label">
                Tipo de safra<span className="edit-crop-season-modal__required"> *</span>
              </label>
              <select
                id="edit-season-type"
                className="edit-crop-season-modal__select"
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
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-year" className="edit-crop-season-modal__label">
                Ano<span className="edit-crop-season-modal__required"> *</span>
              </label>
              <input
                id="edit-season-year"
                type="text"
                className={`edit-crop-season-modal__input${touched.seasonYear && errors.seasonYear ? ' edit-crop-season-modal__input--error' : ''}`}
                value={form.seasonYear}
                placeholder="Ex: 2025/2026"
                aria-required="true"
                aria-invalid={touched.seasonYear && !!errors.seasonYear}
                aria-describedby={
                  touched.seasonYear && errors.seasonYear ? 'edit-season-year-error' : undefined
                }
                onChange={(e) => setField('seasonYear', e.target.value)}
                onBlur={() => touchField('seasonYear')}
              />
              {touched.seasonYear && errors.seasonYear && (
                <span
                  id="edit-season-year-error"
                  className="edit-crop-season-modal__error"
                  role="alert"
                >
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.seasonYear}
                </span>
              )}
            </div>

            {/* Variedade */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-variety" className="edit-crop-season-modal__label">
                Variedade
              </label>
              <input
                id="edit-season-variety"
                type="text"
                className="edit-crop-season-modal__input"
                value={form.varietyName}
                placeholder="Ex: TMG 2381"
                onChange={(e) => setField('varietyName', e.target.value)}
              />
            </div>

            {/* Data plantio */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-start-date" className="edit-crop-season-modal__label">
                Data plantio
              </label>
              <input
                id="edit-season-start-date"
                type="date"
                className="edit-crop-season-modal__input"
                value={form.startDate}
                onChange={(e) => setField('startDate', e.target.value)}
              />
            </div>

            {/* Data colheita */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-end-date" className="edit-crop-season-modal__label">
                Data colheita
              </label>
              <input
                id="edit-season-end-date"
                type="date"
                className="edit-crop-season-modal__input"
                value={form.endDate}
                onChange={(e) => setField('endDate', e.target.value)}
              />
            </div>

            {/* Área plantada */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-area" className="edit-crop-season-modal__label">
                Área plantada (ha)
              </label>
              <input
                id="edit-season-area"
                type="number"
                className="edit-crop-season-modal__input"
                value={form.plantedAreaHa}
                placeholder="Ex: 50"
                min="0"
                step="0.01"
                onChange={(e) => setField('plantedAreaHa', e.target.value)}
              />
            </div>

            {/* Produtividade */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-productivity" className="edit-crop-season-modal__label">
                Produtividade (kg/ha)
              </label>
              <input
                id="edit-season-productivity"
                type="number"
                className="edit-crop-season-modal__input"
                value={form.productivityKgHa}
                placeholder="Ex: 3600"
                min="0"
                step="0.01"
                onChange={(e) => setField('productivityKgHa', e.target.value)}
              />
            </div>

            {/* Produção total */}
            <div className="edit-crop-season-modal__field">
              <label htmlFor="edit-season-production" className="edit-crop-season-modal__label">
                Produção total (kg)
              </label>
              <input
                id="edit-season-production"
                type="number"
                className="edit-crop-season-modal__input"
                value={form.totalProductionKg}
                placeholder="Ex: 180000"
                min="0"
                step="1"
                onChange={(e) => setField('totalProductionKg', e.target.value)}
              />
              <span className="edit-crop-season-modal__hint">
                Calculado automaticamente a partir de área x produtividade
              </span>
            </div>

            {/* Observações */}
            <div className="edit-crop-season-modal__field edit-crop-season-modal__field--full">
              <label htmlFor="edit-season-notes" className="edit-crop-season-modal__label">
                Observações
              </label>
              <textarea
                id="edit-season-notes"
                className="edit-crop-season-modal__textarea"
                value={form.notes}
                placeholder="Notas sobre a safra..."
                rows={3}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="edit-crop-season-modal__footer">
          <button
            type="button"
            className="edit-crop-season-modal__btn edit-crop-season-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="edit-crop-season-modal__btn edit-crop-season-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="edit-crop-season-modal__spinner" />
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

export default EditCropSeasonModal;
