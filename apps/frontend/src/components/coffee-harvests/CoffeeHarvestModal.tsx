import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { useFarmContext } from '@/stores/FarmContext';
import { HARVEST_TYPES, COFFEE_DESTINATIONS } from '@/types/coffee-harvest';
import type { CoffeeHarvestItem, CreateCoffeeHarvestInput } from '@/types/coffee-harvest';
import type { FieldPlot } from '@/types/farm';
import './CoffeeHarvestModal.css';

interface CoffeeHarvestModalProps {
  isOpen: boolean;
  harvest: CoffeeHarvestItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_YIELD = 480;

function CoffeeHarvestModal({ isOpen, harvest, onClose, onSuccess }: CoffeeHarvestModalProps) {
  const isEditing = !!harvest;
  const { selectedFarmId } = useFarmContext();

  // Form state
  const [fieldPlotId, setFieldPlotId] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [harvestType, setHarvestType] = useState('');
  const [volumeLiters, setVolumeLiters] = useState('');
  const [sacsBenefited, setSacsBenefited] = useState('');
  const [yieldLitersPerSac, setYieldLitersPerSac] = useState('');
  const [cherryPct, setCherryPct] = useState('');
  const [greenPct, setGreenPct] = useState('');
  const [floaterPct, setFloaterPct] = useState('');
  const [dryPct, setDryPct] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [numberOfHarvesters, setNumberOfHarvesters] = useState('');
  const [harvestersProductivity, setHarvestersProductivity] = useState('');
  const [isSpecialLot, setIsSpecialLot] = useState(false);
  const [microlotCode, setMicrolotCode] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [plots, setPlots] = useState<FieldPlot[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(false);

  // Computed values
  const estimatedSacs = useMemo(() => {
    const vol = Number(volumeLiters);
    const yld = Number(yieldLitersPerSac) || DEFAULT_YIELD;
    if (!vol || vol <= 0) return null;
    return Math.round((vol / yld) * 100) / 100;
  }, [volumeLiters, yieldLitersPerSac]);

  const computedProductivity = useMemo(() => {
    const vol = Number(volumeLiters);
    const harvesters = Number(numberOfHarvesters);
    if (!vol || vol <= 0 || !harvesters || harvesters <= 0) return null;
    return Math.round((vol / harvesters) * 100) / 100;
  }, [volumeLiters, numberOfHarvesters]);

  const classificationTotal = useMemo(() => {
    const c = Number(cherryPct) || 0;
    const g = Number(greenPct) || 0;
    const f = Number(floaterPct) || 0;
    const d = Number(dryPct) || 0;
    return c + g + f + d;
  }, [cherryPct, greenPct, floaterPct, dryPct]);

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
      setHarvestType('');
      setVolumeLiters('');
      setSacsBenefited('');
      setYieldLitersPerSac('');
      setCherryPct('');
      setGreenPct('');
      setFloaterPct('');
      setDryPct('');
      setDestination('');
      setDestinationName('');
      setNumberOfHarvesters('');
      setHarvestersProductivity('');
      setIsSpecialLot(false);
      setMicrolotCode('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
      setIsDeleting(false);
    } else if (harvest) {
      setFieldPlotId(harvest.fieldPlotId);
      setHarvestDate(harvest.harvestDate);
      setHarvestType(harvest.harvestType);
      setVolumeLiters(String(harvest.volumeLiters));
      setSacsBenefited(harvest.sacsBenefited != null ? String(harvest.sacsBenefited) : '');
      setYieldLitersPerSac(String(harvest.yieldLitersPerSac));
      setCherryPct(String(harvest.cherryPct));
      setGreenPct(String(harvest.greenPct));
      setFloaterPct(String(harvest.floaterPct));
      setDryPct(String(harvest.dryPct));
      setDestination(harvest.destination ?? '');
      setDestinationName(harvest.destinationName ?? '');
      setNumberOfHarvesters(
        harvest.numberOfHarvesters != null ? String(harvest.numberOfHarvesters) : '',
      );
      setHarvestersProductivity(
        harvest.harvestersProductivity != null ? String(harvest.harvestersProductivity) : '',
      );
      setIsSpecialLot(harvest.isSpecialLot);
      setMicrolotCode(harvest.microlotCode ?? '');
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
    harvestType.trim() !== '' &&
    volumeLiters.trim() !== '' &&
    Number(volumeLiters) > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedFarmId) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateCoffeeHarvestInput = {
        fieldPlotId,
        harvestDate,
        harvestType,
        volumeLiters: Number(volumeLiters),
        sacsBenefited: sacsBenefited ? Number(sacsBenefited) : undefined,
        yieldLitersPerSac: yieldLitersPerSac ? Number(yieldLitersPerSac) : undefined,
        cherryPct: cherryPct ? Number(cherryPct) : undefined,
        greenPct: greenPct ? Number(greenPct) : undefined,
        floaterPct: floaterPct ? Number(floaterPct) : undefined,
        dryPct: dryPct ? Number(dryPct) : undefined,
        destination: destination || undefined,
        destinationName: destinationName.trim() || undefined,
        numberOfHarvesters: numberOfHarvesters ? Number(numberOfHarvesters) : undefined,
        harvestersProductivity: harvestersProductivity ? Number(harvestersProductivity) : undefined,
        isSpecialLot,
        microlotCode: microlotCode.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (isEditing) {
        await api.patch(`/org/farms/${selectedFarmId}/coffee-harvests/${harvest!.id}`, payload);
      } else {
        await api.post(`/org/farms/${selectedFarmId}/coffee-harvests`, payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar colheita de café';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedFarmId,
    fieldPlotId,
    harvestDate,
    harvestType,
    volumeLiters,
    sacsBenefited,
    yieldLitersPerSac,
    cherryPct,
    greenPct,
    floaterPct,
    dryPct,
    destination,
    destinationName,
    numberOfHarvesters,
    harvestersProductivity,
    isSpecialLot,
    microlotCode,
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
      await api.delete(`/org/farms/${selectedFarmId}/coffee-harvests/${harvest.id}`);
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
    <div className="coffee-overlay" onClick={onClose}>
      <div
        className="coffee-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar colheita de café' : 'Nova colheita de café'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="coffee-modal__header">
          <h2 className="coffee-modal__title">
            {isEditing ? 'Editar colheita de café' : 'Nova colheita de café'}
          </h2>
          <button
            type="button"
            className="coffee-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="coffee-modal__body">
          <div className="coffee-modal__fields">
            {/* CA1: Local, data, tipo */}
            <h3 className="coffee-modal__section-title">Local e tipo de colheita</h3>

            <div className="coffee-modal__row">
              <div className="coffee-modal__field">
                <label htmlFor="coffee-plot" className="coffee-modal__label">
                  Talhão/Quadra *
                </label>
                <select
                  id="coffee-plot"
                  className="coffee-modal__select"
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
              <div className="coffee-modal__field">
                <label htmlFor="coffee-date" className="coffee-modal__label">
                  Data da colheita *
                </label>
                <input
                  id="coffee-date"
                  type="date"
                  className="coffee-modal__input"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  aria-required="true"
                />
              </div>
            </div>

            <div className="coffee-modal__field">
              <label htmlFor="coffee-type" className="coffee-modal__label">
                Tipo de colheita *
              </label>
              <select
                id="coffee-type"
                className="coffee-modal__select"
                value={harvestType}
                onChange={(e) => setHarvestType(e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione</option>
                {HARVEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CA2: Volume */}
            <h3 className="coffee-modal__section-title">Volume e rendimento</h3>

            <div className="coffee-modal__row--three">
              <div className="coffee-modal__field">
                <label htmlFor="coffee-volume" className="coffee-modal__label">
                  Volume colhido (litros) *
                </label>
                <input
                  id="coffee-volume"
                  type="number"
                  className="coffee-modal__input"
                  value={volumeLiters}
                  onChange={(e) => setVolumeLiters(e.target.value)}
                  placeholder="Ex: 4800"
                  min="0.01"
                  step="0.01"
                  aria-required="true"
                />
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-yield" className="coffee-modal__label">
                  Rendimento (litros/saca)
                </label>
                <input
                  id="coffee-yield"
                  type="number"
                  className="coffee-modal__input"
                  value={yieldLitersPerSac}
                  onChange={(e) => setYieldLitersPerSac(e.target.value)}
                  placeholder={String(DEFAULT_YIELD)}
                  min="1"
                  step="1"
                />
              </div>
              <div className="coffee-modal__field">
                <label className="coffee-modal__label">Sacas estimadas</label>
                <div className="coffee-modal__computed-value">
                  {estimatedSacs != null ? `${estimatedSacs} sc` : '—'}
                </div>
              </div>
            </div>

            {/* CA3: Sacas beneficiadas (pós-beneficiamento) */}
            <div className="coffee-modal__field">
              <label htmlFor="coffee-sacs" className="coffee-modal__label">
                Sacas beneficiadas (real, pós-beneficiamento)
              </label>
              <input
                id="coffee-sacs"
                type="number"
                className="coffee-modal__input"
                value={sacsBenefited}
                onChange={(e) => setSacsBenefited(e.target.value)}
                placeholder="Preencher após beneficiamento"
                min="0"
                step="0.01"
              />
            </div>

            {/* CA4: Classificação */}
            <h3 className="coffee-modal__section-title">
              Classificação
              {classificationTotal > 0 && (
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: '0.8125rem',
                    marginLeft: 12,
                    color:
                      Math.abs(classificationTotal - 100) <= 0.5
                        ? 'var(--color-primary-600)'
                        : 'var(--color-error-500)',
                  }}
                >
                  Total: {classificationTotal}%
                </span>
              )}
            </h3>

            <div className="coffee-modal__row--four">
              <div className="coffee-modal__field">
                <label htmlFor="coffee-cherry" className="coffee-modal__label">
                  Cereja (%)
                </label>
                <input
                  id="coffee-cherry"
                  type="number"
                  className="coffee-modal__input"
                  value={cherryPct}
                  onChange={(e) => setCherryPct(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-green" className="coffee-modal__label">
                  Verde (%)
                </label>
                <input
                  id="coffee-green"
                  type="number"
                  className="coffee-modal__input"
                  value={greenPct}
                  onChange={(e) => setGreenPct(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-floater" className="coffee-modal__label">
                  Boia (%)
                </label>
                <input
                  id="coffee-floater"
                  type="number"
                  className="coffee-modal__input"
                  value={floaterPct}
                  onChange={(e) => setFloaterPct(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-dry" className="coffee-modal__label">
                  Seco (%)
                </label>
                <input
                  id="coffee-dry"
                  type="number"
                  className="coffee-modal__input"
                  value={dryPct}
                  onChange={(e) => setDryPct(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>

            {/* CA5: Destino */}
            <h3 className="coffee-modal__section-title">Destino</h3>

            <div className="coffee-modal__row">
              <div className="coffee-modal__field">
                <label htmlFor="coffee-dest" className="coffee-modal__label">
                  Destino
                </label>
                <select
                  id="coffee-dest"
                  className="coffee-modal__select"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {COFFEE_DESTINATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-dest-name" className="coffee-modal__label">
                  Nome do destino
                </label>
                <input
                  id="coffee-dest-name"
                  type="text"
                  className="coffee-modal__input"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value)}
                  placeholder="Ex: Terreiro principal"
                />
              </div>
            </div>

            {/* CA6: Equipe */}
            <h3 className="coffee-modal__section-title">Equipe de colheita</h3>

            <div className="coffee-modal__row--three">
              <div className="coffee-modal__field">
                <label htmlFor="coffee-harvesters" className="coffee-modal__label">
                  Nº de colhedores
                </label>
                <input
                  id="coffee-harvesters"
                  type="number"
                  className="coffee-modal__input"
                  value={numberOfHarvesters}
                  onChange={(e) => setNumberOfHarvesters(e.target.value)}
                  placeholder="Ex: 12"
                  min="1"
                  step="1"
                />
              </div>
              <div className="coffee-modal__field">
                <label htmlFor="coffee-productivity" className="coffee-modal__label">
                  Produtividade (L/pessoa/dia)
                </label>
                <input
                  id="coffee-productivity"
                  type="number"
                  className="coffee-modal__input"
                  value={harvestersProductivity}
                  onChange={(e) => setHarvestersProductivity(e.target.value)}
                  placeholder={computedProductivity != null ? String(computedProductivity) : '—'}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="coffee-modal__field">
                <label className="coffee-modal__label">Produtividade calculada</label>
                <div className="coffee-modal__computed-value">
                  {computedProductivity != null ? `${computedProductivity} L/pessoa` : '—'}
                </div>
              </div>
            </div>

            {/* CA7: Café especial */}
            <h3 className="coffee-modal__section-title">Café especial</h3>

            <div className="coffee-modal__checkbox-row">
              <input
                id="coffee-special"
                type="checkbox"
                className="coffee-modal__checkbox"
                checked={isSpecialLot}
                onChange={(e) => setIsSpecialLot(e.target.checked)}
              />
              <label htmlFor="coffee-special" className="coffee-modal__checkbox-label">
                Lote de café especial (rastreabilidade de microlote)
              </label>
            </div>

            {isSpecialLot && (
              <div className="coffee-modal__field">
                <label htmlFor="coffee-microlot" className="coffee-modal__label">
                  Código do microlote
                </label>
                <input
                  id="coffee-microlot"
                  type="text"
                  className="coffee-modal__input"
                  value={microlotCode}
                  onChange={(e) => setMicrolotCode(e.target.value)}
                  placeholder="Ex: ML-2026-001"
                />
              </div>
            )}

            {/* Notes */}
            <h3 className="coffee-modal__section-title">Observações</h3>

            <div className="coffee-modal__field">
              <label htmlFor="coffee-notes" className="coffee-modal__label">
                Observações
              </label>
              <textarea
                id="coffee-notes"
                className="coffee-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observações sobre a colheita..."
              />
            </div>

            {submitError && (
              <div className="coffee-modal__error" role="alert" aria-live="polite">
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="coffee-modal__footer">
          {isEditing && (
            <button
              type="button"
              className="coffee-modal__btn coffee-modal__btn--danger"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              aria-label="Excluir colheita"
            >
              <Trash2 size={16} aria-hidden="true" />
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          )}
          <div className="coffee-modal__footer-spacer" />
          <button
            type="button"
            className="coffee-modal__btn coffee-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="coffee-modal__btn coffee-modal__btn--primary"
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

export default CoffeeHarvestModal;
