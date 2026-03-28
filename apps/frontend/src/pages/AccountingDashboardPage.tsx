import { useState, useMemo, lazy, Suspense } from 'react';
import { BarChart3, AlertCircle } from 'lucide-react';
import { useAccountingDashboard } from '@/hooks/useAccountingDashboard';
import { useOrgId } from '@/hooks/useDfc';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import AccountingKpiCard from '@/components/accounting-dashboard/AccountingKpiCard';
import AccountingAlertRow from '@/components/accounting-dashboard/AccountingAlertRow';
import IndicatorCard from '@/components/financial-statements/IndicatorCard';
import './AccountingDashboardPage.css';

const RevenueExpenseLineChart = lazy(
  () => import('@/components/accounting-dashboard/RevenueExpenseLineChart'),
);
const CostCompositionChart = lazy(
  () => import('@/components/accounting-dashboard/CostCompositionChart'),
);

// ─── Month list ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dashboard contabil">
      {/* KPI skeletons */}
      <div className="accounting-dashboard__kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="accounting-dashboard__skeleton" style={{ height: '96px' }} />
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="accounting-dashboard__charts">
        <div className="accounting-dashboard__skeleton" style={{ height: '288px' }} />
        <div className="accounting-dashboard__skeleton" style={{ height: '248px' }} />
      </div>
      {/* Indicator skeletons */}
      <div className="accounting-dashboard__kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="accounting-dashboard__skeleton" style={{ height: '80px' }} />
        ))}
      </div>
      {/* Alert row skeletons */}
      <div className="accounting-dashboard__alerts">
        {[0, 1, 2].map((i) => (
          <div key={i} className="accounting-dashboard__skeleton" style={{ height: '48px' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountingDashboardPage() {
  const orgId = useOrgId();
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const hasFilters = !!selectedFiscalYearId && !!selectedMonth;

  const { data, loading, error } = useAccountingDashboard(
    orgId,
    selectedFiscalYearId || null,
    hasFilters ? selectedMonth : null,
  );

  const periodLabel = useMemo(() => {
    if (!selectedFiscalYearId || !selectedMonth) return '';
    const month = MONTHS.find((m) => m.value === selectedMonth);
    const fy = fiscalYears.find((y) => y.id === selectedFiscalYearId);
    return [month?.label, fy?.name].filter(Boolean).join(' / ');
  }, [selectedFiscalYearId, selectedMonth, fiscalYears]);

  const isEmpty =
    hasFilters &&
    !loading &&
    !error &&
    data !== null &&
    data.kpiCards.length === 0 &&
    data.monthlyChart.length === 0;

  return (
    <main className="accounting-dashboard" id="main-content">
      {/* Breadcrumb */}
      <nav className="accounting-dashboard__breadcrumb" aria-label="Caminho da pagina">
        <span className="accounting-dashboard__breadcrumb-item">Inicio</span>
        <span className="accounting-dashboard__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="accounting-dashboard__breadcrumb-item">Contabilidade</span>
        <span className="accounting-dashboard__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="accounting-dashboard__breadcrumb-item accounting-dashboard__breadcrumb-item--current">
          Dashboard Contabil
        </span>
      </nav>

      {/* Header */}
      <header className="accounting-dashboard__header">
        <BarChart3 size={24} aria-hidden="true" className="accounting-dashboard__header-icon" />
        <div>
          <h1 className="accounting-dashboard__title">Dashboard Contabil</h1>
          <p className="accounting-dashboard__subtitle">
            Visao executiva do resultado contabil da fazenda
          </p>
        </div>
      </header>

      {/* Filters */}
      <div
        className="accounting-dashboard__filters"
        role="search"
        aria-label="Filtros do dashboard"
      >
        <div className="accounting-dashboard__filter-group">
          <label htmlFor="acc-fy-select" className="accounting-dashboard__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="acc-fy-select"
            className="accounting-dashboard__select"
            value={selectedFiscalYearId}
            onChange={(e) => setSelectedFiscalYearId(e.target.value)}
          >
            <option value="">Selecione o exercicio</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>

        <div className="accounting-dashboard__filter-group">
          <label htmlFor="acc-month-select" className="accounting-dashboard__filter-label">
            Mes
          </label>
          <select
            id="acc-month-select"
            className="accounting-dashboard__select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Period label */}
      {periodLabel && (
        <p className="accounting-dashboard__period-label">
          Periodo selecionado: <strong>{periodLabel}</strong>
        </p>
      )}

      {/* Loading state */}
      {loading && <DashboardSkeleton />}

      {/* Error state */}
      {!loading && error && (
        <div className="accounting-dashboard__error" role="alert">
          <AlertCircle size={48} color="var(--color-error-500)" aria-hidden="true" />
          <h2>Nao foi possivel carregar o dashboard contabil</h2>
          <p>Verifique sua conexao e tente novamente.</p>
        </div>
      )}

      {/* Empty state */}
      {(!hasFilters || isEmpty) && !loading && !error && (
        <div className="accounting-dashboard__empty" role="status">
          <BarChart3 size={64} color="var(--color-neutral-300)" aria-hidden="true" />
          <h2>Nenhum dado contabil para o periodo</h2>
          <p>Selecione um exercicio fiscal e mes para carregar o dashboard.</p>
        </div>
      )}

      {/* Dashboard content */}
      {hasFilters && !loading && !error && data !== null && !isEmpty && (
        <>
          {/* Zone 1: KPI Cards */}
          <section className="accounting-dashboard__kpi-grid" aria-label="Indicadores principais">
            {data.kpiCards.map((card) => (
              <AccountingKpiCard key={card.label} {...card} />
            ))}
          </section>

          {/* Zone 2: Charts */}
          <section className="accounting-dashboard__charts" aria-label="Graficos contabeis">
            <div className="accounting-dashboard__chart-card">
              <h2 className="accounting-dashboard__chart-title">Receita vs Despesa — 12 Meses</h2>
              <Suspense
                fallback={
                  <div
                    className="accounting-dashboard__skeleton chart-skeleton"
                    style={{ height: 288 }}
                    aria-label="Carregando grafico"
                  />
                }
              >
                <RevenueExpenseLineChart data={data.monthlyChart} />
              </Suspense>
            </div>

            <div className="accounting-dashboard__chart-card">
              <h2 className="accounting-dashboard__chart-title">Composicao de Custos</h2>
              <Suspense
                fallback={
                  <div
                    className="accounting-dashboard__skeleton chart-skeleton"
                    style={{ height: 248 }}
                    aria-label="Carregando grafico"
                  />
                }
              >
                <CostCompositionChart data={data.costComposition} />
              </Suspense>
            </div>
          </section>

          {/* Zone 3: BP Indicators */}
          <section aria-label="Indicadores patrimoniais">
            <h2 className="accounting-dashboard__section-title">Indicadores Patrimoniais</h2>
            <div className="accounting-dashboard__kpi-grid">
              {data.bpIndicators.map((ind) => (
                <IndicatorCard
                  key={ind.id}
                  label={ind.label}
                  value={ind.value}
                  tooltip={ind.label}
                  sparklineData={ind.sparkline}
                />
              ))}
            </div>
          </section>

          {/* Zone 4: Alerts */}
          <section
            className="accounting-dashboard__alerts-section"
            role="status"
            aria-label="Alertas contabeis"
          >
            <h2 className="accounting-dashboard__section-title">Alertas Contabeis</h2>
            {data.alerts.length === 0 ? (
              <p className="accounting-dashboard__no-alerts">Nenhum alerta contabil no momento.</p>
            ) : (
              <ul className="accounting-dashboard__alerts" role="list">
                {data.alerts.map((alert) => (
                  <AccountingAlertRow key={alert.id} {...alert} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
