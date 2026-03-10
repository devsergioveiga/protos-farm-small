import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { WEATHER_CONDITIONS, DOSE_UNITS } from '@/types/soil-prep';
import type { SoilPrepItem, SoilPrepInputItem } from '@/types/soil-prep';
import type { FieldPlot } from '@/types/farm';
import './SoilPrepModal.css';

interface SoilPrepModalProps {
  isOpen: boolean;
  operation: SoilPrepItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_INPUT: SoilPrepInputItem = {
  productName: '',
  dose: 0,
  doseUnit: 'KG_HA',
  totalQuantity: null,
  batchCode: '',
};

function SoilPrepModal({ isOpen, operation, onClose, onSuccess }: SoilPrepModalProps) {
  const isEditing = !!operation;
  const { selectedFarmId } = useFarmContext();

  // Form state
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [operationTypeName, setOperationTypeName] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [machineName, setMachineName] = useState('');
  const [implementName, setImplementName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [depthCm, setDepthCm] = useState('');
  const [soilMoisturePercent, setSoilMoisturePercent] = useState('');
  const [weatherCondition, setWeatherCondition] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [machineCostPerHour, setMachineCostPerHour] = useState('');
  const [laborCount, setLaborCount] = useState('');
  const [laborHourCost, setLaborHourCost] = useState('');
  const [inputsCost, setInputsCost] = useState('');
  const [notes, setNotes] = useState('');
  const [inputs, setInputs] = useState<SoilPrepInputItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  // Load field plots
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
      setOperationTypeName('');
      setStartedAt('');
      setEndedAt('');
      setMachineName('');
      setImplementName('');
      setOperatorName('');
      setDepthCm('');
      setSoilMoisturePercent('');
      setWeatherCondition('');
      setDurationHours('');
      setMachineCostPerHour('');
      setLaborCount('');
      setLaborHourCost('');
      setInputsCost('');
      setNotes('');
      setInputs([]);
      setSubmitError(null);
      return;
    }
    if (operation) {
      setFieldPlotId(operation.fieldPlotId);
      setOperationTypeName(operation.operationTypeName);
      setStartedAt(operation.startedAt.slice(0, 16));
      setEndedAt(operation.endedAt ? operation.endedAt.slice(0, 16) : '');
      setMachineName(operation.machineName ?? '');
      setImplementName(operation.implementName ?? '');
      setOperatorName(operation.operatorName ?? '');
      setDepthCm(operation.depthCm != null ? String(operation.depthCm) : '');
      setSoilMoisturePercent(
        operation.soilMoisturePercent != null ? String(operation.soilMoisturePercent) : '',
      );
      setWeatherCondition(operation.weatherCondition ?? '');
      setDurationHours(operation.durationHours != null ? String(operation.durationHours) : '');
      setMachineCostPerHour(
        operation.machineCostPerHour != null ? String(operation.machineCostPerHour) : '',
      );
      setLaborCount(operation.laborCount != null ? String(operation.laborCount) : '');
      setLaborHourCost(operation.laborHourCost != null ? String(operation.laborHourCost) : '');
      setInputsCost(operation.inputsCost != null ? String(operation.inputsCost) : '');
      setNotes(operation.notes ?? '');
      setInputs(operation.inputs?.length ? [...operation.inputs] : []);
    }
  }, [isOpen, operation]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAddInput = useCallback(() => {
    setInputs((prev) => [...prev, { ...EMPTY_INPUT }]);
  }, []);

  const handleRemoveInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleInputChange = useCallback(
    (index: number, field: keyof SoilPrepInputItem, value: string | number) => {
      setInputs((prev) => prev.map((inp, i) => (i === index ? { ...inp, [field]: value } : inp)));
    },
    [],
  );

  const canSubmit = fieldPlotId && operationTypeName.trim() && startedAt && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedFarmId) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const body = {
      fieldPlotId,
      operationTypeName: operationTypeName.trim(),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      machineName: machineName.trim() || null,
      implementName: implementName.trim() || null,
      operatorName: operatorName.trim() || null,
      depthCm: depthCm ? Number(depthCm) : null,
      soilMoisturePercent: soilMoisturePercent ? Number(soilMoisturePercent) : null,
      weatherCondition: weatherCondition || null,
      durationHours: durationHours ? Number(durationHours) : null,
      machineCostPerHour: machineCostPerHour ? Number(machineCostPerHour) : null,
      laborCount: laborCount ? Number(laborCount) : null,
      laborHourCost: laborHourCost ? Number(laborHourCost) : null,
      inputsCost: inputsCost ? Number(inputsCost) : null,
      notes: notes.trim() || null,
      inputs: inputs
        .filter((inp) => inp.productName.trim())
        .map((inp) => ({
          productName: inp.productName.trim(),
          dose: Number(inp.dose),
          doseUnit: inp.doseUnit,
          batchCode: inp.batchCode?.trim() || null,
        })),
    };

    try {
      if (isEditing) {
        await api.patch(`/org/farms/${selectedFarmId}/soil-prep-operations/${operation!.id}`, body);
      } else {
        await api.post(`/org/farms/${selectedFarmId}/soil-prep-operations`, body);
      }
      onSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!operation || !selectedFarmId) return;
    setIsDeleting(true);
    setSubmitError(null);
    try {
      await api.delete(`/org/farms/${selectedFarmId}/soil-prep-operations/${operation.id}`);
      onSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível excluir. Tente novamente.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="soilprep-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar operação de preparo' : 'Nova operação de preparo'}
    >
      <div className="soilprep-modal">
        <div className="soilprep-modal__header">
          <h2 className="soilprep-modal__title">
            {isEditing ? 'Editar preparo de solo' : 'Novo preparo de solo'}
          </h2>
          <button
            type="button"
            className="soilprep-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="soilprep-modal__body">
          {/* Basic fields */}
          <h3 className="soilprep-modal__section-title">Dados básicos</h3>
          <div className="soilprep-modal__fields">
            <div className="soilprep-modal__row">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-plot" className="soilprep-modal__label">
                  Talhão *
                </label>
                <select
                  id="sp-plot"
                  className="soilprep-modal__select"
                  value={fieldPlotId}
                  onChange={(e) => setFieldPlotId(e.target.value)}
                  disabled={loadingPlots}
                  aria-required="true"
                >
                  <option value="">{loadingPlots ? 'Carregando...' : 'Selecione o talhão'}</option>
                  {plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({Number(p.boundaryAreaHa).toFixed(2)} ha)
                    </option>
                  ))}
                </select>
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-type" className="soilprep-modal__label">
                  Tipo de operação *
                </label>
                <input
                  id="sp-type"
                  type="text"
                  className="soilprep-modal__input"
                  placeholder="Ex.: Aração, Gradagem, Calagem"
                  value={operationTypeName}
                  onChange={(e) => setOperationTypeName(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            <div className="soilprep-modal__row">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-start" className="soilprep-modal__label">
                  Data/hora início *
                </label>
                <input
                  id="sp-start"
                  type="datetime-local"
                  className="soilprep-modal__input"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  aria-required="true"
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-end" className="soilprep-modal__label">
                  Data/hora fim
                </label>
                <input
                  id="sp-end"
                  type="datetime-local"
                  className="soilprep-modal__input"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Machine & operator */}
          <h3 className="soilprep-modal__section-title">Máquina e operador</h3>
          <div className="soilprep-modal__fields">
            <div className="soilprep-modal__row--three">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-machine" className="soilprep-modal__label">
                  Máquina
                </label>
                <input
                  id="sp-machine"
                  type="text"
                  className="soilprep-modal__input"
                  placeholder="Ex.: Trator MF 4292"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-implement" className="soilprep-modal__label">
                  Implemento
                </label>
                <input
                  id="sp-implement"
                  type="text"
                  className="soilprep-modal__input"
                  placeholder="Ex.: Arado 4 discos"
                  value={implementName}
                  onChange={(e) => setImplementName(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-operator" className="soilprep-modal__label">
                  Operador
                </label>
                <input
                  id="sp-operator"
                  type="text"
                  className="soilprep-modal__input"
                  placeholder="Nome do operador"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
              </div>
            </div>
            <div className="soilprep-modal__row">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-depth" className="soilprep-modal__label">
                  Profundidade (cm)
                </label>
                <input
                  id="sp-depth"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  step="0.5"
                  placeholder="Ex.: 30"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-duration" className="soilprep-modal__label">
                  Duração (horas)
                </label>
                <input
                  id="sp-duration"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  step="0.5"
                  placeholder="Ex.: 4"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Conditions */}
          <h3 className="soilprep-modal__section-title">Condições</h3>
          <div className="soilprep-modal__fields">
            <div className="soilprep-modal__row">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-moisture" className="soilprep-modal__label">
                  Umidade do solo (%)
                </label>
                <input
                  id="sp-moisture"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Ex.: 25"
                  value={soilMoisturePercent}
                  onChange={(e) => setSoilMoisturePercent(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-weather" className="soilprep-modal__label">
                  Clima
                </label>
                <select
                  id="sp-weather"
                  className="soilprep-modal__select"
                  value={weatherCondition}
                  onChange={(e) => setWeatherCondition(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {WEATHER_CONDITIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Inputs (insumos) */}
          <h3 className="soilprep-modal__section-title">Insumos aplicados</h3>
          <div className="soilprep-modal__fields">
            {inputs.map((inp, idx) => (
              <div key={idx} className="soilprep-modal__input-row">
                <div className="soilprep-modal__field">
                  <label htmlFor={`sp-inp-name-${idx}`} className="soilprep-modal__label">
                    Produto
                  </label>
                  <input
                    id={`sp-inp-name-${idx}`}
                    type="text"
                    className="soilprep-modal__input"
                    placeholder="Ex.: Calcário dolomítico"
                    value={inp.productName}
                    onChange={(e) => handleInputChange(idx, 'productName', e.target.value)}
                  />
                </div>
                <div className="soilprep-modal__field">
                  <label htmlFor={`sp-inp-dose-${idx}`} className="soilprep-modal__label">
                    Dose
                  </label>
                  <input
                    id={`sp-inp-dose-${idx}`}
                    type="number"
                    className="soilprep-modal__input"
                    min="0"
                    step="0.01"
                    value={inp.dose || ''}
                    onChange={(e) => handleInputChange(idx, 'dose', Number(e.target.value))}
                  />
                </div>
                <div className="soilprep-modal__field">
                  <label htmlFor={`sp-inp-unit-${idx}`} className="soilprep-modal__label">
                    Unidade
                  </label>
                  <select
                    id={`sp-inp-unit-${idx}`}
                    className="soilprep-modal__select"
                    value={inp.doseUnit}
                    onChange={(e) => handleInputChange(idx, 'doseUnit', e.target.value)}
                  >
                    {DOSE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="soilprep-modal__field">
                  <label htmlFor={`sp-inp-batch-${idx}`} className="soilprep-modal__label">
                    Lote
                  </label>
                  <input
                    id={`sp-inp-batch-${idx}`}
                    type="text"
                    className="soilprep-modal__input"
                    placeholder="Código"
                    value={inp.batchCode ?? ''}
                    onChange={(e) => handleInputChange(idx, 'batchCode', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="soilprep-modal__remove-btn"
                  onClick={() => handleRemoveInput(idx)}
                  aria-label={`Remover insumo ${inp.productName || idx + 1}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="soilprep-modal__add-input-btn"
              onClick={handleAddInput}
            >
              <Plus size={16} aria-hidden="true" />
              Adicionar insumo
            </button>
          </div>

          {/* Costs */}
          <h3 className="soilprep-modal__section-title">Custos</h3>
          <div className="soilprep-modal__fields">
            <div className="soilprep-modal__row--three">
              <div className="soilprep-modal__field">
                <label htmlFor="sp-machine-cost" className="soilprep-modal__label">
                  Custo máquina (R$/h)
                </label>
                <input
                  id="sp-machine-cost"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  step="0.01"
                  value={machineCostPerHour}
                  onChange={(e) => setMachineCostPerHour(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-labor-count" className="soilprep-modal__label">
                  Trabalhadores
                </label>
                <input
                  id="sp-labor-count"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  step="1"
                  value={laborCount}
                  onChange={(e) => setLaborCount(e.target.value)}
                />
              </div>
              <div className="soilprep-modal__field">
                <label htmlFor="sp-labor-cost" className="soilprep-modal__label">
                  Custo mão de obra (R$/h)
                </label>
                <input
                  id="sp-labor-cost"
                  type="number"
                  className="soilprep-modal__input"
                  min="0"
                  step="0.01"
                  value={laborHourCost}
                  onChange={(e) => setLaborHourCost(e.target.value)}
                />
              </div>
            </div>
            <div className="soilprep-modal__field">
              <label htmlFor="sp-inputs-cost" className="soilprep-modal__label">
                Custo total insumos (R$)
              </label>
              <input
                id="sp-inputs-cost"
                type="number"
                className="soilprep-modal__input"
                min="0"
                step="0.01"
                value={inputsCost}
                onChange={(e) => setInputsCost(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <h3 className="soilprep-modal__section-title">Observações</h3>
          <div className="soilprep-modal__fields">
            <div className="soilprep-modal__field">
              <label htmlFor="sp-notes" className="soilprep-modal__label">
                Notas
              </label>
              <textarea
                id="sp-notes"
                className="soilprep-modal__textarea"
                rows={3}
                placeholder="Observações sobre a operação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <div className="soilprep-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        <div className="soilprep-modal__footer">
          {isEditing && (
            <button
              type="button"
              className="soilprep-modal__btn soilprep-modal__btn--danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <div className="soilprep-modal__footer-spacer" />
          <button
            type="button"
            className="soilprep-modal__btn soilprep-modal__btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="soilprep-modal__btn soilprep-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar operação'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SoilPrepModal;
