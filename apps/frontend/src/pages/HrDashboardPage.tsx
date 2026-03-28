import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BarChart3,
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  TrendingDown,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useHrDashboard } from '@/hooks/useHrDashboard';
import './HrDashboardPage.css';

const PayrollCostTrendChart = lazy(() => import('@/components/hr-dashboard/PayrollCostTrendChart'));
const PayrollCompositionChart = lazy(
  () => import('@/components/hr-dashboard/PayrollCompositionChart'),
);

/* ────────────────────────────────────────────────────────── */
/* Formatters                                                  */
/* ────────────────────────────────────────────────────────── */

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR');
}

/* ────────────────────────────────────────────────────────── */
/* Trend arrow component                                       */
/* ────────────────────────────────────────────────────────── */

interface TrendBadgeProps {
  current: number;
  previous: number | null;
  /** When the value going UP is bad (cost metrics) */
  invertLogic?: boolean;
}

function TrendBadge({ current, previous, invertLogic = false }: TrendBadgeProps) {
  if (previous === null || previous === 0) {
    return (
      <span
        className="hr-dashboard__kpi-trend hr-dashboard__kpi-trend--neutral"
        aria-label="Sem dados do período anterior"
      >
        —
      </span>
    );
  }

  const pct = (((current - previous) / Math.abs(previous)) * 100).toFixed(1);
  const numPct = parseFloat(pct);

  if (numPct > 0) {
    const className = invertLogic
      ? 'hr-dashboard__kpi-trend hr-dashboard__kpi-trend--up-bad'
      : 'hr-dashboard__kpi-trend hr-dashboard__kpi-trend--up-good';
    return (
      <span className={className} aria-label={`Aumento de ${pct}% em relação ao período anterior`}>
        <ArrowUp size={12} aria-hidden="true" />
        {`+${pct}%`}
      </span>
    );
  }

  if (numPct < 0) {
    const className = invertLogic
      ? 'hr-dashboard__kpi-trend hr-dashboard__kpi-trend--down-good'
      : 'hr-dashboard__kpi-trend hr-dashboard__kpi-trend--down-bad';
    return (
      <span
        className={className}
        aria-label={`Queda de ${Math.abs(numPct).toFixed(1)}% em relação ao período anterior`}
      >
        <ArrowDown size={12} aria-hidden="true" />
        {`${pct}%`}
      </span>
    );
  }

  return (
    <span
      className="hr-dashboard__kpi-trend hr-dashboard__kpi-trend--neutral"
      aria-label="Sem variação"
    >
      0%
    </span>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Skeleton                                                    */
/* ────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dashboard de RH">
      <div className="hr-dashboard__skeleton-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="hr-dashboard__skeleton" style={{ height: '96px' }} />
        ))}
      </div>
      <div className="hr-dashboard__skeleton-charts">
        <div className="hr-dashboard__skeleton" style={{ height: '320px' }} />
        <div className="hr-dashboard__skeleton" style={{ height: '280px' }} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Contract expiration section                                 */
/* ────────────────────────────────────────────────────────── */

function ExpirationCard({
  bucket,
}: {
  bucket: {
    days: number;
    count: number;
    employees: Array<{ id: string; name: string; endDate: string; contractType: string }>;
  };
}) {
  const bucketClass =
    bucket.days <= 30
      ? 'hr-dashboard__expiration-card--30'
      : bucket.days <= 60
        ? 'hr-dashboard__expiration-card--60'
        : 'hr-dashboard__expiration-card--90';

  const badgeClass =
    bucket.days <= 30
      ? 'hr-dashboard__expiration-badge hr-dashboard__expiration-badge--30'
      : bucket.days <= 60
        ? 'hr-dashboard__expiration-badge hr-dashboard__expiration-badge--60'
        : 'hr-dashboard__expiration-badge';

  return (
    <article className={`hr-dashboard__expiration-card ${bucketClass}`}>
      <div className="hr-dashboard__expiration-header">
        <span className="hr-dashboard__expiration-title">Vencendo em {bucket.days} dias</span>
        <span className={badgeClass} aria-label={`${bucket.count} contratos`}>
          {bucket.count}
        </span>
      </div>
      {bucket.employees.length === 0 ? (
        <p className="hr-dashboard__expiration-empty">Nenhum contrato neste período.</p>
      ) : (
        <ul className="hr-dashboard__expiration-list">
          {bucket.employees.map((emp) => (
            <li key={emp.id} className="hr-dashboard__expiration-item">
              <span className="hr-dashboard__expiration-name">{emp.name}</span>
              <div className="hr-dashboard__expiration-meta">
                <span className="hr-dashboard__expiration-date">{formatDate(emp.endDate)}</span>
                <span className="hr-dashboard__expiration-type-pill">{emp.contractType}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Main page                                                   */
/* ────────────────────────────────────────────────────────── */

export default function HrDashboardPage() {
  const { farms } = useFarmContext();

  const now = new Date();
  const [localFarmId, setLocalFarmId] = useState<string | undefined>(undefined);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const { data, isLoading, error, refetch } = useHrDashboard({
    farmId: localFarmId,
    year,
    month,
  });

  /* Empty state: no payroll runs found for period */
  const isEmpty =
    !isLoading &&
    !error &&
    data !== null &&
    data.headcount.total === 0 &&
    data.currentMonthCost.gross === 0 &&
    data.trend12Months.length === 0;

  const activityRows = data?.costByActivity ?? [];
  const visibleActivityRows = showAllActivity ? activityRows : activityRows.slice(0, 8);
  const totalActivityCost = activityRows.reduce((sum, row) => sum + row.totalCost, 0);

  return (
    <main className="hr-dashboard" id="main-content">
      {/* Breadcrumb */}
      <nav aria-label="Navegação estrutural" style={{ marginBottom: 'var(--space-4)' }}>
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '14px',
            color: 'var(--color-neutral-500)',
          }}
        >
          <li>
            <Link
              to="/dashboard"
              style={{ color: 'var(--color-neutral-500)', textDecoration: 'none' }}
            >
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>RH</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
            Dashboard RH
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="hr-dashboard__header">
        <h1>Dashboard RH</h1>
        <p>Indicadores consolidados de folha de pagamento e gestão de pessoas</p>
      </header>

      {/* Filters */}
      <div className="hr-dashboard__filters" role="search" aria-label="Filtros do dashboard de RH">
        <div className="hr-dashboard__filter-group">
          <label htmlFor="hr-farm-filter">Fazenda</label>
          <select
            id="hr-farm-filter"
            value={localFarmId ?? ''}
            onChange={(e) => setLocalFarmId(e.target.value === '' ? undefined : e.target.value)}
            aria-label="Selecionar fazenda"
          >
            <option value="">Todas as fazendas</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </div>

        <div className="hr-dashboard__filter-group">
          <label htmlFor="hr-year-filter">Ano</label>
          <input
            id="hr-year-filter"
            type="number"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 2020 && v <= 2100) setYear(v);
            }}
            style={{ width: '80px' }}
            aria-label="Selecionar ano"
          />
        </div>

        <div className="hr-dashboard__filter-group">
          <label htmlFor="hr-month-filter">Mês</label>
          <select
            id="hr-month-filter"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            aria-label="Selecionar mês"
          >
            {[
              'Janeiro',
              'Fevereiro',
              'Março',
              'Abril',
              'Maio',
              'Junho',
              'Julho',
              'Agosto',
              'Setembro',
              'Outubro',
              'Novembro',
              'Dezembro',
            ].map((label, i) => (
              <option key={i + 1} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <DashboardSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="hr-dashboard__error" role="alert">
          <AlertCircle size={48} color="var(--color-error-500)" aria-hidden="true" />
          <h2>Não foi possível carregar o dashboard</h2>
          <p>Verifique sua conexão e tente novamente.</p>
          <button type="button" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="hr-dashboard__empty" role="status">
          <BarChart3 size={64} color="var(--color-neutral-300)" aria-hidden="true" />
          <h2>Sem dados de folha para o período</h2>
          <p>
            Não encontramos folhas processadas para a fazenda e período selecionados. Ajuste os
            filtros ou processe a folha do mês.
          </p>
          <Link to="/payroll-runs">Processar Folha</Link>
        </div>
      )}

      {/* Dashboard content */}
      {!isLoading && !error && data !== null && !isEmpty && (
        <>
          {/* KPI card row */}
          <section aria-label="Indicadores principais de RH">
            <div className="hr-dashboard__kpis">
              {/* KPI 1: Total de Colaboradores */}
              <article className="hr-dashboard__kpi-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="var(--color-primary-600)" aria-hidden="true" />
                  <span className="hr-dashboard__kpi-label">Total de Colaboradores</span>
                </div>
                <div
                  className="hr-dashboard__kpi-value"
                  aria-label={`Total de colaboradores: ${data.headcount.total}`}
                >
                  {data.headcount.total}
                </div>
                <TrendBadge current={data.headcount.total} previous={null} />
              </article>

              {/* KPI 2: Custo Bruto da Folha */}
              <article className="hr-dashboard__kpi-card">
                <span className="hr-dashboard__kpi-label">Custo Bruto da Folha</span>
                <div
                  className="hr-dashboard__kpi-value"
                  aria-label={`Custo bruto da folha: ${formatBRL(data.currentMonthCost.gross)}`}
                >
                  {formatBRL(data.currentMonthCost.gross)}
                </div>
                <TrendBadge
                  current={data.currentMonthCost.gross}
                  previous={null}
                  invertLogic={true}
                />
              </article>

              {/* KPI 3: Custo por Hectare */}
              <article className="hr-dashboard__kpi-card">
                <span className="hr-dashboard__kpi-label">Custo por Hectare</span>
                <div
                  className="hr-dashboard__kpi-value"
                  aria-label={
                    data.currentMonthCost.costPerHectare !== null
                      ? `Custo por hectare: ${formatBRL(data.currentMonthCost.costPerHectare)}`
                      : 'Custo por hectare: não disponível'
                  }
                >
                  {data.currentMonthCost.costPerHectare !== null
                    ? formatBRL(data.currentMonthCost.costPerHectare)
                    : '—'}
                </div>
              </article>

              {/* KPI 4: Turnover 12 meses */}
              <article className="hr-dashboard__kpi-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={20} color="var(--color-neutral-500)" aria-hidden="true" />
                  <span className="hr-dashboard__kpi-label">Turnover 12 meses</span>
                </div>
                <div
                  className={
                    `hr-dashboard__kpi-value ` +
                    (data.turnover.last12MonthsRate > 10
                      ? 'hr-dashboard__kpi-turnover--high'
                      : 'hr-dashboard__kpi-turnover--low')
                  }
                  aria-label={`Turnover dos últimos 12 meses: ${data.turnover.last12MonthsRate.toFixed(1)}%`}
                >
                  {data.turnover.last12MonthsRate.toFixed(1)}%
                </div>
                <span
                  style={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '12px',
                    color: 'var(--color-neutral-500)',
                  }}
                >
                  {data.turnover.admissionsLast12} admissões · {data.turnover.terminationsLast12}{' '}
                  desligamentos
                </span>
              </article>
            </div>
          </section>

          {/* Charts section */}
          <section aria-label="Gráficos de folha de pagamento">
            <div className="hr-dashboard__charts">
              <div className="hr-dashboard__chart-card">
                <h2 className="hr-dashboard__chart-title">Tendência de Custo — 12 meses</h2>
                <Suspense
                  fallback={
                    <div
                      className="hr-dashboard__skeleton"
                      style={{ height: '320px' }}
                      aria-label="Carregando gráfico de tendência"
                    />
                  }
                >
                  <PayrollCostTrendChart data={data.trend12Months} />
                </Suspense>
              </div>

              <div className="hr-dashboard__chart-card">
                <h2 className="hr-dashboard__chart-title">Composição da Folha</h2>
                <Suspense
                  fallback={
                    <div
                      className="hr-dashboard__skeleton"
                      style={{ height: '280px' }}
                      aria-label="Carregando gráfico de composição"
                    />
                  }
                >
                  <PayrollCompositionChart data={data.composition} />
                </Suspense>
              </div>
            </div>
          </section>

          {/* Cost by activity table */}
          {activityRows.length > 0 && (
            <section className="hr-dashboard__activity-section" aria-label="Custo por atividade">
              <h2>Custo por Atividade</h2>
              <table className="hr-dashboard__activity-table">
                <caption className="sr-only">
                  Custo da folha por tipo de atividade, ordenado do maior para o menor
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ATIVIDADE</th>
                    <th scope="col">CUSTO TOTAL</th>
                    <th scope="col">% DO TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleActivityRows.map((row) => {
                    const pct =
                      totalActivityCost > 0
                        ? ((row.totalCost / totalActivityCost) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={row.activityType}>
                        <td>{row.activityType}</td>
                        <td>{formatBRL(row.totalCost)}</td>
                        <td>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {activityRows.length > 8 && (
                <button
                  type="button"
                  className="hr-dashboard__activity-expand-btn"
                  onClick={() => setShowAllActivity((prev) => !prev)}
                  aria-expanded={showAllActivity}
                >
                  {showAllActivity
                    ? 'Ver menos'
                    : `Ver mais (${activityRows.length - 8} restantes)`}
                </button>
              )}
            </section>
          )}

          {/* Upcoming contract expirations */}
          {data.upcomingContractExpirations.length > 0 && (
            <section aria-label="Contratos com vencimento próximo">
              <h2
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--color-neutral-800)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                Vencimentos de Contrato
              </h2>
              <div className="hr-dashboard__expirations">
                {data.upcomingContractExpirations.map((bucket) => (
                  <ExpirationCard key={bucket.days} bucket={bucket} />
                ))}
              </div>
            </section>
          )}

          {/* Alerts section */}
          <section className="hr-dashboard__alerts" aria-label="Alertas de RH" role="status">
            <h2>Alertas</h2>

            {/* Overdue payables */}
            <div className="hr-dashboard__alert-row">
              <AlertCircle size={20} color="var(--color-error-500)" aria-hidden="true" />
              <span>Contas a pagar de folha vencidas</span>
              <span
                className={`hr-dashboard__alert-count ${
                  data.alerts.overduePayablesPayroll > 0
                    ? 'hr-dashboard__alert-count--error'
                    : 'hr-dashboard__alert-count--warning'
                }`}
                aria-label={`${data.alerts.overduePayablesPayroll} contas vencidas`}
              >
                {data.alerts.overduePayablesPayroll}
              </span>
              {data.alerts.overduePayablesPayroll > 0 && (
                <Link
                  to="/payables?filter=overdue"
                  className="hr-dashboard__alert-link"
                  aria-label="Ver contas a pagar vencidas"
                >
                  Ver
                </Link>
              )}
            </div>

            {/* Pending timesheets */}
            <div className="hr-dashboard__alert-row">
              <AlertTriangle size={20} color="var(--color-warning-500)" aria-hidden="true" />
              <span>Espelhos de ponto pendentes de aprovação</span>
              <span
                className={`hr-dashboard__alert-count ${
                  data.alerts.pendingTimesheets > 0
                    ? 'hr-dashboard__alert-count--warning'
                    : 'hr-dashboard__alert-count--warning'
                }`}
                aria-label={`${data.alerts.pendingTimesheets} espelhos pendentes`}
              >
                {data.alerts.pendingTimesheets}
              </span>
              {data.alerts.pendingTimesheets > 0 && (
                <Link
                  to="/timesheets"
                  className="hr-dashboard__alert-link"
                  aria-label="Ver espelhos de ponto pendentes"
                >
                  Ver
                </Link>
              )}
            </div>

            {/* Expired contracts */}
            <div className="hr-dashboard__alert-row">
              <AlertTriangle size={20} color="var(--color-warning-500)" aria-hidden="true" />
              <span>Contratos vencidos</span>
              <span
                className="hr-dashboard__alert-count hr-dashboard__alert-count--warning"
                aria-label={`${data.alerts.expiredContracts} contratos vencidos`}
              >
                {data.alerts.expiredContracts}
              </span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
