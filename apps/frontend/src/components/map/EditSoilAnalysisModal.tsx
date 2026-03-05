import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import type { SoilAnalysisItem, UpdateSoilAnalysisPayload } from '@/types/farm';
import './EditSoilAnalysisModal.css';

interface EditSoilAnalysisModalProps {
  isOpen: boolean;
  analysis: SoilAnalysisItem;
  farmId: string;
  plotId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  analysisDate: string;
  labName: string;
  sampleDepthCm: string;
  phH2o: string;
  organicMatterPct: string;
  phosphorusMgDm3: string;
  potassiumMgDm3: string;
  calciumCmolcDm3: string;
  magnesiumCmolcDm3: string;
  aluminumCmolcDm3: string;
  ctcCmolcDm3: string;
  baseSaturationPct: string;
  sulfurMgDm3: string;
  clayContentPct: string;
  notes: string;
}

interface FormErrors {
  analysisDate?: string;
  phH2o?: string;
  organicMatterPct?: string;
  baseSaturationPct?: string;
  clayContentPct?: string;
}

function analysisToForm(analysis: SoilAnalysisItem): FormData {
  return {
    analysisDate: analysis.analysisDate,
    labName: analysis.labName ?? '',
    sampleDepthCm: analysis.sampleDepthCm ?? '',
    phH2o: analysis.phH2o != null ? String(analysis.phH2o) : '',
    organicMatterPct: analysis.organicMatterPct != null ? String(analysis.organicMatterPct) : '',
    phosphorusMgDm3: analysis.phosphorusMgDm3 != null ? String(analysis.phosphorusMgDm3) : '',
    potassiumMgDm3: analysis.potassiumMgDm3 != null ? String(analysis.potassiumMgDm3) : '',
    calciumCmolcDm3: analysis.calciumCmolcDm3 != null ? String(analysis.calciumCmolcDm3) : '',
    magnesiumCmolcDm3: analysis.magnesiumCmolcDm3 != null ? String(analysis.magnesiumCmolcDm3) : '',
    aluminumCmolcDm3: analysis.aluminumCmolcDm3 != null ? String(analysis.aluminumCmolcDm3) : '',
    ctcCmolcDm3: analysis.ctcCmolcDm3 != null ? String(analysis.ctcCmolcDm3) : '',
    baseSaturationPct: analysis.baseSaturationPct != null ? String(analysis.baseSaturationPct) : '',
    sulfurMgDm3: analysis.sulfurMgDm3 != null ? String(analysis.sulfurMgDm3) : '',
    clayContentPct: analysis.clayContentPct != null ? String(analysis.clayContentPct) : '',
    notes: analysis.notes ?? '',
  };
}

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.analysisDate) errors.analysisDate = 'Data da análise é obrigatória';

  if (form.phH2o) {
    const v = parseFloat(form.phH2o);
    if (isNaN(v) || v < 0 || v > 14) errors.phH2o = 'pH deve ser entre 0 e 14';
  }
  if (form.organicMatterPct) {
    const v = parseFloat(form.organicMatterPct);
    if (isNaN(v) || v < 0 || v > 100) errors.organicMatterPct = 'MO deve ser entre 0 e 100%';
  }
  if (form.baseSaturationPct) {
    const v = parseFloat(form.baseSaturationPct);
    if (isNaN(v) || v < 0 || v > 100) errors.baseSaturationPct = 'V% deve ser entre 0 e 100%';
  }
  if (form.clayContentPct) {
    const v = parseFloat(form.clayContentPct);
    if (isNaN(v) || v < 0 || v > 100) errors.clayContentPct = 'Argila deve ser entre 0 e 100%';
  }

  return errors;
}

const NUMERIC_FIELDS: Array<{
  key: keyof FormData;
  label: string;
  unit: string;
  placeholder: string;
  min?: number;
  max?: number;
  step?: string;
}> = [
  {
    key: 'phH2o',
    label: 'pH (H₂O)',
    unit: '',
    placeholder: 'Ex: 5.8',
    min: 0,
    max: 14,
    step: '0.1',
  },
  {
    key: 'organicMatterPct',
    label: 'Matéria orgânica',
    unit: '%',
    placeholder: 'Ex: 3.2',
    min: 0,
    max: 100,
    step: '0.1',
  },
  {
    key: 'phosphorusMgDm3',
    label: 'Fósforo (P)',
    unit: 'mg/dm³',
    placeholder: 'Ex: 12.5',
    min: 0,
    step: '0.1',
  },
  {
    key: 'potassiumMgDm3',
    label: 'Potássio (K)',
    unit: 'mg/dm³',
    placeholder: 'Ex: 85',
    min: 0,
    step: '0.1',
  },
  {
    key: 'calciumCmolcDm3',
    label: 'Cálcio (Ca)',
    unit: 'cmolc/dm³',
    placeholder: 'Ex: 4.5',
    min: 0,
    step: '0.01',
  },
  {
    key: 'magnesiumCmolcDm3',
    label: 'Magnésio (Mg)',
    unit: 'cmolc/dm³',
    placeholder: 'Ex: 1.8',
    min: 0,
    step: '0.01',
  },
  {
    key: 'aluminumCmolcDm3',
    label: 'Alumínio (Al)',
    unit: 'cmolc/dm³',
    placeholder: 'Ex: 0.1',
    min: 0,
    step: '0.01',
  },
  {
    key: 'ctcCmolcDm3',
    label: 'CTC',
    unit: 'cmolc/dm³',
    placeholder: 'Ex: 8.5',
    min: 0,
    step: '0.01',
  },
  {
    key: 'baseSaturationPct',
    label: 'Saturação de bases (V%)',
    unit: '%',
    placeholder: 'Ex: 65',
    min: 0,
    max: 100,
    step: '0.1',
  },
  {
    key: 'sulfurMgDm3',
    label: 'Enxofre (S)',
    unit: 'mg/dm³',
    placeholder: 'Ex: 6.0',
    min: 0,
    step: '0.1',
  },
  {
    key: 'clayContentPct',
    label: 'Argila',
    unit: '%',
    placeholder: 'Ex: 42',
    min: 0,
    max: 100,
    step: '0.1',
  },
];

function EditSoilAnalysisModal({
  isOpen,
  analysis,
  farmId,
  plotId,
  onClose,
  onSuccess,
}: EditSoilAnalysisModalProps) {
  const [form, setForm] = useState<FormData>(() => analysisToForm(analysis));
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validate(form);

  useEffect(() => {
    setForm(analysisToForm(analysis));
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
  }, [analysis]);

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
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const touchField = useCallback((key: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const touchAll: Partial<Record<keyof FormData, boolean>> = { analysisDate: true };
    NUMERIC_FIELDS.forEach((f) => {
      if (form[f.key]) touchAll[f.key] = true;
    });
    setTouched(touchAll);

    const errs = validate(form);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: UpdateSoilAnalysisPayload = {
      analysisDate: form.analysisDate,
    };

    payload.labName = form.labName.trim() || null;
    payload.sampleDepthCm = form.sampleDepthCm.trim() || null;
    payload.notes = form.notes.trim() || null;

    for (const field of NUMERIC_FIELDS) {
      if (form[field.key]) {
        const v = parseFloat(form[field.key]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload as any)[field.key] = isNaN(v) ? null : v;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload as any)[field.key] = null;
      }
    }

    try {
      await api.patch<SoilAnalysisItem>(
        `/org/farms/${farmId}/plots/${plotId}/soil-analyses/${analysis.id}`,
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
  }, [form, farmId, plotId, analysis.id, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="edit-soil-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-soil-analysis-title"
    >
      <div className="edit-soil-modal">
        <header className="edit-soil-modal__header">
          <h2 id="edit-soil-analysis-title" className="edit-soil-modal__title">
            Editar análise de solo
          </h2>
          <button
            type="button"
            className="edit-soil-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="edit-soil-modal__body">
          {submitError && (
            <div className="edit-soil-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="edit-soil-modal__fields">
            {/* Data da análise * */}
            <div className="edit-soil-modal__field">
              <label htmlFor="edit-soil-date" className="edit-soil-modal__label">
                Data da análise<span className="edit-soil-modal__required"> *</span>
              </label>
              <input
                id="edit-soil-date"
                type="date"
                className={`edit-soil-modal__input${touched.analysisDate && errors.analysisDate ? ' edit-soil-modal__input--error' : ''}`}
                value={form.analysisDate}
                aria-required="true"
                aria-invalid={touched.analysisDate && !!errors.analysisDate}
                aria-describedby={
                  touched.analysisDate && errors.analysisDate ? 'edit-soil-date-error' : undefined
                }
                onChange={(e) => setField('analysisDate', e.target.value)}
                onBlur={() => touchField('analysisDate')}
              />
              {touched.analysisDate && errors.analysisDate && (
                <span id="edit-soil-date-error" className="edit-soil-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.analysisDate}
                </span>
              )}
            </div>

            {/* Laboratório */}
            <div className="edit-soil-modal__field">
              <label htmlFor="edit-soil-lab" className="edit-soil-modal__label">
                Laboratório
              </label>
              <input
                id="edit-soil-lab"
                type="text"
                className="edit-soil-modal__input"
                value={form.labName}
                placeholder="Ex: Eurofins"
                onChange={(e) => setField('labName', e.target.value)}
              />
            </div>

            {/* Profundidade */}
            <div className="edit-soil-modal__field">
              <label htmlFor="edit-soil-depth" className="edit-soil-modal__label">
                Profundidade da amostra
              </label>
              <input
                id="edit-soil-depth"
                type="text"
                className="edit-soil-modal__input"
                value={form.sampleDepthCm}
                placeholder="Ex: 0-20 cm"
                onChange={(e) => setField('sampleDepthCm', e.target.value)}
              />
            </div>

            {/* Separator */}
            <div className="edit-soil-modal__separator">Parâmetros químicos</div>

            {/* Numeric fields */}
            {NUMERIC_FIELDS.map((field) => {
              const errorKey = field.key as keyof FormErrors;
              const hasError = touched[field.key] && errors[errorKey];
              return (
                <div key={field.key} className="edit-soil-modal__field">
                  <label htmlFor={`edit-soil-${field.key}`} className="edit-soil-modal__label">
                    {field.label}
                    {field.unit && <span className="edit-soil-modal__unit"> ({field.unit})</span>}
                  </label>
                  <input
                    id={`edit-soil-${field.key}`}
                    type="number"
                    className={`edit-soil-modal__input${hasError ? ' edit-soil-modal__input--error' : ''}`}
                    value={form[field.key]}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    aria-invalid={!!hasError}
                    aria-describedby={hasError ? `edit-soil-${field.key}-error` : undefined}
                    onChange={(e) => setField(field.key, e.target.value)}
                    onBlur={() => touchField(field.key)}
                  />
                  {hasError && (
                    <span
                      id={`edit-soil-${field.key}-error`}
                      className="edit-soil-modal__error"
                      role="alert"
                    >
                      <AlertCircle size={16} aria-hidden="true" />
                      {errors[errorKey]}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Observações */}
            <div className="edit-soil-modal__field edit-soil-modal__field--full">
              <label htmlFor="edit-soil-notes" className="edit-soil-modal__label">
                Observações
              </label>
              <textarea
                id="edit-soil-notes"
                className="edit-soil-modal__textarea"
                value={form.notes}
                placeholder="Notas sobre a análise..."
                rows={3}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="edit-soil-modal__footer">
          <button
            type="button"
            className="edit-soil-modal__btn edit-soil-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="edit-soil-modal__btn edit-soil-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="edit-soil-modal__spinner" />
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

export default EditSoilAnalysisModal;
