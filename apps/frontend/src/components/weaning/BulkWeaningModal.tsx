import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useLots } from '@/hooks/useLots';
import type { UnweanedAnimal, WeaningConfig, BulkWeaningResultItem } from '@/types/weaning';
import './BulkWeaningModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  selectedAnimals: UnweanedAnimal[];
  config: WeaningConfig | null;
  onSuccess: () => void;
}

interface AnimalWeightEntry {
  calfId: string;
  earTag: string;
  name: string | null;
  sex: 'MALE' | 'FEMALE';
  weightKg: string;
  observations: string;
  minWeight: number | null;
}

export default function BulkWeaningModal({
  isOpen,
  onClose,
  farmId,
  selectedAnimals,
  config,
  onSuccess,
}: Props) {
  const [weaningDate, setWeaningDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetLotId, setTargetLotId] = useState<string>('');
  const [entries, setEntries] = useState<AnimalWeightEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkWeaningResultItem[] | null>(null);

  const { lots } = useLots({ farmId, limit: 200 });

  useEffect(() => {
    if (!isOpen) return;
    setWeaningDate(new Date().toISOString().split('T')[0]);
    setTargetLotId('');
    setError(null);
    setResults(null);
    setEntries(
      selectedAnimals.map((a) => ({
        calfId: a.id,
        earTag: a.earTag,
        name: a.name,
        sex: a.sex,
        weightKg: a.lastWeightKg?.toString() ?? '',
        observations: '',
        minWeight:
          a.sex === 'MALE'
            ? config?.minWeightKgMale ?? null
            : config?.minWeightKgFemale ?? null,
      })),
    );
  }, [isOpen, selectedAnimals, config]);

  const updateWeight = (index: number, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], weightKg: value };
      return next;
    });
  };

  const _updateObs = (index: number, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], observations: value };
      return next;
    });
  };

  const getWeightWarning = (entry: AnimalWeightEntry): string | null => {
    if (!entry.weightKg || !entry.minWeight) return null;
    const w = Number(entry.weightKg);
    if (isNaN(w) || w <= 0) return null;
    if (w < entry.minWeight) {
      return `Abaixo do mínimo (${entry.minWeight} kg)`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!weaningDate) {
      setError('Informe a data da desmama.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        weaningDate,
        targetLotId: targetLotId || null,
        animals: entries.map((entry) => ({
          calfId: entry.calfId,
          weightKg: entry.weightKg ? Number(entry.weightKg) : null,
          observations: entry.observations || null,
        })),
      };

      const result = await api.post<BulkWeaningResultItem[]>(
        `/org/farms/${farmId}/weanings/bulk`,
        payload,
      );
      setResults(result);

      const allCreated = result.every((r) => r.status === 'created');
      if (allCreated) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar desmamas.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasWarnings = entries.some((e) => getWeightWarning(e) !== null);

  return (
    <div className="bulk-wean-modal__overlay" onClick={onClose}>
      <div
        className="bulk-wean-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-wean-modal-title"
      >
        <header className="bulk-wean-modal__header">
          <h2 id="bulk-wean-modal-title">
            Desmamar {selectedAnimals.length} animal{selectedAnimals.length > 1 ? 'is' : ''}
          </h2>
          <button
            type="button"
            className="bulk-wean-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {results ? (
          <div className="bulk-wean-modal__results">
            {results.map((r) => (
              <div
                key={r.calfId}
                className={`bulk-wean-modal__result-item ${r.status === 'error' ? 'bulk-wean-modal__result-item--error' : ''}`}
              >
                <div className="bulk-wean-modal__result-header">
                  {r.status === 'created' ? (
                    <CheckCircle size={16} className="bulk-wean-modal__icon--success" aria-hidden="true" />
                  ) : (
                    <AlertCircle size={16} className="bulk-wean-modal__icon--error" aria-hidden="true" />
                  )}
                  <strong>{r.calfEarTag}</strong>
                  <span>{r.status === 'created' ? 'Desmamado' : 'Erro'}</span>
                </div>
                {r.weightWarning && (
                  <div className="bulk-wean-modal__result-warning">
                    <AlertTriangle size={14} aria-hidden="true" />
                    {r.weightWarning}
                  </div>
                )}
                {r.error && <div className="bulk-wean-modal__result-error">{r.error}</div>}
              </div>
            ))}
            <footer className="bulk-wean-modal__footer">
              <button type="button" className="bulk-wean-modal__btn-save" onClick={onSuccess}>
                Fechar
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bulk-wean-modal__form">
            {error && (
              <div className="bulk-wean-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="bulk-wean-modal__shared-fields">
              <div className="bulk-wean-modal__field">
                <label htmlFor="bulk-wean-date">Data da desmama *</label>
                <input
                  id="bulk-wean-date"
                  type="date"
                  value={weaningDate}
                  onChange={(e) => setWeaningDate(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
              <div className="bulk-wean-modal__field">
                <label htmlFor="bulk-wean-lot">Lote de destino</label>
                <select
                  id="bulk-wean-lot"
                  value={targetLotId}
                  onChange={(e) => setTargetLotId(e.target.value)}
                >
                  <option value="">Nenhum (manter no lote atual)</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasWarnings && (
              <div className="bulk-wean-modal__warning-banner" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                Alguns animais estão abaixo do peso mínimo configurado. Verifique antes de confirmar.
              </div>
            )}

            <div className="bulk-wean-modal__animal-list">
              <h3>Peso por animal</h3>
              {entries.map((entry, idx) => {
                const warning = getWeightWarning(entry);
                return (
                  <div
                    key={entry.calfId}
                    className={`bulk-wean-modal__animal-row ${warning ? 'bulk-wean-modal__animal-row--warning' : ''}`}
                  >
                    <div className="bulk-wean-modal__animal-info">
                      <span className="bulk-wean-modal__animal-tag">{entry.earTag}</span>
                      {entry.name && <span className="bulk-wean-modal__animal-name">{entry.name}</span>}
                      <span className="bulk-wean-modal__animal-sex">
                        {entry.sex === 'MALE' ? 'M' : 'F'}
                      </span>
                    </div>
                    <div className="bulk-wean-modal__animal-fields">
                      <div className="bulk-wean-modal__weight-field">
                        <label htmlFor={`weight-${idx}`} className="sr-only">
                          Peso de {entry.earTag}
                        </label>
                        <input
                          id={`weight-${idx}`}
                          type="number"
                          min="0"
                          step="0.1"
                          value={entry.weightKg}
                          onChange={(e) => updateWeight(idx, e.target.value)}
                          placeholder="Peso (kg)"
                        />
                        {warning && (
                          <span className="bulk-wean-modal__weight-warning" role="status">
                            <AlertTriangle size={14} aria-hidden="true" />
                            {warning}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="bulk-wean-modal__footer">
              <button
                type="button"
                className="bulk-wean-modal__btn-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="bulk-wean-modal__btn-save" disabled={isLoading}>
                {isLoading ? 'Salvando...' : `Confirmar desmama (${entries.length})`}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
