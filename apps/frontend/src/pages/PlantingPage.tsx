import { useState, useRef, useCallback } from 'react';
import {
  Sprout,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Tractor,
  Percent,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { usePlantingOperations } from '@/hooks/usePlantingOperations';
import PermissionGate from '@/components/auth/PermissionGate';
import PlantingModal from '@/components/planting/PlantingModal';
import type { PlantingItem } from '@/types/planting';
import './PlantingPage.css';

function PlantingPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<PlantingItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { operations, meta, isLoading, error, refetch } = usePlantingOperations({
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

  const handleCardClick = useCallback((op: PlantingItem) => {
    setSelectedOperation(op);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, op: PlantingItem) => {
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!selectedFarmId) {
    return (
      <section className="planting">
        <div className="planting__empty">
          <Sprout size={64} aria-hidden="true" />
          <h2 className="planting__empty-title">Selecione uma fazenda</h2>
          <p className="planting__empty-desc">
            Escolha uma fazenda no seletor acima para ver os registros de plantio.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="planting">
      <div className="planting__header">
        <div>
          <h1 className="planting__title">Plantio</h1>
          <p className="planting__subtitle">
            Registros de plantio em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="planting__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="planting__btn planting__btn--primary"
              onClick={handleNewOperation}
            >
              <Plus size={20} aria-hidden="true" />
              Novo plantio
            </button>
          </PermissionGate>
        </div>
      </div>

      <div className="planting__toolbar">
        <div className="planting__search-wrapper">
          <Search size={16} aria-hidden="true" className="planting__search-icon" />
          <input
            type="search"
            className="planting__search"
            placeholder="Buscar por cultura, máquina, operador..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar registros de plantio"
          />
        </div>
      </div>

      {error && (
        <div className="planting__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {isLoading && (
        <div className="planting__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="planting__skeleton planting__skeleton--card" />
          ))}
        </div>
      )}

      {operations.length === 0 && !isLoading && !error ? (
        <div className="planting__empty">
          <Sprout size={64} aria-hidden="true" />
          <h2 className="planting__empty-title">Nenhum plantio registrado</h2>
          <p className="planting__empty-desc">
            Registre operações de plantio para rastrear o que foi plantado, onde, quando e como em
            cada talhão.
          </p>
        </div>
      ) : null}

      {operations.length > 0 && !isLoading && (
        <div className="planting__grid">
          {operations.map((op) => (
            <div
              key={op.id}
              className="planting__card"
              onClick={() => handleCardClick(op)}
              onKeyDown={(e) => handleCardKeyDown(e, op)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes de plantio de ${op.crop} em ${op.fieldPlotName}`}
            >
              <div className="planting__card-header">
                <h3 className="planting__card-name">{op.crop}</h3>
                <span className="planting__badge planting__badge--type">
                  {op.seasonTypeLabel} {op.seasonYear}
                </span>
              </div>

              <div className="planting__card-details">
                <span className="planting__card-detail">
                  <span className="planting__card-detail-label">Talhão:</span>
                  {op.fieldPlotName}
                </span>
                {op.cultivarName && (
                  <span className="planting__card-detail">
                    <span className="planting__card-detail-label">Cultivar:</span>
                    {op.cultivarName}
                  </span>
                )}
                <span className="planting__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(op.plantingDate)}
                </span>
                {op.plantedAreaPercent < 100 && (
                  <span className="planting__card-detail">
                    <Percent size={14} aria-hidden="true" />
                    {op.plantedAreaPercent}% da área ({op.plantedAreaHa.toFixed(2)} ha)
                  </span>
                )}
              </div>

              {op.machineName && (
                <div className="planting__card-extra">
                  <Tractor size={14} aria-hidden="true" />
                  <span>
                    {op.machineName}
                    {op.operatorName ? ` — ${op.operatorName}` : ''}
                  </span>
                </div>
              )}

              <div className="planting__card-badges">
                {op.seedTreatments.length > 0 && (
                  <span className="planting__badge planting__badge--info">
                    {op.seedTreatments.length} trat. semente
                  </span>
                )}
                {op.baseFertilizations.length > 0 && (
                  <span className="planting__badge planting__badge--info">
                    {op.baseFertilizations.length} adubação
                  </span>
                )}
                {op.totalCost != null && (
                  <span className="planting__badge planting__badge--cost">
                    {formatCurrency(op.totalCost)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="planting__pagination" aria-label="Paginação de plantios">
          <button
            type="button"
            className="planting__btn planting__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="planting__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="planting__btn planting__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      <PlantingModal
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

export default PlantingPage;
