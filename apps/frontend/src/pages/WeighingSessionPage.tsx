import { useState, useEffect, useRef } from 'react';
import { Scale, AlertCircle, ChevronLeft, Check, SkipForward } from 'lucide-react';
import { useAnimals } from '@/hooks/useAnimals';
import { useLots } from '@/hooks/useLots';
import { useFarmContext } from '@/stores/FarmContext';
import { api } from '@/services/api';
import { CATEGORY_LABELS } from '@/types/animal';
import type { AnimalListItem, AnimalCategory } from '@/types/animal';
import './WeighingSessionPage.css';

type Phase = 'selection' | 'weighing' | 'summary';

interface WeighingRecord {
  animalId: string;
  weightKg: number;
  date: string;
  bodyConditionScore?: number;
  notes?: string;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function WeighingSessionPage() {
  const { selectedFarm } = useFarmContext();
  const prevFarmIdRef = useRef(selectedFarm?.id);

  // Phase state
  const [phase, setPhase] = useState<Phase>('selection');

  // Selection filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Weighing state
  const [sessionAnimals, setSessionAnimals] = useState<AnimalListItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [weighed, setWeighed] = useState<Map<string, WeighingRecord>>(new Map());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  // Form fields
  const [weightKg, setWeightKg] = useState('');
  const [weighDate, setWeighDate] = useState(todayISO());
  const [ecc, setEcc] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset on farm change
  if (prevFarmIdRef.current !== selectedFarm?.id) {
    prevFarmIdRef.current = selectedFarm?.id;
    setPhase('selection');
    setSearchInput('');
    setSearch('');
    setLotFilter('');
    setSessionAnimals([]);
    setCurrentIndex(0);
    setWeighed(new Map());
    setSkipped(new Set());
    resetForm();
  }

  const { animals, isLoading } = useAnimals({
    farmId: selectedFarm?.id ?? null,
    search: search || undefined,
    lotId: lotFilter || undefined,
    limit: 200,
  });

  const { lots } = useLots({ farmId: selectedFarm?.id ?? null, limit: 100 });

  // Search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  function resetForm() {
    setWeightKg('');
    setWeighDate(todayISO());
    setEcc('');
    setNotes('');
    setSaveError(null);
  }

  function handleStartSession() {
    if (animals.length === 0) return;
    setSessionAnimals([...animals]);
    setCurrentIndex(0);
    setWeighed(new Map());
    setSkipped(new Set());
    resetForm();
    setPhase('weighing');
  }

  function handleWeighSingle(animal: AnimalListItem) {
    setSessionAnimals([animal]);
    setCurrentIndex(0);
    setWeighed(new Map());
    setSkipped(new Set());
    resetForm();
    setPhase('weighing');
  }

  const currentAnimal = sessionAnimals[currentIndex] ?? null;

  function advanceToNext() {
    resetForm();
    if (currentIndex < sessionAnimals.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase('summary');
    }
  }

  async function handleSaveAndNext() {
    if (!currentAnimal || !selectedFarm) return;
    const w = parseFloat(weightKg);
    if (isNaN(w) || w < 0.01 || w > 9999) {
      setSaveError('Peso deve ser entre 0.01 e 9999 kg.');
      return;
    }
    if (!weighDate) {
      setSaveError('Data é obrigatória.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        weightKg: w,
        date: weighDate,
      };
      const eccVal = ecc ? parseInt(ecc, 10) : null;
      if (eccVal != null && eccVal >= 1 && eccVal <= 5) {
        body.bodyConditionScore = eccVal;
      }
      if (notes.trim()) {
        body.notes = notes.trim();
      }

      await api.post(`/org/farms/${selectedFarm.id}/animals/${currentAnimal.id}/weighings`, body);

      setWeighed((prev) => {
        const next = new Map(prev);
        next.set(currentAnimal.id, {
          animalId: currentAnimal.id,
          weightKg: w,
          date: weighDate,
          bodyConditionScore: eccVal ?? undefined,
          notes: notes.trim() || undefined,
        });
        return next;
      });

      advanceToNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a pesagem.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkip() {
    if (!currentAnimal) return;
    setSkipped((prev) => {
      const next = new Set(prev);
      next.add(currentAnimal.id);
      return next;
    });
    advanceToNext();
  }

  function handleGoBack() {
    if (currentIndex > 0) {
      resetForm();
      setCurrentIndex((i) => i - 1);
    }
  }

  function handleEndSession() {
    setPhase('summary');
  }

  function handleNewSession() {
    setPhase('selection');
    setSessionAnimals([]);
    setCurrentIndex(0);
    setWeighed(new Map());
    setSkipped(new Set());
    resetForm();
  }

  // --- Renders ---

  if (!selectedFarm) {
    return (
      <section className="weighing">
        <div className="weighing__empty">
          <Scale size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="weighing__empty-title">Selecione uma fazenda</h2>
          <p className="weighing__empty-desc">
            Escolha uma fazenda no seletor acima para iniciar uma sessão de pesagem.
          </p>
        </div>
      </section>
    );
  }

  if (isLoading && animals.length === 0 && phase === 'selection') {
    return (
      <section className="weighing" aria-live="polite">
        <div
          className="weighing__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="weighing__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="weighing__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  // Phase: Summary
  if (phase === 'summary') {
    const weighedCount = weighed.size;
    const skippedCount = skipped.size;
    const totalSession = sessionAnimals.length;
    const weights = Array.from(weighed.values()).map((r) => r.weightKg);
    const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;

    return (
      <section className="weighing">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Resumo da sessão</h1>
            <p className="weighing__subtitle">Pesagem de {selectedFarm.name}</p>
          </div>
        </header>

        <div className="weighing__summary-cards">
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Total na sessão</span>
            <span className="weighing__summary-value">{totalSession}</span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Pesados</span>
            <span className="weighing__summary-value weighing__summary-value--success">
              {weighedCount}
            </span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Pulados</span>
            <span className="weighing__summary-value weighing__summary-value--warning">
              {skippedCount}
            </span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Peso médio</span>
            <span className="weighing__summary-value">
              {avgWeight > 0 ? `${avgWeight.toFixed(1)} kg` : '—'}
            </span>
          </div>
        </div>

        {/* Weighed animals list */}
        {weighedCount > 0 && (
          <div className="weighing__summary-list">
            <h2 className="weighing__section-title">Animais pesados</h2>
            <ul className="weighing__result-list">
              {sessionAnimals
                .filter((a) => weighed.has(a.id))
                .map((a) => {
                  const record = weighed.get(a.id)!;
                  return (
                    <li key={a.id} className="weighing__result-item weighing__result-item--done">
                      <Check size={16} aria-hidden="true" className="weighing__result-icon" />
                      <span className="weighing__result-tag">{a.earTag}</span>
                      <span className="weighing__result-name">{a.name ?? ''}</span>
                      <span className="weighing__result-weight">{record.weightKg} kg</span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        <div className="weighing__summary-actions">
          <button
            type="button"
            className="weighing__btn weighing__btn--primary"
            onClick={handleNewSession}
          >
            Nova sessão
          </button>
        </div>
      </section>
    );
  }

  // Phase: Weighing
  if (phase === 'weighing' && currentAnimal) {
    const weighedCount = weighed.size;
    const progress = ((weighedCount + skipped.size) / sessionAnimals.length) * 100;

    return (
      <section className="weighing">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Sessão de pesagem</h1>
            <p className="weighing__subtitle">
              {weighedCount + skipped.size} de {sessionAnimals.length} pesados
            </p>
          </div>
          <button
            type="button"
            className="weighing__btn weighing__btn--secondary"
            onClick={handleEndSession}
          >
            Encerrar sessão
          </button>
        </header>

        {/* Progress bar */}
        <div
          className="weighing__progress"
          role="progressbar"
          aria-valuenow={weighedCount + skipped.size}
          aria-valuemin={0}
          aria-valuemax={sessionAnimals.length}
          aria-label="Progresso da pesagem"
        >
          <div className="weighing__progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="weighing__weighing-layout">
          {/* Current animal card + form */}
          <div className="weighing__current">
            <div className="weighing__animal-card">
              <h2 className="weighing__animal-tag">{currentAnimal.earTag}</h2>
              {currentAnimal.name && <p className="weighing__animal-name">{currentAnimal.name}</p>}
              <div className="weighing__animal-info">
                <span>
                  {CATEGORY_LABELS[currentAnimal.category as AnimalCategory] ??
                    currentAnimal.category}
                </span>
                {currentAnimal.lotName && <span>Lote: {currentAnimal.lotName}</span>}
                <span>
                  Último peso:{' '}
                  {currentAnimal.entryWeightKg ? `${currentAnimal.entryWeightKg} kg` : '—'}
                </span>
              </div>
            </div>

            <form
              className="weighing__form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveAndNext();
              }}
            >
              {saveError && (
                <div className="weighing__error" role="alert" aria-live="polite">
                  <AlertCircle aria-hidden="true" size={16} />
                  {saveError}
                </div>
              )}

              <div className="weighing__form-row">
                <div className="weighing__form-group">
                  <label htmlFor="weight-input" className="weighing__label">
                    Peso (kg) *
                  </label>
                  <input
                    id="weight-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="9999"
                    className="weighing__input"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    autoFocus
                    required
                    aria-required="true"
                  />
                </div>

                <div className="weighing__form-group">
                  <label htmlFor="weigh-date" className="weighing__label">
                    Data *
                  </label>
                  <input
                    id="weigh-date"
                    type="date"
                    className="weighing__input"
                    value={weighDate}
                    onChange={(e) => setWeighDate(e.target.value)}
                    max={todayISO()}
                    required
                    aria-required="true"
                  />
                </div>

                <div className="weighing__form-group">
                  <label htmlFor="ecc-input" className="weighing__label">
                    ECC (1–5)
                  </label>
                  <input
                    id="ecc-input"
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    className="weighing__input"
                    value={ecc}
                    onChange={(e) => setEcc(e.target.value)}
                  />
                </div>
              </div>

              <div className="weighing__form-group">
                <label htmlFor="notes-input" className="weighing__label">
                  Observações
                </label>
                <textarea
                  id="notes-input"
                  className="weighing__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="weighing__form-actions">
                <button
                  type="button"
                  className="weighing__btn weighing__btn--ghost"
                  onClick={handleGoBack}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                  Anterior
                </button>
                <button
                  type="button"
                  className="weighing__btn weighing__btn--secondary"
                  onClick={handleSkip}
                >
                  <SkipForward aria-hidden="true" size={16} />
                  Pular
                </button>
                <button
                  type="submit"
                  className="weighing__btn weighing__btn--primary"
                  disabled={isSaving}
                >
                  <Check aria-hidden="true" size={16} />
                  {isSaving ? 'Salvando...' : 'Salvar e próximo'}
                </button>
              </div>
            </form>
          </div>

          {/* Side list */}
          <aside className="weighing__side-list" aria-label="Lista de animais da sessão">
            <h3 className="weighing__side-title">Animais</h3>
            <ul className="weighing__queue">
              {sessionAnimals.map((a, i) => {
                const isDone = weighed.has(a.id);
                const isSkippedAnimal = skipped.has(a.id);
                const isCurrent = i === currentIndex;
                let className = 'weighing__queue-item';
                if (isCurrent) className += ' weighing__queue-item--current';
                if (isDone) className += ' weighing__queue-item--done';
                if (isSkippedAnimal) className += ' weighing__queue-item--skipped';

                return (
                  <li key={a.id} className={className}>
                    <span className="weighing__queue-status">
                      {isDone && <Check size={14} aria-label="Pesado" />}
                      {isSkippedAnimal && <SkipForward size={14} aria-label="Pulado" />}
                    </span>
                    <span className="weighing__queue-tag">{a.earTag}</span>
                    {isDone && (
                      <span className="weighing__queue-weight">
                        {weighed.get(a.id)!.weightKg} kg
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </section>
    );
  }

  // Phase: Selection (default)
  return (
    <section className="weighing">
      <header className="weighing__header">
        <div>
          <h1 className="weighing__title">Sessão de pesagem</h1>
          <p className="weighing__subtitle">
            Selecione os animais para pesar — {selectedFarm.name}
          </p>
        </div>
        <div className="weighing__header-actions">
          <button
            type="button"
            className="weighing__btn weighing__btn--primary"
            onClick={handleStartSession}
            disabled={animals.length === 0}
          >
            <Scale aria-hidden="true" size={20} />
            Iniciar sessão ({animals.length})
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="weighing__toolbar">
        <label htmlFor="weighing-search" className="sr-only">
          Buscar animais
        </label>
        <input
          id="weighing-search"
          type="text"
          className="weighing__search"
          placeholder="Buscar por brinco ou nome..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="weighing-lot-filter" className="sr-only">
          Filtrar por lote
        </label>
        <select
          id="weighing-lot-filter"
          className="weighing__filter-select"
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
        >
          <option value="">Todos os lotes</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {animals.length === 0 && !isLoading ? (
        <div className="weighing__empty">
          <Scale size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="weighing__empty-title">Nenhum animal encontrado</h2>
          <p className="weighing__empty-desc">
            Tente ajustar os filtros de busca ou cadastre animais primeiro.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="weighing__table-wrapper">
            <table className="weighing__table">
              <thead>
                <tr>
                  <th scope="col">Brinco</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Lote</th>
                  <th scope="col">Último peso</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((animal) => (
                  <tr key={animal.id} className="weighing__table-row">
                    <td>
                      <span className="weighing__ear-tag">{animal.earTag}</span>
                    </td>
                    <td>{animal.name ?? '—'}</td>
                    <td>{CATEGORY_LABELS[animal.category as AnimalCategory] ?? animal.category}</td>
                    <td>{animal.lotName ?? '—'}</td>
                    <td>{animal.entryWeightKg ? `${animal.entryWeightKg} kg` : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="weighing__btn weighing__btn--ghost weighing__btn--sm"
                        onClick={() => handleWeighSingle(animal)}
                        aria-label={`Pesar ${animal.earTag}`}
                      >
                        <Scale aria-hidden="true" size={16} />
                        Pesar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="weighing__cards">
            {animals.map((animal) => (
              <div key={animal.id} className="weighing__card">
                <div className="weighing__card-header">
                  <h3 className="weighing__card-name">
                    {animal.earTag} {animal.name ? `— ${animal.name}` : ''}
                  </h3>
                </div>
                <div className="weighing__card-row">
                  <span className="weighing__card-label">Categoria</span>
                  <span className="weighing__card-value">
                    {CATEGORY_LABELS[animal.category as AnimalCategory] ?? animal.category}
                  </span>
                </div>
                <div className="weighing__card-row">
                  <span className="weighing__card-label">Lote</span>
                  <span className="weighing__card-value">{animal.lotName ?? '—'}</span>
                </div>
                <div className="weighing__card-row">
                  <span className="weighing__card-label">Último peso</span>
                  <span className="weighing__card-value">
                    {animal.entryWeightKg ? `${animal.entryWeightKg} kg` : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className="weighing__btn weighing__btn--ghost weighing__btn--sm weighing__card-action"
                  onClick={() => handleWeighSingle(animal)}
                  aria-label={`Pesar ${animal.earTag}`}
                >
                  <Scale aria-hidden="true" size={16} />
                  Pesar
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default WeighingSessionPage;
