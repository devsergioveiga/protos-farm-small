import { useState, useRef, useCallback } from 'react';
import { Bug, Plus, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { usePests } from '@/hooks/usePests';
import PermissionGate from '@/components/auth/PermissionGate';
import PestModal from '@/components/pests/PestModal';
import { PEST_CATEGORIES } from '@/types/pest';
import type { PestItem } from '@/types/pest';
import './PestsPage.css';

function PestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPest, setSelectedPest] = useState<PestItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { pests, meta, isLoading, error, refetch } = usePests({
    page,
    search: search || undefined,
    category: categoryFilter || undefined,
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
    setSelectedPest(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((pest: PestItem) => {
    setSelectedPest(pest);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, pest: PestItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(pest);
      }
    },
    [handleCardClick],
  );

  const handleNewPest = useCallback(() => {
    setSelectedPest(null);
    setShowModal(true);
  }, []);

  const severityColor = (sev: string | null) => {
    if (!sev) return '';
    const map: Record<string, string> = {
      BAIXO: 'pests__badge--low',
      MEDIO: 'pests__badge--medium',
      ALTO: 'pests__badge--high',
      CRITICO: 'pests__badge--critical',
    };
    return map[sev] ?? '';
  };

  return (
    <section className="pests">
      <div className="pests__header">
        <div className="pests__header-text">
          <h1 className="pests__title">Biblioteca de Pragas e Doenças</h1>
          <p className="pests__subtitle">Catálogo MIP com níveis de controle e dano econômico</p>
        </div>
        <div className="pests__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="pests__btn pests__btn--primary"
              onClick={handleNewPest}
            >
              <Plus size={20} aria-hidden="true" />
              Nova praga/doença
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pests__toolbar">
        <div className="pests__search-wrapper">
          <Search size={16} aria-hidden="true" className="pests__search-icon" />
          <input
            type="search"
            className="pests__search"
            placeholder="Buscar por nome popular ou científico..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar pragas e doenças"
          />
        </div>
        <select
          className="pests__filter-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas categorias</option>
          {PEST_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="pests__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="pests__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pests__card pests__card--skeleton">
              <div className="pests__skeleton-line pests__skeleton-line--title" />
              <div className="pests__skeleton-line" />
              <div className="pests__skeleton-line pests__skeleton-line--short" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && pests.length === 0 && (
        <div className="pests__empty">
          <Bug size={48} aria-hidden="true" className="pests__empty-icon" />
          <h2 className="pests__empty-title">
            {search || categoryFilter
              ? 'Nenhuma praga encontrada com esses filtros'
              : 'Nenhuma praga cadastrada ainda'}
          </h2>
          <p className="pests__empty-desc">
            {search || categoryFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Cadastre pragas e doenças para usar no monitoramento MIP.'}
          </p>
          {!search && !categoryFilter && (
            <PermissionGate permission="farms:update">
              <button
                type="button"
                className="pests__btn pests__btn--primary"
                onClick={handleNewPest}
              >
                <Plus size={20} aria-hidden="true" />
                Cadastrar primeira praga
              </button>
            </PermissionGate>
          )}
        </div>
      )}

      {/* Grid */}
      {!isLoading && !error && pests.length > 0 && (
        <>
          <div className="pests__grid">
            {pests.map((pest) => (
              <div
                key={pest.id}
                className="pests__card"
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(pest)}
                onKeyDown={(e) => handleCardKeyDown(e, pest)}
              >
                <div className="pests__card-header">
                  <span className="pests__card-category">{pest.categoryLabel}</span>
                  {pest.severityLabel && (
                    <span className={`pests__badge ${severityColor(pest.severity)}`}>
                      {pest.severityLabel}
                    </span>
                  )}
                </div>
                <h3 className="pests__card-name">{pest.commonName}</h3>
                {pest.scientificName && (
                  <p className="pests__card-scientific">{pest.scientificName}</p>
                )}
                {pest.affectedCrops.length > 0 && (
                  <div className="pests__card-crops">
                    {pest.affectedCrops.map((crop) => (
                      <span key={crop} className="pests__crop-tag">
                        {crop}
                      </span>
                    ))}
                  </div>
                )}
                {pest.ncDescription && (
                  <p className="pests__card-nc">
                    <strong>NC:</strong> {pest.ncDescription}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="pests__pagination" aria-label="Paginação">
              <button
                type="button"
                className="pests__btn pests__btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span className="pests__page-info">
                {page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="pests__btn pests__btn--ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      <PestModal
        isOpen={showModal}
        pest={selectedPest}
        onClose={() => {
          setShowModal(false);
          setSelectedPest(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default PestsPage;
