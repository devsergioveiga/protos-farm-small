import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import {
  Sprout,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  MapPin,
  Filter,
  X,
} from 'lucide-react';
import { useCultivars } from '@/hooks/useCultivars';
import PermissionGate from '@/components/auth/PermissionGate';
import CultivarModal from '@/components/cultivars/CultivarModal';
import { CROP_OPTIONS, CULTIVAR_TYPES } from '@/types/cultivar';
import type { CultivarItem } from '@/types/cultivar';
import './CultivarsPage.css';

const CultivarProductivity = lazy(() => import('@/components/cultivars/CultivarProductivity'));
const CultivarPlotHistory = lazy(() => import('@/components/cultivars/CultivarPlotHistory'));

type Tab = 'catalogo' | 'produtividade' | 'historico';

function CultivarsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('catalogo');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [technologyFilter, setTechnologyFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCultivar, setSelectedCultivar] = useState<CultivarItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { cultivars, meta, isLoading, error, refetch } = useCultivars({
    page,
    search: search || undefined,
    crop: cropFilter || undefined,
  });

  // CA7: Client-side advanced filters (type, technology)
  const filteredCultivars = cultivars.filter((c) => {
    if (typeFilter && c.type !== typeFilter) return false;
    if (
      technologyFilter &&
      (!c.technology || !c.technology.toLowerCase().includes(technologyFilter.toLowerCase()))
    )
      return false;
    return true;
  });

  const activeFilterCount = [cropFilter, typeFilter, technologyFilter].filter(Boolean).length;

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
    setSelectedCultivar(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((cultivar: CultivarItem) => {
    setSelectedCultivar(cultivar);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, cultivar: CultivarItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(cultivar);
      }
    },
    [handleCardClick],
  );

  const handleNewCultivar = useCallback(() => {
    setSelectedCultivar(null);
    setShowModal(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setCropFilter('');
    setTypeFilter('');
    setTechnologyFilter('');
    setPage(1);
  }, []);

  return (
    <section className="cultivars">
      <div className="cultivars__header">
        <div className="cultivars__header-text">
          <h1 className="cultivars__title">Cultivares</h1>
          <p className="cultivars__subtitle">Catálogo de cultivares com características técnicas</p>
        </div>
        <div className="cultivars__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="cultivars__btn cultivars__btn--primary"
              onClick={handleNewCultivar}
            >
              <Plus size={20} aria-hidden="true" />
              Nova cultivar
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Tabs */}
      <nav className="cultivars__tabs" role="tablist" aria-label="Seções de cultivares">
        <button
          type="button"
          role="tab"
          className={`cultivars__tab ${activeTab === 'catalogo' ? 'cultivars__tab--active' : ''}`}
          aria-selected={activeTab === 'catalogo'}
          onClick={() => setActiveTab('catalogo')}
        >
          <Sprout size={16} aria-hidden="true" />
          Catálogo
        </button>
        <button
          type="button"
          role="tab"
          className={`cultivars__tab ${activeTab === 'produtividade' ? 'cultivars__tab--active' : ''}`}
          aria-selected={activeTab === 'produtividade'}
          onClick={() => setActiveTab('produtividade')}
        >
          Produtividade
        </button>
        <button
          type="button"
          role="tab"
          className={`cultivars__tab ${activeTab === 'historico' ? 'cultivars__tab--active' : ''}`}
          aria-selected={activeTab === 'historico'}
          onClick={() => setActiveTab('historico')}
        >
          <MapPin size={16} aria-hidden="true" />
          Histórico por Talhão
        </button>
      </nav>

      {/* Tab: Catálogo */}
      {activeTab === 'catalogo' && (
        <div role="tabpanel" aria-label="Catálogo de cultivares">
          {/* Toolbar */}
          <div className="cultivars__toolbar">
            <div className="cultivars__search-wrapper">
              <Search size={16} aria-hidden="true" className="cultivars__search-icon" />
              <input
                type="search"
                className="cultivars__search"
                placeholder="Buscar cultivares..."
                value={searchInput}
                onChange={handleSearchChange}
                aria-label="Buscar cultivares"
              />
            </div>
            <select
              className="cultivars__filter-select"
              value={cropFilter}
              onChange={(e) => {
                setCropFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por cultura"
            >
              <option value="">Todas culturas</option>
              {CROP_OPTIONS.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`cultivars__btn cultivars__btn--ghost ${showAdvancedFilters ? 'cultivars__btn--active-filter' : ''}`}
              onClick={() => setShowAdvancedFilters((v) => !v)}
              aria-expanded={showAdvancedFilters}
              aria-controls="cultivars-advanced-filters"
            >
              <Filter size={16} aria-hidden="true" />
              Filtros
              {activeFilterCount > 0 && (
                <span
                  className="cultivars__filter-count"
                  aria-label={`${activeFilterCount} filtros ativos`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* CA7: Advanced filters */}
          {showAdvancedFilters && (
            <div id="cultivars-advanced-filters" className="cultivars__advanced-filters">
              <div className="cultivars__filter-group">
                <label htmlFor="filter-type" className="cultivars__filter-label">
                  Tipo
                </label>
                <select
                  id="filter-type"
                  className="cultivars__filter-select cultivars__filter-select--sm"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {CULTIVAR_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cultivars__filter-group">
                <label htmlFor="filter-technology" className="cultivars__filter-label">
                  Tecnologia
                </label>
                <input
                  id="filter-technology"
                  type="text"
                  className="cultivars__filter-input"
                  placeholder="Ex: RR, IPRO, Bt..."
                  value={technologyFilter}
                  onChange={(e) => {
                    setTechnologyFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="cultivars__btn cultivars__btn--ghost cultivars__btn--clear-filters"
                  onClick={handleClearFilters}
                >
                  <X size={16} aria-hidden="true" />
                  Limpar filtros
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="cultivars__error" role="alert" aria-live="polite">
              <AlertCircle aria-hidden="true" size={16} />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="cultivars__skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="cultivars__skeleton cultivars__skeleton--card" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {filteredCultivars.length === 0 && !isLoading && !error ? (
            <div className="cultivars__empty">
              <Sprout size={64} aria-hidden="true" />
              <h2 className="cultivars__empty-title">
                {activeFilterCount > 0
                  ? 'Nenhuma cultivar encontrada com esses filtros'
                  : 'Nenhuma cultivar cadastrada'}
              </h2>
              <p className="cultivars__empty-desc">
                {activeFilterCount > 0
                  ? 'Tente ajustar ou limpar os filtros para ver mais resultados.'
                  : 'Cadastre cultivares com características técnicas para escolher a melhor opção para cada talhão e condição.'}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="cultivars__btn cultivars__btn--ghost"
                  onClick={handleClearFilters}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : null}

          {/* Cards grid */}
          {filteredCultivars.length > 0 && !isLoading && (
            <div className="cultivars__grid">
              {filteredCultivars.map((cultivar) => (
                <div
                  key={cultivar.id}
                  className="cultivars__card"
                  onClick={() => handleCardClick(cultivar)}
                  onKeyDown={(e) => handleCardKeyDown(e, cultivar)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes da cultivar ${cultivar.name}`}
                >
                  <div className="cultivars__card-header">
                    <h3 className="cultivars__card-name">{cultivar.name}</h3>
                    <span className="cultivars__badge cultivars__badge--crop">{cultivar.crop}</span>
                  </div>

                  <div className="cultivars__card-details">
                    {cultivar.breeder && (
                      <span className="cultivars__card-detail">
                        <span className="cultivars__card-detail-label">Obtentora:</span>
                        {cultivar.breeder}
                      </span>
                    )}
                    {cultivar.cycleDays && (
                      <span className="cultivars__card-detail">
                        <Clock size={14} aria-hidden="true" />
                        {cultivar.cycleDays} dias
                      </span>
                    )}
                    {cultivar.regionalAptitude && (
                      <span className="cultivars__card-detail">
                        <MapPin size={14} aria-hidden="true" />
                        {cultivar.regionalAptitude}
                      </span>
                    )}
                  </div>

                  <div className="cultivars__card-badges">
                    <span className="cultivars__badge cultivars__badge--type">
                      {cultivar.type === 'TRANSGENICO' ? 'Transgênico' : 'Convencional'}
                    </span>
                    {cultivar.technology && (
                      <span className="cultivars__badge cultivars__badge--type">
                        {cultivar.technology}
                      </span>
                    )}
                    {cultivar.maturationGroup && (
                      <span className="cultivars__badge cultivars__badge--type">
                        GM {cultivar.maturationGroup}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="cultivars__pagination" aria-label="Paginação de cultivares">
              <button
                type="button"
                className="cultivars__btn cultivars__btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span className="cultivars__pagination-info">
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="cultivars__btn cultivars__btn--ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </div>
      )}

      {/* Tab: Produtividade (CA4/CA8) */}
      {activeTab === 'produtividade' && (
        <div role="tabpanel" aria-label="Comparativo de produtividade">
          <Suspense
            fallback={
              <div className="cultivars__skeleton-grid">
                <div className="cultivars__skeleton" style={{ height: 240 }} />
              </div>
            }
          >
            <CultivarProductivity />
          </Suspense>
        </div>
      )}

      {/* Tab: Histórico por Talhão (CA3/CA9) */}
      {activeTab === 'historico' && (
        <div role="tabpanel" aria-label="Histórico de cultivares por talhão">
          <Suspense
            fallback={
              <div className="cultivars__skeleton-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="cultivars__skeleton" style={{ height: 56 }} />
                ))}
              </div>
            }
          >
            <CultivarPlotHistory />
          </Suspense>
        </div>
      )}

      {/* Modal */}
      <CultivarModal
        isOpen={showModal}
        cultivar={selectedCultivar}
        onClose={() => {
          setShowModal(false);
          setSelectedCultivar(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default CultivarsPage;
