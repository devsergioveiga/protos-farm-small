import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  TrendingDown,
  TrendingUp,
  BarChart2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useFinancialDashboard,
  type FinancialDashboardPeriod,
} from '@/hooks/useFinancialDashboard';
import './FinancialDashboardPage.css';

const RevenueExpenseChart = lazy(
  () => import('@/components/financial-dashboard/RevenueExpenseChart'),
);
const TopCategoriesChart = lazy(
  () => import('@/components/financial-dashboard/TopCategoriesChart'),
);

/* ────────────────────────────────────────────────────── */
/* Period helpers                                          */
/* ────────────────────────────────────────────────────── */

const PERIOD_OPTIONS = [
  { label: 'Mês atual', value: 'current' },
  { label: 'Mês anterior', value: 'previous' },
  { label: 'Último trimestre', value: 'quarter' },
];

function resolvePeriod(value: string): FinancialDashboardPeriod {
  const now = new Date();
  switch (value) {
    case 'previous': {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
    case 'quarter': {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 2, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    }
    default:
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

/* ────────────────────────────────────────────────────── */
/* YoY Badge                                              */
/* ────────────────────────────────────────────────────── */

interface YoyBadgeProps {
  current: number;
  prevYear: number | null;
}

function YoyBadge({ current, prevYear }: YoyBadgeProps) {
  if (prevYear === null) {
    return (
      <span className="fin-dashboard__yoy--neutral" aria-label="Sem dados do ano anterior">
        —
      </span>
    );
  }

  if (prevYear === 0) {
    if (current === 0) {
      return (
        <span className="fin-dashboard__yoy--neutral" aria-label="Sem variação">
          0%
        </span>
      );
    }
    return (
      <span className="fin-dashboard__yoy--up" aria-label="Aumento em relação ao ano anterior">
        <ArrowUp size={12} aria-hidden="true" />
        +novo
      </span>
    );
  }

  const pct = (((current - prevYear) / Math.abs(prevYear)) * 100).toFixed(1);
  const numPct = parseFloat(pct);

  if (numPct > 0) {
    return (
      <span
        className="fin-dashboard__yoy--up"
        aria-label={`Aumento de ${pct}% em relação ao ano anterior`}
      >
        <ArrowUp size={12} aria-hidden="true" />
        {`+${pct}%`}
      </span>
    );
  }

  if (numPct < 0) {
    return (
      <span
        className="fin-dashboard__yoy--down"
        aria-label={`Queda de ${Math.abs(numPct).toFixed(1)}% em relação ao ano anterior`}
      >
        <ArrowDown size={12} aria-hidden="true" />
        {`${pct}%`}
      </span>
    );
  }

  return (
    <span className="fin-dashboard__yoy--neutral" aria-label="Sem variação">
      0%
    </span>
  );
}

/* ────────────────────────────────────────────────────── */
/* Currency formatter                                     */
/* ────────────────────────────────────────────────────── */

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ────────────────────────────────────────────────────── */
/* Skeleton                                               */
/* ────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dashboard financeiro">
      <div className="fin-dashboard__skeleton-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fin-dashboard__skeleton" style={{ height: '96px' }} />
        ))}
      </div>
      <div
        className="fin-dashboard__skeleton"
        style={{ height: '20px', width: '200px', marginBottom: 'var(--space-8)' }}
      />
      <div className="fin-dashboard__skeleton-charts">
        <div className="fin-dashboard__skeleton" style={{ height: '288px' }} />
        <div className="fin-dashboard__skeleton" style={{ height: '248px' }} />
      </div>
      <div className="fin-dashboard__skeleton-top5">
        {[0, 1].map((i) => (
          <div key={i} className="fin-dashboard__skeleton-top5-rows">
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="fin-dashboard__skeleton" style={{ height: '32px' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* Main page                                              */
/* ────────────────────────────────────────────────────── */

export default function FinancialDashboardPage() {
  const { farms } = useFarmContext();

  // Local filter state — NOT using FarmContext.selectedFarmId
  const [localFarmId, setLocalFarmId] = useState<string | null>(null);
  const [periodValue, setPeriodValue] = useState<string>('current');

  const period = resolvePeriod(periodValue);

  const { data, isLoading, error, refetch } = useFinancialDashboard({
    farmId: localFarmId,
    period,
  });

  const isQuarter = periodValue === 'quarter';

  /* Empty check */
  const isEmpty =
    !isLoading &&
    !error &&
    data !== null &&
    data.totalBankBalance === 0 &&
    data.payablesDue30d === 0 &&
    data.receivablesDue30d === 0 &&
    data.monthResult === 0 &&
    data.monthlyTrend.length === 0;

  /* ── render ── */
  return (
    <main className="fin-dashboard" id="main-content">
      {/* Header */}
      <header className="fin-dashboard__header">
        <h1>Dashboard Financeiro</h1>
        <p>Posição financeira consolidada da fazenda</p>
      </header>

      {/* Filters */}
      <div className="fin-dashboard__filters" role="search" aria-label="Filtros do dashboard">
        <div className="fin-dashboard__filter-group">
          <label htmlFor="farm-filter">Fazenda</label>
          <select
            id="farm-filter"
            value={localFarmId ?? ''}
            onChange={(e) => setLocalFarmId(e.target.value === '' ? null : e.target.value)}
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

        <div className="fin-dashboard__filter-group">
          <label htmlFor="period-filter">Período</label>
          <select
            id="period-filter"
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            aria-label="Selecionar período"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <DashboardSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="fin-dashboard__error" role="alert">
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
        <div className="fin-dashboard__empty" role="status">
          <BarChart2 size={64} color="var(--color-neutral-300)" aria-hidden="true" />
          <h2>Nenhum dado financeiro ainda</h2>
          <p>Cadastre contas bancárias, contas a pagar e a receber para ver o dashboard.</p>
          <Link to="/bank-accounts">Cadastrar conta bancária</Link>
        </div>
      )}

      {/* Dashboard content */}
      {!isLoading && !error && data !== null && !isEmpty && (
        <>
          {/* KPI cards */}
          <section aria-label="Indicadores financeiros principais">
            <div className="fin-dashboard__kpis">
              {/* KPI 1: Saldo bancário real */}
              <article className="fin-dashboard__kpi-card">
                <div className="fin-dashboard__kpi-icon" aria-hidden="true">
                  <Building2 size={20} />
                </div>
                <div className="fin-dashboard__kpi-label-row">
                  <span className="fin-dashboard__kpi-label">Saldo bancário real</span>
                  <span className="fin-dashboard__saldo-badge">SALDO REAL</span>
                </div>
                <div
                  className={`fin-dashboard__kpi-value${data.totalBankBalance < 0 ? ' fin-dashboard__kpi-value--negative' : ''}`}
                  aria-label={`Saldo bancário real: ${formatBRL(data.totalBankBalance)}`}
                >
                  {formatBRL(data.totalBankBalance)}
                </div>
                <YoyBadge
                  current={data.totalBankBalance}
                  prevYear={data.totalBankBalancePrevYear}
                />
              </article>

              {/* KPI 2: A pagar 30d */}
              <article className="fin-dashboard__kpi-card">
                <div className="fin-dashboard__kpi-icon" aria-hidden="true">
                  <TrendingDown size={20} />
                </div>
                <div className="fin-dashboard__kpi-label-row">
                  <span className="fin-dashboard__kpi-label">A pagar — próximos 30 dias</span>
                </div>
                <div
                  className="fin-dashboard__kpi-value"
                  aria-label={`A pagar nos próximos 30 dias: ${formatBRL(data.payablesDue30d)}`}
                >
                  {formatBRL(data.payablesDue30d)}
                </div>
                <YoyBadge current={data.payablesDue30d} prevYear={data.payablesDue30dPrevYear} />
              </article>

              {/* KPI 3: A receber 30d */}
              <article className="fin-dashboard__kpi-card">
                <div className="fin-dashboard__kpi-icon" aria-hidden="true">
                  <TrendingUp size={20} />
                </div>
                <div className="fin-dashboard__kpi-label-row">
                  <span className="fin-dashboard__kpi-label">A receber — próximos 30 dias</span>
                </div>
                <div
                  className="fin-dashboard__kpi-value"
                  aria-label={`A receber nos próximos 30 dias: ${formatBRL(data.receivablesDue30d)}`}
                >
                  {formatBRL(data.receivablesDue30d)}
                </div>
                <YoyBadge
                  current={data.receivablesDue30d}
                  prevYear={data.receivablesDue30dPrevYear}
                />
              </article>

              {/* KPI 4: Resultado do mês */}
              <article className="fin-dashboard__kpi-card">
                <div className="fin-dashboard__kpi-icon" aria-hidden="true">
                  <BarChart2 size={20} />
                </div>
                <div className="fin-dashboard__kpi-label-row">
                  <span className="fin-dashboard__kpi-label">
                    {isQuarter ? 'Resultado do trimestre' : 'Resultado do mês'}
                  </span>
                </div>
                <div
                  className={`fin-dashboard__kpi-value${data.monthResult < 0 ? ' fin-dashboard__kpi-value--negative' : ''}`}
                  aria-label={`Resultado do ${isQuarter ? 'trimestre' : 'mês'}: ${formatBRL(data.monthResult)}`}
                >
                  {formatBRL(data.monthResult)}
                </div>
                <div
                  className={`fin-dashboard__kpi-sublabel${data.monthResult < 0 ? ' fin-dashboard__kpi-sublabel--negative' : ''}`}
                >
                  {data.monthResult >= 0 ? 'Lucro no período' : 'Déficit no período'}
                </div>
                <YoyBadge current={data.monthResult} prevYear={data.monthResultPrevYear} />
              </article>
            </div>
          </section>

          {/* Endividamento placeholder */}
          <div className="fin-dashboard__debt-placeholder" role="note">
            <Info size={16} aria-hidden="true" />
            <span>Endividamento: crédito rural disponível na Fase 6</span>
          </div>

          {/* Charts */}
          <section aria-label="Gráficos financeiros">
            <div className="fin-dashboard__charts">
              <div className="fin-dashboard__chart-card">
                <h2 className="fin-dashboard__chart-title">Receitas vs Despesas</h2>
                <p className="fin-dashboard__chart-subtitle">
                  Valores realizados (baixados) por mês
                </p>
                <Suspense
                  fallback={
                    <div
                      className="fin-dashboard__skeleton"
                      style={{ height: '240px' }}
                      aria-label="Carregando gráfico"
                    />
                  }
                >
                  <RevenueExpenseChart data={data.monthlyTrend} />
                </Suspense>
              </div>

              <div className="fin-dashboard__chart-card">
                <h2 className="fin-dashboard__chart-title">Top 5 Categorias de Despesa</h2>
                <Suspense
                  fallback={
                    <div
                      className="fin-dashboard__skeleton"
                      style={{ height: '240px' }}
                      aria-label="Carregando gráfico"
                    />
                  }
                >
                  <TopCategoriesChart data={data.topExpenseCategories} />
                </Suspense>
              </div>
            </div>
          </section>

          {/* Top 5 ranked lists */}
          <section aria-label="Rankings financeiros">
            <div className="fin-dashboard__top5">
              {/* Maiores despesas por categoria */}
              <div className="fin-dashboard__top5-panel">
                <h2 className="fin-dashboard__top5-title">Maiores despesas por categoria</h2>
                {data.topPayablesByCategory.length === 0 ? (
                  <p style={{ color: 'var(--color-neutral-500)', fontSize: '14px' }}>
                    Nenhuma despesa no período.
                  </p>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {data.topPayablesByCategory.map((item) => (
                      <li key={item.category}>
                        <div className="fin-dashboard__top5-row">
                          <span className="fin-dashboard__top5-rank">#{item.rank}</span>
                          <span className="fin-dashboard__top5-label" title={item.categoryLabel}>
                            {item.categoryLabel}
                          </span>
                          <span className="fin-dashboard__top5-value">{formatBRL(item.total)}</span>
                        </div>
                        <div className="fin-dashboard__top5-bar">
                          <div
                            className="fin-dashboard__top5-bar-fill"
                            style={{ width: `${item.relativePercent}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Maiores receitas por cliente */}
              <div className="fin-dashboard__top5-panel">
                <h2 className="fin-dashboard__top5-title">Maiores receitas por cliente</h2>
                {data.topReceivablesByClient.length === 0 ? (
                  <p style={{ color: 'var(--color-neutral-500)', fontSize: '14px' }}>
                    Nenhuma receita no período.
                  </p>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {data.topReceivablesByClient.map((item) => (
                      <li key={item.clientName}>
                        <div className="fin-dashboard__top5-row">
                          <span className="fin-dashboard__top5-rank">#{item.rank}</span>
                          <span className="fin-dashboard__top5-label" title={item.clientName}>
                            {item.clientName}
                          </span>
                          <span className="fin-dashboard__top5-value">{formatBRL(item.total)}</span>
                        </div>
                        <div className="fin-dashboard__top5-bar">
                          <div
                            className="fin-dashboard__top5-bar-fill"
                            style={{ width: `${item.relativePercent}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>

          {/* Alerts panel */}
          <section className="fin-dashboard__alerts" aria-label="Alertas financeiros" role="status">
            <h2 className="fin-dashboard__alerts-title">Alertas financeiros</h2>

            {!data.alerts.overduePayablesCount && !data.alerts.projectedBalanceNegative ? (
              <div className="fin-dashboard__alert-row fin-dashboard__alert-row--success">
                <CheckCircle size={24} color="var(--color-success-500)" aria-hidden="true" />
                <span>Nenhum alerta financeiro no momento.</span>
              </div>
            ) : (
              <>
                {data.alerts.overduePayablesCount > 0 && (
                  <div className="fin-dashboard__alert-row fin-dashboard__alert-row--error">
                    <AlertCircle size={20} color="var(--color-error-500)" aria-hidden="true" />
                    <span>
                      {data.alerts.overduePayablesCount} conta(s) a pagar vencida(s), totalizando{' '}
                      {formatBRL(data.alerts.overduePayablesTotal)}.
                    </span>
                  </div>
                )}
                {data.alerts.projectedBalanceNegative && (
                  <div className="fin-dashboard__alert-row fin-dashboard__alert-row--warning">
                    <AlertTriangle size={20} color="var(--color-warning-500)" aria-hidden="true" />
                    <span>O saldo bancário pode ficar negativo nos próximos 30 dias.</span>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
