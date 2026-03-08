import { useState, useRef, useCallback } from 'react';
import {
  SprayCan,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Droplets,
  Thermometer,
  Settings2,
  FlaskConical,
  ShieldAlert,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { usePesticideApplications } from '@/hooks/usePesticideApplications';
import { useWithdrawalAlerts } from '@/hooks/useWithdrawalAlerts';
import PermissionGate from '@/components/auth/PermissionGate';
import PesticideApplicationModal from '@/components/pesticide-applications/PesticideApplicationModal';
import {
  PESTICIDE_TARGETS,
  TARGET_LABELS,
  DOSE_UNIT_LABELS,
  SPRAYER_TYPES,
  NOZZLE_TYPES,
} from '@/types/pesticide-application';
import type { PesticideApplicationItem } from '@/types/pesticide-application';
import './PesticideApplicationsPage.css';

function PesticideApplicationsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<PesticideApplicationItem | null>(
    null,
  );

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { alerts } = useWithdrawalAlerts(selectedFarmId);

  const activeWithdrawalIds = new Set(alerts.map((a) => a.applicationId));

  const { applications, meta, isLoading, error, refetch } = usePesticideApplications({
    farmId: selectedFarmId,
    page,
    search: search || undefined,
    target: targetFilter || undefined,
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
    setSelectedApplication(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((app: PesticideApplicationItem) => {
    setSelectedApplication(app);
    setShowModal(true);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, app: PesticideApplicationItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(app);
      }
    },
    [handleCardClick],
  );

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

  const hasInadequateConditions = (app: PesticideApplicationItem) =>
    (app.temperature != null && app.temperature > 30) ||
    (app.relativeHumidity != null && app.relativeHumidity < 55) ||
    (app.windSpeed != null && app.windSpeed > 10);

  if (!selectedFarmId) {
    return (
      <section className="pesticides">
        <div className="pesticides__empty">
          <SprayCan size={64} aria-hidden="true" />
          <h2 className="pesticides__empty-title">Selecione uma fazenda</h2>
          <p className="pesticides__empty-desc">
            Escolha uma fazenda no seletor acima para ver as aplicações de defensivos.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pesticides">
      <div className="pesticides__header">
        <div className="pesticides__header-text">
          <h1 className="pesticides__title">Aplicações de defensivos</h1>
          <p className="pesticides__subtitle">
            Registro de aplicações em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="pesticides__header-actions">
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="pesticides__btn pesticides__btn--primary"
              onClick={handleNewApplication}
            >
              <Plus size={20} aria-hidden="true" />
              Nova aplicação
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pesticides__toolbar">
        <div className="pesticides__search-wrapper">
          <Search size={16} aria-hidden="true" className="pesticides__search-icon" />
          <input
            type="search"
            className="pesticides__search"
            placeholder="Buscar por produto ou ingrediente..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Buscar aplicações"
          />
        </div>
        <select
          className="pesticides__filter-select"
          value={targetFilter}
          onChange={(e) => {
            setTargetFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por tipo de alvo"
        >
          <option value="">Todos os alvos</option>
          {PESTICIDE_TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="pesticides__error" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </div>
      )}

      {/* Withdrawal alerts */}
      {alerts.length > 0 && (
        <div className="pesticides__withdrawal-banner" role="alert" aria-live="polite">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>
              {alerts.length} {alerts.length === 1 ? 'talhão em' : 'talhões em'} período de carência
            </strong>
            <ul className="pesticides__withdrawal-list">
              {alerts.map((a) => (
                <li key={a.applicationId}>
                  <strong>{a.fieldPlotName}</strong> — {a.productName} ({a.daysRemaining}{' '}
                  {a.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}, colheita a partir de{' '}
                  {new Date(a.safeHarvestDate).toLocaleDateString('pt-BR')})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="pesticides__skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="pesticides__skeleton pesticides__skeleton--card" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {applications.length === 0 && !isLoading && !error ? (
        <div className="pesticides__empty">
          <SprayCan size={64} aria-hidden="true" />
          <h2 className="pesticides__empty-title">Nenhuma aplicação registrada</h2>
          <p className="pesticides__empty-desc">
            Registre aplicações de defensivos com produto, dose, volume de calda e alvo para
            rastreabilidade completa.
          </p>
        </div>
      ) : null}

      {/* Cards grid */}
      {applications.length > 0 && !isLoading && (
        <div className="pesticides__grid">
          {applications.map((app) => (
            <div
              key={app.id}
              className={`pesticides__card${activeWithdrawalIds.has(app.id) ? ' pesticides__card--withdrawal-active' : ''}`}
              onClick={() => handleCardClick(app)}
              onKeyDown={(e) => handleCardKeyDown(e, app)}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalhes da aplicação de ${app.productName} em ${app.fieldPlotName}`}
            >
              <div className="pesticides__card-header">
                <h3 className="pesticides__card-name">{app.productName}</h3>
                <span className="pesticides__badge pesticides__badge--target">
                  {TARGET_LABELS[app.target] ?? app.target}
                </span>
              </div>

              <div className="pesticides__card-details">
                <span className="pesticides__card-detail">
                  <span className="pesticides__card-detail-label">Ingrediente ativo:</span>
                  {app.activeIngredient}
                </span>
                <span className="pesticides__card-detail">
                  <span className="pesticides__card-detail-label">Talhão:</span>
                  {app.fieldPlotName}
                </span>
                <span className="pesticides__card-detail">
                  <Calendar size={14} aria-hidden="true" />
                  {formatDate(app.appliedAt)}
                </span>
                <span className="pesticides__card-detail">
                  <Droplets size={14} aria-hidden="true" />
                  {app.dose} {DOSE_UNIT_LABELS[app.doseUnit] ?? app.doseUnit} | Calda:{' '}
                  {app.sprayVolume} L/ha
                </span>
              </div>

              {app.artNumber && (
                <span className="pesticides__card-detail">
                  <span className="pesticides__card-detail-label">ART:</span>
                  {app.artNumber}
                </span>
              )}

              {(app.temperature != null ||
                app.relativeHumidity != null ||
                app.windSpeed != null) && (
                <div className="pesticides__card-conditions">
                  <Thermometer size={14} aria-hidden="true" />
                  {app.temperature != null && <span>{app.temperature}°C</span>}
                  {app.relativeHumidity != null && <span>{app.relativeHumidity}% UR</span>}
                  {app.windSpeed != null && <span>{app.windSpeed} km/h</span>}
                  {hasInadequateConditions(app) && (
                    <span className="pesticides__card-condition-warn" title="Condições inadequadas">
                      <AlertTriangle size={14} aria-label="Condições inadequadas" />
                    </span>
                  )}
                </div>
              )}

              {app.sprayerType && (
                <div className="pesticides__card-equipment">
                  <Settings2 size={14} aria-hidden="true" />
                  <span>
                    {SPRAYER_TYPES.find((s) => s.value === app.sprayerType)?.label ??
                      app.sprayerType}
                  </span>
                  {app.nozzleType && (
                    <span>
                      {NOZZLE_TYPES.find((n) => n.value === app.nozzleType)?.label ??
                        app.nozzleType}
                    </span>
                  )}
                </div>
              )}

              {app.safeHarvestDate && (
                <div className="pesticides__card-withdrawal">
                  <ShieldAlert size={14} aria-hidden="true" />
                  <span>
                    Carência: {app.withdrawalPeriodDays} dias — Colheita a partir de{' '}
                    {new Date(app.safeHarvestDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}

              {(app.adjuvant || app.tankMixPh != null) && (
                <div className="pesticides__card-tank-mix">
                  <FlaskConical size={14} aria-hidden="true" />
                  {app.adjuvant && <span>{app.adjuvant}</span>}
                  {app.tankMixPh != null && <span>pH {app.tankMixPh}</span>}
                </div>
              )}

              {app.targetDescription && (
                <div className="pesticides__card-badges">
                  <span className="pesticides__badge pesticides__badge--type">
                    {app.targetDescription}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="pesticides__pagination" aria-label="Paginação de aplicações">
          <button
            type="button"
            className="pesticides__btn pesticides__btn--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            Anterior
          </button>
          <span className="pesticides__pagination-info">
            Página {meta.page} de {meta.totalPages}
          </span>
          <button
            type="button"
            className="pesticides__btn pesticides__btn--ghost"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </nav>
      )}

      {/* Modal */}
      <PesticideApplicationModal
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

export default PesticideApplicationsPage;
