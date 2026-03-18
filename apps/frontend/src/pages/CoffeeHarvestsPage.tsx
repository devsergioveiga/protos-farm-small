import { useState, useRef, useCallback } from 'react';
import {
  Coffee,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Droplets,
  Users,
  Star,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useCoffeeHarvests } from '@/hooks/useCoffeeHarvests';
import PermissionGate from '@/components/auth/PermissionGate';
import CoffeeHarvestModal from '@/components/coffee-harvests/CoffeeHarvestModal';
import { HARVEST_TYPES, HARVEST_TYPE_LABELS } from '@/types/coffee-harvest';
import type { CoffeeHarvestItem } from '@/types/coffee-harvest';
import './CoffeeHarvestsPage.css';

function CoffeeHarvestsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedHarvest, setSelectedHarvest] = useState<CoffeeHarvestItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { harvests, meta, isLoading, error, refetch } = useCoffeeHarvests({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    harvestType: typeFilter || undefined,
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

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedHarvest(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((h: CoffeeHarvestItem) => {
    setSelectedHarvest(h);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, h: CoffeeHarvestItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(h);
      }
    },
    [handleCardClick],
  );

  const handleNewHarvest = useCallback(() => {
    setSelectedHarvest(null);
    setShowModal(true);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!selectedFarmId) {
    return (
      <section className="coffee-harvests">
        <div className="coffee-harvests__empty">
          <Coffee size={64} aria-hidden="true" />
          <h2 className="coffee-harvests__empty-title">Selecione uma fazenda</h2>
          <p className="coffee-harvests__empty-desc">
            Escolha uma fazenda no seletor acima para ver as colheitas de café.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="coffee-harvests">
      <div className="coffee-harvests__header">
        <div className="coffee-harvests__header-text">
          <h1 className="coffee-harvests__title">Colheita de café</h1>
          <p className="coffee-harvests__subtitle">
            Registro de colheitas em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="coffee-harvests__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="coffee-harvests__btn coffee-harvests__btn--primary"
              onClick={handleNewHarvest}
            >
              <Plus size={20} aria-hidden="true" />
              Nova colheita
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="coffee-harvests__toolbar">
        <div className="coffee-harvests__search-wrapper">
          <Search size={16} aria-hidden="true" className="coffee-harvests__search-icon" />
          <input
            type="search"
            className="coffee-harvests__search"
            placeholder="Buscar por microlote, destino ou observações..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar colheitas"
          />
        </div>
        <select
          className="coffee-harvests__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de colheita"
        >
          <option value="">Todos os tipos</option>
          {HARVEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="coffee-harvests__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="coffee-harvests__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="coffee-harvests__skeleton coffee-harvests__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {harvests.length === 0 && !isLoading && !error ? (
        <div className="coffee-harvests__empty">
          <Coffee size={64} aria-hidden="true" />
          <h2 className="coffee-harvests__empty-title">Nenhuma colheita registrada</h2>
          <p className="coffee-harvests__empty-desc">
            Registre colheitas de café com volume, classificação e equipe para controle completo da
            produção.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {harvests.length > 0 && !isLoading && (
        <div className="coffee-harvests__grid">
          {harvests.map((h) => (
            <div
              key={h.id}
              className={`coffee-harvests__card${h.isSpecialLot ? ' coffee-harvests__card--special' : ''}`}
              onClick={() => handleCardClick(h)}
              onKeyDown={(e) => handleCardKeyDown(e, h)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da colheita em ${h.fieldPlotName} de ${formatDate(h.harvestDate)}`}
            >
              <div className="coffee-harvests__card-header">
                <h3 className="coffee-harvests__card-plot">{h.fieldPlotName}</h3>
                <span className="coffee-harvests__badge coffee-harvests__badge--type">
                  {HARVEST_TYPE_LABELS[h.harvestType] ?? h.harvestType}
                </span>
              </div>

              <div className="coffee-harvests__card-details">
                <span className="coffee-harvests__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(h.harvestDate)}
                </span>
                <span className="coffee-harvests__card-detail">
                  <Droplets size={14} aria-hidden="true" />
                  <span className="coffee-harvests__card-detail-label">Volume:</span>
                  {h.volumeLiters.toLocaleString('pt-BR')} L{' → '}
                  {h.estimatedSacs} sc estimadas
                  {h.sacsBenefited != null && ` (${h.sacsBenefited} sc reais)`}
                </span>
                {h.commercialUnits && (
                  <span className="coffee-harvests__card-detail coffee-harvests__card-detail--commercial">
                    <span className="coffee-harvests__card-detail-label">Comercial:</span>
                    {h.commercialUnits.kg.toLocaleString('pt-BR')} kg
                    {' · '}
                    {h.commercialUnits.arroba.toLocaleString('pt-BR')} @{' · '}
                    {h.commercialUnits.t.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} t
                  </span>
                )}
              </div>

              {(h.cherryPct > 0 || h.greenPct > 0 || h.floaterPct > 0 || h.dryPct > 0) && (
                <div className="coffee-harvests__card-classification">
                  <span>Cereja {h.cherryPct}%</span>
                  <span>Verde {h.greenPct}%</span>
                  <span>Boia {h.floaterPct}%</span>
                  <span>Seco {h.dryPct}%</span>
                </div>
              )}

              {h.numberOfHarvesters != null && (
                <div className="coffee-harvests__card-detail" style={{ marginTop: 4 }}>
                  <Users size={14} aria-hidden="true" />
                  {h.numberOfHarvesters} colhedores
                  {h.harvestersProductivity != null && (
                    <span> — {h.harvestersProductivity} L/pessoa/dia</span>
                  )}
                </div>
              )}

              {h.destinationLabel && (
                <div className="coffee-harvests__card-destination">
                  <span className="coffee-harvests__card-detail-label">Destino:</span>
                  {h.destinationLabel}
                  {h.destinationName && ` — ${h.destinationName}`}
                </div>
              )}

              {h.isSpecialLot && (
                <div className="coffee-harvests__card-badges">
                  <span className="coffee-harvests__badge coffee-harvests__badge--special">
                    <Star size={12} aria-hidden="true" />
                    Café especial
                    {h.microlotCode && ` — ${h.microlotCode}`}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="coffee-harvests__pagination" aria-label="Paginação de colheitas">
          <button
            type="button"
            className="coffee-harvests__btn coffee-harvests__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="coffee-harvests__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="coffee-harvests__btn coffee-harvests__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <CoffeeHarvestModal
        isOpen={showModal}
        harvest={selectedHarvest}
        onClose={() => {
          setShowModal(false);
          setSelectedHarvest(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default CoffeeHarvestsPage;
