import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Info } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import {
  FERTILIZER_APPLICATION_TYPES,
  FERTILIZER_DOSE_UNITS,
} from '@/types/fertilizer-application';
import type {
  FertilizerApplicationItem,
  CreateFertilizerApplicationInput,
} from '@/types/fertilizer-application';
import type { FieldPlot } from '@/types/farm';
import './FertilizerApplicationModal.css';

interface FertilizerApplicationModalProps {
  isOpen: boolean;
  application: FertilizerApplicationItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function FertilizerApplicationModal({
  isOpen,
  application,
  onClose,
  onSuccess,
}: FertilizerApplicationModalProps) {
  const isEditing = !!application;
  const { selectedFarmId } = useFarmContext();

  const [fieldPlotId, setFieldPlotId] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [applicationType, setApplicationType] = useState('');
  const [productName, setProductName] = useState('');
  const [formulation, setFormulation] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('KG_HA');
  const [nutrientSource, setNutrientSource] = useState('');
  const [phenologicalStage, setPhenologicalStage] = useState('');
  const [nitrogenN, setNitrogenN] = useState('');
  const [phosphorusP, setPhosphorusP] = useState('');
  const [potassiumK, setPotassiumK] = useState('');
  const [machineName, setMachineName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [areaAppliedHa, setAreaAppliedHa] = useState('');
  const [plantsPerHa, setPlantsPerHa] = useState('');
  const [dosePerPlantG, setDosePerPlantG] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  // Computed: g/planta → kg/ha conversion
  const computedDoseKgHa = useMemo(() => {
    const plants = Number(plantsPerHa);
    const doseG = Number(dosePerPlantG);
    if (
      !plantsPerHa ||
      !dosePerPlantG ||
      isNaN(plants) ||
      isNaN(doseG) ||
      plants <= 0 ||
      doseG <= 0
    )
      return null;
    return ((doseG * plants) / 1000).toFixed(2);
  }, [plantsPerHa, dosePerPlantG]);

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
      setApplicationType('');
      setProductName('');
      setFormulation('');
      setDose('');
      setDoseUnit('KG_HA');
      setNutrientSource('');
      setPhenologicalStage('');
      setNitrogenN('');
      setPhosphorusP('');
      setPotassiumK('');
      setMachineName('');
      setOperatorName('');
      setAreaAppliedHa('');
      setPlantsPerHa('');
      setDosePerPlantG('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (application) {
      setFieldPlotId(application.fieldPlotId);
      const dt = new Date(application.appliedAt);
      setAppliedAt(dt.toISOString().slice(0, 16));
      setApplicationType(application.applicationType);
      setProductName(application.productName);
      setFormulation(application.formulation ?? '');
      setDose(String(application.dose));
      setDoseUnit(application.doseUnit);
      setNutrientSource(application.nutrientSource ?? '');
      setPhenologicalStage(application.phenologicalStage ?? '');
      setNitrogenN(application.nitrogenN != null ? String(application.nitrogenN) : '');
      setPhosphorusP(application.phosphorusP != null ? String(application.phosphorusP) : '');
      setPotassiumK(application.potassiumK != null ? String(application.potassiumK) : '');
      setMachineName(application.machineName ?? '');
      setOperatorName(application.operatorName ?? '');
      setAreaAppliedHa(application.areaAppliedHa != null ? String(application.areaAppliedHa) : '');
      setPlantsPerHa(application.plantsPerHa != null ? String(application.plantsPerHa) : '');
      setDosePerPlantG(application.dosePerPlantG != null ? String(application.dosePerPlantG) : '');
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
    applicationType.trim() !== '' &&
    productName.trim() !== '' &&
    dose.trim() !== '' &&
    Number(dose) > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateFertilizerApplicationInput = {
        fieldPlotId,
        appliedAt: new Date(appliedAt).toISOString(),
        applicationType,
        productName: productName.trim(),
        formulation: formulation.trim() || undefined,
        dose: Number(dose),
        doseUnit,
        nutrientSource: nutrientSource.trim() || undefined,
        phenologicalStage: phenologicalStage.trim() || undefined,
        nitrogenN: nitrogenN ? Number(nitrogenN) : undefined,
        phosphorusP: phosphorusP ? Number(phosphorusP) : undefined,
        potassiumK: potassiumK ? Number(potassiumK) : undefined,
        machineName: machineName.trim() || undefined,
        operatorName: operatorName.trim() || undefined,
        areaAppliedHa: areaAppliedHa ? Number(areaAppliedHa) : undefined,
        plantsPerHa: plantsPerHa ? Number(plantsPerHa) : undefined,
        dosePerPlantG: dosePerPlantG ? Number(dosePerPlantG) : undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(
          `/org/farms/${selectedFarmId}/fertilizer-applications/${application!.id}`,
          payload,
        );
      } else {
        await api.post(`/org/farms/${selectedFarmId}/fertilizer-applications`, payload);
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
    applicationType,
    productName,
    formulation,
    dose,
    doseUnit,
    nutrientSource,
    phenologicalStage,
    nitrogenN,
    phosphorusP,
    potassiumK,
    machineName,
    operatorName,
    areaAppliedHa,
    plantsPerHa,
    dosePerPlantG,
    notes,
    isEditing,
    application,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fertilizer-overlay" onClick={onClose}>
      <div
        className="fertilizer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar aplicação de adubo' : 'Nova aplicação de adubo'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="fertilizer-modal__header">
          <h2 className="fertilizer-modal__title">
            {isEditing ? 'Editar aplicação' : 'Nova aplicação de adubo'}
          </h2>
          <button
            type="button"
            className="fertilizer-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="fertilizer-modal__body">
          <div className="fertilizer-modal__fields">
            {/* Local e data */}
            <h3 className="fertilizer-modal__section-title">Local e data</h3>

            <div className="fertilizer-modal__row">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-plot" className="fertilizer-modal__label">
                  Talhão *
                </label>
                <select
                  id="fert-plot"
                  className="fertilizer-modal__select"
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
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-date" className="fertilizer-modal__label">
                  Data/hora da aplicação *
                </label>
                <input
                  id="fert-date"
                  type="datetime-local"
                  className="fertilizer-modal__input"
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            {/* Produto e dosagem */}
            <h3 className="fertilizer-modal__section-title">Produto e dosagem</h3>

            <div className="fertilizer-modal__row">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-type" className="fertilizer-modal__label">
                  Tipo de aplicação *
                </label>
                <select
                  id="fert-type"
                  className="fertilizer-modal__select"
                  value={applicationType}
                  onChange={(e) => setApplicationType(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {FERTILIZER_APPLICATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-product" className="fertilizer-modal__label">
                  Produto *
                </label>
                <input
                  id="fert-product"
                  type="text"
                  className="fertilizer-modal__input"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Ureia, MAP, KCl, NPK 04-14-08"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="fertilizer-modal__row--three">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-dose" className="fertilizer-modal__label">
                  Dose *
                </label>
                <input
                  id="fert-dose"
                  type="number"
                  className="fertilizer-modal__input"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="Ex: 200"
                  min="0.001"
                  step="0.001"
                  aria-required="true"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-dose-unit" className="fertilizer-modal__label">
                  Unidade de dose
                </label>
                <select
                  id="fert-dose-unit"
                  className="fertilizer-modal__select"
                  value={doseUnit}
                  onChange={(e) => setDoseUnit(e.target.value)}
                >
                  {FERTILIZER_DOSE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-formulation" className="fertilizer-modal__label">
                  Formulação
                </label>
                <input
                  id="fert-formulation"
                  type="text"
                  className="fertilizer-modal__input"
                  value={formulation}
                  onChange={(e) => setFormulation(e.target.value)}
                  placeholder="Ex: 45-00-00, 04-14-08"
                />
              </div>
            </div>

            <div className="fertilizer-modal__row">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-nutrient-source" className="fertilizer-modal__label">
                  Fonte do nutriente
                </label>
                <input
                  id="fert-nutrient-source"
                  type="text"
                  className="fertilizer-modal__input"
                  value={nutrientSource}
                  onChange={(e) => setNutrientSource(e.target.value)}
                  placeholder="Ex: Ureia, MAP, KCl, Sulfato de amônio"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-stage" className="fertilizer-modal__label">
                  Estádio fenológico
                </label>
                <input
                  id="fert-stage"
                  type="text"
                  className="fertilizer-modal__input"
                  value={phenologicalStage}
                  onChange={(e) => setPhenologicalStage(e.target.value)}
                  placeholder="Ex: V4, V6, R1"
                />
              </div>
            </div>

            {/* Nutrientes */}
            <h3 className="fertilizer-modal__section-title">Nutrientes fornecidos (kg/ha)</h3>

            <div className="fertilizer-modal__row--three">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-n" className="fertilizer-modal__label">
                  N (kg/ha)
                </label>
                <input
                  id="fert-n"
                  type="number"
                  className="fertilizer-modal__input"
                  value={nitrogenN}
                  onChange={(e) => setNitrogenN(e.target.value)}
                  placeholder="Ex: 90"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-p" className="fertilizer-modal__label">
                  P2O5 (kg/ha)
                </label>
                <input
                  id="fert-p"
                  type="number"
                  className="fertilizer-modal__input"
                  value={phosphorusP}
                  onChange={(e) => setPhosphorusP(e.target.value)}
                  placeholder="Ex: 40"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-k" className="fertilizer-modal__label">
                  K2O (kg/ha)
                </label>
                <input
                  id="fert-k"
                  type="number"
                  className="fertilizer-modal__input"
                  value={potassiumK}
                  onChange={(e) => setPotassiumK(e.target.value)}
                  placeholder="Ex: 60"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Conversão g/planta */}
            <h3 className="fertilizer-modal__section-title">
              Dose por planta (café, laranja, etc.)
            </h3>

            <div className="fertilizer-modal__row--three">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-plants" className="fertilizer-modal__label">
                  Plantas/ha
                </label>
                <input
                  id="fert-plants"
                  type="number"
                  className="fertilizer-modal__input"
                  value={plantsPerHa}
                  onChange={(e) => setPlantsPerHa(e.target.value)}
                  placeholder="Ex: 3333"
                  min="1"
                  step="1"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-dose-plant" className="fertilizer-modal__label">
                  Dose/planta (g)
                </label>
                <input
                  id="fert-dose-plant"
                  type="number"
                  className="fertilizer-modal__input"
                  value={dosePerPlantG}
                  onChange={(e) => setDosePerPlantG(e.target.value)}
                  placeholder="Ex: 50"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label className="fertilizer-modal__label">Equivalente kg/ha</label>
                <div className="fertilizer-modal__computed-value">
                  {computedDoseKgHa
                    ? `${computedDoseKgHa} kg/ha`
                    : 'Preencha plantas/ha e dose/planta'}
                </div>
              </div>
            </div>

            {computedDoseKgHa && (
              <div className="fertilizer-modal__nutrient-hint">
                <Info size={16} aria-hidden="true" />
                <span>
                  Conversão: {dosePerPlantG} g/planta × {plantsPerHa} plantas/ha ÷ 1000 ={' '}
                  <strong>{computedDoseKgHa} kg/ha</strong>
                </span>
              </div>
            )}

            {/* Equipamento */}
            <h3 className="fertilizer-modal__section-title">Equipamento e operação</h3>

            <div className="fertilizer-modal__row--three">
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-machine" className="fertilizer-modal__label">
                  Máquina/Equipamento
                </label>
                <input
                  id="fert-machine"
                  type="text"
                  className="fertilizer-modal__input"
                  value={machineName}
                  onChange={(e) => setMachineName(e.target.value)}
                  placeholder="Ex: Distribuidor centrífugo"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-operator" className="fertilizer-modal__label">
                  Operador
                </label>
                <input
                  id="fert-operator"
                  type="text"
                  className="fertilizer-modal__input"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="fertilizer-modal__field">
                <label htmlFor="fert-area" className="fertilizer-modal__label">
                  Área aplicada (ha)
                </label>
                <input
                  id="fert-area"
                  type="number"
                  className="fertilizer-modal__input"
                  value={areaAppliedHa}
                  onChange={(e) => setAreaAppliedHa(e.target.value)}
                  placeholder="Ex: 15.5"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>

            {/* Observações */}
            <h3 className="fertilizer-modal__section-title">Observações</h3>

            <div className="fertilizer-modal__field">
              <label htmlFor="fert-notes" className="fertilizer-modal__label">
                Observações
              </label>
              <textarea
                id="fert-notes"
                className="fertilizer-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições do solo, umidade, observações gerais..."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="fertilizer-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fertilizer-modal__footer">
          <div className="fertilizer-modal__footer-spacer" />
          <button
            type="button"
            className="fertilizer-modal__btn fertilizer-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="fertilizer-modal__btn fertilizer-modal__btn--primary"
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

export default FertilizerApplicationModal;
