import { useState, useEffect, useCallback } from 'react';
import { X, Search, Check } from 'lucide-react';
import { api } from '@/services/api';
import { INSEMINATION_TYPES, CERVICAL_MUCUS_OPTIONS } from '@/types/iatf-execution';
import type { BullItem } from '@/types/bull';
import type { AnimalListItem } from '@/types/animal';
import { CATEGORY_LABELS } from '@/types/animal';
import './BulkInseminationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: (count: number) => void;
}

export default function BulkInseminationModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  // Step 1: select animals, Step 2: fill insemination data
  const [step, setStep] = useState<1 | 2>(1);

  // Animal selection
  const [animals, setAnimals] = useState<AnimalListItem[]>([]);
  const [animalSearch, setAnimalSearch] = useState('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<Set<string>>(new Set());
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);

  // Insemination data
  const [inseminationType, setInseminationType] = useState('IATF');
  const [bullId, setBullId] = useState('');
  const [inseminatorName, setInseminatorName] = useState('');
  const [inseminationDate, setInseminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [inseminationTime, setInseminationTime] = useState('');
  const [cervicalMucus, setCervicalMucus] = useState('');
  const [observations, setObservations] = useState('');

  const [bulls, setBulls] = useState<BullItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedAnimalIds(new Set());
      setAnimalSearch('');
      setInseminationType('IATF');
      setBullId('');
      setInseminatorName('');
      setInseminationDate(new Date().toISOString().slice(0, 10));
      setInseminationTime('');
      setCervicalMucus('');
      setObservations('');
      setError(null);
      setProgress(0);
    }
  }, [isOpen]);

  // Load female animals
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingAnimals(true);
    void api
      .get<{ data: AnimalListItem[] }>(
        `/org/farms/${farmId}/animals?sex=FEMALE&limit=2000&sortBy=earTag&sortOrder=asc`,
      )
      .then((res) => setAnimals(res.data ?? []))
      .catch(() => setAnimals([]))
      .finally(() => setIsLoadingAnimals(false));
  }, [isOpen, farmId]);

  // Load bulls
  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<{ data: BullItem[] }>(`/org/farms/${farmId}/bulls?status=ACTIVE&limit=200`)
      .then((res) => setBulls(res.data ?? []))
      .catch(() => setBulls([]));
  }, [isOpen, farmId]);

  const filteredAnimals = animalSearch.trim()
    ? animals.filter((a) => {
        const q = animalSearch.trim().toLowerCase();
        return (
          a.earTag.toLowerCase().includes(q) ||
          (a.name && a.name.toLowerCase().includes(q))
        );
      })
    : animals;

  function toggleAnimal(id: string) {
    setSelectedAnimalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedAnimalIds.size === filteredAnimals.length) {
      setSelectedAnimalIds(new Set());
    } else {
      setSelectedAnimalIds(new Set(filteredAnimals.map((a) => a.id)));
    }
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedAnimalIds.size === 0 || !inseminatorName.trim() || !inseminationDate) return;

      setIsSubmitting(true);
      setError(null);
      setProgress(0);

      const animalIds = Array.from(selectedAnimalIds);
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < animalIds.length; i++) {
        try {
          await api.post(`/org/farms/${farmId}/inseminations`, {
            animalId: animalIds[i],
            inseminationType,
            bullId: bullId || null,
            dosesUsed: 1,
            inseminatorName: inseminatorName.trim(),
            inseminationDate,
            inseminationTime: inseminationTime || null,
            cervicalMucus: cervicalMucus || null,
            observations: observations.trim() || null,
          });
          successCount++;
        } catch (_err) {
          const animal = animals.find((a) => a.id === animalIds[i]);
          const tag = animal?.earTag || animalIds[i];
          errors.push(tag);
        }
        setProgress(Math.round(((i + 1) / animalIds.length) * 100));
      }

      setIsSubmitting(false);

      if (errors.length > 0) {
        setError(`Falha em ${errors.length} animal(is): ${errors.join(', ')}`);
      }
      if (successCount > 0) {
        onSuccess(successCount);
      }
    },
    [
      selectedAnimalIds,
      inseminationType,
      bullId,
      inseminatorName,
      inseminationDate,
      inseminationTime,
      cervicalMucus,
      observations,
      farmId,
      animals,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  const allFiltered = filteredAnimals.length > 0 && selectedAnimalIds.size === filteredAnimals.length;

  return (
    <div className="bulk-insem__overlay" onClick={onClose}>
      <div
        className="bulk-insem"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-insem-title"
      >
        <header className="bulk-insem__header">
          <div>
            <h2 id="bulk-insem-title">Nova inseminação</h2>
            <p className="bulk-insem__step-label">
              {step === 1
                ? `Passo 1: Selecionar animais (${selectedAnimalIds.size} selecionados)`
                : `Passo 2: Dados da inseminação — ${selectedAnimalIds.size} animal(is)`}
            </p>
          </div>
          <button
            type="button"
            className="bulk-insem__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && (
          <div className="bulk-insem__error" role="alert">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div className="bulk-insem__body">
            <div className="bulk-insem__animal-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                value={animalSearch}
                onChange={(e) => setAnimalSearch(e.target.value)}
                placeholder="Buscar por brinco ou nome..."
                aria-label="Buscar animais"
              />
            </div>

            <div className="bulk-insem__select-all">
              <button type="button" onClick={selectAll} className="bulk-insem__select-all-btn">
                <span
                  className={`bulk-insem__checkbox ${allFiltered ? 'bulk-insem__checkbox--checked' : ''}`}
                >
                  {allFiltered && <Check size={12} aria-hidden="true" />}
                </span>
                {allFiltered ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              <span className="bulk-insem__count">
                {filteredAnimals.length} animais
              </span>
            </div>

            {isLoadingAnimals ? (
              <div className="bulk-insem__loading">Carregando animais...</div>
            ) : (
              <ul className="bulk-insem__animal-list" role="listbox" aria-multiselectable="true">
                {filteredAnimals.map((a) => {
                  const selected = selectedAnimalIds.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`bulk-insem__animal-item ${selected ? 'bulk-insem__animal-item--selected' : ''}`}
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleAnimal(a.id)}
                    >
                      <span
                        className={`bulk-insem__checkbox ${selected ? 'bulk-insem__checkbox--checked' : ''}`}
                      >
                        {selected && <Check size={12} aria-hidden="true" />}
                      </span>
                      <span className="bulk-insem__animal-tag">{a.earTag}</span>
                      <span className="bulk-insem__animal-name">{a.name || '—'}</span>
                      <span className="bulk-insem__animal-cat">{CATEGORY_LABELS[a.category] || a.category}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="bulk-insem__body">
              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-type">
                    Tipo <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="bulk-type"
                    value={inseminationType}
                    onChange={(e) => setInseminationType(e.target.value)}
                    required
                    aria-required="true"
                  >
                    {INSEMINATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-bull">Touro</label>
                  <select
                    id="bulk-bull"
                    value={bullId}
                    onChange={(e) => setBullId(e.target.value)}
                  >
                    <option value="">Selecione o touro</option>
                    {bulls.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.breedName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-date">
                    Data <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bulk-date"
                    type="date"
                    value={inseminationDate}
                    onChange={(e) => setInseminationDate(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-time">Hora</label>
                  <input
                    id="bulk-time"
                    type="time"
                    value={inseminationTime}
                    onChange={(e) => setInseminationTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="bulk-insem__row">
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-inseminator">
                    Inseminador <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="bulk-inseminator"
                    type="text"
                    value={inseminatorName}
                    onChange={(e) => setInseminatorName(e.target.value)}
                    placeholder="Nome do inseminador"
                    required
                    aria-required="true"
                  />
                </div>
                <div className="bulk-insem__field">
                  <label htmlFor="bulk-mucus">Muco cervical</label>
                  <select
                    id="bulk-mucus"
                    value={cervicalMucus}
                    onChange={(e) => setCervicalMucus(e.target.value)}
                  >
                    <option value="">Não informado</option>
                    {CERVICAL_MUCUS_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bulk-insem__field">
                <label htmlFor="bulk-obs">Observações</label>
                <textarea
                  id="bulk-obs"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={2}
                  placeholder="Observações opcionais..."
                />
              </div>

              {isSubmitting && (
                <div className="bulk-insem__progress">
                  <div className="bulk-insem__progress-bar">
                    <div
                      className="bulk-insem__progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="bulk-insem__progress-text">{progress}%</span>
                </div>
              )}
            </div>

            <footer className="bulk-insem__footer">
              <button
                type="button"
                className="bulk-insem__btn-secondary"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                Voltar
              </button>
              <button
                type="submit"
                className="bulk-insem__btn-primary"
                disabled={isSubmitting || !inseminatorName.trim() || !inseminationDate}
              >
                {isSubmitting
                  ? 'Salvando...'
                  : selectedAnimalIds.size === 1
                    ? 'Registrar inseminação'
                    : `Registrar ${selectedAnimalIds.size} inseminações`}
              </button>
            </footer>
          </form>
        )}

        {step === 1 && (
          <footer className="bulk-insem__footer">
            <button type="button" className="bulk-insem__btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="bulk-insem__btn-primary"
              onClick={() => setStep(2)}
              disabled={selectedAnimalIds.size === 0}
            >
              Continuar ({selectedAnimalIds.size} selecionados)
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
