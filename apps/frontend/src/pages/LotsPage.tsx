import { useState, useRef, useCallback } from 'react';
import { Layers, Plus, Search, ChevronLeft, ChevronRight, AlertCircle, MapPin } from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useLots } from '@/hooks/useLots';
import PermissionGate from '@/components/auth/PermissionGate';
import CreateLotModal from '@/components/lots/CreateLotModal';
import LotDetailModal from '@/components/lots/LotDetailModal';
import { CATEGORY_LABELS } from '@/types/animal';
import { LOCATION_TYPE_LABELS, LOCATION_TYPES } from '@/types/lot';
import type { AnimalCategory } from '@/types/animal';
import type { LotListItem, LotLocationType } from '@/types/lot';
import './LotsPage.css';

const ANIMAL_CATEGORIES: AnimalCategory[] = [
  'BEZERRO',
  'BEZERRA',
  'NOVILHA',
  'NOVILHO',
  'VACA_LACTACAO',
  'VACA_SECA',
  'TOURO_REPRODUTOR',
  'DESCARTE',
];

function LotsPage() {
  const { selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationTypeFilter, setLocationTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<LotListItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevFarmIdRef = useRef<string | undefined>(undefined);

  // Reset filters on farm change
  if (prevFarmIdRef.current !== selectedFarm?.id) {
    prevFarmIdRef.current = selectedFarm?.id;
    setPage(1);
    setSearch('');
    setSearchInput('');
    setCategoryFilter('');
    setLocationTypeFilter('');
  }

  const { lots, meta, isLoading, error, refetch } = useLots({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    category: categoryFilter || undefined,
    locationType: locationTypeFilter || undefined,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    void refetch();
  }, [refetch]);

  const handleLotClick = useCallback((lot: LotListItem) => {
    setSelectedLot(lot);
  }, []);

  const handleLotKeyDown = useCallback(
    (e: React.KeyboardEvent, lot: LotListItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleLotClick(lot);
      }
    },
    [handleLotClick],
  );

  const getCapacityPercent = (lot: LotListItem) => {
    if (!lot.maxCapacity) return null;
    return Math.round((lot._count.animals / lot.maxCapacity) * 100);
  };

  const getCapacityClass = (percent: number | null) => {
    if (percent === null) return '';
    if (percent > 100) return 'lots__capacity-bar--over';
    if (percent >= 80) return 'lots__capacity-bar--warning';
    return 'lots__capacity-bar--ok';
  };

  return (
    <section className="lots">
      <div className="lots__header">
        <div className="lots__header-text">
          <h1 className="lots__title">Lotes</h1>
          <p className="lots__subtitle">
            {selectedFarm
              ? `Lotes de manejo de ${selectedFarm.name}`
              : 'Selecione uma fazenda para ver os lotes'}
          </p>
        </div>
        <div className="lots__header-actions">
          <PermissionGate permission="animals:create">
            <button
              type="button"
              className="lots__btn lots__btn--primary"
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedFarm}
            >
              <Plus size={20} aria-hidden="true" />
              Novo lote
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="lots__toolbar">
        <div className="lots__search-wrapper">
          <Search size={16} aria-hidden="true" className="lots__search-icon" />
          <input
            type="search"
            className="lots__search"
            placeholder="Buscar lotes..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar lotes"
          />
        </div>
        <select
          className="lots__filter-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas categorias</option>
          {ANIMAL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        <select
          className="lots__filter-select"
          value={locationTypeFilter}
          onChange={(e) => {
            setLocationTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de local"
        >
          <option value="">Todos locais</option>
          {LOCATION_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {LOCATION_TYPE_LABELS[lt]}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="lots__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="lots__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="lots__skeleton lots__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {lots.length === 0 && !isLoading && !error ? (
        <div className="lots__empty">
          <Layers size={64} aria-hidden="true" />
          <h2 className="lots__empty-title">Nenhum lote encontrado</h2>
          <p className="lots__empty-desc">
            {selectedFarm
              ? 'Crie seu primeiro lote para organizar os animais por grupo de manejo.'
              : 'Selecione uma fazenda para gerenciar os lotes.'}
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {lots.length > 0 && !isLoading && (
        <div className="lots__grid">
          {lots.map((lot) => {
            const capacityPercent = getCapacityPercent(lot);
            return (
              <div
                key={lot.id}
                className="lots__card"
                onClick={() => handleLotClick(lot)}
                onKeyDown={(e) => handleLotKeyDown(e, lot)}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalhes do lote ${lot.name}`}
              >
                <div className="lots__card-header">
                  <h3 className="lots__card-name">{lot.name}</h3>
                  <span className="lots__badge lots__badge--category">
                    {CATEGORY_LABELS[lot.predominantCategory]}
                  </span>
                </div>
                <div className="lots__card-info">
                  <span className="lots__card-location">
                    <MapPin size={14} aria-hidden="true" />
                    {lot.currentLocation} (
                    {LOCATION_TYPE_LABELS[lot.locationType as LotLocationType]})
                  </span>
                  <span className="lots__card-count">
                    {lot._count.animals} {lot._count.animals === 1 ? 'animal' : 'animais'}
                  </span>
                </div>
                {lot.maxCapacity && (
                  <div className="lots__capacity">
                    <div className="lots__capacity-label">
                      <span>Capacidade</span>
                      <span>
                        {lot._count.animals}/{lot.maxCapacity}
                      </span>
                    </div>
                    <div className="lots__capacity-track">
                      <div
                        className={`lots__capacity-bar ${getCapacityClass(capacityPercent)}`}
                        style={{ width: `${Math.min(capacityPercent ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="lots__pagination" aria-label="Paginação de lotes">
          <button
            type="button"
            className="lots__btn lots__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="lots__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="lots__btn lots__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modals */}
      <CreateLotModal
        isOpen={showCreateModal}
        farmId={selectedFarm?.id ?? ''}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      <LotDetailModal
        isOpen={!!selectedLot}
        farmId={selectedFarm?.id ?? ''}
        lot={selectedLot}
        onClose={() => setSelectedLot(null)}
        onUpdate={() => void refetch()}
      />
    </section>
  );
}

export default LotsPage;
