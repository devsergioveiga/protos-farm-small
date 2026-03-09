import { useState, useRef, useCallback } from 'react';
import {
  Shovel,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Clock,
  Users,
  Settings2,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useCulturalOperations } from '@/hooks/useCulturalOperations';
import PermissionGate from '@/components/auth/PermissionGate';
import CulturalOperationModal from '@/components/cultural-operations/CulturalOperationModal';
import { CULTURAL_OPERATION_TYPES } from '@/types/cultural-operation';
import type { CulturalOperationItem } from '@/types/cultural-operation';
import './CulturalOperationsPage.css';

function CulturalOperationsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<CulturalOperationItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { operations, meta, isLoading, error, refetch } = useCulturalOperations({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    operationType: typeFilter || undefined,
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
    setSelectedOperation(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((op: CulturalOperationItem) => {
    setSelectedOperation(op);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, op: CulturalOperationItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(op);
      }
    },
    [handleCardClick],
  );

  const handleNewOperation = useCallback(() => {
    setSelectedOperation(null);
    setShowModal(true);
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!selectedFarmId) {
    return (
      <section className="cultural-ops">
        <div className="cultural-ops__empty">
          <Shovel size={64} aria-hidden="true" />
          <h2 className="cultural-ops__empty-title">Selecione uma fazenda</h2>
          <p className="cultural-ops__empty-desc">
            Escolha uma fazenda no seletor acima para ver as operações de trato cultural.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cultural-ops">
      <div className="cultural-ops__header">
        <div className="cultural-ops__header-text">
          <h1 className="cultural-ops__title">Tratos culturais</h1>
          <p className="cultural-ops__subtitle">
            Operações de trato cultural em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="cultural-ops__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="cultural-ops__btn cultural-ops__btn--primary"
              onClick={handleNewOperation}
            >
              <Plus size={20} aria-hidden="true" />
              Nova operação
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cultural-ops__toolbar">
        <div className="cultural-ops__search-wrapper">
          <Search size={16} aria-hidden="true" className="cultural-ops__search-icon" />
          <input
            type="search"
            className="cultural-ops__search"
            placeholder="Buscar por máquina, sistema ou notas..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar operações"
          />
        </div>
        <select
          className="cultural-ops__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de operação"
        >
          <option value="">Todos os tipos</option>
          {CULTURAL_OPERATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="cultural-ops__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="cultural-ops__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="cultural-ops__skeleton cultural-ops__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {operations.length === 0 && !isLoading && !error ? (
        <div className="cultural-ops__empty">
          <Shovel size={64} aria-hidden="true" />
          <h2 className="cultural-ops__empty-title">Nenhuma operação registrada</h2>
          <p className="cultural-ops__empty-desc">
            Registre operações como capina, roçagem, irrigação, poda e outras para rastrear todas as
            atividades nos talhões.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {operations.length > 0 && !isLoading && (
        <div className="cultural-ops__grid">
          {operations.map((op) => (
            <div
              key={op.id}
              className="cultural-ops__card"
              onClick={() => handleCardClick(op)}
              onKeyDown={(e) => handleCardKeyDown(e, op)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da operação ${op.operationTypeLabel} em ${op.fieldPlotName}`}
            >
              <div className="cultural-ops__card-header">
                <h3 className="cultural-ops__card-name">{op.operationTypeLabel}</h3>
                <span className="cultural-ops__badge cultural-ops__badge--type">
                  {op.operationTypeLabel}
                </span>
              </div>

              <div className="cultural-ops__card-details">
                <span className="cultural-ops__card-detail">
                  <span className="cultural-ops__card-detail-label">Talhão:</span>
                  {op.fieldPlotName}
                </span>
                <span className="cultural-ops__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(op.performedAt)}
                </span>
                {op.durationHours != null && (
                  <span className="cultural-ops__card-detail">
                    <Clock size={14} aria-hidden="true" />
                    {op.durationHours}h
                  </span>
                )}
              </div>

              {(op.laborCount != null || op.laborHours != null) && (
                <div className="cultural-ops__card-extra">
                  <Users size={14} aria-hidden="true" />
                  {op.laborCount != null && <span>{op.laborCount} trabalhadores</span>}
                  {op.laborHours != null && <span>({op.laborHours}h)</span>}
                </div>
              )}

              {op.machineName && (
                <div className="cultural-ops__card-extra">
                  <Settings2 size={14} aria-hidden="true" />
                  <span>{op.machineName}</span>
                </div>
              )}

              {op.totalCost != null && (
                <div className="cultural-ops__card-badges">
                  <span className="cultural-ops__badge cultural-ops__badge--cost">
                    {formatCurrency(op.totalCost)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="cultural-ops__pagination" aria-label="Paginação de operações">
          <button
            type="button"
            className="cultural-ops__btn cultural-ops__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="cultural-ops__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="cultural-ops__btn cultural-ops__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <CulturalOperationModal
        isOpen={showModal}
        operation={selectedOperation}
        onClose={() => {
          setShowModal(false);
          setSelectedOperation(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default CulturalOperationsPage;
