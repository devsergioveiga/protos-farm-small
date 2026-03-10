import { useState, useRef, useCallback } from 'react';
import {
  Tractor,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Clock,
  Settings2,
  Droplets,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useSoilPrepOperations } from '@/hooks/useSoilPrepOperations';
import PermissionGate from '@/components/auth/PermissionGate';
import SoilPrepModal from '@/components/soil-prep/SoilPrepModal';
import type { SoilPrepItem } from '@/types/soil-prep';
import './SoilPrepPage.css';

function SoilPrepPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<SoilPrepItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { operations, meta, isLoading, error, refetch } = useSoilPrepOperations({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
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

  const handleCardClick = useCallback((op: SoilPrepItem) => {
    setSelectedOperation(op);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, op: SoilPrepItem) => {
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
      <section className="soil-prep">
        <div className="soil-prep__empty">
          <Tractor size={64} aria-hidden="true" />
          <h2 className="soil-prep__empty-title">Selecione uma fazenda</h2>
          <p className="soil-prep__empty-desc">
            Escolha uma fazenda no seletor acima para ver as operações de preparo de solo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="soil-prep">
      <div className="soil-prep__header">
        <div>
          <h1 className="soil-prep__title">Preparo de solo</h1>
          <p className="soil-prep__subtitle">
            Operações de preparo em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="soil-prep__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="soil-prep__btn soil-prep__btn--primary"
              onClick={handleNewOperation}
            >
              <Plus size={20} aria-hidden="true" />
              Nova operação
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="soil-prep__toolbar">
        <div className="soil-prep__search-wrapper">
          <Search size={16} aria-hidden="true" className="soil-prep__search-icon" />
          <input
            type="search"
            className="soil-prep__search"
            placeholder="Buscar por tipo, máquina, operador..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar operações de preparo"
          />
        </div>
      </div>

      {error && (
        <div className="soil-prep__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="soil-prep__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="soil-prep__skeleton soil-prep__skeleton--card" />
          ))}
        </div>
      )}

      {operations.length === 0 && !isLoading && !error ? (
        <div className="soil-prep__empty">
          <Tractor size={64} aria-hidden="true" />
          <h2 className="soil-prep__empty-title">Nenhuma operação registrada</h2>
          <p className="soil-prep__empty-desc">
            Registre operações de preparo de solo como aração, gradagem, calagem e subsolagem para
            rastrear o histórico de cada talhão.
          </p>
        </div>
      ) : null}

      {operations.length > 0 && !isLoading && (
        <div className="soil-prep__grid">
          {operations.map((op) => (
            <div
              key={op.id}
              className="soil-prep__card"
              onClick={() => handleCardClick(op)}
              onKeyDown={(e) => handleCardKeyDown(e, op)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes de ${op.operationTypeName} em ${op.fieldPlotName}`}
            >
              <div className="soil-prep__card-header">
                <h3 className="soil-prep__card-name">{op.operationTypeName}</h3>
                <span className="soil-prep__badge soil-prep__badge--type">
                  {op.operationTypeName}
                </span>
              </div>

              <div className="soil-prep__card-details">
                <span className="soil-prep__card-detail">
                  <span className="soil-prep__card-detail-label">Talhão:</span>
                  {op.fieldPlotName}
                </span>
                <span className="soil-prep__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(op.startedAt)}
                </span>
                {op.durationHours != null && (
                  <span className="soil-prep__card-detail">
                    <Clock size={14} aria-hidden="true" />
                    {op.durationHours}h
                  </span>
                )}
                {op.depthCm != null && (
                  <span className="soil-prep__card-detail">
                    <span className="soil-prep__card-detail-label">Prof.:</span>
                    {op.depthCm} cm
                  </span>
                )}
              </div>

              {op.machineName && (
                <div className="soil-prep__card-extra">
                  <Settings2 size={14} aria-hidden="true" />
                  <span>
                    {op.machineName}
                    {op.implementName ? ` + ${op.implementName}` : ''}
                  </span>
                </div>
              )}

              {op.soilMoisturePercent != null && (
                <div className="soil-prep__card-extra">
                  <Droplets size={14} aria-hidden="true" />
                  <span>Umidade: {op.soilMoisturePercent}%</span>
                </div>
              )}

              <div className="soil-prep__card-badges">
                {op.weatherConditionLabel && (
                  <span className="soil-prep__badge soil-prep__badge--weather">
                    {op.weatherConditionLabel}
                  </span>
                )}
                {op.inputs.length > 0 && (
                  <span className="soil-prep__badge soil-prep__badge--weather">
                    {op.inputs.length} insumo{op.inputs.length > 1 ? 's' : ''}
                  </span>
                )}
                {op.totalCost != null && (
                  <span className="soil-prep__badge soil-prep__badge--cost">
                    {formatCurrency(op.totalCost)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="soil-prep__pagination" aria-label="Paginação de operações">
          <button
            type="button"
            className="soil-prep__btn soil-prep__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="soil-prep__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="soil-prep__btn soil-prep__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      <SoilPrepModal
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

export default SoilPrepPage;
