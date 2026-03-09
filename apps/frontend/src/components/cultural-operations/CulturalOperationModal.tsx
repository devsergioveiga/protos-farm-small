import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { CULTURAL_OPERATION_TYPES, PRUNING_TYPES } from '@/types/cultural-operation';
import type {
  CulturalOperationItem,
  CreateCulturalOperationInput,
} from '@/types/cultural-operation';
import type { FieldPlot } from '@/types/farm';
import './CulturalOperationModal.css';

interface CulturalOperationModalProps {
  isOpen: boolean;
  operation: CulturalOperationItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CulturalOperationModal({
  isOpen,
  operation,
  onClose,
  onSuccess,
}: CulturalOperationModalProps) {
  const isEditing = !!operation;
  const { selectedFarmId } = useFarmContext();

  const [fieldPlotId, setFieldPlotId] = useState('');
  const [performedAt, setPerformedAt] = useState('');
  const [operationType, setOperationType] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [machineName, setMachineName] = useState('');
  const [laborCount, setLaborCount] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [irrigationDepthMm, setIrrigationDepthMm] = useState('');
  const [irrigationTimeMin, setIrrigationTimeMin] = useState('');
  const [irrigationSystem, setIrrigationSystem] = useState('');
  const [pruningType, setPruningType] = useState('');
  const [pruningPercentage, setPruningPercentage] = useState('');
  const [machineHourCost, setMachineHourCost] = useState('');
  const [laborHourCost, setLaborHourCost] = useState('');
  const [supplyCost, setSupplyCost] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  const showIrrigationFields = operationType === 'IRRIGACAO';
  const showPruningFields = operationType === 'PODA';

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
      setPerformedAt('');
      setOperationType('');
      setDurationHours('');
      setMachineName('');
      setLaborCount('');
      setLaborHours('');
      setIrrigationDepthMm('');
      setIrrigationTimeMin('');
      setIrrigationSystem('');
      setPruningType('');
      setPruningPercentage('');
      setMachineHourCost('');
      setLaborHourCost('');
      setSupplyCost('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (operation) {
      setFieldPlotId(operation.fieldPlotId);
      const dt = new Date(operation.performedAt);
      setPerformedAt(dt.toISOString().slice(0, 16));
      setOperationType(operation.operationType);
      setDurationHours(operation.durationHours != null ? String(operation.durationHours) : '');
      setMachineName(operation.machineName ?? '');
      setLaborCount(operation.laborCount != null ? String(operation.laborCount) : '');
      setLaborHours(operation.laborHours != null ? String(operation.laborHours) : '');
      setIrrigationDepthMm(
        operation.irrigationDepthMm != null ? String(operation.irrigationDepthMm) : '',
      );
      setIrrigationTimeMin(
        operation.irrigationTimeMin != null ? String(operation.irrigationTimeMin) : '',
      );
      setIrrigationSystem(operation.irrigationSystem ?? '');
      setPruningType(operation.pruningType ?? '');
      setPruningPercentage(
        operation.pruningPercentage != null ? String(operation.pruningPercentage) : '',
      );
      setMachineHourCost(
        operation.machineHourCost != null ? String(operation.machineHourCost) : '',
      );
      setLaborHourCost(operation.laborHourCost != null ? String(operation.laborHourCost) : '');
      setSupplyCost(operation.supplyCost != null ? String(operation.supplyCost) : '');
      setNotes(operation.notes ?? '');
    }
  }, [isOpen, operation]);

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
    fieldPlotId.trim() !== '' && performedAt.trim() !== '' && operationType.trim() !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateCulturalOperationInput = {
        fieldPlotId,
        performedAt: new Date(performedAt).toISOString(),
        operationType,
        durationHours: durationHours ? Number(durationHours) : undefined,
        machineName: machineName.trim() || undefined,
        laborCount: laborCount ? Number(laborCount) : undefined,
        laborHours: laborHours ? Number(laborHours) : undefined,
        irrigationDepthMm: irrigationDepthMm ? Number(irrigationDepthMm) : undefined,
        irrigationTimeMin: irrigationTimeMin ? Number(irrigationTimeMin) : undefined,
        irrigationSystem: irrigationSystem.trim() || undefined,
        pruningType: pruningType || undefined,
        pruningPercentage: pruningPercentage ? Number(pruningPercentage) : undefined,
        machineHourCost: machineHourCost ? Number(machineHourCost) : undefined,
        laborHourCost: laborHourCost ? Number(laborHourCost) : undefined,
        supplyCost: supplyCost ? Number(supplyCost) : undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(
          `/org/farms/${selectedFarmId}/cultural-operations/${operation!.id}`,
          payload,
        );
      } else {
        await api.post(`/org/farms/${selectedFarmId}/cultural-operations`, payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar operação';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedFarmId,
    fieldPlotId,
    performedAt,
    operationType,
    durationHours,
    machineName,
    laborCount,
    laborHours,
    irrigationDepthMm,
    irrigationTimeMin,
    irrigationSystem,
    pruningType,
    pruningPercentage,
    machineHourCost,
    laborHourCost,
    supplyCost,
    notes,
    isEditing,
    operation,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="cultural-overlay" onClick={onClose}>
      <div
        className="cultural-modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          isEditing ? 'Editar operação de trato cultural' : 'Nova operação de trato cultural'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cultural-modal__header">
          <h2 className="cultural-modal__title">
            {isEditing ? 'Editar operação' : 'Nova operação de trato cultural'}
          </h2>
          <button
            type="button"
            className="cultural-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="cultural-modal__body">
          <div className="cultural-modal__fields">
            {/* Local e data */}
            <h3 className="cultural-modal__section-title">Local e data</h3>

            <div className="cultural-modal__row">
              <div className="cultural-modal__field">
                <label htmlFor="cult-plot" className="cultural-modal__label">
                  Talhão *
                </label>
                <select
                  id="cult-plot"
                  className="cultural-modal__select"
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
              <div className="cultural-modal__field">
                <label htmlFor="cult-date" className="cultural-modal__label">
                  Data/hora da operação *
                </label>
                <input
                  id="cult-date"
                  type="datetime-local"
                  className="cultural-modal__input"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            {/* Tipo de operação */}
            <h3 className="cultural-modal__section-title">Tipo de operação</h3>

            <div className="cultural-modal__row">
              <div className="cultural-modal__field">
                <label htmlFor="cult-type" className="cultural-modal__label">
                  Tipo *
                </label>
                <select
                  id="cult-type"
                  className="cultural-modal__select"
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione o tipo</option>
                  {CULTURAL_OPERATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cultural-modal__field">
                <label htmlFor="cult-duration" className="cultural-modal__label">
                  Duração (horas)
                </label>
                <input
                  id="cult-duration"
                  type="number"
                  className="cultural-modal__input"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="Ex: 4"
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            {/* Irrigação - condicional */}
            {showIrrigationFields && (
              <>
                <h3 className="cultural-modal__section-title">Irrigação</h3>
                <div className="cultural-modal__row--three">
                  <div className="cultural-modal__field">
                    <label htmlFor="cult-irr-depth" className="cultural-modal__label">
                      Lâmina aplicada (mm)
                    </label>
                    <input
                      id="cult-irr-depth"
                      type="number"
                      className="cultural-modal__input"
                      value={irrigationDepthMm}
                      onChange={(e) => setIrrigationDepthMm(e.target.value)}
                      placeholder="Ex: 25"
                      min="0.1"
                      step="0.1"
                    />
                  </div>
                  <div className="cultural-modal__field">
                    <label htmlFor="cult-irr-time" className="cultural-modal__label">
                      Tempo de irrigação (min)
                    </label>
                    <input
                      id="cult-irr-time"
                      type="number"
                      className="cultural-modal__input"
                      value={irrigationTimeMin}
                      onChange={(e) => setIrrigationTimeMin(e.target.value)}
                      placeholder="Ex: 120"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="cultural-modal__field">
                    <label htmlFor="cult-irr-system" className="cultural-modal__label">
                      Sistema/Pivô
                    </label>
                    <input
                      id="cult-irr-system"
                      type="text"
                      className="cultural-modal__input"
                      value={irrigationSystem}
                      onChange={(e) => setIrrigationSystem(e.target.value)}
                      placeholder="Ex: Pivô central, Gotejamento"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Poda - condicional */}
            {showPruningFields && (
              <>
                <h3 className="cultural-modal__section-title">Poda</h3>
                <div className="cultural-modal__row">
                  <div className="cultural-modal__field">
                    <label htmlFor="cult-prune-type" className="cultural-modal__label">
                      Tipo de poda
                    </label>
                    <select
                      id="cult-prune-type"
                      className="cultural-modal__select"
                      value={pruningType}
                      onChange={(e) => setPruningType(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {PRUNING_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cultural-modal__field">
                    <label htmlFor="cult-prune-pct" className="cultural-modal__label">
                      % da lavoura podada
                    </label>
                    <input
                      id="cult-prune-pct"
                      type="number"
                      className="cultural-modal__input"
                      value={pruningPercentage}
                      onChange={(e) => setPruningPercentage(e.target.value)}
                      placeholder="Ex: 30"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mão de obra e máquina */}
            <h3 className="cultural-modal__section-title">Mão de obra e máquina</h3>

            <div className="cultural-modal__row--three">
              <div className="cultural-modal__field">
                <label htmlFor="cult-machine" className="cultural-modal__label">
                  Máquina/Equipamento
                </label>
                <input
                  id="cult-machine"
                  type="text"
                  className="cultural-modal__input"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="Ex: Roçadeira lateral"
                />
              </div>
              <div className="cultural-modal__field">
                <label htmlFor="cult-labor-count" className="cultural-modal__label">
                  Nº de trabalhadores
                </label>
                <input
                  id="cult-labor-count"
                  type="number"
                  className="cultural-modal__input"
                  value={laborCount}
                  onChange={(e) => setLaborCount(e.target.value)}
                  placeholder="Ex: 5"
                  min="1"
                  step="1"
                />
              </div>
              <div className="cultural-modal__field">
                <label htmlFor="cult-labor-hours" className="cultural-modal__label">
                  Horas de mão de obra
                </label>
                <input
                  id="cult-labor-hours"
                  type="number"
                  className="cultural-modal__input"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="Ex: 40"
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            {/* Custos */}
            <h3 className="cultural-modal__section-title">Custos (R$)</h3>

            <div className="cultural-modal__row--three">
              <div className="cultural-modal__field">
                <label htmlFor="cult-cost-machine" className="cultural-modal__label">
                  Horas-máquina
                </label>
                <input
                  id="cult-cost-machine"
                  type="number"
                  className="cultural-modal__input"
                  value={machineHourCost}
                  onChange={(e) => setMachineHourCost(e.target.value)}
                  placeholder="Ex: 350.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="cultural-modal__field">
                <label htmlFor="cult-cost-labor" className="cultural-modal__label">
                  Horas-homem
                </label>
                <input
                  id="cult-cost-labor"
                  type="number"
                  className="cultural-modal__input"
                  value={laborHourCost}
                  onChange={(e) => setLaborHourCost(e.target.value)}
                  placeholder="Ex: 500.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="cultural-modal__field">
                <label htmlFor="cult-cost-supply" className="cultural-modal__label">
                  Insumos
                </label>
                <input
                  id="cult-cost-supply"
                  type="number"
                  className="cultural-modal__input"
                  value={supplyCost}
                  onChange={(e) => setSupplyCost(e.target.value)}
                  placeholder="Ex: 200.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Observações */}
            <h3 className="cultural-modal__section-title">Observações</h3>

            <div className="cultural-modal__field">
              <label htmlFor="cult-notes" className="cultural-modal__label">
                Observações
              </label>
              <textarea
                id="cult-notes"
                className="cultural-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições do terreno, observações gerais..."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="cultural-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cultural-modal__footer">
          <div className="cultural-modal__footer-spacer" />
          <button
            type="button"
            className="cultural-modal__btn cultural-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="cultural-modal__btn cultural-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar operação'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CulturalOperationModal;
