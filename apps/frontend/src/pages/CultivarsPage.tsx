import { useState, useRef, useCallback } from 'react';
import {
  Sprout,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { useCultivars } from '@/hooks/useCultivars';
import PermissionGate from '@/components/auth/PermissionGate';
import CultivarModal from '@/components/cultivars/CultivarModal';
import { CROP_OPTIONS } from '@/types/cultivar';
import type { CultivarItem } from '@/types/cultivar';
import './CultivarsPage.css';

function CultivarsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedCultivar, setSelectedCultivar] = useState<CultivarItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { cultivars, meta, isLoading, error, refetch } = useCultivars({
    page,
    search: search || undefined,
    crop: cropFilter || undefined,
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
      </div>

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
      {cultivars.length === 0 && !isLoading && !error ? (
        <div className="cultivars__empty">
          <Sprout size={64} aria-hidden="true" />
          <h2 className="cultivars__empty-title">Nenhuma cultivar cadastrada</h2>
          <p className="cultivars__empty-desc">
            Cadastre cultivares com características técnicas para escolher a melhor opção para cada
            talhão e condição.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {cultivars.length > 0 && !isLoading && (
        <div className="cultivars__grid">
          {cultivars.map((cultivar) => (
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
