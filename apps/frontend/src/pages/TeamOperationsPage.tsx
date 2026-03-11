import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  ClipboardList,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Clock,
  UsersRound,
  MapPin,
  DollarSign,
  BarChart3,
  TrendingUp,
  FilterX,
  Download,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useTeamOperations } from '@/hooks/useTeamOperations';
import { api } from '@/services/api';
import PermissionGate from '@/components/auth/PermissionGate';
import TeamOperationModal from '@/components/team-operations/TeamOperationModal';
import TeamOperationDetailModal from '@/components/team-operations/TeamOperationDetailModal';
import { TEAM_OPERATION_TYPES } from '@/types/team-operation';
import type { TeamOperationItem } from '@/types/team-operation';
import type { FieldPlot } from '@/types/farm';
import type { FieldTeamItem } from '@/types/field-team';
import './TeamOperationsPage.css';

const CostByPlotTab = lazy(() => import('@/components/team-operations/CostByPlotTab'));
const TimesheetTab = lazy(() => import('@/components/team-operations/TimesheetTab'));
const ProductivityRankingTab = lazy(
  () => import('@/components/team-operations/ProductivityRankingTab'),
);
const BonificationTab = lazy(() => import('@/components/team-operations/BonificationTab'));

type TabId = 'operations' | 'productivity' | 'bonification' | 'cost-by-plot' | 'timesheet';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'operations', label: 'Operações' },
  { id: 'productivity', label: 'Produtividade' },
  { id: 'bonification', label: 'Bonificação' },
  { id: 'cost-by-plot', label: 'Custo por talhão' },
  { id: 'timesheet', label: 'Espelho de ponto' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TabSkeleton() {
  return (
    <div className="team-ops__skeleton-grid">
      {[1, 2, 3].map((i) => (
        <div key={i} className="team-ops__skeleton team-ops__skeleton--card" />
      ))}
    </div>
  );
}

function TeamOperationsPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [activeTab, setActiveTab] = useState<TabId>('operations');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [plotFilter, setPlotFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOp, setSelectedOp] = useState<TeamOperationItem | null>(null);

  // Filter options data
  const [filterTeams, setFilterTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [filterPlots, setFilterPlots] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    api
      .get<{ data: FieldTeamItem[] }>(`/org/farms/${selectedFarmId}/field-teams?limit=200`)
      .then((result) => {
        if (!cancelled) {
          setFilterTeams(result.data.map((t) => ({ id: t.id, name: t.name })));
        }
      })
      .catch(() => {});
    api
      .get<FieldPlot[]>(`/org/farms/${selectedFarmId}/plots`)
      .then((result) => {
        if (!cancelled) setFilterPlots(result.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedFarmId]);

  const hasFilters = typeFilter || teamFilter || plotFilter || dateFrom || dateTo;

  const clearFilters = useCallback(() => {
    setTypeFilter('');
    setTeamFilter('');
    setPlotFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!selectedFarmId) return;
    setIsExporting(true);
    try {
      const query = new URLSearchParams();
      if (typeFilter) query.set('operationType', typeFilter);
      if (teamFilter) query.set('teamId', teamFilter);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      const qs = query.toString();
      const blob = await api.getBlob(
        `/org/farms/${selectedFarmId}/team-operations/export${qs ? `?${qs}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operacoes-bloco-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — user can retry
    } finally {
      setIsExporting(false);
    }
  }, [selectedFarmId, typeFilter, teamFilter, dateFrom, dateTo]);

  const { operations, meta, isLoading, error, refetch } = useTeamOperations({
    farmId: selectedFarmId,
    page,
    operationType: typeFilter || undefined,
    teamId: teamFilter || undefined,
    fieldPlotId: plotFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedOp(null);
    void refetch();
  }, [refetch]);

  const handleCardClick = useCallback((op: TeamOperationItem) => {
    setSelectedOp(op);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, op: TeamOperationItem) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCardClick(op);
      }
    },
    [handleCardClick],
  );

  if (!selectedFarmId) {
    return (
      <section className="team-ops">
        <div className="team-ops__empty">
          <ClipboardList size={64} aria-hidden="true" />
          <h2 className="team-ops__empty-title">Selecione uma fazenda</h2>
          <p className="team-ops__empty-desc">
            Escolha uma fazenda no seletor acima para ver as operações em bloco.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="team-ops">
      <div className="team-ops__header">
        <div className="team-ops__header-text">
          <h1 className="team-ops__title">Operações em bloco</h1>
          <p className="team-ops__subtitle">
            Operações de equipe em {selectedFarm?.name ?? 'fazenda selecionada'}
          </p>
        </div>
        <div className="team-ops__header-actions">
          <button
            type="button"
            className="team-ops__btn team-ops__btn--ghost"
            onClick={handleExport}
            disabled={isExporting}
            aria-label="Exportar operações para Excel"
          >
            <Download size={20} aria-hidden="true" />
            {isExporting ? 'Exportando…' : 'Exportar'}
          </button>
          <PermissionGate permission="farms:update">
            <button
              type="button"
              className="team-ops__btn team-ops__btn--primary"
              onClick={() => setShowModal(true)}
            >
              <Plus size={20} aria-hidden="true" />
              Nova operação
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Tabs */}
      <nav className="team-ops__tabs" aria-label="Seções de operações em bloco">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`team-ops__tab ${activeTab === tab.id ? 'team-ops__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.id === 'operations' && <ClipboardList size={16} aria-hidden="true" />}
            {tab.id === 'productivity' && <TrendingUp size={16} aria-hidden="true" />}
            {tab.id === 'bonification' && <DollarSign size={16} aria-hidden="true" />}
            {tab.id === 'cost-by-plot' && <BarChart3 size={16} aria-hidden="true" />}
            {tab.id === 'timesheet' && <Clock size={16} aria-hidden="true" />}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'operations' && (
        <>
          {/* Toolbar */}
          <div className="team-ops__toolbar">
            <select
              className="team-ops__filter-select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por tipo de operação"
            >
              <option value="">Todos os tipos</option>
              {TEAM_OPERATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              className="team-ops__filter-select"
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por equipe"
            >
              <option value="">Todas as equipes</option>
              {filterTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              className="team-ops__filter-select"
              value={plotFilter}
              onChange={(e) => {
                setPlotFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por talhão"
            >
              <option value="">Todos os talhões</option>
              {filterPlots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="team-ops__filter-date-group">
              <label htmlFor="filter-date-from" className="team-ops__filter-date-label">
                De
              </label>
              <input
                id="filter-date-from"
                type="date"
                className="team-ops__filter-date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="team-ops__filter-date-group">
              <label htmlFor="filter-date-to" className="team-ops__filter-date-label">
                Até
              </label>
              <input
                id="filter-date-to"
                type="date"
                className="team-ops__filter-date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                className="team-ops__btn team-ops__btn--ghost"
                onClick={clearFilters}
                aria-label="Limpar filtros"
              >
                <FilterX size={16} aria-hidden="true" />
                Limpar
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="team-ops__error" role="alert" aria-live="polite">
              <AlertCircle aria-hidden="true" size={16} />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="team-ops__skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="team-ops__skeleton team-ops__skeleton--card" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {operations.length === 0 && !isLoading && !error ? (
            <div className="team-ops__empty">
              <ClipboardList size={64} aria-hidden="true" />
              <h2 className="team-ops__empty-title">Nenhuma operação registrada</h2>
              <p className="team-ops__empty-desc">
                Registre operações em bloco para apontar atividades de uma equipe inteira de uma
                vez.
              </p>
            </div>
          ) : null}

          {/* Cards grid */}
          {operations.length > 0 && !isLoading && (
            <div className="team-ops__grid">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className="team-ops__card"
                  onClick={() => handleCardClick(op)}
                  onKeyDown={(e) => handleCardKeyDown(e, op)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes da operação ${op.operationTypeLabel} em ${op.fieldPlotName}`}
                >
                  <div className="team-ops__card-header">
                    <h3 className="team-ops__card-name">{op.operationTypeLabel}</h3>
                    <span className="team-ops__badge team-ops__badge--type">
                      {op.entryCount} {op.entryCount === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>

                  <div className="team-ops__card-details">
                    <span className="team-ops__card-detail">
                      <MapPin size={14} aria-hidden="true" />
                      {op.fieldPlotName}
                    </span>
                    <span className="team-ops__card-detail">
                      <UsersRound size={14} aria-hidden="true" />
                      {op.teamName}
                    </span>
                    <span className="team-ops__card-detail">
                      <Calendar size={14} aria-hidden="true" />
                      {formatDate(op.performedAt)}
                    </span>
                    <span className="team-ops__card-detail">
                      <Clock size={14} aria-hidden="true" />
                      {formatTime(op.timeStart)} — {formatTime(op.timeEnd)} ({op.durationHours}h)
                    </span>
                    {op.totalProductivity != null && op.productivityUnit && (
                      <span className="team-ops__card-detail">
                        <TrendingUp size={14} aria-hidden="true" />
                        Produção: {op.totalProductivity.toLocaleString('pt-BR')}{' '}
                        {op.productivityUnit}
                      </span>
                    )}
                    {op.totalLaborCost != null && (
                      <span className="team-ops__card-detail">
                        <DollarSign size={14} aria-hidden="true" />
                        Custo MO: {formatCurrency(op.totalLaborCost)}
                      </span>
                    )}
                  </div>

                  {op.notes && <p className="team-ops__card-notes">{op.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Detail modal */}
          {selectedOp && (
            <TeamOperationDetailModal
              operation={selectedOp}
              onClose={() => setSelectedOp(null)}
              onUpdated={(updated) => {
                setSelectedOp(updated);
                void refetch();
              }}
              onDeleted={() => {
                setSelectedOp(null);
                void refetch();
              }}
            />
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="team-ops__pagination" aria-label="Paginação de operações">
              <button
                type="button"
                className="team-ops__btn team-ops__btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span className="team-ops__pagination-info">
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                type="button"
                className="team-ops__btn team-ops__btn--ghost"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </nav>
          )}
        </>
      )}

      {activeTab === 'productivity' && (
        <Suspense fallback={<TabSkeleton />}>
          <ProductivityRankingTab />
        </Suspense>
      )}

      {activeTab === 'bonification' && (
        <Suspense fallback={<TabSkeleton />}>
          <BonificationTab />
        </Suspense>
      )}

      {activeTab === 'cost-by-plot' && (
        <Suspense fallback={<TabSkeleton />}>
          <CostByPlotTab />
        </Suspense>
      )}

      {activeTab === 'timesheet' && (
        <Suspense fallback={<TabSkeleton />}>
          <TimesheetTab />
        </Suspense>
      )}

      {/* Modal */}
      <TeamOperationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

export default TeamOperationsPage;
