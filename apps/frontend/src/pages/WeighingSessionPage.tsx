import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scale,
  AlertCircle,
  Check,
  Search,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useLots } from '@/hooks/useLots';
import { useFarmWeighings } from '@/hooks/useFarmWeighings';
import { useFarmContext } from '@/stores/FarmContext';
import { api } from '@/services/api';
import { CATEGORY_LABELS } from '@/types/animal';
import type { AnimalListItem, AnimalCategory, FarmWeighingItem } from '@/types/animal';
import PermissionGate from '@/components/auth/PermissionGate';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './WeighingSessionPage.css';

type Phase = 'history' | 'start' | 'weighing' | 'summary';
type SortField =
  | 'measuredAt'
  | 'earTag'
  | 'animalName'
  | 'weightKg'
  | 'bodyConditionScore'
  | 'recorderName';

interface WeighingRecord {
  animal: AnimalListItem;
  weightKg: number;
  date: string;
  bodyConditionScore?: number;
  notes?: string;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function WeighingSessionPage() {
  const { selectedFarm } = useFarmContext();
  const prevFarmIdRef = useRef(selectedFarm?.id);

  // Phase state
  const [phase, setPhase] = useState<Phase>('history');

  // History filters
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySearchInput, setHistorySearchInput] = useState('');
  const [historyLotFilter, setHistoryLotFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('measuredAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const historySearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session config
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [sessionLot, setSessionLot] = useState('');

  // Weighing state
  const [records, setRecords] = useState<WeighingRecord[]>([]);

  // Search animal
  const [earTagInput, setEarTagInput] = useState('');
  const [searchResults, setSearchResults] = useState<AnimalListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalListItem | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [weightKg, setWeightKg] = useState('');
  const [ecc, setEcc] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Action modals
  const [viewWeighing, setViewWeighing] = useState<FarmWeighingItem | null>(null);
  const [editWeighing, setEditWeighing] = useState<FarmWeighingItem | null>(null);
  const [deleteWeighing, setDeleteWeighing] = useState<FarmWeighingItem | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editEcc, setEditEcc] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs
  const earTagRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  const { lots } = useLots({ farmId: selectedFarm?.id ?? null, limit: 100 });

  const {
    weighings: historyWeighings,
    meta: historyMeta,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useFarmWeighings({
    farmId: phase === 'history' ? (selectedFarm?.id ?? null) : null,
    page: historyPage,
    dateFrom: historyDateFrom || undefined,
    dateTo: historyDateTo || undefined,
    search: historySearch || undefined,
    lotId: historyLotFilter || undefined,
    sortBy,
    sortOrder,
  });

  // Reset on farm change
  if (prevFarmIdRef.current !== selectedFarm?.id) {
    prevFarmIdRef.current = selectedFarm?.id;
    setPhase('history');
    setHistoryPage(1);
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistorySearch('');
    setHistorySearchInput('');
    setHistoryLotFilter('');
    setSortBy('measuredAt');
    setSortOrder('desc');
    setSessionDate(todayISO());
    setSessionLot('');
    setRecords([]);
    resetForm();
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'measuredAt' ? 'desc' : 'asc');
    }
    setHistoryPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown size={14} aria-hidden="true" />;
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} aria-hidden="true" />
    ) : (
      <ArrowDown size={14} aria-hidden="true" />
    );
  }

  function resetForm() {
    setEarTagInput('');
    setSearchResults([]);
    setSelectedAnimal(null);
    setWeightKg('');
    setEcc('');
    setNotes('');
    setSaveError(null);
  }

  // Search animals by ear tag — tries with lot filter first, falls back to all animals
  useEffect(() => {
    if (phase !== 'weighing' || !selectedFarm || earTagInput.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const baseParams = { search: earTagInput.trim(), limit: '10' };
        let results: AnimalListItem[] = [];

        if (sessionLot) {
          const lotQuery = new URLSearchParams({ ...baseParams, lotId: sessionLot });
          const lotResult = await api.get<{ data: AnimalListItem[] }>(
            `/org/farms/${selectedFarm.id}/animals?${lotQuery.toString()}`,
          );
          results = lotResult.data;
        }

        if (results.length === 0) {
          const allQuery = new URLSearchParams(baseParams);
          const allResult = await api.get<{ data: AnimalListItem[] }>(
            `/org/farms/${selectedFarm.id}/animals?${allQuery.toString()}`,
          );
          results = allResult.data;
        } else if (sessionLot) {
          const allQuery = new URLSearchParams(baseParams);
          const allResult = await api.get<{ data: AnimalListItem[] }>(
            `/org/farms/${selectedFarm.id}/animals?${allQuery.toString()}`,
          );
          const lotIds = new Set(results.map((a) => a.id));
          const others = allResult.data.filter((a) => !lotIds.has(a.id));
          results = [...results, ...others].slice(0, 10);
        }

        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [earTagInput, phase, selectedFarm, sessionLot]);

  const handleSelectAnimal = useCallback((animal: AnimalListItem) => {
    setSelectedAnimal(animal);
    setEarTagInput(animal.earTag);
    setSearchResults([]);
    setTimeout(() => weightRef.current?.focus(), 50);
  }, []);

  const handleClearAnimal = useCallback(() => {
    setSelectedAnimal(null);
    setEarTagInput('');
    setSearchResults([]);
    setWeightKg('');
    setEcc('');
    setNotes('');
    setSaveError(null);
    setTimeout(() => earTagRef.current?.focus(), 50);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedAnimal || !selectedFarm) return;

    const w = parseFloat(weightKg);
    if (isNaN(w) || w < 0.01 || w > 9999) {
      setSaveError('Peso deve ser entre 0.01 e 9999 kg.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        weightKg: w,
        date: sessionDate,
      };
      const eccVal = ecc ? parseInt(ecc, 10) : null;
      if (eccVal != null && eccVal >= 1 && eccVal <= 5) {
        body.bodyConditionScore = eccVal;
      }
      if (notes.trim()) {
        body.notes = notes.trim();
      }

      await api.post(`/org/farms/${selectedFarm.id}/animals/${selectedAnimal.id}/weighings`, body);

      setRecords((prev) => [
        {
          animal: selectedAnimal,
          weightKg: w,
          date: sessionDate,
          bodyConditionScore: eccVal ?? undefined,
          notes: notes.trim() || undefined,
        },
        ...prev,
      ]);

      handleClearAnimal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a pesagem.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [selectedAnimal, selectedFarm, weightKg, sessionDate, ecc, notes, handleClearAnimal]);

  function handleOpenEdit(w: FarmWeighingItem) {
    setEditWeighing(w);
    setEditWeight(String(w.weightKg));
    setEditEcc(w.bodyConditionScore != null ? String(w.bodyConditionScore) : '');
    setEditNotes(w.notes ?? '');
    setEditDate(w.measuredAt);
    setEditError(null);
  }

  async function handleEditSave() {
    if (!editWeighing || !selectedFarm) return;
    const w = parseFloat(editWeight);
    if (isNaN(w) || w < 0.01 || w > 9999) {
      setEditError('Peso deve ser entre 0.01 e 9999 kg.');
      return;
    }

    setIsEditSaving(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = { weightKg: w, measuredAt: editDate };
      const eccVal = editEcc ? parseInt(editEcc, 10) : null;
      if (eccVal != null && eccVal >= 1 && eccVal <= 5) {
        body.bodyConditionScore = eccVal;
      } else {
        body.bodyConditionScore = null;
      }
      body.notes = editNotes.trim() || null;

      await api.patch(
        `/org/farms/${selectedFarm.id}/animals/${editWeighing.animalId}/weighings/${editWeighing.id}`,
        body,
      );
      setEditWeighing(null);
      void refetchHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar as alterações.';
      setEditError(message);
    } finally {
      setIsEditSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteWeighing || !selectedFarm) return;
    setIsDeleting(true);
    try {
      await api.delete(
        `/org/farms/${selectedFarm.id}/animals/${deleteWeighing.animalId}/weighings/${deleteWeighing.id}`,
      );
      setDeleteWeighing(null);
      void refetchHistory();
    } catch {
      // silently fail — user can retry
    } finally {
      setIsDeleting(false);
    }
  }

  function handleStartSession() {
    setRecords([]);
    resetForm();
    setPhase('weighing');
    setTimeout(() => earTagRef.current?.focus(), 100);
  }

  function handleEndSession() {
    setPhase('summary');
  }

  function handleBackToHistory() {
    setPhase('history');
    setHistoryPage(1);
    void refetchHistory();
  }

  // --- Renders ---

  if (!selectedFarm) {
    return (
      <section className="weighing">
        <div className="weighing__empty">
          <Scale size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="weighing__empty-title">Selecione uma fazenda</h2>
          <p className="weighing__empty-desc">
            Escolha uma fazenda no seletor acima para ver as pesagens.
          </p>
        </div>
      </section>
    );
  }

  // Phase: Summary
  if (phase === 'summary') {
    const weighedCount = records.length;
    const weights = records.map((r) => r.weightKg);
    const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0;
    const minWeight = weights.length > 0 ? Math.min(...weights) : 0;
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

    return (
      <section className="weighing">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Resumo da sessão</h1>
            <p className="weighing__subtitle">
              Pesagem de {selectedFarm.name} — {formatDateBR(sessionDate)}
            </p>
          </div>
        </header>

        <div className="weighing__summary-cards">
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Pesados</span>
            <span className="weighing__summary-value weighing__summary-value--success">
              {weighedCount}
            </span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Peso médio</span>
            <span className="weighing__summary-value">
              {avgWeight > 0 ? `${avgWeight.toFixed(1)} kg` : '—'}
            </span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Menor peso</span>
            <span className="weighing__summary-value">
              {minWeight > 0 ? `${minWeight.toFixed(1)} kg` : '—'}
            </span>
          </div>
          <div className="weighing__summary-card">
            <span className="weighing__summary-label">Maior peso</span>
            <span className="weighing__summary-value">
              {maxWeight > 0 ? `${maxWeight.toFixed(1)} kg` : '—'}
            </span>
          </div>
        </div>

        {weighedCount > 0 && (
          <div className="weighing__summary-list">
            <h2 className="weighing__section-title">Animais pesados</h2>
            <ul className="weighing__result-list">
              {records.map((record, i) => (
                <li
                  key={`${record.animal.id}-${i}`}
                  className="weighing__result-item weighing__result-item--done"
                >
                  <Check size={16} aria-hidden="true" className="weighing__result-icon" />
                  <span className="weighing__result-tag">{record.animal.earTag}</span>
                  <span className="weighing__result-name">{record.animal.name ?? ''}</span>
                  <span className="weighing__result-weight">{record.weightKg} kg</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="weighing__summary-actions">
          <button
            type="button"
            className="weighing__btn weighing__btn--ghost"
            onClick={handleBackToHistory}
          >
            Voltar ao histórico
          </button>
          <button
            type="button"
            className="weighing__btn weighing__btn--primary"
            onClick={() => {
              setRecords([]);
              resetForm();
              setPhase('start');
            }}
          >
            Nova sessão
          </button>
        </div>
      </section>
    );
  }

  // Phase: Weighing
  if (phase === 'weighing') {
    return (
      <section className="weighing">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Sessão de pesagem</h1>
            <p className="weighing__subtitle">
              {selectedFarm.name} — {formatDateBR(sessionDate)}
              {sessionLot && lots.find((l) => l.id === sessionLot)
                ? ` — Lote: ${lots.find((l) => l.id === sessionLot)!.name}`
                : ''}
              {records.length > 0 && ` — ${records.length} pesado${records.length > 1 ? 's' : ''}`}
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

        <div className="weighing__weighing-layout">
          <div className="weighing__current">
            {/* Animal search */}
            <div className="weighing__animal-search">
              <label htmlFor="ear-tag-search" className="weighing__label">
                Brinco do animal
              </label>
              <div className="weighing__search-field">
                <Search size={16} aria-hidden="true" className="weighing__search-field-icon" />
                <input
                  ref={earTagRef}
                  id="ear-tag-search"
                  type="text"
                  className="weighing__input weighing__input--search"
                  placeholder="Digite o brinco ou nome..."
                  value={earTagInput}
                  onChange={(e) => {
                    setEarTagInput(e.target.value);
                    if (selectedAnimal) setSelectedAnimal(null);
                  }}
                  disabled={!!selectedAnimal}
                  autoFocus
                  autoComplete="off"
                />
                {selectedAnimal && (
                  <button
                    type="button"
                    className="weighing__search-clear"
                    onClick={handleClearAnimal}
                    aria-label="Limpar animal selecionado"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {!selectedAnimal && earTagInput.trim().length >= 2 && (
                <div
                  className="weighing__search-results"
                  role="listbox"
                  aria-label="Resultados da busca"
                >
                  {isSearching ? (
                    <div className="weighing__search-loading">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="weighing__search-empty">Nenhum animal encontrado</div>
                  ) : (
                    searchResults.map((animal) => {
                      const isOtherLot = sessionLot && animal.lotId !== sessionLot;
                      return (
                        <button
                          key={animal.id}
                          type="button"
                          role="option"
                          className={`weighing__search-result${isOtherLot ? ' weighing__search-result--other-lot' : ''}`}
                          onClick={() => handleSelectAnimal(animal)}
                          aria-selected={false}
                        >
                          <span className="weighing__search-result-tag">{animal.earTag}</span>
                          <span className="weighing__search-result-name">{animal.name ?? ''}</span>
                          <span className="weighing__search-result-info">
                            {CATEGORY_LABELS[animal.category as AnimalCategory] ?? animal.category}
                            {animal.lotName ? ` · ${animal.lotName}` : ''}
                          </span>
                          {isOtherLot && (
                            <span className="weighing__search-result-badge">
                              <AlertTriangle size={12} aria-hidden="true" />
                              Outro lote
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Selected animal card */}
            {selectedAnimal && (
              <div className="weighing__animal-card">
                <h2 className="weighing__animal-tag">{selectedAnimal.earTag}</h2>
                {selectedAnimal.name && (
                  <p className="weighing__animal-name">{selectedAnimal.name}</p>
                )}
                <div className="weighing__animal-info">
                  <span>
                    {CATEGORY_LABELS[selectedAnimal.category as AnimalCategory] ??
                      selectedAnimal.category}
                  </span>
                  {selectedAnimal.lotName && <span>Lote: {selectedAnimal.lotName}</span>}
                  <span>
                    Último peso:{' '}
                    {selectedAnimal.entryWeightKg ? `${selectedAnimal.entryWeightKg} kg` : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Warning: animal from another lot */}
            {selectedAnimal && sessionLot && selectedAnimal.lotId !== sessionLot && (
              <div className="weighing__lot-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  Este animal pertence ao lote{' '}
                  <strong>{selectedAnimal.lotName ?? 'Sem lote'}</strong>. A sessão está filtrando
                  pelo lote{' '}
                  <strong>{lots.find((l) => l.id === sessionLot)?.name ?? sessionLot}</strong>.
                </span>
              </div>
            )}

            {/* Weight form */}
            {selectedAnimal && (
              <form
                className="weighing__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
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
                      ref={weightRef}
                      id="weight-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="9999"
                      className="weighing__input"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
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
                    onClick={handleClearAnimal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="weighing__btn weighing__btn--primary"
                    disabled={isSaving || !weightKg}
                  >
                    <Check aria-hidden="true" size={16} />
                    {isSaving ? 'Salvando...' : 'Salvar pesagem'}
                  </button>
                </div>
              </form>
            )}

            {!selectedAnimal && earTagInput.trim().length < 2 && (
              <p className="weighing__hint">
                Digite o brinco ou nome do animal para buscar e registrar a pesagem.
              </p>
            )}
          </div>

          {/* Side list: weighed animals */}
          <aside className="weighing__side-list" aria-label="Animais pesados na sessão">
            <h3 className="weighing__side-title">Pesados ({records.length})</h3>
            {records.length === 0 ? (
              <p className="weighing__side-empty">Nenhum animal pesado ainda.</p>
            ) : (
              <ul className="weighing__queue">
                {records.map((record, i) => (
                  <li
                    key={`${record.animal.id}-${i}`}
                    className="weighing__queue-item weighing__queue-item--done"
                  >
                    <span className="weighing__queue-status">
                      <Check size={14} aria-label="Pesado" />
                    </span>
                    <span className="weighing__queue-tag">{record.animal.earTag}</span>
                    <span className="weighing__queue-weight">{record.weightKg} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    );
  }

  // Phase: Start (session config)
  if (phase === 'start') {
    return (
      <section className="weighing">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Nova sessão de pesagem</h1>
            <p className="weighing__subtitle">Configure e inicie a sessão — {selectedFarm.name}</p>
          </div>
          <button
            type="button"
            className="weighing__btn weighing__btn--ghost"
            onClick={handleBackToHistory}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Voltar
          </button>
        </header>

        <div className="weighing__start-card">
          <div className="weighing__start-fields">
            <div className="weighing__form-group">
              <label htmlFor="session-date" className="weighing__label">
                Data da pesagem *
              </label>
              <input
                id="session-date"
                type="date"
                className="weighing__input"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                max={todayISO()}
                required
                aria-required="true"
              />
            </div>

            <div className="weighing__form-group">
              <label htmlFor="session-lot" className="weighing__label">
                Filtrar por lote (opcional)
              </label>
              <select
                id="session-lot"
                className="weighing__filter-select"
                value={sessionLot}
                onChange={(e) => setSessionLot(e.target.value)}
              >
                <option value="">Todos os lotes</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="weighing__btn weighing__btn--primary"
            onClick={handleStartSession}
          >
            <Scale aria-hidden="true" size={20} />
            Iniciar sessão
          </button>
        </div>
      </section>
    );
  }

  // Phase: History (default)
  return (
    <section className="weighing weighing--history">
      {/* Fixed top area */}
      <div className="weighing__fixed-top">
        <header className="weighing__header">
          <div>
            <h1 className="weighing__title">Pesagens</h1>
            <p className="weighing__subtitle">Histórico de pesagens — {selectedFarm.name}</p>
          </div>
          <div className="weighing__header-actions">
            <PermissionGate permission="animals:update">
              <button
                type="button"
                className="weighing__btn weighing__btn--primary"
                onClick={() => {
                  setSessionDate(todayISO());
                  setSessionLot('');
                  setPhase('start');
                }}
              >
                <Plus aria-hidden="true" size={20} />
                Nova pesagem
              </button>
            </PermissionGate>
          </div>
        </header>

        {/* Filters */}
        <div className="weighing__toolbar">
          <div className="weighing__search-wrapper">
            <Search size={16} aria-hidden="true" className="weighing__toolbar-search-icon" />
            <input
              type="text"
              className="weighing__input weighing__input--toolbar-search"
              placeholder="Buscar por brinco ou nome..."
              value={historySearchInput}
              onChange={(e) => {
                const value = e.target.value;
                setHistorySearchInput(value);
                if (historySearchDebounce.current) clearTimeout(historySearchDebounce.current);
                historySearchDebounce.current = setTimeout(() => {
                  setHistorySearch(value);
                  setHistoryPage(1);
                }, 300);
              }}
              aria-label="Buscar por brinco ou nome"
            />
          </div>
          <select
            className="weighing__filter-select"
            value={historyLotFilter}
            onChange={(e) => {
              setHistoryLotFilter(e.target.value);
              setHistoryPage(1);
            }}
            aria-label="Filtrar por lote"
          >
            <option value="">Todos os lotes</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="weighing__input weighing__input--date"
            value={historyDateFrom}
            onChange={(e) => {
              setHistoryDateFrom(e.target.value);
              setHistoryPage(1);
            }}
            max={historyDateTo || todayISO()}
            aria-label="Data início"
          />
          <input
            type="date"
            className="weighing__input weighing__input--date"
            value={historyDateTo}
            onChange={(e) => {
              setHistoryDateTo(e.target.value);
              setHistoryPage(1);
            }}
            min={historyDateFrom || undefined}
            max={todayISO()}
            aria-label="Data fim"
          />
          {(historyDateFrom || historyDateTo || historySearch || historyLotFilter) && (
            <button
              type="button"
              className="weighing__btn weighing__btn--ghost weighing__btn--sm"
              onClick={() => {
                setHistoryDateFrom('');
                setHistoryDateTo('');
                setHistorySearch('');
                setHistorySearchInput('');
                setHistoryLotFilter('');
                setHistoryPage(1);
              }}
            >
              <X size={14} aria-hidden="true" />
              Limpar
            </button>
          )}
        </div>

        {/* Table header (fixed) */}
        {!historyLoading && historyWeighings.length > 0 && (
          <div className="weighing__table-wrapper weighing__table-wrapper--head">
            <table className="weighing__table">
              <thead>
                <tr>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('measuredAt')}
                      aria-label="Ordenar por data"
                    >
                      Data <SortIcon field="measuredAt" />
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('earTag')}
                      aria-label="Ordenar por brinco"
                    >
                      Brinco <SortIcon field="earTag" />
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('animalName')}
                      aria-label="Ordenar por nome"
                    >
                      Nome <SortIcon field="animalName" />
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('weightKg')}
                      aria-label="Ordenar por peso"
                    >
                      Peso (kg) <SortIcon field="weightKg" />
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('bodyConditionScore')}
                      aria-label="Ordenar por ECC"
                    >
                      ECC <SortIcon field="bodyConditionScore" />
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="weighing__sort-btn"
                      onClick={() => handleSort('recorderName')}
                      aria-label="Ordenar por registrado por"
                    >
                      Registrado por <SortIcon field="recorderName" />
                    </button>
                  </th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
            </table>
          </div>
        )}
      </div>

      {/* Scrollable body area */}
      <div className="weighing__scroll-body">
        {/* Error */}
        {historyError && (
          <div className="weighing__error" role="alert" aria-live="polite">
            <AlertCircle aria-hidden="true" size={16} />
            {historyError}
          </div>
        )}

        {/* Loading */}
        {historyLoading && (
          <div className="weighing__skeleton-grid">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="weighing__skeleton"
                style={{ height: '56px', marginBottom: '4px' }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!historyLoading && !historyError && historyWeighings.length === 0 && (
          <div className="weighing__empty">
            <Scale size={64} color="var(--color-neutral-400)" aria-hidden="true" />
            <h2 className="weighing__empty-title">Nenhuma pesagem registrada</h2>
            <p className="weighing__empty-desc">
              {historyDateFrom || historyDateTo || historySearch || historyLotFilter
                ? 'Nenhuma pesagem encontrada para os filtros selecionados. Tente ajustar ou limpar os filtros.'
                : 'Inicie uma sessão de pesagem para registrar os pesos dos animais.'}
            </p>
          </div>
        )}

        {/* Table body */}
        {!historyLoading && historyWeighings.length > 0 && (
          <>
            <div className="weighing__table-wrapper">
              <table className="weighing__table">
                <tbody>
                  {historyWeighings.map((w) => (
                    <tr key={w.id} className="weighing__table-row">
                      <td>{formatDateBR(w.measuredAt)}</td>
                      <td>
                        <span className="weighing__ear-tag">{w.earTag}</span>
                      </td>
                      <td>{w.animalName ?? '—'}</td>
                      <td>
                        <strong>{w.weightKg.toFixed(1)}</strong>
                      </td>
                      <td>{w.bodyConditionScore ?? '—'}</td>
                      <td>{w.recorderName}</td>
                      <td>
                        <div className="weighing__actions">
                          <button
                            type="button"
                            className="weighing__icon-btn"
                            aria-label={`Ver detalhes de ${w.earTag}`}
                            onClick={() => setViewWeighing(w)}
                          >
                            <Eye size={18} aria-hidden="true" />
                          </button>
                          <PermissionGate permission="animals:update">
                            <button
                              type="button"
                              className="weighing__icon-btn"
                              aria-label={`Editar pesagem de ${w.earTag}`}
                              onClick={() => handleOpenEdit(w)}
                            >
                              <Pencil size={18} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="weighing__icon-btn weighing__icon-btn--danger"
                              aria-label={`Excluir pesagem de ${w.earTag}`}
                              onClick={() => setDeleteWeighing(w)}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="weighing__cards">
              {historyWeighings.map((w) => (
                <div key={w.id} className="weighing__card">
                  <div className="weighing__card-header">
                    <h3 className="weighing__card-name">
                      {w.earTag} {w.animalName ? `— ${w.animalName}` : ''}
                    </h3>
                  </div>
                  <div className="weighing__card-row">
                    <span className="weighing__card-label">Data</span>
                    <span className="weighing__card-value">{formatDateBR(w.measuredAt)}</span>
                  </div>
                  <div className="weighing__card-row">
                    <span className="weighing__card-label">Peso</span>
                    <span className="weighing__card-value">{w.weightKg.toFixed(1)} kg</span>
                  </div>
                  <div className="weighing__card-row">
                    <span className="weighing__card-label">ECC</span>
                    <span className="weighing__card-value">{w.bodyConditionScore ?? '—'}</span>
                  </div>
                  <div className="weighing__card-row">
                    <span className="weighing__card-label">Registrado por</span>
                    <span className="weighing__card-value">{w.recorderName}</span>
                  </div>
                  <div className="weighing__card-actions">
                    <button
                      type="button"
                      className="weighing__icon-btn"
                      aria-label={`Ver detalhes de ${w.earTag}`}
                      onClick={() => setViewWeighing(w)}
                    >
                      <Eye size={18} aria-hidden="true" />
                    </button>
                    <PermissionGate permission="animals:update">
                      <button
                        type="button"
                        className="weighing__icon-btn"
                        aria-label={`Editar pesagem de ${w.earTag}`}
                        onClick={() => handleOpenEdit(w)}
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="weighing__icon-btn weighing__icon-btn--danger"
                        aria-label={`Excluir pesagem de ${w.earTag}`}
                        onClick={() => setDeleteWeighing(w)}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {historyMeta && historyMeta.totalPages > 1 && (
              <nav className="weighing__pagination" aria-label="Paginação de pesagens">
                <button
                  type="button"
                  className="weighing__btn weighing__btn--ghost weighing__btn--sm"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                  Anterior
                </button>
                <span className="weighing__pagination-info">
                  Página {historyMeta.page} de {historyMeta.totalPages}
                </span>
                <button
                  type="button"
                  className="weighing__btn weighing__btn--ghost weighing__btn--sm"
                  disabled={historyPage >= historyMeta.totalPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Próxima
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      {/* View Detail Modal */}
      {viewWeighing && (
        <div
          className="weighing__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewWeighing(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-weighing-title"
        >
          <div className="weighing__modal">
            <header className="weighing__modal-header">
              <h2 id="view-weighing-title" className="weighing__modal-title">
                Detalhes da pesagem
              </h2>
              <button
                type="button"
                className="weighing__icon-btn"
                onClick={() => setViewWeighing(null)}
                aria-label="Fechar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="weighing__modal-body">
              <div className="weighing__detail-row">
                <span className="weighing__detail-label">Brinco</span>
                <span className="weighing__detail-value weighing__ear-tag">
                  {viewWeighing.earTag}
                </span>
              </div>
              {viewWeighing.animalName && (
                <div className="weighing__detail-row">
                  <span className="weighing__detail-label">Nome</span>
                  <span className="weighing__detail-value">{viewWeighing.animalName}</span>
                </div>
              )}
              <div className="weighing__detail-row">
                <span className="weighing__detail-label">Data</span>
                <span className="weighing__detail-value">
                  {formatDateBR(viewWeighing.measuredAt)}
                </span>
              </div>
              <div className="weighing__detail-row">
                <span className="weighing__detail-label">Peso</span>
                <span className="weighing__detail-value">
                  <strong>{viewWeighing.weightKg.toFixed(1)} kg</strong>
                </span>
              </div>
              <div className="weighing__detail-row">
                <span className="weighing__detail-label">ECC</span>
                <span className="weighing__detail-value">
                  {viewWeighing.bodyConditionScore ?? '—'}
                </span>
              </div>
              <div className="weighing__detail-row">
                <span className="weighing__detail-label">Registrado por</span>
                <span className="weighing__detail-value">{viewWeighing.recorderName}</span>
              </div>
              {viewWeighing.notes && (
                <div className="weighing__detail-row">
                  <span className="weighing__detail-label">Observações</span>
                  <span className="weighing__detail-value">{viewWeighing.notes}</span>
                </div>
              )}
            </div>
            <div className="weighing__modal-footer">
              <button
                type="button"
                className="weighing__btn weighing__btn--ghost"
                onClick={() => setViewWeighing(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editWeighing && (
        <div
          className="weighing__modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditWeighing(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-weighing-title"
        >
          <div className="weighing__modal">
            <header className="weighing__modal-header">
              <h2 id="edit-weighing-title" className="weighing__modal-title">
                Editar pesagem — {editWeighing.earTag}
              </h2>
              <button
                type="button"
                className="weighing__icon-btn"
                onClick={() => setEditWeighing(null)}
                aria-label="Fechar"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <form
              className="weighing__modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                void handleEditSave();
              }}
            >
              {editError && (
                <div className="weighing__error" role="alert" aria-live="polite">
                  <AlertCircle aria-hidden="true" size={16} />
                  {editError}
                </div>
              )}
              <div className="weighing__form-group">
                <label htmlFor="edit-date" className="weighing__label">
                  Data *
                </label>
                <input
                  id="edit-date"
                  type="date"
                  className="weighing__input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  max={todayISO()}
                  required
                  aria-required="true"
                />
              </div>
              <div className="weighing__form-row">
                <div className="weighing__form-group">
                  <label htmlFor="edit-weight" className="weighing__label">
                    Peso (kg) *
                  </label>
                  <input
                    id="edit-weight"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="9999"
                    className="weighing__input"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                <div className="weighing__form-group">
                  <label htmlFor="edit-ecc" className="weighing__label">
                    ECC (1–5)
                  </label>
                  <input
                    id="edit-ecc"
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    className="weighing__input"
                    value={editEcc}
                    onChange={(e) => setEditEcc(e.target.value)}
                  />
                </div>
              </div>
              <div className="weighing__form-group">
                <label htmlFor="edit-notes" className="weighing__label">
                  Observações
                </label>
                <textarea
                  id="edit-notes"
                  className="weighing__textarea"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="weighing__modal-footer">
                <button
                  type="button"
                  className="weighing__btn weighing__btn--ghost"
                  onClick={() => setEditWeighing(null)}
                  disabled={isEditSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="weighing__btn weighing__btn--primary"
                  disabled={isEditSaving || !editWeight}
                >
                  {isEditSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteWeighing}
        title="Excluir pesagem?"
        message={
          deleteWeighing
            ? `A pesagem de ${deleteWeighing.earTag} (${deleteWeighing.weightKg.toFixed(1)} kg em ${formatDateBR(deleteWeighing.measuredAt)}) será excluída permanentemente.`
            : ''
        }
        confirmLabel="Excluir pesagem"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteWeighing(null)}
      />
    </section>
  );
}

export default WeighingSessionPage;
