import { useState, useRef, useCallback } from 'react';
import {
  Citrus,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Package,
  Users,
  FileText,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useOrangeHarvests } from '@/hooks/useOrangeHarvests';
import PermissionGate from '@/components/auth/PermissionGate';
import OrangeHarvestModal from '@/components/orange-harvests/OrangeHarvestModal';
import { ORANGE_DESTINATIONS } from '@/types/orange-harvest';
import type { OrangeHarvestItem } from '@/types/orange-harvest';
import './OrangeHarvestsPage.css';

function OrangeHarvestsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedHarvest, setSelectedHarvest] = useState<OrangeHarvestItem | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { harvests, meta, isLoading, error, refetch } = useOrangeHarvests({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    destination: destFilter || undefined,
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

  const handleCardClick = useCallback((h: OrangeHarvestItem) => {
    setSelectedHarvest(h);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, h: OrangeHarvestItem) => {
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

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  if (!selectedFarmId) {
    return (
      <section className="orange-harvests">
        <div className="orange-harvests__empty">
          <Citrus size={64} aria-hidden="true" />
          <h2 className="orange-harvests__empty-title">Selecione uma fazenda</h2>
          <p className="orange-harvests__empty-desc">
            Escolha uma fazenda no seletor acima para ver as colheitas de laranja.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="orange-harvests">
      <div className="orange-harvests__header">
        <div className="orange-harvests__header-text">
          <h1 className="orange-harvests__title">Colheita de laranja</h1>
          <p className="orange-harvests__subtitle">
            Registro de colheitas em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="orange-harvests__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="orange-harvests__btn orange-harvests__btn--primary"
              onClick={handleNewHarvest}
            >
              <Plus size={20} aria-hidden="true" />
              Nova colheita
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="orange-harvests__toolbar">
        <div className="orange-harvests__search-wrapper">
          <Search size={16} aria-hidden="true" className="orange-harvests__search-icon" />
          <input
            type="search"
            className="orange-harvests__search"
            placeholder="Buscar por variedade, destino, contrato ou observações..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar colheitas"
          />
        </div>
        <select
          className="orange-harvests__filter-select"
          value={destFilter}
          onChange={(e) => {
            setDestFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por destino"
        >
          <option value="">Todos os destinos</option>
          {ORANGE_DESTINATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="orange-harvests__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="orange-harvests__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="orange-harvests__skeleton orange-harvests__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {harvests.length === 0 && !isLoading && !error ? (
        <div className="orange-harvests__empty">
          <Citrus size={64} aria-hidden="true" />
          <h2 className="orange-harvests__empty-title">Nenhuma colheita registrada</h2>
          <p className="orange-harvests__empty-desc">
            Registre colheitas de laranja com dados de produção, qualidade e destino para controle
            completo.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {harvests.length > 0 && !isLoading && (
        <div className="orange-harvests__grid">
          {harvests.map((h) => (
            <div
              key={h.id}
              className="orange-harvests__card"
              onClick={() => handleCardClick(h)}
              onKeyDown={(e) => handleCardKeyDown(e, h)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da colheita em ${h.fieldPlotName} de ${formatDate(h.harvestDate)}`}
            >
              <div className="orange-harvests__card-header">
                <h3 className="orange-harvests__card-plot">{h.fieldPlotName}</h3>
                {h.variety && (
                  <span className="orange-harvests__badge orange-harvests__badge--variety">
                    {h.variety}
                  </span>
                )}
              </div>

              <div className="orange-harvests__card-details">
                <span className="orange-harvests__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(h.harvestDate)}
                </span>
                <span className="orange-harvests__card-detail">
                  <Package size={14} aria-hidden="true" />
                  <span className="orange-harvests__card-detail-label">Caixas:</span>
                  {formatNumber(h.numberOfBoxes)} cx ({formatNumber(h.totalWeightKg)} kg)
                </span>
              </div>

              {/* CA2: Produtividade */}
              <div className="orange-harvests__card-metrics">
                {h.boxesPerTree != null && (
                  <span className="orange-harvests__card-metric">{h.boxesPerTree} cx/pé</span>
                )}
                {h.boxesPerHa != null && (
                  <span className="orange-harvests__card-metric">{h.boxesPerHa} cx/ha</span>
                )}
                {h.tonsPerHa != null && (
                  <span className="orange-harvests__card-metric">{h.tonsPerHa} t/ha</span>
                )}
              </div>

              {/* CA3: Qualidade */}
              {(h.ratioSS != null || h.refusalPct != null) && (
                <div className="orange-harvests__card-quality">
                  {h.ratioSS != null && <span>Ratio {h.ratioSS}</span>}
                  {h.acidityPct != null && <span>Acidez {h.acidityPct}%</span>}
                  {h.refusalPct != null && <span>Refugo {h.refusalPct}%</span>}
                </div>
              )}

              {/* CA5: Equipe */}
              {h.numberOfHarvesters != null && (
                <div className="orange-harvests__card-detail" style={{ marginTop: 4 }}>
                  <Users size={14} aria-hidden="true" />
                  {h.numberOfHarvesters} colhedores
                  {h.harvestersProductivity != null && (
                    <span> — {h.harvestersProductivity} cx/pessoa/dia</span>
                  )}
                </div>
              )}

              {/* CA4: Destino */}
              {h.destinationLabel && (
                <div className="orange-harvests__card-destination">
                  <span className="orange-harvests__card-detail-label">Destino:</span>
                  {h.destinationLabel}
                  {h.destinationName && ` — ${h.destinationName}`}
                </div>
              )}

              {/* CA6: Contrato */}
              {h.saleContractRef && (
                <div className="orange-harvests__card-badges">
                  <span className="orange-harvests__badge orange-harvests__badge--contract">
                    <FileText size={12} aria-hidden="true" />
                    {h.saleContractRef}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="orange-harvests__pagination" aria-label="Paginação de colheitas">
          <button
            type="button"
            className="orange-harvests__btn orange-harvests__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="orange-harvests__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="orange-harvests__btn orange-harvests__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <OrangeHarvestModal
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

export default OrangeHarvestsPage;
