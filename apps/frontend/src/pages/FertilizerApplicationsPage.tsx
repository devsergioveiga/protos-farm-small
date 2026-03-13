import { useState, useRef, useCallback } from 'react';
import {
  Droplet,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Droplets,
  Settings2,
  Download,
  BarChart3,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useFertilizerApplications } from '@/hooks/useFertilizerApplications';
import { useFertilizerNutrientSummary } from '@/hooks/useFertilizerNutrientSummary';
import PermissionGate from '@/components/auth/PermissionGate';
import FertilizerApplicationModal from '@/components/fertilizer-applications/FertilizerApplicationModal';
import {
  FERTILIZER_APPLICATION_TYPES,
  APPLICATION_TYPE_LABELS,
  DOSE_UNIT_LABELS,
} from '@/types/fertilizer-application';
import type { FertilizerApplicationItem } from '@/types/fertilizer-application';
import { getBaseUnit, formatQuantity } from '@/utils/dose-conversion';
import './FertilizerApplicationsPage.css';

function FertilizerApplicationsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<FertilizerApplicationItem | null>(
    null,
  );

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { applications, meta, isLoading, error, refetch } = useFertilizerApplications({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    applicationType: typeFilter || undefined,
  });

  const { summary } = useFertilizerNutrientSummary(selectedFarmId);

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
    setSelectedApplication(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((app: FertilizerApplicationItem) => {
    setSelectedApplication(app);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, app: FertilizerApplicationItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(app);
      }
    },
    [handleCardClick],
  );

  const handleExportCsv = useCallback(() => {
    if (!selectedFarmId) return;
    const query = new URLSearchParams();
    if (search) query.set('productName', search);
    if (typeFilter) query.set('applicationType', typeFilter);
    const qs = query.toString();
    const url = `/api/org/farms/${selectedFarmId}/fertilizer-applications/report/export${qs ? `?${qs}` : ''}`;
    window.open(url, '_blank');
  }, [selectedFarmId, search, typeFilter]);

  const handleNewApplication = useCallback(() => {
    setSelectedApplication(null);
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

  if (!selectedFarmId) {
    return (
      <section className="fertilizers">
        <div className="fertilizers__empty">
          <Droplet size={64} aria-hidden="true" />
          <h2 className="fertilizers__empty-title">Selecione uma fazenda</h2>
          <p className="fertilizers__empty-desc">
            Escolha uma fazenda no seletor acima para ver as aplicações de adubação.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="fertilizers">
      <div className="fertilizers__header">
        <div className="fertilizers__header-text">
          <h1 className="fertilizers__title">Adubação</h1>
          <p className="fertilizers__subtitle">
            Registro de adubação de cobertura e foliar em{' '}
            {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="fertilizers__header-actions">
          <button
            type="button"
            className="fertilizers__btn fertilizers__btn--ghost"
            onClick={handleExportCsv}
            aria-label="Exportar relatório CSV"
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="fertilizers__btn fertilizers__btn--primary"
              onClick={handleNewApplication}
            >
              <Plus size={20} aria-hidden="true" />
              Nova adubação
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="fertilizers__toolbar">
        <div className="fertilizers__search-wrapper">
          <Search size={16} aria-hidden="true" className="fertilizers__search-icon" />
          <input
            type="search"
            className="fertilizers__search"
            placeholder="Buscar por produto ou fonte..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar aplicações"
          />
        </div>
        <select
          className="fertilizers__filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de aplicação"
        >
          <option value="">Todos os tipos</option>
          {FERTILIZER_APPLICATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="fertilizers__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Nutrient Summary */}
      {summary.length > 0 && (
        <div className="fertilizers__summary">
          <div className="fertilizers__summary-header">
            <h2 className="fertilizers__summary-title">
              <BarChart3
                size={16}
                aria-hidden="true"
                style={{ marginRight: 8, verticalAlign: 'middle' }}
              />
              Acumulado de nutrientes por talhão
            </h2>
            <button
              type="button"
              className="fertilizers__summary-toggle"
              onClick={() => setShowSummary((v) => !v)}
            >
              {showSummary ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {showSummary && (
            <table className="fertilizers__summary-table">
              <thead>
                <tr>
                  <th scope="col">Talhão</th>
                  <th scope="col">N (kg/ha)</th>
                  <th scope="col">P2O5 (kg/ha)</th>
                  <th scope="col">K2O (kg/ha)</th>
                  <th scope="col">Aplicações</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.fieldPlotId}>
                    <td>{s.fieldPlotName}</td>
                    <td>{s.totalN.toFixed(1)}</td>
                    <td>{s.totalP.toFixed(1)}</td>
                    <td>{s.totalK.toFixed(1)}</td>
                    <td>{s.applicationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="fertilizers__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="fertilizers__skeleton fertilizers__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {applications.length === 0 && !isLoading && !error ? (
        <div className="fertilizers__empty">
          <Droplet size={64} aria-hidden="true" />
          <h2 className="fertilizers__empty-title">Nenhuma adubação registrada</h2>
          <p className="fertilizers__empty-desc">
            Registre aplicações de adubação de cobertura e foliar com produto, dose e nutrientes
            para acompanhar a nutrição da lavoura.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {applications.length > 0 && !isLoading && (
        <div className="fertilizers__grid">
          {applications.map((app) => (
            <div
              key={app.id}
              className="fertilizers__card"
              onClick={() => handleCardClick(app)}
              onKeyDown={(e) => handleCardKeyDown(e, app)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da adubação de ${app.productName} em ${app.fieldPlotName}`}
            >
              <div className="fertilizers__card-header">
                <h3 className="fertilizers__card-name">{app.productName}</h3>
                <span className="fertilizers__badge fertilizers__badge--type">
                  {APPLICATION_TYPE_LABELS[app.applicationType] ?? app.applicationType}
                </span>
              </div>

              <div className="fertilizers__card-details">
                {app.formulation && (
                  <span className="fertilizers__card-detail">
                    <span className="fertilizers__card-detail-label">Formulação:</span>
                    {app.formulation}
                  </span>
                )}
                <span className="fertilizers__card-detail">
                  <span className="fertilizers__card-detail-label">Talhão:</span>
                  {app.fieldPlotName}
                </span>
                <span className="fertilizers__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(app.appliedAt)}
                </span>
                <span className="fertilizers__card-detail">
                  <Droplets size={14} aria-hidden="true" />
                  {app.dose} {DOSE_UNIT_LABELS[app.doseUnit] ?? app.doseUnit}
                  {app.totalQuantityUsed != null && (
                    <span className="fertilizers__card-conversion">
                      {' '}
                      &rarr; {formatQuantity(app.totalQuantityUsed)} {getBaseUnit(app.doseUnit)}
                    </span>
                  )}
                </span>
              </div>

              {(app.nitrogenN != null || app.phosphorusP != null || app.potassiumK != null) && (
                <div className="fertilizers__card-nutrients">
                  {app.nitrogenN != null && (
                    <span className="fertilizers__card-nutrient">
                      <span className="fertilizers__card-nutrient-label">N:</span>
                      {app.nitrogenN}
                    </span>
                  )}
                  {app.phosphorusP != null && (
                    <span className="fertilizers__card-nutrient">
                      <span className="fertilizers__card-nutrient-label">P:</span>
                      {app.phosphorusP}
                    </span>
                  )}
                  {app.potassiumK != null && (
                    <span className="fertilizers__card-nutrient">
                      <span className="fertilizers__card-nutrient-label">K:</span>
                      {app.potassiumK}
                    </span>
                  )}
                </div>
              )}

              {(app.machineName || app.operatorName) && (
                <div className="fertilizers__card-equipment">
                  <Settings2 size={14} aria-hidden="true" />
                  {app.machineName && <span>{app.machineName}</span>}
                  {app.operatorName && <span>— {app.operatorName}</span>}
                </div>
              )}

              {(app.nutrientSource || app.phenologicalStage) && (
                <div className="fertilizers__card-badges">
                  {app.nutrientSource && (
                    <span className="fertilizers__badge fertilizers__badge--nutrient">
                      {app.nutrientSource}
                    </span>
                  )}
                  {app.phenologicalStage && (
                    <span className="fertilizers__badge fertilizers__badge--nutrient">
                      {app.phenologicalStage}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="fertilizers__pagination" aria-label="Paginação de adubações">
          <button
            type="button"
            className="fertilizers__btn fertilizers__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="fertilizers__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="fertilizers__btn fertilizers__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <FertilizerApplicationModal
        isOpen={showModal}
        application={selectedApplication}
        onClose={() => {
          setShowModal(false);
          setSelectedApplication(null);
        }}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default FertilizerApplicationsPage;
