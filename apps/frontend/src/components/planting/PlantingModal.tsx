import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { SEASON_TYPES, FERTILIZER_MODES, DOSE_UNITS } from '@/types/planting';
import type { PlantingItem, SeedTreatmentItem, BaseFertilizationItem } from '@/types/planting';
import type { FieldPlot } from '@/types/farm';
import type { CultivarItem } from '@/types/cultivar';
import './PlantingModal.css';

interface PlantingModalProps {
  isOpen: boolean;
  operation: PlantingItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_TREATMENT: SeedTreatmentItem = {
  productName: '',
  dose: 0,
  doseUnit: 'ML_100KG',
  responsibleTechnician: '',
};

const EMPTY_FERTILIZATION: BaseFertilizationItem = {
  formulation: '',
  doseKgHa: 0,
  applicationMode: 'SULCO',
  totalQuantity: null,
};

function PlantingModal({ isOpen, operation, onClose, onSuccess }: PlantingModalProps) {
  const isEditing = !!operation;
  const { selectedFarmId } = useFarmContext();

  // CA1 — Basic fields
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [cultivarId, setCultivarId] = useState('');
  const [seasonYear, setSeasonYear] = useState('');
  const [seasonType, setSeasonType] = useState('SAFRA');
  const [crop, setCrop] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [plantedAreaPercent, setPlantedAreaPercent] = useState('100');

  // CA2 — Technical fields
  const [populationPerM, setPopulationPerM] = useState('');
  const [rowSpacingCm, setRowSpacingCm] = useState('');
  const [depthCm, setDepthCm] = useState('');
  const [seedRateKgHa, setSeedRateKgHa] = useState('');

  // CA3 — Seed treatments
  const [seedTreatments, setSeedTreatments] = useState<SeedTreatmentItem[]>([]);

  // CA4 — Base fertilizations
  const [baseFertilizations, setBaseFertilizations] = useState<BaseFertilizationItem[]>([]);

  // CA5 — Machine & operator
  const [machineName, setMachineName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [averageSpeedKmH, setAverageSpeedKmH] = useState('');

  // CA8 — Costs
  const [seedCost, setSeedCost] = useState('');
  const [fertilizerCost, setFertilizerCost] = useState('');
  const [treatmentCost, setTreatmentCost] = useState('');
  const [operationCost, setOperationCost] = useState('');

  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [cultivars, setCultivars] = useState<CultivarItem[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  // Load field plots and cultivars
  useEffect(() => {
    if (!isOpen || !selectedFarmId) return;
    let cancelled = false;
    setLoadingPlots(true);

    Promise.all([
      api.get<FieldPlot[]>(`/org/farms/${selectedFarmId}/plots`),
      api.get<{ data: CultivarItem[] }>('/org/cultivars?limit=200'),
    ])
      .then(([plotsResult, cultivarsResult]) => {
        if (!cancelled) {
          setPlots(plotsResult);
          setCultivars(cultivarsResult.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlots([]);
          setCultivars([]);
        }
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
      setCultivarId('');
      setSeasonYear('');
      setSeasonType('SAFRA');
      setCrop('');
      setPlantingDate('');
      setPlantedAreaPercent('100');
      setPopulationPerM('');
      setRowSpacingCm('');
      setDepthCm('');
      setSeedRateKgHa('');
      setSeedTreatments([]);
      setBaseFertilizations([]);
      setMachineName('');
      setOperatorName('');
      setAverageSpeedKmH('');
      setSeedCost('');
      setFertilizerCost('');
      setTreatmentCost('');
      setOperationCost('');
      setNotes('');
      setSubmitError(null);
      return;
    }
    if (operation) {
      setFieldPlotId(operation.fieldPlotId);
      setCultivarId(operation.cultivarId ?? '');
      setSeasonYear(operation.seasonYear);
      setSeasonType(operation.seasonType);
      setCrop(operation.crop);
      setPlantingDate(operation.plantingDate);
      setPlantedAreaPercent(String(operation.plantedAreaPercent));
      setPopulationPerM(operation.populationPerM != null ? String(operation.populationPerM) : '');
      setRowSpacingCm(operation.rowSpacingCm != null ? String(operation.rowSpacingCm) : '');
      setDepthCm(operation.depthCm != null ? String(operation.depthCm) : '');
      setSeedRateKgHa(operation.seedRateKgHa != null ? String(operation.seedRateKgHa) : '');
      setSeedTreatments(operation.seedTreatments?.length ? [...operation.seedTreatments] : []);
      setBaseFertilizations(
        operation.baseFertilizations?.length ? [...operation.baseFertilizations] : [],
      );
      setMachineName(operation.machineName ?? '');
      setOperatorName(operation.operatorName ?? '');
      setAverageSpeedKmH(
        operation.averageSpeedKmH != null ? String(operation.averageSpeedKmH) : '',
      );
      setSeedCost(operation.seedCost != null ? String(operation.seedCost) : '');
      setFertilizerCost(operation.fertilizerCost != null ? String(operation.fertilizerCost) : '');
      setTreatmentCost(operation.treatmentCost != null ? String(operation.treatmentCost) : '');
      setOperationCost(operation.operationCost != null ? String(operation.operationCost) : '');
      setNotes(operation.notes ?? '');
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

  // Auto-fill crop from cultivar selection
  const handleCultivarChange = useCallback(
    (id: string) => {
      setCultivarId(id);
      if (id) {
        const cv = cultivars.find((c) => c.id === id);
        if (cv && !crop) setCrop(cv.crop);
      }
    },
    [cultivars, crop],
  );

  // Seed treatment handlers
  const handleAddTreatment = useCallback(() => {
    setSeedTreatments((prev) => [...prev, { ...EMPTY_TREATMENT }]);
  }, []);
  const handleRemoveTreatment = useCallback((idx: number) => {
    setSeedTreatments((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const handleTreatmentChange = useCallback(
    (idx: number, field: keyof SeedTreatmentItem, value: string | number) => {
      setSeedTreatments((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
    },
    [],
  );

  // Fertilization handlers
  const handleAddFertilization = useCallback(() => {
    setBaseFertilizations((prev) => [...prev, { ...EMPTY_FERTILIZATION }]);
  }, []);
  const handleRemoveFertilization = useCallback((idx: number) => {
    setBaseFertilizations((prev) => prev.filter((_, i) => i !== idx));
  }, []);
  const handleFertilizationChange = useCallback(
    (idx: number, field: keyof BaseFertilizationItem, value: string | number) => {
      setBaseFertilizations((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)),
      );
    },
    [],
  );

  const canSubmit =
    fieldPlotId && crop.trim() && plantingDate && seasonYear.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedFarmId) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const body = {
      fieldPlotId,
      cultivarId: cultivarId || null,
      seasonYear: seasonYear.trim(),
      seasonType,
      crop: crop.trim(),
      plantingDate,
      plantedAreaPercent: plantedAreaPercent ? Number(plantedAreaPercent) : 100,
      populationPerM: populationPerM ? Number(populationPerM) : null,
      rowSpacingCm: rowSpacingCm ? Number(rowSpacingCm) : null,
      depthCm: depthCm ? Number(depthCm) : null,
      seedRateKgHa: seedRateKgHa ? Number(seedRateKgHa) : null,
      seedTreatments: seedTreatments
        .filter((t) => t.productName.trim())
        .map((t) => ({
          productName: t.productName.trim(),
          dose: Number(t.dose),
          doseUnit: t.doseUnit,
          responsibleTechnician: t.responsibleTechnician?.trim() || null,
        })),
      baseFertilizations: baseFertilizations
        .filter((f) => f.formulation.trim())
        .map((f) => ({
          formulation: f.formulation.trim(),
          doseKgHa: Number(f.doseKgHa),
          applicationMode: f.applicationMode,
        })),
      machineName: machineName.trim() || null,
      operatorName: operatorName.trim() || null,
      averageSpeedKmH: averageSpeedKmH ? Number(averageSpeedKmH) : null,
      seedCost: seedCost ? Number(seedCost) : null,
      fertilizerCost: fertilizerCost ? Number(fertilizerCost) : null,
      treatmentCost: treatmentCost ? Number(treatmentCost) : null,
      operationCost: operationCost ? Number(operationCost) : null,
      notes: notes.trim() || null,
    };

    try {
      if (isEditing) {
        await api.patch(`/org/farms/${selectedFarmId}/planting-operations/${operation!.id}`, body);
      } else {
        await api.post(`/org/farms/${selectedFarmId}/planting-operations`, body);
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
      await api.delete(`/org/farms/${selectedFarmId}/planting-operations/${operation.id}`);
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
      className="planting-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar plantio' : 'Novo plantio'}
    >
      <div className="planting-modal">
        <div className="planting-modal__header">
          <h2 className="planting-modal__title">{isEditing ? 'Editar plantio' : 'Novo plantio'}</h2>
          <button
            type="button"
            className="planting-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="planting-modal__body">
          {/* CA1 — Dados básicos */}
          <h3 className="planting-modal__section-title">Dados básicos</h3>
          <div className="planting-modal__fields">
            <div className="planting-modal__row">
              <div className="planting-modal__field">
                <label htmlFor="pl-plot" className="planting-modal__label">
                  Talhão *
                </label>
                <select
                  id="pl-plot"
                  className="planting-modal__select"
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
              <div className="planting-modal__field">
                <label htmlFor="pl-cultivar" className="planting-modal__label">
                  Cultivar
                </label>
                <select
                  id="pl-cultivar"
                  className="planting-modal__select"
                  value={cultivarId}
                  onChange={(e) => handleCultivarChange(e.target.value)}
                >
                  <option value="">Selecione a cultivar</option>
                  {cultivars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.crop})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="planting-modal__row">
              <div className="planting-modal__field">
                <label htmlFor="pl-crop" className="planting-modal__label">
                  Cultura *
                </label>
                <input
                  id="pl-crop"
                  type="text"
                  className="planting-modal__input"
                  placeholder="Ex.: Soja, Milho, Café"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  aria-required="true"
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-date" className="planting-modal__label">
                  Data de plantio *
                </label>
                <input
                  id="pl-date"
                  type="date"
                  className="planting-modal__input"
                  value={plantingDate}
                  onChange={(e) => setPlantingDate(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            <div className="planting-modal__row--three">
              <div className="planting-modal__field">
                <label htmlFor="pl-season" className="planting-modal__label">
                  Safra *
                </label>
                <input
                  id="pl-season"
                  type="text"
                  className="planting-modal__input"
                  placeholder="Ex.: 2025/2026"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(e.target.value)}
                  aria-required="true"
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-season-type" className="planting-modal__label">
                  Tipo de safra
                </label>
                <select
                  id="pl-season-type"
                  className="planting-modal__select"
                  value={seasonType}
                  onChange={(e) => setSeasonType(e.target.value)}
                >
                  {SEASON_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-area-pct" className="planting-modal__label">
                  Área plantada (%)
                </label>
                <input
                  id="pl-area-pct"
                  type="number"
                  className="planting-modal__input"
                  min="1"
                  max="100"
                  step="1"
                  value={plantedAreaPercent}
                  onChange={(e) => setPlantedAreaPercent(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CA2 — Dados técnicos */}
          <h3 className="planting-modal__section-title">Dados técnicos</h3>
          <div className="planting-modal__fields">
            <div className="planting-modal__row--four">
              <div className="planting-modal__field">
                <label htmlFor="pl-pop" className="planting-modal__label">
                  Pop. (sem/m)
                </label>
                <input
                  id="pl-pop"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.1"
                  placeholder="14.5"
                  value={populationPerM}
                  onChange={(e) => setPopulationPerM(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-spacing" className="planting-modal__label">
                  Espaçam. (cm)
                </label>
                <input
                  id="pl-spacing"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="1"
                  placeholder="50"
                  value={rowSpacingCm}
                  onChange={(e) => setRowSpacingCm(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-depth" className="planting-modal__label">
                  Prof. (cm)
                </label>
                <input
                  id="pl-depth"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.5"
                  placeholder="4"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-rate" className="planting-modal__label">
                  Taxa (kg/ha)
                </label>
                <input
                  id="pl-rate"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.1"
                  placeholder="65"
                  value={seedRateKgHa}
                  onChange={(e) => setSeedRateKgHa(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CA3 — Tratamento de sementes */}
          <h3 className="planting-modal__section-title">Tratamento de sementes</h3>
          <div className="planting-modal__fields">
            {seedTreatments.map((st, idx) => (
              <div key={idx} className="planting-modal__input-row">
                <div className="planting-modal__field">
                  <label htmlFor={`pl-st-name-${idx}`} className="planting-modal__label">
                    Produto
                  </label>
                  <input
                    id={`pl-st-name-${idx}`}
                    type="text"
                    className="planting-modal__input"
                    placeholder="Ex.: Standak Top"
                    value={st.productName}
                    onChange={(e) => handleTreatmentChange(idx, 'productName', e.target.value)}
                  />
                </div>
                <div className="planting-modal__field">
                  <label htmlFor={`pl-st-dose-${idx}`} className="planting-modal__label">
                    Dose
                  </label>
                  <input
                    id={`pl-st-dose-${idx}`}
                    type="number"
                    className="planting-modal__input"
                    min="0"
                    step="0.01"
                    value={st.dose || ''}
                    onChange={(e) => handleTreatmentChange(idx, 'dose', Number(e.target.value))}
                  />
                </div>
                <div className="planting-modal__field">
                  <label htmlFor={`pl-st-unit-${idx}`} className="planting-modal__label">
                    Unidade
                  </label>
                  <select
                    id={`pl-st-unit-${idx}`}
                    className="planting-modal__select"
                    value={st.doseUnit}
                    onChange={(e) => handleTreatmentChange(idx, 'doseUnit', e.target.value)}
                  >
                    {DOSE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="planting-modal__field">
                  <label htmlFor={`pl-st-tech-${idx}`} className="planting-modal__label">
                    Resp. técnico
                  </label>
                  <input
                    id={`pl-st-tech-${idx}`}
                    type="text"
                    className="planting-modal__input"
                    placeholder="Nome"
                    value={st.responsibleTechnician ?? ''}
                    onChange={(e) =>
                      handleTreatmentChange(idx, 'responsibleTechnician', e.target.value)
                    }
                  />
                </div>
                <button
                  type="button"
                  className="planting-modal__remove-btn"
                  onClick={() => handleRemoveTreatment(idx)}
                  aria-label={`Remover tratamento ${st.productName || idx + 1}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="planting-modal__add-input-btn"
              onClick={handleAddTreatment}
            >
              <Plus size={16} aria-hidden="true" />
              Adicionar tratamento
            </button>
          </div>

          {/* CA4 — Adubação de base */}
          <h3 className="planting-modal__section-title">Adubação de base</h3>
          <div className="planting-modal__fields">
            {baseFertilizations.map((bf, idx) => (
              <div key={idx} className="planting-modal__input-row--fert">
                <div className="planting-modal__field">
                  <label htmlFor={`pl-bf-form-${idx}`} className="planting-modal__label">
                    Formulação
                  </label>
                  <input
                    id={`pl-bf-form-${idx}`}
                    type="text"
                    className="planting-modal__input"
                    placeholder="Ex.: 04-20-20"
                    value={bf.formulation}
                    onChange={(e) => handleFertilizationChange(idx, 'formulation', e.target.value)}
                  />
                </div>
                <div className="planting-modal__field">
                  <label htmlFor={`pl-bf-dose-${idx}`} className="planting-modal__label">
                    Dose (kg/ha)
                  </label>
                  <input
                    id={`pl-bf-dose-${idx}`}
                    type="number"
                    className="planting-modal__input"
                    min="0"
                    step="1"
                    value={bf.doseKgHa || ''}
                    onChange={(e) =>
                      handleFertilizationChange(idx, 'doseKgHa', Number(e.target.value))
                    }
                  />
                </div>
                <div className="planting-modal__field">
                  <label htmlFor={`pl-bf-mode-${idx}`} className="planting-modal__label">
                    Modo
                  </label>
                  <select
                    id={`pl-bf-mode-${idx}`}
                    className="planting-modal__select"
                    value={bf.applicationMode}
                    onChange={(e) =>
                      handleFertilizationChange(idx, 'applicationMode', e.target.value)
                    }
                  >
                    {FERTILIZER_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="planting-modal__remove-btn"
                  onClick={() => handleRemoveFertilization(idx)}
                  aria-label={`Remover adubação ${bf.formulation || idx + 1}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="planting-modal__add-input-btn"
              onClick={handleAddFertilization}
            >
              <Plus size={16} aria-hidden="true" />
              Adicionar adubação
            </button>
          </div>

          {/* CA5 — Máquina e operador */}
          <h3 className="planting-modal__section-title">Máquina e operador</h3>
          <div className="planting-modal__fields">
            <div className="planting-modal__row--three">
              <div className="planting-modal__field">
                <label htmlFor="pl-machine" className="planting-modal__label">
                  Plantadeira
                </label>
                <input
                  id="pl-machine"
                  type="text"
                  className="planting-modal__input"
                  placeholder="Ex.: John Deere 2130"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-operator" className="planting-modal__label">
                  Operador
                </label>
                <input
                  id="pl-operator"
                  type="text"
                  className="planting-modal__input"
                  placeholder="Nome do operador"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-speed" className="planting-modal__label">
                  Velocidade (km/h)
                </label>
                <input
                  id="pl-speed"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.1"
                  placeholder="6.5"
                  value={averageSpeedKmH}
                  onChange={(e) => setAverageSpeedKmH(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CA8 — Custos */}
          <h3 className="planting-modal__section-title">Custos (R$)</h3>
          <div className="planting-modal__fields">
            <div className="planting-modal__row--four">
              <div className="planting-modal__field">
                <label htmlFor="pl-seed-cost" className="planting-modal__label">
                  Semente
                </label>
                <input
                  id="pl-seed-cost"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.01"
                  value={seedCost}
                  onChange={(e) => setSeedCost(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-fert-cost" className="planting-modal__label">
                  Adubo
                </label>
                <input
                  id="pl-fert-cost"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.01"
                  value={fertilizerCost}
                  onChange={(e) => setFertilizerCost(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-treat-cost" className="planting-modal__label">
                  Tratamento
                </label>
                <input
                  id="pl-treat-cost"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.01"
                  value={treatmentCost}
                  onChange={(e) => setTreatmentCost(e.target.value)}
                />
              </div>
              <div className="planting-modal__field">
                <label htmlFor="pl-op-cost" className="planting-modal__label">
                  Operação
                </label>
                <input
                  id="pl-op-cost"
                  type="number"
                  className="planting-modal__input"
                  min="0"
                  step="0.01"
                  value={operationCost}
                  onChange={(e) => setOperationCost(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <h3 className="planting-modal__section-title">Observações</h3>
          <div className="planting-modal__fields">
            <div className="planting-modal__field">
              <label htmlFor="pl-notes" className="planting-modal__label">
                Notas
              </label>
              <textarea
                id="pl-notes"
                className="planting-modal__textarea"
                rows={3}
                placeholder="Observações sobre o plantio..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <div className="planting-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        <div className="planting-modal__footer">
          {isEditing && (
            <button
              type="button"
              className="planting-modal__btn planting-modal__btn--danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <div className="planting-modal__footer-spacer" />
          <button
            type="button"
            className="planting-modal__btn planting-modal__btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="planting-modal__btn planting-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar plantio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlantingModal;
