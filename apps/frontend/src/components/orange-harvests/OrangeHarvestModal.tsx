import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { ORANGE_DESTINATIONS, BOX_WEIGHT_KG } from '@/types/orange-harvest';
import type { OrangeHarvestItem, CreateOrangeHarvestInput } from '@/types/orange-harvest';
import type { FieldPlot } from '@/types/farm';
import './OrangeHarvestModal.css';

interface OrangeHarvestModalProps {
  isOpen: boolean;
  harvest: OrangeHarvestItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function OrangeHarvestModal({ isOpen, harvest, onClose, onSuccess }: OrangeHarvestModalProps) {
  const isEditing = !!harvest;
  const { selectedFarmId } = useFarmContext();

  // Form state — CA1
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [variety, setVariety] = useState('');
  const [numberOfBoxes, setNumberOfBoxes] = useState('');
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [treesHarvested, setTreesHarvested] = useState('');
  // CA3 — qualidade
  const [ratioSS, setRatioSS] = useState('');
  const [acidityPct, setAcidityPct] = useState('');
  const [refusalPct, setRefusalPct] = useState('');
  // CA4 — destino
  const [destination, setDestination] = useState('');
  const [destinationName, setDestinationName] = useState('');
  // CA5 — equipe
  const [numberOfHarvesters, setNumberOfHarvesters] = useState('');
  const [harvestersProductivity, setHarvestersProductivity] = useState('');
  // CA6 — contrato
  const [saleContractRef, setSaleContractRef] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  // CA2 — Computed values
  const computedWeightKg = useMemo(() => {
    const boxes = Number(numberOfBoxes);
    if (!boxes || boxes <= 0) return null;
    return Math.round(boxes * BOX_WEIGHT_KG * 100) / 100;
  }, [numberOfBoxes]);

  const computedBoxesPerTree = useMemo(() => {
    const boxes = Number(numberOfBoxes);
    const trees = Number(treesHarvested);
    if (!boxes || boxes <= 0 || !trees || trees <= 0) return null;
    return Math.round((boxes / trees) * 100) / 100;
  }, [numberOfBoxes, treesHarvested]);

  const selectedPlotAreaHa = useMemo(() => {
    const plot = plots.find((p) => p.id === fieldPlotId);
    return plot?.boundaryAreaHa ?? null;
  }, [plots, fieldPlotId]);

  const computedBoxesPerHa = useMemo(() => {
    const boxes = Number(numberOfBoxes);
    if (!boxes || boxes <= 0 || !selectedPlotAreaHa || selectedPlotAreaHa <= 0) return null;
    return Math.round((boxes / selectedPlotAreaHa) * 100) / 100;
  }, [numberOfBoxes, selectedPlotAreaHa]);

  const computedTonsPerHa = useMemo(() => {
    const weight = Number(totalWeightKg) || computedWeightKg;
    if (!weight || weight <= 0 || !selectedPlotAreaHa || selectedPlotAreaHa <= 0) return null;
    return Math.round((weight / 1000 / selectedPlotAreaHa) * 100) / 100;
  }, [totalWeightKg, computedWeightKg, selectedPlotAreaHa]);

  const computedProductivity = useMemo(() => {
    const boxes = Number(numberOfBoxes);
    const harvesters = Number(numberOfHarvesters);
    if (!boxes || boxes <= 0 || !harvesters || harvesters <= 0) return null;
    return Math.round((boxes / harvesters) * 100) / 100;
  }, [numberOfBoxes, numberOfHarvesters]);

  // Load plots
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
      setHarvestDate('');
      setVariety('');
      setNumberOfBoxes('');
      setTotalWeightKg('');
      setTreesHarvested('');
      setRatioSS('');
      setAcidityPct('');
      setRefusalPct('');
      setDestination('');
      setDestinationName('');
      setNumberOfHarvesters('');
      setHarvestersProductivity('');
      setSaleContractRef('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
      setIsDeleting(false);
    } else if (harvest) {
      setFieldPlotId(harvest.fieldPlotId);
      setHarvestDate(harvest.harvestDate);
      setVariety(harvest.variety ?? '');
      setNumberOfBoxes(String(harvest.numberOfBoxes));
      setTotalWeightKg(harvest.totalWeightKg != null ? String(harvest.totalWeightKg) : '');
      setTreesHarvested(harvest.treesHarvested != null ? String(harvest.treesHarvested) : '');
      setRatioSS(harvest.ratioSS != null ? String(harvest.ratioSS) : '');
      setAcidityPct(harvest.acidityPct != null ? String(harvest.acidityPct) : '');
      setRefusalPct(harvest.refusalPct != null ? String(harvest.refusalPct) : '');
      setDestination(harvest.destination ?? '');
      setDestinationName(harvest.destinationName ?? '');
      setNumberOfHarvesters(
        harvest.numberOfHarvesters != null ? String(harvest.numberOfHarvesters) : '',
      );
      setHarvestersProductivity(
        harvest.harvestersProductivity != null ? String(harvest.harvestersProductivity) : '',
      );
      setSaleContractRef(harvest.saleContractRef ?? '');
      setNotes(harvest.notes ?? '');
    }
  }, [isOpen, harvest]);

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
    harvestDate.trim() !== '' &&
    numberOfBoxes.trim() !== '' &&
    Number(numberOfBoxes) > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateOrangeHarvestInput = {
        fieldPlotId,
        harvestDate,
        variety: variety.trim() || undefined,
        numberOfBoxes: Number(numberOfBoxes),
        totalWeightKg: totalWeightKg ? Number(totalWeightKg) : undefined,
        treesHarvested: treesHarvested ? Number(treesHarvested) : undefined,
        ratioSS: ratioSS ? Number(ratioSS) : undefined,
        acidityPct: acidityPct ? Number(acidityPct) : undefined,
        refusalPct: refusalPct ? Number(refusalPct) : undefined,
        destination: destination || undefined,
        destinationName: destinationName.trim() || undefined,
        numberOfHarvesters: numberOfHarvesters ? Number(numberOfHarvesters) : undefined,
        harvestersProductivity: harvestersProductivity ? Number(harvestersProductivity) : undefined,
        saleContractRef: saleContractRef.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(`/org/farms/${selectedFarmId}/orange-harvests/${harvest!.id}`, payload);
      } else {
        await api.post(`/org/farms/${selectedFarmId}/orange-harvests`, payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar colheita de laranja';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedFarmId,
    fieldPlotId,
    harvestDate,
    variety,
    numberOfBoxes,
    totalWeightKg,
    treesHarvested,
    ratioSS,
    acidityPct,
    refusalPct,
    destination,
    destinationName,
    numberOfHarvesters,
    harvestersProductivity,
    saleContractRef,
    notes,
    isEditing,
    harvest,
    onSuccess,
  ]);

  const handleDelete = useCallback(async () => {
    if (!selectedFarmId || !harvest) return;
    if (!window.confirm('Tem certeza que deseja excluir esta colheita?')) return;

    setIsDeleting(true);
    setSubmitError(null);

    try {
      await api.delete(`/org/farms/${selectedFarmId}/orange-harvests/${harvest.id}`);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir colheita';
      setSubmitError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFarmId, harvest, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="orange-overlay" onClick={onClose}>
      <div
        className="orange-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar colheita de laranja' : 'Nova colheita de laranja'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="orange-modal__header">
          <h2 className="orange-modal__title">
            {isEditing ? 'Editar colheita de laranja' : 'Nova colheita de laranja'}
          </h2>
          <button
            type="button"
            className="orange-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="orange-modal__body">
          <div className="orange-modal__fields">
            {/* CA1: Local, data, variedade */}
            <h3 className="orange-modal__section-title">Local e variedade</h3>

            <div className="orange-modal__row">
              <div className="orange-modal__field">
                <label htmlFor="orange-plot" className="orange-modal__label">
                  Talhão *
                </label>
                <select
                  id="orange-plot"
                  className="orange-modal__select"
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
              <div className="orange-modal__field">
                <label htmlFor="orange-date" className="orange-modal__label">
                  Data da colheita *
                </label>
                <input
                  id="orange-date"
                  type="date"
                  className="orange-modal__input"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            <div className="orange-modal__field">
              <label htmlFor="orange-variety" className="orange-modal__label">
                Variedade
              </label>
              <input
                id="orange-variety"
                type="text"
                className="orange-modal__input"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="Ex: Pera, Valência, Natal, Hamlin"
              />
            </div>

            {/* CA1: Produção */}
            <h3 className="orange-modal__section-title">Produção</h3>

            <div className="orange-modal__row--three">
              <div className="orange-modal__field">
                <label htmlFor="orange-boxes" className="orange-modal__label">
                  Nº de caixas (40,8 kg) *
                </label>
                <input
                  id="orange-boxes"
                  type="number"
                  className="orange-modal__input"
                  value={numberOfBoxes}
                  onChange={(e) => setNumberOfBoxes(e.target.value)}
                  placeholder="Ex: 500"
                  min="0.01"
                  step="0.01"
                  aria-required="true"
                />
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-weight" className="orange-modal__label">
                  Peso total (kg)
                </label>
                <input
                  id="orange-weight"
                  type="number"
                  className="orange-modal__input"
                  value={totalWeightKg}
                  onChange={(e) => setTotalWeightKg(e.target.value)}
                  placeholder={computedWeightKg != null ? String(computedWeightKg) : '—'}
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-trees" className="orange-modal__label">
                  Nº de árvores colhidas
                </label>
                <input
                  id="orange-trees"
                  type="number"
                  className="orange-modal__input"
                  value={treesHarvested}
                  onChange={(e) => setTreesHarvested(e.target.value)}
                  placeholder="Ex: 200"
                  min="1"
                  step="1"
                />
              </div>
            </div>

            {/* CA2: Produtividade calculada */}
            <div className="orange-modal__computed-row">
              <div className="orange-modal__computed-item">
                <span className="orange-modal__computed-label">Caixas/pé</span>
                <span className="orange-modal__computed-value">
                  {computedBoxesPerTree != null ? computedBoxesPerTree : '—'}
                </span>
              </div>
              <div className="orange-modal__computed-item">
                <span className="orange-modal__computed-label">Caixas/ha</span>
                <span className="orange-modal__computed-value">
                  {computedBoxesPerHa != null ? computedBoxesPerHa : '—'}
                </span>
              </div>
              <div className="orange-modal__computed-item">
                <span className="orange-modal__computed-label">Toneladas/ha</span>
                <span className="orange-modal__computed-value">
                  {computedTonsPerHa != null ? computedTonsPerHa : '—'}
                </span>
              </div>
            </div>

            {/* CA3: Qualidade */}
            <h3 className="orange-modal__section-title">Qualidade</h3>

            <div className="orange-modal__row--three">
              <div className="orange-modal__field">
                <label htmlFor="orange-ratio" className="orange-modal__label">
                  Ratio (sólidos solúveis)
                </label>
                <input
                  id="orange-ratio"
                  type="number"
                  className="orange-modal__input"
                  value={ratioSS}
                  onChange={(e) => setRatioSS(e.target.value)}
                  placeholder="Ex: 14.5"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-acidity" className="orange-modal__label">
                  Acidez (%)
                </label>
                <input
                  id="orange-acidity"
                  type="number"
                  className="orange-modal__input"
                  value={acidityPct}
                  onChange={(e) => setAcidityPct(e.target.value)}
                  placeholder="Ex: 0.85"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-refusal" className="orange-modal__label">
                  Refugo (%)
                </label>
                <input
                  id="orange-refusal"
                  type="number"
                  className="orange-modal__input"
                  value={refusalPct}
                  onChange={(e) => setRefusalPct(e.target.value)}
                  placeholder="Ex: 3.2"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            {/* CA4: Destino */}
            <h3 className="orange-modal__section-title">Destino</h3>

            <div className="orange-modal__row">
              <div className="orange-modal__field">
                <label htmlFor="orange-dest" className="orange-modal__label">
                  Destino
                </label>
                <select
                  id="orange-dest"
                  className="orange-modal__select"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {ORANGE_DESTINATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-dest-name" className="orange-modal__label">
                  Nome do comprador/indústria
                </label>
                <input
                  id="orange-dest-name"
                  type="text"
                  className="orange-modal__input"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  placeholder="Ex: Citrosuco, CEAGESP"
                />
              </div>
            </div>

            {/* CA5: Equipe */}
            <h3 className="orange-modal__section-title">Equipe de colheita</h3>

            <div className="orange-modal__row--three">
              <div className="orange-modal__field">
                <label htmlFor="orange-harvesters" className="orange-modal__label">
                  Nº de colhedores
                </label>
                <input
                  id="orange-harvesters"
                  type="number"
                  className="orange-modal__input"
                  value={numberOfHarvesters}
                  onChange={(e) => setNumberOfHarvesters(e.target.value)}
                  placeholder="Ex: 10"
                  min="1"
                  step="1"
                />
              </div>
              <div className="orange-modal__field">
                <label htmlFor="orange-productivity" className="orange-modal__label">
                  Produtividade (cx/pessoa/dia)
                </label>
                <input
                  id="orange-productivity"
                  type="number"
                  className="orange-modal__input"
                  value={harvestersProductivity}
                  onChange={(e) => setHarvestersProductivity(e.target.value)}
                  placeholder={computedProductivity != null ? String(computedProductivity) : '—'}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="orange-modal__field">
                <label className="orange-modal__label">Produtividade calculada</label>
                <div className="orange-modal__computed-value">
                  {computedProductivity != null ? `${computedProductivity} cx/pessoa` : '—'}
                </div>
              </div>
            </div>

            {/* CA6: Contrato */}
            <h3 className="orange-modal__section-title">Contrato de venda</h3>

            <div className="orange-modal__field">
              <label htmlFor="orange-contract" className="orange-modal__label">
                Referência do contrato
              </label>
              <input
                id="orange-contract"
                type="text"
                className="orange-modal__input"
                value={saleContractRef}
                onChange={(e) => setSaleContractRef(e.target.value)}
                placeholder="Ex: CT-2026-045"
              />
            </div>

            {/* Notes */}
            <h3 className="orange-modal__section-title">Observações</h3>

            <div className="orange-modal__field">
              <label htmlFor="orange-notes" className="orange-modal__label">
                Observações
              </label>
              <textarea
                id="orange-notes"
                className="orange-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observações sobre a colheita..."
              />
            </div>

            {submitError && (
              <div className="orange-modal__error" role="alert" aria-live="polite">
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="orange-modal__footer">
          {isEditing && (
            <button
              type="button"
              className="orange-modal__btn orange-modal__btn--danger"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              aria-label="Excluir colheita"
            >
              <Trash2 size={16} aria-hidden="true" />
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <div className="orange-modal__footer-spacer" />
          <button
            type="button"
            className="orange-modal__btn orange-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="orange-modal__btn orange-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting || isDeleting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar colheita'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrangeHarvestModal;
