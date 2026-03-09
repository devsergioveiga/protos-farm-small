import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { MonitoringRecordItem, CreateMonitoringRecordInput } from '@/types/monitoring-record';
import type { MonitoringPointItem, MonitoringPointsResponse } from '@/types/monitoring-point';
import type { PestItem, PestsResponse } from '@/types/pest';
import { INFESTATION_LEVELS, GROWTH_STAGES } from '@/types/monitoring-record';
import './MonitoringRecordModal.css';

interface MonitoringRecordModalProps {
  isOpen: boolean;
  farmId: string;
  fieldPlotId: string;
  record: MonitoringRecordItem | null;
  preselectedPointId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function MonitoringRecordModal({
  isOpen,
  farmId,
  fieldPlotId,
  record,
  preselectedPointId,
  onClose,
  onSuccess,
}: MonitoringRecordModalProps) {
  const isEditing = !!record;

  const [monitoringPointId, setMonitoringPointId] = useState('');
  const [pestId, setPestId] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [infestationLevel, setInfestationLevel] = useState('');
  const [sampleCount, setSampleCount] = useState('');
  const [pestCount, setPestCount] = useState('');
  const [growthStage, setGrowthStage] = useState('');
  const [hasNaturalEnemies, setHasNaturalEnemies] = useState(false);
  const [naturalEnemiesDesc, setNaturalEnemiesDesc] = useState('');
  const [damagePercentage, setDamagePercentage] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [points, setPoints] = useState<MonitoringPointItem[]>([]);
  const [pests, setPests] = useState<PestItem[]>([]);
  const [pestSearch, setPestSearch] = useState('');

  // Load monitoring points and pests when modal opens
  useEffect(() => {
    if (!isOpen || !farmId || !fieldPlotId) return;

    async function loadData() {
      try {
        const [pointsRes, pestsRes] = await Promise.all([
          api.get<MonitoringPointsResponse>(
            `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-points?limit=100`,
          ),
          api.get<PestsResponse>('/org/pests?limit=100'),
        ]);
        setPoints(pointsRes.data);
        setPests(pestsRes.data);
      } catch {
        // ignore — dropdowns will be empty
      }
    }

    void loadData();
  }, [isOpen, farmId, fieldPlotId]);

  // Reset form state
  useEffect(() => {
    if (!isOpen) {
      setMonitoringPointId('');
      setPestId('');
      setObservedAt('');
      setInfestationLevel('');
      setSampleCount('');
      setPestCount('');
      setGrowthStage('');
      setHasNaturalEnemies(false);
      setNaturalEnemiesDesc('');
      setDamagePercentage('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
      setPestSearch('');
    } else if (record) {
      setMonitoringPointId(record.monitoringPointId);
      setPestId(record.pestId);
      setObservedAt(record.observedAt.slice(0, 16)); // datetime-local format
      setInfestationLevel(record.infestationLevel);
      setSampleCount(record.sampleCount != null ? String(record.sampleCount) : '');
      setPestCount(record.pestCount != null ? String(record.pestCount) : '');
      setGrowthStage(record.growthStage ?? '');
      setHasNaturalEnemies(record.hasNaturalEnemies);
      setNaturalEnemiesDesc(record.naturalEnemiesDesc ?? '');
      setDamagePercentage(record.damagePercentage != null ? String(record.damagePercentage) : '');
      setNotes(record.notes ?? '');
    } else {
      // New record — set defaults
      setMonitoringPointId(preselectedPointId ?? '');
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setObservedAt(now.toISOString().slice(0, 16));
    }
  }, [isOpen, record, preselectedPointId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        const payload: CreateMonitoringRecordInput = {
          monitoringPointId,
          pestId,
          observedAt: new Date(observedAt).toISOString(),
          infestationLevel,
          sampleCount: sampleCount ? parseInt(sampleCount, 10) : null,
          pestCount: pestCount ? parseInt(pestCount, 10) : null,
          growthStage: growthStage || null,
          hasNaturalEnemies,
          naturalEnemiesDesc: naturalEnemiesDesc.trim() || null,
          damagePercentage: damagePercentage ? parseFloat(damagePercentage) : null,
          notes: notes.trim() || null,
        };

        if (isEditing && record) {
          await api.patch(`/org/farms/${farmId}/monitoring-records/${record.id}`, {
            ...payload,
            monitoringPointId: undefined, // can't change point
          });
        } else {
          await api.post(
            `/org/farms/${farmId}/field-plots/${fieldPlotId}/monitoring-records`,
            payload,
          );
        }
        onSuccess();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao salvar registro de monitoramento';
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      isEditing,
      record,
      farmId,
      fieldPlotId,
      monitoringPointId,
      pestId,
      observedAt,
      infestationLevel,
      sampleCount,
      pestCount,
      growthStage,
      hasNaturalEnemies,
      naturalEnemiesDesc,
      damagePercentage,
      notes,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  const isValid =
    monitoringPointId !== '' && pestId !== '' && observedAt !== '' && infestationLevel !== '';

  const filteredPests = pestSearch
    ? pests.filter(
        (p) =>
          p.commonName.toLowerCase().includes(pestSearch.toLowerCase()) ||
          (p.scientificName && p.scientificName.toLowerCase().includes(pestSearch.toLowerCase())),
      )
    : pests;

  return (
    <div
      className="mr-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Editar registro de monitoramento' : 'Novo registro de monitoramento'}
    >
      <div className="mr-modal__container">
        <div className="mr-modal__header">
          <h2 className="mr-modal__title">
            {isEditing ? 'Editar registro de monitoramento' : 'Novo registro de monitoramento'}
          </h2>
          <button
            type="button"
            className="mr-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mr-modal__body">
          {submitError && (
            <div className="mr-modal__error" role="alert">
              {submitError}
            </div>
          )}

          {/* Ponto de monitoramento */}
          <div className="mr-modal__field">
            <label htmlFor="mr-point" className="mr-modal__label">
              Ponto de monitoramento <span aria-hidden="true">*</span>
            </label>
            <select
              id="mr-point"
              className="mr-modal__select"
              value={monitoringPointId}
              onChange={(e) => setMonitoringPointId(e.target.value)}
              aria-required="true"
              disabled={isEditing}
            >
              <option value="">Selecione um ponto</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} ({p.latitude.toFixed(4)}, {p.longitude.toFixed(4)})
                </option>
              ))}
            </select>
          </div>

          {/* Praga */}
          <div className="mr-modal__field">
            <label htmlFor="mr-pest" className="mr-modal__label">
              Praga / Doença <span aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              className="mr-modal__input mr-modal__input--search"
              placeholder="Buscar praga pelo nome..."
              value={pestSearch}
              onChange={(e) => setPestSearch(e.target.value)}
              aria-label="Buscar praga"
            />
            <select
              id="mr-pest"
              className="mr-modal__select"
              value={pestId}
              onChange={(e) => setPestId(e.target.value)}
              aria-required="true"
            >
              <option value="">Selecione uma praga</option>
              {filteredPests.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.commonName}
                  {p.scientificName ? ` (${p.scientificName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Data / Nível de infestação */}
          <div className="mr-modal__row">
            <div className="mr-modal__field">
              <label htmlFor="mr-date" className="mr-modal__label">
                Data da observação <span aria-hidden="true">*</span>
              </label>
              <input
                id="mr-date"
                type="datetime-local"
                className="mr-modal__input"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                aria-required="true"
              />
            </div>
            <div className="mr-modal__field">
              <label htmlFor="mr-level" className="mr-modal__label">
                Nível de infestação <span aria-hidden="true">*</span>
              </label>
              <select
                id="mr-level"
                className="mr-modal__select"
                value={infestationLevel}
                onChange={(e) => setInfestationLevel(e.target.value)}
                aria-required="true"
              >
                <option value="">Selecione</option>
                {INFESTATION_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contagens */}
          <div className="mr-modal__row">
            <div className="mr-modal__field">
              <label htmlFor="mr-samples" className="mr-modal__label">
                Amostras coletadas
              </label>
              <input
                id="mr-samples"
                type="number"
                min={0}
                step={1}
                className="mr-modal__input"
                value={sampleCount}
                onChange={(e) => setSampleCount(e.target.value)}
                placeholder="Qtd amostras"
              />
            </div>
            <div className="mr-modal__field">
              <label htmlFor="mr-pest-count" className="mr-modal__label">
                Contagem de pragas
              </label>
              <input
                id="mr-pest-count"
                type="number"
                min={0}
                step={1}
                className="mr-modal__input"
                value={pestCount}
                onChange={(e) => setPestCount(e.target.value)}
                placeholder="Pragas encontradas"
              />
            </div>
          </div>

          {/* Estádio e dano */}
          <div className="mr-modal__row">
            <div className="mr-modal__field">
              <label htmlFor="mr-growth" className="mr-modal__label">
                Estádio fenológico
              </label>
              <select
                id="mr-growth"
                className="mr-modal__select"
                value={growthStage}
                onChange={(e) => setGrowthStage(e.target.value)}
              >
                <option value="">Selecione (opcional)</option>
                {GROWTH_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="mr-modal__field">
              <label htmlFor="mr-damage" className="mr-modal__label">
                Dano estimado (%)
              </label>
              <input
                id="mr-damage"
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="mr-modal__input"
                value={damagePercentage}
                onChange={(e) => setDamagePercentage(e.target.value)}
                placeholder="0 a 100"
              />
            </div>
          </div>

          {/* Inimigos naturais */}
          <div className="mr-modal__field">
            <div className="mr-modal__checkbox-row">
              <input
                id="mr-enemies"
                type="checkbox"
                className="mr-modal__checkbox"
                checked={hasNaturalEnemies}
                onChange={(e) => setHasNaturalEnemies(e.target.checked)}
              />
              <label htmlFor="mr-enemies" className="mr-modal__label mr-modal__label--inline">
                Presença de inimigos naturais
              </label>
            </div>
            {hasNaturalEnemies && (
              <input
                type="text"
                className="mr-modal__input"
                value={naturalEnemiesDesc}
                onChange={(e) => setNaturalEnemiesDesc(e.target.value)}
                placeholder="Descreva os inimigos naturais observados"
                aria-label="Descrição dos inimigos naturais"
              />
            )}
          </div>

          {/* Observações */}
          <div className="mr-modal__field">
            <label htmlFor="mr-notes" className="mr-modal__label">
              Observações
            </label>
            <textarea
              id="mr-notes"
              className="mr-modal__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações adicionais (opcional)"
              rows={3}
            />
          </div>

          <div className="mr-modal__footer">
            <button
              type="button"
              className="mr-modal__btn mr-modal__btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mr-modal__btn mr-modal__btn--primary"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MonitoringRecordModal;
