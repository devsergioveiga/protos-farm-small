import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import type { CreateSoilAnalysisPayload, SoilAnalysisItem } from '@/types/farm';
import './AddSoilAnalysisModal.css';

interface AddSoilAnalysisModalProps {
  isOpen: boolean;
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

const INITIAL_FORM: FormData = {
  analysisDate: '',
  labName: '',
  sampleDepthCm: '',
  phH2o: '',
  organicMatterPct: '',
  phosphorusMgDm3: '',
  potassiumMgDm3: '',
  calciumCmolcDm3: '',
  magnesiumCmolcDm3: '',
  aluminumCmolcDm3: '',
  ctcCmolcDm3: '',
  baseSaturationPct: '',
  sulfurMgDm3: '',
  clayContentPct: '',
  notes: '',
};

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

function AddSoilAnalysisModal({
  isOpen,
  farmId,
  plotId,
  onClose,
  onSuccess,
}: AddSoilAnalysisModalProps) {
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

    const payload: CreateSoilAnalysisPayload = {
      analysisDate: form.analysisDate,
    };

    if (form.labName.trim()) payload.labName = form.labName.trim();
    if (form.sampleDepthCm.trim()) payload.sampleDepthCm = form.sampleDepthCm.trim();
    if (form.notes.trim()) payload.notes = form.notes.trim();

    for (const field of NUMERIC_FIELDS) {
      if (form[field.key]) {
        const v = parseFloat(form[field.key]);
        if (!isNaN(v)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload as any)[field.key] = v;
        }
      }
    }

    try {
      await api.post<SoilAnalysisItem>(
        `/org/farms/${farmId}/plots/${plotId}/soil-analyses`,
        payload,
      );
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar a análise. Tente novamente.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, farmId, plotId, reset, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="add-soil-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-soil-analysis-title"
    >
      <div className="add-soil-modal">
        <header className="add-soil-modal__header">
          <h2 id="add-soil-analysis-title" className="add-soil-modal__title">
            Nova análise de solo
          </h2>
          <button
            type="button"
            className="add-soil-modal__close"
            aria-label="Fechar"
            onClick={handleClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="add-soil-modal__body">
          {submitError && (
            <div className="add-soil-modal__submit-error" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              {submitError}
            </div>
          )}

          <div className="add-soil-modal__fields">
            {/* Data da análise * */}
            <div className="add-soil-modal__field">
              <label htmlFor="soil-date" className="add-soil-modal__label">
                Data da análise<span className="add-soil-modal__required"> *</span>
              </label>
              <input
                id="soil-date"
                type="date"
                className={`add-soil-modal__input${touched.analysisDate && errors.analysisDate ? ' add-soil-modal__input--error' : ''}`}
                value={form.analysisDate}
                aria-required="true"
                aria-invalid={touched.analysisDate && !!errors.analysisDate}
                aria-describedby={
                  touched.analysisDate && errors.analysisDate ? 'soil-date-error' : undefined
                }
                onChange={(e) => setField('analysisDate', e.target.value)}
                onBlur={() => touchField('analysisDate')}
              />
              {touched.analysisDate && errors.analysisDate && (
                <span id="soil-date-error" className="add-soil-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {errors.analysisDate}
                </span>
              )}
            </div>

            {/* Laboratório */}
            <div className="add-soil-modal__field">
              <label htmlFor="soil-lab" className="add-soil-modal__label">
                Laboratório
              </label>
              <input
                id="soil-lab"
                type="text"
                className="add-soil-modal__input"
                value={form.labName}
                placeholder="Ex: Eurofins"
                onChange={(e) => setField('labName', e.target.value)}
              />
            </div>

            {/* Profundidade */}
            <div className="add-soil-modal__field">
              <label htmlFor="soil-depth" className="add-soil-modal__label">
                Profundidade da amostra
              </label>
              <input
                id="soil-depth"
                type="text"
                className="add-soil-modal__input"
                value={form.sampleDepthCm}
                placeholder="Ex: 0-20 cm"
                onChange={(e) => setField('sampleDepthCm', e.target.value)}
              />
            </div>

            {/* Separator */}
            <div className="add-soil-modal__separator">Parâmetros químicos</div>

            {/* Numeric fields */}
            {NUMERIC_FIELDS.map((field) => {
              const errorKey = field.key as keyof FormErrors;
              const hasError = touched[field.key] && errors[errorKey];
              return (
                <div key={field.key} className="add-soil-modal__field">
                  <label htmlFor={`soil-${field.key}`} className="add-soil-modal__label">
                    {field.label}
                    {field.unit && <span className="add-soil-modal__unit"> ({field.unit})</span>}
                  </label>
                  <input
                    id={`soil-${field.key}`}
                    type="number"
                    className={`add-soil-modal__input${hasError ? ' add-soil-modal__input--error' : ''}`}
                    value={form[field.key]}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    aria-invalid={!!hasError}
                    aria-describedby={hasError ? `soil-${field.key}-error` : undefined}
                    onChange={(e) => setField(field.key, e.target.value)}
                    onBlur={() => touchField(field.key)}
                  />
                  {hasError && (
                    <span
                      id={`soil-${field.key}-error`}
                      className="add-soil-modal__error"
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
            <div className="add-soil-modal__field add-soil-modal__field--full">
              <label htmlFor="soil-notes" className="add-soil-modal__label">
                Observações
              </label>
              <textarea
                id="soil-notes"
                className="add-soil-modal__textarea"
                value={form.notes}
                placeholder="Notas sobre a análise..."
                rows={3}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="add-soil-modal__footer">
          <button
            type="button"
            className="add-soil-modal__btn add-soil-modal__btn--secondary"
            onClick={handleClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="add-soil-modal__btn add-soil-modal__btn--primary"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} aria-hidden="true" className="add-soil-modal__spinner" />
                Salvando...
              </>
            ) : (
              'Salvar análise'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default AddSoilAnalysisModal;
