import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { useSafetyCompliance } from '@/hooks/useSafetyCompliance';
import { SafetyKpiCard } from '@/components/shared/SafetyKpiCard';
import { ComplianceStatusBadge } from '@/components/shared/ComplianceStatusBadge';
import { useFarmContext } from '@/stores/FarmContext';
import type { EmployeeCompliance } from '@/types/safety';
import './SafetyDashboardPage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="safety-dashboard__kpi-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="safety-kpi-skeleton" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="safety-dashboard__table-skeleton" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="safety-dashboard__row-skeleton" />
      ))}
    </div>
  );
}

// ─── Count badge ─────────────────────────────────────────────────────────────

function CountBadge({ count, variant }: { count: number; variant: 'warning' | 'error' }) {
  if (count === 0) return <span className="safety-dashboard__count-badge--zero">0</span>;
  return (
    <span className={`safety-dashboard__count-badge safety-dashboard__count-badge--${variant}`}>
      {count}
    </span>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type TabKey = 'geral' | 'epis' | 'treinamentos' | 'asos';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SafetyDashboardPage() {
  const { selectedFarmId } = useFarmContext();
  const {
    summary,
    employees,
    loading,
    error,
    exportingCsv,
    exportingPdf,
    fetchSummary,
    fetchNonCompliantEmployees,
    exportCsv,
    exportPdf,
  } = useSafetyCompliance();

  const [activeTab, setActiveTab] = useState<TabKey>('geral');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pendingTypeFilter, setPendingTypeFilter] = useState<'EPI' | 'TREINAMENTO' | 'ASO' | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────

  const loadData = useCallback(() => {
    const farmId = selectedFarmId ?? undefined;
    void fetchSummary(farmId);
    void fetchNonCompliantEmployees({
      farmId,
      search: search || undefined,
      pendingType: pendingTypeFilter || undefined,
      page,
      limit: 20,
    });
  }, [selectedFarmId, search, pendingTypeFilter, page, fetchSummary, fetchNonCompliantEmployees]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Search debounce ────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  // ─── Export handlers ────────────────────────────────────────────────

  const handleExportCsv = async () => {
    try {
      await exportCsv(selectedFarmId ?? undefined);
    } catch {
      showToast('Não foi possível exportar o CSV. Tente novamente.');
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportPdf(selectedFarmId ?? undefined);
    } catch {
      showToast('Não foi possível gerar o PDF. Tente novamente.');
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // ─── Derived data for tabs ──────────────────────────────────────────

  const employeeList: EmployeeCompliance[] = employees?.data ?? [];
  const totalPages = employees?.totalPages ?? 1;

  const epiPending = employeeList.filter((e) => e.epiCompliance.pending.length > 0);
  const trainingPending = employeeList.filter((e) => e.trainingCompliance.expired.length > 0);
  const asoPending = employeeList.filter(
    (e) => e.asoCompliance.expiryStatus !== 'OK',
  );

  // Apply status filter client-side for sub-tabs
  const applyStatusFilter = (list: EmployeeCompliance[]) => {
    if (!statusFilter) return list;
    return list.filter((e) => e.overallStatus === statusFilter);
  };

  // ─── Empty state ────────────────────────────────────────────────────

  const allCompliant = summary !== null && summary.pendingCount === 0 && !loading;

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <main id="main-content" className="safety-dashboard">
      {/* Header */}
      <header className="safety-dashboard__header">
        <h1 className="safety-dashboard__title">
          <Shield size={24} aria-hidden="true" />
          Dashboard NR-31
        </h1>
      </header>

      {/* Error state */}
      {error && !loading && (
        <div className="safety-dashboard__error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="safety-dashboard__retry-btn"
            onClick={loadData}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* KPI Row */}
      {loading && !summary ? (
        <KpiSkeleton />
      ) : summary ? (
        <div className="safety-dashboard__kpi-row">
          <SafetyKpiCard label="Total colaboradores" value={summary.totalEmployees} icon={Users} />
          <SafetyKpiCard
            label="Conformes"
            value={summary.compliantCount}
            icon={ShieldCheck}
            suffix={` (${summary.compliantPercent}%)`}
            borderColor="var(--color-primary-600)"
          />
          <SafetyKpiCard
            label="Com pendências"
            value={summary.pendingCount}
            icon={ShieldAlert}
          />
          <SafetyKpiCard
            label="Vencimentos em 30 dias"
            value={summary.expiringIn30Days}
            icon={Clock}
            borderColor="var(--color-warning-500)"
          />
        </div>
      ) : null}

      {/* Tab Strip */}
      <nav className="safety-dashboard__tabs" aria-label="Abas do dashboard">
        <button
          type="button"
          className={`safety-dashboard__tab${activeTab === 'geral' ? ' safety-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('geral')}
          aria-selected={activeTab === 'geral'}
          role="tab"
        >
          Visao Geral
        </button>
        <button
          type="button"
          className={`safety-dashboard__tab${activeTab === 'epis' ? ' safety-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('epis')}
          aria-selected={activeTab === 'epis'}
          role="tab"
        >
          EPIs
          {summary && summary.pendingCount > 0 && (
            <span className="safety-dashboard__tab-badge safety-dashboard__tab-badge--warning">
              {epiPending.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`safety-dashboard__tab${activeTab === 'treinamentos' ? ' safety-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('treinamentos')}
          aria-selected={activeTab === 'treinamentos'}
          role="tab"
        >
          Treinamentos
          {summary && summary.pendingCount > 0 && (
            <span className="safety-dashboard__tab-badge safety-dashboard__tab-badge--warning">
              {trainingPending.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`safety-dashboard__tab${activeTab === 'asos' ? ' safety-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('asos')}
          aria-selected={activeTab === 'asos'}
          role="tab"
        >
          ASOs
          {summary && summary.pendingCount > 0 && (
            <span className="safety-dashboard__tab-badge safety-dashboard__tab-badge--warning">
              {asoPending.length}
            </span>
          )}
        </button>
      </nav>

      {/* Tab 1 — Visao Geral */}
      {activeTab === 'geral' && (
        <section aria-label="Visão Geral de conformidade">
          {/* Filters + export */}
          <div className="safety-dashboard__filters">
            <div className="safety-dashboard__search-wrapper">
              <Search size={16} className="safety-dashboard__search-icon" aria-hidden="true" />
              <input
                type="search"
                className="safety-dashboard__search"
                placeholder="Buscar colaborador..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Buscar colaborador"
              />
            </div>
            <select
              className="safety-dashboard__select"
              value={pendingTypeFilter}
              onChange={(e) =>
                setPendingTypeFilter(e.target.value as 'EPI' | 'TREINAMENTO' | 'ASO' | '')
              }
              aria-label="Filtrar por tipo de pendência"
            >
              <option value="">Todos os tipos</option>
              <option value="EPI">EPI</option>
              <option value="TREINAMENTO">Treinamento</option>
              <option value="ASO">ASO</option>
            </select>

            <div className="safety-dashboard__export-btns">
              <button
                type="button"
                className="safety-dashboard__export-btn"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                aria-label="Exportar CSV de conformidade"
              >
                {exportingCsv ? (
                  <Loader2 size={16} className="safety-dashboard__spinner" aria-hidden="true" />
                ) : (
                  <Download size={16} aria-hidden="true" />
                )}
                Exportar CSV
              </button>
              <button
                type="button"
                className="safety-dashboard__export-btn"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                aria-label="Gerar relatório PDF de conformidade"
              >
                {exportingPdf ? (
                  <Loader2 size={16} className="safety-dashboard__spinner" aria-hidden="true" />
                ) : (
                  <FileText size={16} aria-hidden="true" />
                )}
                Relatorio PDF
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && <TableSkeleton />}

          {/* Empty — all compliant */}
          {!loading && allCompliant && (
            <div className="safety-dashboard__empty-state">
              <ShieldCheck
                size={64}
                aria-hidden="true"
                className="safety-dashboard__empty-icon"
              />
              <h2 className="safety-dashboard__empty-title">
                Todos os colaboradores em conformidade
              </h2>
              <p className="safety-dashboard__empty-body">
                Nenhuma pendência de EPI, treinamento ou ASO no momento.
              </p>
            </div>
          )}

          {/* Non-compliant table */}
          {!loading && !allCompliant && employeeList.length > 0 && (
            <>
              <div className="safety-dashboard__table-wrapper">
                <table className="safety-dashboard__table">
                  <thead>
                    <tr>
                      <th scope="col">NOME</th>
                      <th scope="col">CARGO</th>
                      <th scope="col">EPIS PENDENTES</th>
                      <th scope="col">TREINAMENTOS VENCIDOS</th>
                      <th scope="col">STATUS ASO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeList.map((emp) => (
                      <tr key={emp.employeeId}>
                        <td>{emp.employeeName}</td>
                        <td>{emp.positionName ?? '—'}</td>
                        <td>
                          <CountBadge
                            count={emp.epiCompliance.pending.length}
                            variant="warning"
                          />
                        </td>
                        <td>
                          <CountBadge
                            count={emp.trainingCompliance.expired.length}
                            variant="error"
                          />
                        </td>
                        <td>
                          <ComplianceStatusBadge status={emp.asoCompliance.expiryStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="safety-dashboard__pagination">
                  <button
                    type="button"
                    className="safety-dashboard__page-btn"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <span className="safety-dashboard__page-info">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="safety-dashboard__page-btn"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Tab 2 — EPIs */}
      {activeTab === 'epis' && (
        <section aria-label="Conformidade de EPIs">
          <div className="safety-dashboard__filters">
            <select
              className="safety-dashboard__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status de conformidade"
            >
              <option value="">Todos os status</option>
              <option value="OK">Conforme</option>
              <option value="YELLOW">Vencendo em breve</option>
              <option value="RED">Vencendo em 15 dias</option>
              <option value="EXPIRED">Vencido</option>
            </select>
          </div>

          {loading && <TableSkeleton />}

          {!loading && (
            <div className="safety-dashboard__table-wrapper">
              <table className="safety-dashboard__table">
                <thead>
                  <tr>
                    <th scope="col">COLABORADOR</th>
                    <th scope="col">FUNÇÃO</th>
                    <th scope="col">EPI OBRIGATÓRIO</th>
                    <th scope="col">ÚLTIMA ENTREGA</th>
                    <th scope="col">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {applyStatusFilter(epiPending).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="safety-dashboard__table-empty">
                        Nenhum colaborador com pendências de EPI.
                      </td>
                    </tr>
                  ) : (
                    applyStatusFilter(epiPending).map((emp) =>
                      emp.epiCompliance.pending.map((item, idx) => (
                        <tr key={`${emp.employeeId}-${idx}`}>
                          {idx === 0 && (
                            <>
                              <td rowSpan={emp.epiCompliance.pending.length}>
                                {emp.employeeName}
                              </td>
                              <td rowSpan={emp.epiCompliance.pending.length}>
                                {emp.positionName ?? '—'}
                              </td>
                            </>
                          )}
                          <td>{item.epiProductName}</td>
                          <td>—</td>
                          <td>
                            <ComplianceStatusBadge status="EXPIRED" />
                          </td>
                        </tr>
                      )),
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3 — Treinamentos */}
      {activeTab === 'treinamentos' && (
        <section aria-label="Conformidade de Treinamentos">
          <div className="safety-dashboard__filters">
            <select
              className="safety-dashboard__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status de conformidade"
            >
              <option value="">Todos os status</option>
              <option value="OK">Conforme</option>
              <option value="YELLOW">Vencendo em breve</option>
              <option value="RED">Vencendo em 15 dias</option>
              <option value="EXPIRED">Vencido</option>
            </select>
          </div>

          {loading && <TableSkeleton />}

          {!loading && (
            <div className="safety-dashboard__table-wrapper">
              <table className="safety-dashboard__table">
                <thead>
                  <tr>
                    <th scope="col">COLABORADOR</th>
                    <th scope="col">FUNÇÃO</th>
                    <th scope="col">TREINAMENTO</th>
                    <th scope="col">VENCIMENTO</th>
                    <th scope="col">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {applyStatusFilter(trainingPending).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="safety-dashboard__table-empty">
                        Nenhum colaborador com treinamentos vencidos.
                      </td>
                    </tr>
                  ) : (
                    applyStatusFilter(trainingPending).map((emp) =>
                      emp.trainingCompliance.expired.map((item, idx) => (
                        <tr key={`${emp.employeeId}-${idx}`}>
                          {idx === 0 && (
                            <>
                              <td rowSpan={emp.trainingCompliance.expired.length}>
                                {emp.employeeName}
                              </td>
                              <td rowSpan={emp.trainingCompliance.expired.length}>
                                {emp.positionName ?? '—'}
                              </td>
                            </>
                          )}
                          <td>{item.trainingTypeName}</td>
                          <td>{formatDate(item.expiresAt)}</td>
                          <td>
                            <ComplianceStatusBadge status={item.status} />
                          </td>
                        </tr>
                      )),
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 4 — ASOs */}
      {activeTab === 'asos' && (
        <section aria-label="Conformidade de ASOs">
          <div className="safety-dashboard__filters">
            <select
              className="safety-dashboard__select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status de vencimento do ASO"
            >
              <option value="">Todos os status</option>
              <option value="OK">Conforme</option>
              <option value="YELLOW">Vencendo em breve</option>
              <option value="RED">Vencendo em 15 dias</option>
              <option value="EXPIRED">Vencido</option>
            </select>
          </div>

          {loading && <TableSkeleton />}

          {!loading && (
            <div className="safety-dashboard__table-wrapper">
              <table className="safety-dashboard__table">
                <thead>
                  <tr>
                    <th scope="col">COLABORADOR</th>
                    <th scope="col">FUNÇÃO</th>
                    <th scope="col">ÚLTIMO RESULTADO</th>
                    <th scope="col">PRÓXIMO EXAME</th>
                    <th scope="col">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {applyStatusFilter(asoPending).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="safety-dashboard__table-empty">
                        Nenhum colaborador com ASO pendente.
                      </td>
                    </tr>
                  ) : (
                    applyStatusFilter(asoPending).map((emp) => (
                      <tr key={emp.employeeId}>
                        <td>{emp.employeeName}</td>
                        <td>{emp.positionName ?? '—'}</td>
                        <td>{emp.asoCompliance.latestResult ?? '—'}</td>
                        <td>{formatDate(emp.asoCompliance.nextExamDate)}</td>
                        <td>
                          <ComplianceStatusBadge status={emp.asoCompliance.expiryStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className="safety-dashboard__toast" role="alert" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
