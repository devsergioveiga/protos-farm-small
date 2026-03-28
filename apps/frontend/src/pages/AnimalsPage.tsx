import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Beef,
  Plus,
  Upload,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  Scale,
  Hash,
} from 'lucide-react';
import { useAnimals } from '@/hooks/useAnimals';
import { useBreeds } from '@/hooks/useBreeds';
import { useLots } from '@/hooks/useLots';
import { useFarmLocations } from '@/hooks/useFarmLocations';
import { useFarmContext } from '@/stores/FarmContext';
import { api } from '@/services/api';
import PermissionGate from '@/components/auth/PermissionGate';
import CreateAnimalModal from '@/components/animals/CreateAnimalModal';
import AnimalBulkImportModal from '@/components/animal-bulk-import/AnimalBulkImportModal';
import BulkActionsBar from '@/components/bulk-actions/BulkActionsBar';
import BulkMoveToLotModal from '@/components/bulk-actions/BulkMoveToLotModal';
import BulkHealthEventModal from '@/components/bulk-actions/BulkHealthEventModal';
import BulkAssignOwnerModal from '@/components/bulk-actions/BulkAssignOwnerModal';
import AnimalExitModal from '@/components/animal-exits/AnimalExitModal';
import { useAnimalOwners } from '@/hooks/useAnimalOwners';
import type { AnimalListItem, AnimalSex, AnimalCategory } from '@/types/animal';
import { SEX_LABELS, CATEGORY_LABELS, ORIGIN_LABELS } from '@/types/animal';
import './AnimalsPage.css';

const SORT_FIELD_LABELS: Record<string, string> = {
  earTag: 'Brinco',
  name: 'Nome',
  birthDate: 'Nascimento',
  entryWeightKg: 'Peso',
  createdAt: 'Cadastro',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function AnimalsPage() {
  const navigate = useNavigate();
  const { selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [breedFilter, setBreedFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFarmIdRef = useRef(selectedFarm?.id);

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [originFilter, setOriginFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [specialFilter, setSpecialFilter] = useState('');
  const [minWeightInput, setMinWeightInput] = useState('');
  const [maxWeightInput, setMaxWeightInput] = useState('');
  const [minAgeInput, setMinAgeInput] = useState('');
  const [maxAgeInput, setMaxAgeInput] = useState('');
  const [minWeightKg, setMinWeightKg] = useState<number | undefined>();
  const [maxWeightKg, setMaxWeightKg] = useState<number | undefined>();
  const [minAgeDays, setMinAgeDays] = useState<number | undefined>();
  const [maxAgeDays, setMaxAgeDays] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const weightDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ageDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [showBulkHealthModal, setShowBulkHealthModal] = useState(false);
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false);
  const [showBulkExitModal, setShowBulkExitModal] = useState(false);

  // Reset filters when farm changes (during render, not in effect)
  if (prevFarmIdRef.current !== selectedFarm?.id) {
    prevFarmIdRef.current = selectedFarm?.id;
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSexFilter('');
    setCategoryFilter('');
    setBreedFilter('');
    setOriginFilter('');
    setLotFilter('');
    setLocationFilter('');
    setOwnerFilter('');
    setSpecialFilter('');
    setMinWeightInput('');
    setMaxWeightInput('');
    setMinAgeInput('');
    setMaxAgeInput('');
    setMinWeightKg(undefined);
    setMaxWeightKg(undefined);
    setMinAgeDays(undefined);
    setMaxAgeDays(undefined);
    setSortBy('');
    setSortOrder('');
    setShowAdvancedFilters(false);
    setSelectedIds(new Set());
  }

  const { animals, meta, groupStats, isLoading, error, refetch } = useAnimals({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    sex: sexFilter || undefined,
    category: categoryFilter || undefined,
    breedId: breedFilter || undefined,
    origin: originFilter || undefined,
    lotId: lotFilter || undefined,
    locationId: locationFilter || undefined,
    ownerId: ownerFilter || undefined,
    specialFilter: specialFilter || undefined,
    minWeightKg,
    maxWeightKg,
    minAgeDays,
    maxAgeDays,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
  });

  const { breeds } = useBreeds();
  const { lots } = useLots({ farmId: selectedFarm?.id ?? null, limit: 100 });
  const { locations } = useFarmLocations(selectedFarm?.id);
  const { owners: animalOwners, refetch: refetchOwners } = useAnimalOwners(selectedFarm?.id);

  // Search debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Weight debounce
  useEffect(() => {
    if (weightDebounceRef.current) clearTimeout(weightDebounceRef.current);
    weightDebounceRef.current = setTimeout(() => {
      setMinWeightKg(minWeightInput ? Number(minWeightInput) : undefined);
      setMaxWeightKg(maxWeightInput ? Number(maxWeightInput) : undefined);
      setPage(1);
    }, 500);
    return () => {
      if (weightDebounceRef.current) clearTimeout(weightDebounceRef.current);
    };
  }, [minWeightInput, maxWeightInput]);

  // Age debounce
  useEffect(() => {
    if (ageDebounceRef.current) clearTimeout(ageDebounceRef.current);
    ageDebounceRef.current = setTimeout(() => {
      setMinAgeDays(minAgeInput ? Number(minAgeInput) : undefined);
      setMaxAgeDays(maxAgeInput ? Number(maxAgeInput) : undefined);
      setPage(1);
    }, 500);
    return () => {
      if (ageDebounceRef.current) clearTimeout(ageDebounceRef.current);
    };
  }, [minAgeInput, maxAgeInput]);

  const hasAdvancedFilters =
    !!originFilter ||
    !!lotFilter ||
    !!locationFilter ||
    !!ownerFilter ||
    !!specialFilter ||
    minWeightKg != null ||
    maxWeightKg != null ||
    minAgeDays != null ||
    maxAgeDays != null ||
    !!sortBy;

  const hasAnyFilter =
    !!search || !!sexFilter || !!categoryFilter || !!breedFilter || hasAdvancedFilters;

  const activeFilterCount = [
    search,
    sexFilter,
    categoryFilter,
    breedFilter,
    originFilter,
    lotFilter,
    locationFilter,
    ownerFilter,
    specialFilter,
    minWeightKg != null ? 'w' : '',
    maxWeightKg != null ? 'w' : '',
    minAgeDays != null ? 'a' : '',
    maxAgeDays != null ? 'a' : '',
    sortBy,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setSexFilter('');
    setCategoryFilter('');
    setBreedFilter('');
    setOriginFilter('');
    setLotFilter('');
    setLocationFilter('');
    setOwnerFilter('');
    setSpecialFilter('');
    setMinWeightInput('');
    setMaxWeightInput('');
    setMinAgeInput('');
    setMaxAgeInput('');
    setMinWeightKg(undefined);
    setMaxWeightKg(undefined);
    setMinAgeDays(undefined);
    setMaxAgeDays(undefined);
    setSortBy('');
    setSortOrder('');
    setPage(1);
  };

  const toggleAnimalSelection = useCallback(
    (id: string, e: React.MouseEvent | React.ChangeEvent) => {
      e.stopPropagation();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allOnPage = animals.map((a) => a.id);
      const allSelected = allOnPage.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allOnPage.forEach((id) => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        allOnPage.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [animals]);

  const allOnPageSelected = animals.length > 0 && animals.every((a) => selectedIds.has(a.id));
  const someOnPageSelected = animals.some((a) => selectedIds.has(a.id));
  const selectedAnimalIds = Array.from(selectedIds);

  const handleBulkSuccess = useCallback(() => {
    setSelectedIds(new Set());
    setShowBulkMoveModal(false);
    setShowBulkHealthModal(false);
    setShowBulkOwnerModal(false);
    void refetch();
    void refetchOwners();
  }, [refetch, refetchOwners]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!selectedFarm) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sexFilter) params.set('sex', sexFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (breedFilter) params.set('breedId', breedFilter);
      if (originFilter) params.set('origin', originFilter);
      if (lotFilter) params.set('lotId', lotFilter);
      if (locationFilter) params.set('locationId', locationFilter);
      if (specialFilter) params.set('specialFilter', specialFilter);
      if (minWeightKg != null) params.set('minWeightKg', String(minWeightKg));
      if (maxWeightKg != null) params.set('maxWeightKg', String(maxWeightKg));
      if (minAgeDays != null) params.set('minAgeDays', String(minAgeDays));
      if (maxAgeDays != null) params.set('maxAgeDays', String(maxAgeDays));
      if (sortBy) params.set('sortBy', sortBy);
      if (sortOrder) params.set('sortOrder', sortOrder);
      if (format === 'xlsx') params.set('format', 'xlsx');

      const qs = params.toString();
      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/animals/export${qs ? `?${qs}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animais-${selectedFarm.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export error is non-critical, user sees disabled button revert
    } finally {
      setIsExporting(false);
    }
  };

  const handleRowClick = (animal: AnimalListItem) => {
    navigate(`/animals/${animal.id}`);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, animal: AnimalListItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(animal);
    }
  };

  if (!selectedFarm) {
    return (
      <section className="animals">
        <div className="animals__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animals__empty-title">Selecione uma fazenda</h2>
          <p className="animals__empty-desc">
            Escolha uma fazenda no seletor acima para visualizar o rebanho.
          </p>
        </div>
      </section>
    );
  }

  if (isLoading && animals.length === 0) {
    return (
      <section className="animals" aria-live="polite">
        <div
          className="animals__skeleton"
          style={{ width: '200px', height: '32px', marginBottom: '24px' }}
        />
        <div
          className="animals__skeleton"
          style={{ width: '100%', height: '48px', marginBottom: '16px' }}
        />
        <div className="animals__skeleton" style={{ width: '100%', height: '300px' }} />
      </section>
    );
  }

  return (
    <section className="animals">
      <header className="animals__header">
        <div>
          <h1 className="animals__title">Animais</h1>
          <p className="animals__subtitle">Rebanho de {selectedFarm.name}</p>
        </div>
        <div className="animals__header-actions">
          <button
            type="button"
            className="animals__btn animals__btn--secondary"
            onClick={() => void handleExport('csv')}
            disabled={isExporting}
            aria-label="Exportar animais em CSV"
          >
            <Download aria-hidden="true" size={20} />
            {isExporting ? 'Exportando...' : 'CSV'}
          </button>
          <button
            type="button"
            className="animals__btn animals__btn--secondary"
            onClick={() => void handleExport('xlsx')}
            disabled={isExporting}
            aria-label="Exportar animais em Excel"
          >
            <Download aria-hidden="true" size={20} />
            {isExporting ? 'Exportando...' : 'Excel'}
          </button>
          <PermissionGate permission="animals:create">
            <button
              type="button"
              className="animals__btn animals__btn--secondary"
              onClick={() => setShowBulkImportModal(true)}
            >
              <Upload aria-hidden="true" size={20} />
              Importar animais
            </button>
          </PermissionGate>
          <PermissionGate permission="animals:create">
            <button
              type="button"
              className="animals__btn animals__btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus aria-hidden="true" size={20} />
              Novo animal
            </button>
          </PermissionGate>
        </div>
      </header>

      {error && (
        <div className="animals__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="animals__toolbar">
        <label htmlFor="animal-search" className="sr-only">
          Buscar animais
        </label>
        <input
          id="animal-search"
          type="text"
          className="animals__search"
          placeholder="Buscar por brinco, nome ou RFID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <label htmlFor="animal-sex-filter" className="sr-only">
          Filtrar por sexo
        </label>
        <select
          id="animal-sex-filter"
          className="animals__filter-select"
          value={sexFilter}
          onChange={(e) => {
            setSexFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os sexos</option>
          <option value="MALE">Macho</option>
          <option value="FEMALE">Fêmea</option>
        </select>
        <label htmlFor="animal-category-filter" className="sr-only">
          Filtrar por categoria
        </label>
        <select
          id="animal-category-filter"
          className="animals__filter-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor="animal-breed-filter" className="sr-only">
          Filtrar por raça
        </label>
        <select
          id="animal-breed-filter"
          className="animals__filter-select"
          value={breedFilter}
          onChange={(e) => {
            setBreedFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as raças</option>
          {breeds.map((breed) => (
            <option key={breed.id} value={breed.id}>
              {breed.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="animals__btn animals__btn--secondary animals__btn--toggle"
          onClick={() => setShowAdvancedFilters((v) => !v)}
          aria-expanded={showAdvancedFilters}
          aria-controls="advanced-filters-panel"
        >
          {showAdvancedFilters ? (
            <ChevronUp aria-hidden="true" size={16} />
          ) : (
            <ChevronDown aria-hidden="true" size={16} />
          )}
          Mais filtros
          {hasAdvancedFilters && (
            <span
              className="animals__filter-badge"
              aria-label={`${activeFilterCount} filtros ativos`}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div id="advanced-filters-panel" className="animals__advanced-filters">
          <div className="animals__advanced-row">
            <div className="animals__filter-group">
              <label htmlFor="animal-origin-filter" className="animals__filter-label">
                Origem
              </label>
              <select
                id="animal-origin-filter"
                className="animals__filter-select"
                value={originFilter}
                onChange={(e) => {
                  setOriginFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas as origens</option>
                {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-lot-filter" className="animals__filter-label">
                Lote
              </label>
              <select
                id="animal-lot-filter"
                className="animals__filter-select"
                value={lotFilter}
                onChange={(e) => {
                  setLotFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os lotes</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-location-filter" className="animals__filter-label">
                Local
              </label>
              <select
                id="animal-location-filter"
                className="animals__filter-select"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os locais</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type === 'PASTURE' ? 'Pasto' : 'Instalação'})
                  </option>
                ))}
              </select>
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-owner-filter" className="animals__filter-label">
                Proprietário
              </label>
              <select
                id="animal-owner-filter"
                className="animals__filter-select"
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os proprietários</option>
                {animalOwners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-special-filter" className="animals__filter-label">
                Filtro especial
              </label>
              <select
                id="animal-special-filter"
                className="animals__filter-select"
                value={specialFilter}
                onChange={(e) => {
                  setSpecialFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Nenhum</option>
                <option value="PREGNANT">Prenhas</option>
                <option value="EMPTY">Vazias</option>
                <option value="WITHDRAWAL">Em carência</option>
                <option value="LACTATING">Em lactação</option>
                <option value="DRY">Secas</option>
                <option value="CULLING">Aptas para descarte</option>
              </select>
            </div>
          </div>

          <div className="animals__advanced-row">
            <div className="animals__filter-group">
              <label htmlFor="animal-min-weight" className="animals__filter-label">
                Peso mínimo (kg)
              </label>
              <input
                id="animal-min-weight"
                type="number"
                className="animals__filter-input"
                placeholder="Ex: 100"
                min={0}
                value={minWeightInput}
                onChange={(e) => setMinWeightInput(e.target.value)}
              />
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-max-weight" className="animals__filter-label">
                Peso máximo (kg)
              </label>
              <input
                id="animal-max-weight"
                type="number"
                className="animals__filter-input"
                placeholder="Ex: 500"
                min={0}
                value={maxWeightInput}
                onChange={(e) => setMaxWeightInput(e.target.value)}
              />
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-min-age" className="animals__filter-label">
                Idade mínima (dias)
              </label>
              <input
                id="animal-min-age"
                type="number"
                className="animals__filter-input"
                placeholder="Ex: 30"
                min={0}
                value={minAgeInput}
                onChange={(e) => setMinAgeInput(e.target.value)}
              />
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-max-age" className="animals__filter-label">
                Idade máxima (dias)
              </label>
              <input
                id="animal-max-age"
                type="number"
                className="animals__filter-input"
                placeholder="Ex: 365"
                min={0}
                value={maxAgeInput}
                onChange={(e) => setMaxAgeInput(e.target.value)}
              />
            </div>
          </div>

          <div className="animals__advanced-row">
            <div className="animals__filter-group">
              <label htmlFor="animal-sort-by" className="animals__filter-label">
                Ordenar por
              </label>
              <select
                id="animal-sort-by"
                className="animals__filter-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  if (e.target.value && !sortOrder) setSortOrder('asc');
                  if (!e.target.value) setSortOrder('');
                  setPage(1);
                }}
              >
                <option value="">Padrão</option>
                {Object.entries(SORT_FIELD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="animals__filter-group">
              <label htmlFor="animal-sort-order" className="animals__filter-label">
                Ordem
              </label>
              <select
                id="animal-sort-order"
                className="animals__filter-select"
                value={sortOrder}
                disabled={!sortBy}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setPage(1);
                }}
              >
                <option value="asc">Crescente</option>
                <option value="desc">Decrescente</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Group stats bar */}
      {groupStats && (
        <div className="animals__group-stats" aria-live="polite">
          <div className="animals__group-stats-items">
            <span className="animals__group-stats-item">
              <Hash aria-hidden="true" size={16} />
              <strong>{groupStats.totalCount}</strong> animal(is)
              {hasAnyFilter ? ' encontrado(s)' : ''}
            </span>
            {groupStats.averageWeightKg != null && (
              <span className="animals__group-stats-item">
                <Scale aria-hidden="true" size={16} />
                Peso médio: <strong>{groupStats.averageWeightKg} kg</strong>
              </span>
            )}
          </div>
          {hasAnyFilter && (
            <button
              type="button"
              className="animals__btn animals__btn--ghost"
              onClick={clearAllFilters}
            >
              <X aria-hidden="true" size={16} />
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {animals.length === 0 && !isLoading ? (
        <div className="animals__empty">
          <Beef size={64} color="var(--color-neutral-400)" aria-hidden="true" />
          <h2 className="animals__empty-title">Nenhum animal encontrado</h2>
          <p className="animals__empty-desc">
            {hasAnyFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre o primeiro animal para começar.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="animals__table-wrapper">
            <table className="animals__table">
              <thead>
                <tr>
                  <th scope="col" className="animals__th-check">
                    <input
                      type="checkbox"
                      className="animals__checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todos os animais da página"
                    />
                  </th>
                  <th scope="col">Brinco</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Sexo</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Raça</th>
                  <th scope="col">Proprietário</th>
                  <th scope="col">Nascimento</th>
                </tr>
              </thead>
              <tbody>
                {animals.map((animal) => (
                  <tr
                    key={animal.id}
                    className={`animals__table-row${selectedIds.has(animal.id) ? ' animals__table-row--selected' : ''}`}
                    onClick={() => handleRowClick(animal)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${animal.earTag}`}
                    onKeyDown={(e) => handleRowKeyDown(e, animal)}
                  >
                    <td className="animals__td-check">
                      <input
                        type="checkbox"
                        className="animals__checkbox"
                        checked={selectedIds.has(animal.id)}
                        onChange={(e) => toggleAnimalSelection(animal.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Selecionar ${animal.earTag}`}
                      />
                    </td>
                    <td>
                      <span className="animals__ear-tag">{animal.earTag}</span>
                    </td>
                    <td>{animal.name ?? '—'}</td>
                    <td>
                      <span
                        className={`animals__badge animals__badge--sex-${animal.sex.toLowerCase()}`}
                      >
                        {SEX_LABELS[animal.sex]}
                      </span>
                    </td>
                    <td>
                      <span className="animals__badge animals__badge--category">
                        {CATEGORY_LABELS[animal.category as AnimalCategory]}
                      </span>
                    </td>
                    <td>
                      <span className="animals__breed-summary">{animal.breedSummary ?? '—'}</span>
                    </td>
                    <td>
                      <span className="animals__owner-summary">{animal.ownerSummary ?? '—'}</span>
                    </td>
                    <td>{formatDate(animal.birthDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="animals__cards">
            {animals.map((animal) => (
              <div
                key={animal.id}
                className={`animals__card${selectedIds.has(animal.id) ? ' animals__card--selected' : ''}`}
                onClick={() => handleRowClick(animal)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes de ${animal.earTag}`}
                onKeyDown={(e) => handleRowKeyDown(e, animal)}
              >
                <div className="animals__card-header">
                  <div className="animals__card-header-left">
                    <input
                      type="checkbox"
                      className="animals__checkbox"
                      checked={selectedIds.has(animal.id)}
                      onChange={(e) => toggleAnimalSelection(animal.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar ${animal.earTag}`}
                    />
                    <h3 className="animals__card-name">
                      {animal.earTag} {animal.name ? `— ${animal.name}` : ''}
                    </h3>
                  </div>
                  <span
                    className={`animals__badge animals__badge--sex-${animal.sex.toLowerCase()}`}
                  >
                    {SEX_LABELS[animal.sex as AnimalSex]}
                  </span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Categoria</span>
                  <span className="animals__card-value">
                    {CATEGORY_LABELS[animal.category as AnimalCategory]}
                  </span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Raça</span>
                  <span className="animals__card-value">{animal.breedSummary ?? '—'}</span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Proprietário</span>
                  <span className="animals__card-value">{animal.ownerSummary ?? '—'}</span>
                </div>
                <div className="animals__card-row">
                  <span className="animals__card-label">Nascimento</span>
                  <span className="animals__card-value">{formatDate(animal.birthDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="animals__pagination" aria-label="Paginação de animais">
              <button
                type="button"
                className="animals__pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="animals__pagination-btn"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}

      <CreateAnimalModal
        isOpen={showCreateModal}
        farmId={selectedFarm.id}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          void refetch();
        }}
      />

      <AnimalBulkImportModal
        isOpen={showBulkImportModal}
        farmId={selectedFarm.id}
        onClose={() => setShowBulkImportModal(false)}
        onImportComplete={() => {
          setShowBulkImportModal(false);
          void refetch();
        }}
      />

      <PermissionGate permission="animals:update">
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onMoveToLot={() => setShowBulkMoveModal(true)}
          onRegisterHealthEvent={() => setShowBulkHealthModal(true)}
          onAssignOwner={() => setShowBulkOwnerModal(true)}
          onRegisterExit={() => setShowBulkExitModal(true)}
        />

        <BulkMoveToLotModal
          isOpen={showBulkMoveModal}
          farmId={selectedFarm.id}
          selectedAnimalIds={selectedAnimalIds}
          onClose={() => setShowBulkMoveModal(false)}
          onSuccess={handleBulkSuccess}
        />

        <BulkHealthEventModal
          isOpen={showBulkHealthModal}
          farmId={selectedFarm.id}
          selectedAnimalIds={selectedAnimalIds}
          onClose={() => setShowBulkHealthModal(false)}
          onSuccess={handleBulkSuccess}
        />

        <BulkAssignOwnerModal
          isOpen={showBulkOwnerModal}
          farmId={selectedFarm.id}
          selectedAnimalIds={selectedAnimalIds}
          onClose={() => setShowBulkOwnerModal(false)}
          onSuccess={handleBulkSuccess}
        />

        <AnimalExitModal
          isOpen={showBulkExitModal}
          farmId={selectedFarm.id}
          animalIds={selectedAnimalIds}
          onClose={() => setShowBulkExitModal(false)}
          onSuccess={handleBulkSuccess}
        />
      </PermissionGate>
    </section>
  );
}

export default AnimalsPage;
