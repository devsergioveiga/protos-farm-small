import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { PESTICIDE_TARGETS, DOSE_UNITS } from '@/types/pesticide-application';
import type {
  PesticideApplicationItem,
  CreatePesticideApplicationInput,
} from '@/types/pesticide-application';
import type { FieldPlot } from '@/types/farm';
import './PesticideApplicationModal.css';

interface PesticideApplicationModalProps {
  isOpen: boolean;
  application: PesticideApplicationItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PesticideApplicationModal({
  isOpen,
  application,
  onClose,
  onSuccess,
}: PesticideApplicationModalProps) {
  const isEditing = !!application;
  const { selectedFarmId } = useFarmContext();

  const [fieldPlotId, setFieldPlotId] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [productName, setProductName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('L_HA');
  const [sprayVolume, setSprayVolume] = useState('');
  const [target, setTarget] = useState('');
  const [targetDescription, setTargetDescription] = useState('');
  const [artNumber, setArtNumber] = useState('');
  const [agronomistCrea, setAgronomistCrea] = useState('');
  const [technicalJustification, setTechnicalJustification] = useState('');
  const [temperature, setTemperature] = useState('');
  const [relativeHumidity, setRelativeHumidity] = useState('');
  const [windSpeed, setWindSpeed] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const conditionAlerts = useMemo(() => {
    const alerts: string[] = [];
    const temp = Number(temperature);
    const humidity = Number(relativeHumidity);
    const wind = Number(windSpeed);
    if (temperature && !isNaN(temp) && temp > 30) {
      alerts.push(`Temperatura elevada (${temp}°C > 30°C)`);
    }
    if (relativeHumidity && !isNaN(humidity) && humidity < 55) {
      alerts.push(`Umidade baixa (${humidity}% < 55%)`);
    }
    if (windSpeed && !isNaN(wind) && wind > 10) {
      alerts.push(`Vento forte (${wind} km/h > 10 km/h)`);
    }
    return alerts;
  }, [temperature, relativeHumidity, windSpeed]);

  // Load field plots when modal opens
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;

    let cancelled = false;
    setLoadingPlots(true);
    api
      .get<FieldPlot[]>(`/org/farms/${selectedFarmId}/plots`)
      .then((result) => {
        if (!cancelled) setPlots(result);
      })
      .catch(() => {
        if (!cancelled) setPlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedFarmId]);

  // Reset / populate form
  useEffect(() => {
    if (!isOpen) {
      setFieldPlotId('');
      setAppliedAt('');
      setProductName('');
      setActiveIngredient('');
      setDose('');
      setDoseUnit('L_HA');
      setSprayVolume('');
      setTarget('');
      setTargetDescription('');
      setArtNumber('');
      setAgronomistCrea('');
      setTechnicalJustification('');
      setTemperature('');
      setRelativeHumidity('');
      setWindSpeed('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (application) {
      setFieldPlotId(application.fieldPlotId);
      const dt = new Date(application.appliedAt);
      setAppliedAt(dt.toISOString().slice(0, 16));
      setProductName(application.productName);
      setActiveIngredient(application.activeIngredient);
      setDose(String(application.dose));
      setDoseUnit(application.doseUnit);
      setSprayVolume(String(application.sprayVolume));
      setTarget(application.target);
      setTargetDescription(application.targetDescription ?? '');
      setArtNumber(application.artNumber ?? '');
      setAgronomistCrea(application.agronomistCrea ?? '');
      setTechnicalJustification(application.technicalJustification ?? '');
      setTemperature(application.temperature != null ? String(application.temperature) : '');
      setRelativeHumidity(
        application.relativeHumidity != null ? String(application.relativeHumidity) : '',
      );
      setWindSpeed(application.windSpeed != null ? String(application.windSpeed) : '');
      setNotes(application.notes ?? '');
    }
  }, [isOpen, application]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const canSubmit =
    fieldPlotId.trim() !== '' &&
    appliedAt.trim() !== '' &&
    productName.trim() !== '' &&
    activeIngredient.trim() !== '' &&
    dose.trim() !== '' &&
    Number(dose) > 0 &&
    sprayVolume.trim() !== '' &&
    Number(sprayVolume) > 0 &&
    target.trim() !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreatePesticideApplicationInput = {
        fieldPlotId,
        appliedAt: new Date(appliedAt).toISOString(),
        productName: productName.trim(),
        activeIngredient: activeIngredient.trim(),
        dose: Number(dose),
        doseUnit,
        sprayVolume: Number(sprayVolume),
        target,
        targetDescription: targetDescription.trim() || undefined,
        artNumber: artNumber.trim() || undefined,
        agronomistCrea: agronomistCrea.trim() || undefined,
        technicalJustification: technicalJustification.trim() || undefined,
        temperature: temperature ? Number(temperature) : undefined,
        relativeHumidity: relativeHumidity ? Number(relativeHumidity) : undefined,
        windSpeed: windSpeed ? Number(windSpeed) : undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(
          `/org/farms/${selectedFarmId}/pesticide-applications/${application!.id}`,
          payload,
        );
      } else {
        await api.post(`/org/farms/${selectedFarmId}/pesticide-applications`, payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar aplicação';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedFarmId,
    fieldPlotId,
    appliedAt,
    productName,
    activeIngredient,
    dose,
    doseUnit,
    sprayVolume,
    target,
    targetDescription,
    artNumber,
    agronomistCrea,
    technicalJustification,
    temperature,
    relativeHumidity,
    windSpeed,
    notes,
    isEditing,
    application,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="pesticide-overlay" onClick={onClose}>
      <div
        className="pesticide-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar aplicação de defensivo' : 'Nova aplicação de defensivo'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pesticide-modal__header">
          <h2 className="pesticide-modal__title">
            {isEditing ? 'Editar aplicação' : 'Nova aplicação de defensivo'}
          </h2>
          <button
            type="button"
            className="pesticide-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="pesticide-modal__body">
          <div className="pesticide-modal__fields">
            {/* Local e data */}
            <h3 className="pesticide-modal__section-title">Local e data</h3>

            <div className="pesticide-modal__row">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-plot" className="pesticide-modal__label">
                  Talhão *
                </label>
                <select
                  id="pest-plot"
                  className="pesticide-modal__select"
                  value={fieldPlotId}
                  onChange={(e) => setFieldPlotId(e.target.value)}
                  aria-required="true"
                  disabled={loadingPlots}
                >
                  <option value="">
                    {loadingPlots ? 'Carregando talhões...' : 'Selecione o talhão'}
                  </option>
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.boundaryAreaHa} ha)
                    </option>
                  ))}
                </select>
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-date" className="pesticide-modal__label">
                  Data/hora da aplicação *
                </label>
                <input
                  id="pest-date"
                  type="datetime-local"
                  className="pesticide-modal__input"
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            {/* Produto */}
            <h3 className="pesticide-modal__section-title">Produto e dosagem</h3>

            <div className="pesticide-modal__row">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-product" className="pesticide-modal__label">
                  Produto comercial *
                </label>
                <input
                  id="pest-product"
                  type="text"
                  className="pesticide-modal__input"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Roundup Ready"
                  aria-required="true"
                />
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-ingredient" className="pesticide-modal__label">
                  Ingrediente ativo *
                </label>
                <input
                  id="pest-ingredient"
                  type="text"
                  className="pesticide-modal__input"
                  value={activeIngredient}
                  onChange={(e) => setActiveIngredient(e.target.value)}
                  placeholder="Ex: Glifosato"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="pesticide-modal__row--three">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-dose" className="pesticide-modal__label">
                  Dose *
                </label>
                <input
                  id="pest-dose"
                  type="number"
                  className="pesticide-modal__input"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="Ex: 2.5"
                  min="0.001"
                  step="0.001"
                  aria-required="true"
                />
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-dose-unit" className="pesticide-modal__label">
                  Unidade de dose
                </label>
                <select
                  id="pest-dose-unit"
                  className="pesticide-modal__select"
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-spray" className="pesticide-modal__label">
                  Volume de calda (L/ha) *
                </label>
                <input
                  id="pest-spray"
                  type="number"
                  className="pesticide-modal__input"
                  value={sprayVolume}
                  onChange={(e) => setSprayVolume(e.target.value)}
                  placeholder="Ex: 150"
                  min="0.1"
                  step="0.1"
                  aria-required="true"
                />
              </div>
            </div>

            {/* Alvo */}
            <h3 className="pesticide-modal__section-title">Alvo da aplicação</h3>

            <div className="pesticide-modal__row">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-target" className="pesticide-modal__label">
                  Tipo de alvo *
                </label>
                <select
                  id="pest-target"
                  className="pesticide-modal__select"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {PESTICIDE_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-target-desc" className="pesticide-modal__label">
                  Descrição do alvo
                </label>
                <input
                  id="pest-target-desc"
                  type="text"
                  className="pesticide-modal__input"
                  value={targetDescription}
                  onChange={(e) => setTargetDescription(e.target.value)}
                  placeholder="Ex: Lagarta-da-soja, Ferrugem asiática"
                />
              </div>
            </div>

            {/* Receituário agronômico */}
            <h3 className="pesticide-modal__section-title">Receituário agronômico</h3>

            <div className="pesticide-modal__row">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-art" className="pesticide-modal__label">
                  Nº da ART / Receita
                </label>
                <input
                  id="pest-art"
                  type="text"
                  className="pesticide-modal__input"
                  value={artNumber}
                  onChange={(e) => setArtNumber(e.target.value)}
                  placeholder="Ex: ART-2026-001234"
                />
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-crea" className="pesticide-modal__label">
                  Agrônomo responsável (CREA)
                </label>
                <input
                  id="pest-crea"
                  type="text"
                  className="pesticide-modal__input"
                  value={agronomistCrea}
                  onChange={(e) => setAgronomistCrea(e.target.value)}
                  placeholder="Ex: CREA-SP 5012345678"
                />
              </div>
            </div>

            <div className="pesticide-modal__field">
              <label htmlFor="pest-justification" className="pesticide-modal__label">
                Justificativa técnica
              </label>
              <textarea
                id="pest-justification"
                className="pesticide-modal__textarea"
                value={technicalJustification}
                onChange={(e) => setTechnicalJustification(e.target.value)}
                placeholder="Justificativa técnica para a aplicação do defensivo..."
                rows={3}
              />
            </div>

            {/* Condições da aplicação */}
            <h3 className="pesticide-modal__section-title">Condições da aplicação</h3>

            <div className="pesticide-modal__row--three">
              <div className="pesticide-modal__field">
                <label htmlFor="pest-temperature" className="pesticide-modal__label">
                  Temperatura (°C)
                </label>
                <input
                  id="pest-temperature"
                  type="number"
                  className="pesticide-modal__input"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="Ex: 28"
                  min="-10"
                  max="60"
                  step="0.1"
                />
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-humidity" className="pesticide-modal__label">
                  Umidade relativa (%)
                </label>
                <input
                  id="pest-humidity"
                  type="number"
                  className="pesticide-modal__input"
                  value={relativeHumidity}
                  onChange={(e) => setRelativeHumidity(e.target.value)}
                  placeholder="Ex: 65"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div className="pesticide-modal__field">
                <label htmlFor="pest-wind" className="pesticide-modal__label">
                  Velocidade do vento (km/h)
                </label>
                <input
                  id="pest-wind"
                  type="number"
                  className="pesticide-modal__input"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(e.target.value)}
                  placeholder="Ex: 8"
                  min="0"
                  max="200"
                  step="0.1"
                />
              </div>
            </div>

            {conditionAlerts.length > 0 && (
              <div className="pesticide-modal__condition-alert" role="alert" aria-live="polite">
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                  <strong>Condições inadequadas para aplicação</strong>
                  <ul className="pesticide-modal__condition-alert-list">
                    {conditionAlerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Observações */}
            <h3 className="pesticide-modal__section-title">Observações</h3>

            <div className="pesticide-modal__field">
              <label htmlFor="pest-notes" className="pesticide-modal__label">
                Observações
              </label>
              <textarea
                id="pest-notes"
                className="pesticide-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições observadas, justificativa, etc."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="pesticide-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pesticide-modal__footer">
          <div className="pesticide-modal__footer-spacer" />
          <button
            type="button"
            className="pesticide-modal__btn pesticide-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pesticide-modal__btn pesticide-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar aplicação'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PesticideApplicationModal;
