import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  AlertCircle,
  Clock,
  Truck,
  ArrowUp,
  ArrowDown,
  BarChart2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import {
  usePurchasingDashboard,
  type PurchasingDashboardPeriod,
} from '@/hooks/usePurchasingDashboard';
import './PurchasingDashboardPage.css';

const VolumeByStageChart = lazy(
  () => import('@/components/purchasing-dashboard/VolumeByStageChart'),
);
const PurchasesByCategoryChart = lazy(
  () => import('@/components/purchasing-dashboard/PurchasesByCategoryChart'),
);
const MonthlyEvolutionChart = lazy(
  () => import('@/components/purchasing-dashboard/MonthlyEvolutionChart'),
);
const UrgentVsPlannedChart = lazy(
  () => import('@/components/purchasing-dashboard/UrgentVsPlannedChart'),
);

/* ────────────────────────────────────────────────────── */
/* Period helpers                                          */
/* ────────────────────────────────────────────────────── */

const PERIOD_OPTIONS = [
  { label: 'Mes', value: 'month' },
  { label: 'Trimestre', value: 'quarter' },
  { label: 'Safra', value: 'crop_season' },
  { label: 'Personalizado', value: 'custom' },
];

function resolvePeriod(
  value: string,
  customStart?: string,
  customEnd?: string,
): PurchasingDashboardPeriod {
  const now = new Date();
  switch (value) {
    case 'month': {
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(Date.UTC(year, month, 1));
      const lastDay = new Date(Date.UTC(year, month + 1, 0));
      return {
        periodStart: firstDay.toISOString().slice(0, 10),
        periodEnd: lastDay.toISOString().slice(0, 10),
      };
    }
    case 'quarter': {
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 2, 1));
      return {
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
      };
    }
    case 'crop_season': {
      // Jul 1 to Jun 30
      const currentMonth = now.getMonth() + 1; // 1-indexed
      let startYear: number;
      let endYear: number;
      if (currentMonth >= 7) {
        startYear = now.getFullYear();
        endYear = now.getFullYear() + 1;
      } else {
        startYear = now.getFullYear() - 1;
        endYear = now.getFullYear();
      }
      return {
        periodStart: `${startYear}-07-01`,
        periodEnd: `${endYear}-06-30`,
      };
    }
    case 'custom':
      return {
        periodStart: customStart ?? now.toISOString().slice(0, 10),
        periodEnd: customEnd ?? now.toISOString().slice(0, 10),
      };
    default: {
      const year = now.getFullYear();
      const month = now.getMonth();
      return {
        periodStart: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
        periodEnd: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
      };
    }
  }
}

/* ────────────────────────────────────────────────────── */
/* YoY Badge — for all 4 KPIs: up = bad                   */
/* ────────────────────────────────────────────────────── */

interface YoyBadgeProps {
  current: number;
  prev: number;
}

function YoyBadge({ current, prev }: YoyBadgeProps) {
  if (prev === 0 && current === 0) {
    return (
      <span className="purch-dashboard__yoy--neutral" aria-label="Sem variacao">
        0%
      </span>
    );
  }

  if (prev === 0) {
    return (
      <span
        className="purch-dashboard__yoy--bad"
        aria-label="Aumento em relacao ao periodo anterior"
      >
        <ArrowUp size={12} aria-hidden="true" />
        +novo
      </span>
    );
  }

  const pct = (((current - prev) / Math.abs(prev)) * 100).toFixed(1);
  const numPct = parseFloat(pct);

  if (numPct > 0) {
    // Up is bad for all purchasing KPIs
    return (
      <span
        className="purch-dashboard__yoy--bad"
        aria-label={`Aumento de ${pct}% em relacao ao periodo anterior`}
      >
        <ArrowUp size={12} aria-hidden="true" />
        {`+${pct}%`}
      </span>
    );
  }

  if (numPct < 0) {
    // Down is good for all purchasing KPIs
    return (
      <span
        className="purch-dashboard__yoy--good"
        aria-label={`Reducao de ${Math.abs(numPct).toFixed(1)}% em relacao ao periodo anterior`}
      >
        <ArrowDown size={12} aria-hidden="true" />
        {`${pct}%`}
      </span>
    );
  }

  return (
    <span className="purch-dashboard__yoy--neutral" aria-label="Sem variacao">
      0%
    </span>
  );
}

/* ────────────────────────────────────────────────────── */
/* Skeleton                                               */
/* ────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dashboard de compras">
      <div className="purch-dashboard__skeleton-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="purch-dashboard__skeleton" style={{ height: '120px' }} />
        ))}
      </div>
      <div className="purch-dashboard__skeleton-charts">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="purch-dashboard__skeleton" style={{ height: '348px' }} />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* Main page                                              */
/* ────────────────────────────────────────────────────── */

export default function PurchasingDashboardPage() {
  const { user } = useAuth();
  const { farms } = useFarmContext();
  const navigate = useNavigate();

  const orgId = user?.organizationId ?? '';

  const [localFarmId, setLocalFarmId] = useState<string | null>(null);
  const [periodValue, setPeriodValue] = useState<string>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const period = resolvePeriod(periodValue, customStart, customEnd);

  const { data, isLoading, error, refetch } = usePurchasingDashboard(orgId, localFarmId, period);

  const isEmpty =
    !isLoading &&
    !error &&
    data !== null &&
    data.pendingApprovalCount === 0 &&
    data.overduePoCount === 0 &&
    data.avgCycleDays === 0 &&
    data.lateDeliveriesCount === 0 &&
    data.volumeByStage.length === 0 &&
    data.monthlyEvolution.length === 0;

  return (
    <main className="purch-dashboard" id="main-content">
      {/* Header */}
      <header className="purch-dashboard__header">
        <h1>Dashboard de Compras</h1>
        <p>Indicadores operacionais e evolucao do ciclo de compras</p>
      </header>

      {/* Filters */}
      <div className="purch-dashboard__filters" role="search" aria-label="Filtros do dashboard">
        <div className="purch-dashboard__filter-group">
          <label htmlFor="purch-farm-filter">Fazenda</label>
          <select
            id="purch-farm-filter"
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

        <div className="purch-dashboard__filter-group">
          <label htmlFor="purch-period-filter">Periodo</label>
          <select
            id="purch-period-filter"
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            aria-label="Selecionar periodo"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {periodValue === 'custom' && (
          <>
            <div className="purch-dashboard__filter-group">
              <label htmlFor="purch-date-start">De</label>
              <input
                id="purch-date-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Data inicial"
              />
            </div>
            <div className="purch-dashboard__filter-group">
              <label htmlFor="purch-date-end">Ate</label>
              <input
                id="purch-date-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="Data final"
              />
            </div>
          </>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <DashboardSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div className="purch-dashboard__error" role="alert">
          <AlertCircle size={48} color="var(--color-error-500)" aria-hidden="true" />
          <h2>Nao foi possivel carregar os dados</h2>
          <p>Verifique sua conexao e tente novamente.</p>
          <button type="button" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="purch-dashboard__empty" role="status">
          <BarChart2 size={64} color="var(--color-neutral-300)" aria-hidden="true" />
          <h2>Sem dados para o periodo</h2>
          <p>Selecione um periodo diferente ou aguarde o cadastro das primeiras requisicoes.</p>
        </div>
      )}

      {/* Dashboard content */}
      {!isLoading && !error && data !== null && !isEmpty && (
        <>
          {/* KPI cards */}
          <section aria-label="Indicadores principais de compras">
            <div className="purch-dashboard__kpis">
              {/* KPI 1: RCs pendentes de aprovacao — clickable */}
              <button
                type="button"
                className="purch-dashboard__kpi-card--clickable"
                aria-label={`RCs pendentes de aprovacao: ${String(data.pendingApprovalCount)}, ver detalhes`}
                onClick={() => navigate('/purchase-requests?status=PENDENTE')}
              >
                <div className="purch-dashboard__kpi-icon" aria-hidden="true">
                  <ShoppingCart size={20} />
                </div>
                <span className="purch-dashboard__kpi-label">RCs pendentes de aprovacao</span>
                <div className="purch-dashboard__kpi-value">
                  {String(data.pendingApprovalCount)}
                </div>
                <YoyBadge
                  current={data.pendingApprovalCount}
                  prev={data.pendingApprovalCountPrev}
                />
              </button>

              {/* KPI 2: OCs em atraso — clickable */}
              <button
                type="button"
                className="purch-dashboard__kpi-card--clickable"
                aria-label={`OCs em atraso: ${String(data.overduePoCount)}, ver detalhes`}
                onClick={() => navigate('/purchasing-kanban?filter=overdue_po')}
              >
                <div className="purch-dashboard__kpi-icon" aria-hidden="true">
                  <AlertCircle size={20} />
                </div>
                <span className="purch-dashboard__kpi-label">OCs em atraso</span>
                <div
                  className={`purch-dashboard__kpi-value${data.overduePoCount > 0 ? ' purch-dashboard__kpi-value--alert' : ''}`}
                >
                  {String(data.overduePoCount)}
                </div>
                <YoyBadge current={data.overduePoCount} prev={data.overduePoCountPrev} />
              </button>

              {/* KPI 3: Prazo medio do ciclo — NOT clickable */}
              <div
                className="purch-dashboard__kpi-card"
                role="status"
                aria-label={`Prazo medio do ciclo: ${String(data.avgCycleDays)} dias`}
              >
                <div className="purch-dashboard__kpi-icon" aria-hidden="true">
                  <Clock size={20} />
                </div>
                <span className="purch-dashboard__kpi-label">Prazo medio do ciclo (dias)</span>
                <div className="purch-dashboard__kpi-value">{String(data.avgCycleDays)}</div>
                <YoyBadge current={data.avgCycleDays} prev={data.avgCycleDaysPrev} />
              </div>

              {/* KPI 4: Entregas atrasadas — clickable */}
              <button
                type="button"
                className="purch-dashboard__kpi-card--clickable"
                aria-label={`Entregas atrasadas: ${String(data.lateDeliveriesCount)}, ver detalhes`}
                onClick={() => navigate('/purchasing-kanban?filter=late_deliveries')}
              >
                <div className="purch-dashboard__kpi-icon" aria-hidden="true">
                  <Truck size={20} />
                </div>
                <span className="purch-dashboard__kpi-label">Entregas atrasadas</span>
                <div
                  className={`purch-dashboard__kpi-value${data.lateDeliveriesCount > 0 ? ' purch-dashboard__kpi-value--alert' : ''}`}
                >
                  {String(data.lateDeliveriesCount)}
                </div>
                <YoyBadge current={data.lateDeliveriesCount} prev={data.lateDeliveriesCountPrev} />
              </button>
            </div>
          </section>

          {/* Alerts section — only show alerts with count > 0 */}
          {(data.alerts.overduePoCount > 0 ||
            data.alerts.rcAboveSlaCount > 0 ||
            data.alerts.budgetExceededCount > 0 ||
            data.alerts.lateDeliveriesCount > 0) && (
            <section
              className="purch-dashboard__alerts"
              aria-label="Alertas de compras"
              role="status"
            >
              <h2 className="purch-dashboard__alerts-title">Alertas</h2>

              {data.alerts.overduePoCount > 0 && (
                <div className="purch-dashboard__alert-row purch-dashboard__alert-row--error">
                  <AlertCircle size={20} color="var(--color-error-500)" aria-hidden="true" />
                  <span>{data.alerts.overduePoCount} OCs vencidas</span>
                  <a href="/purchasing-kanban?filter=overdue_po">Ver no kanban</a>
                </div>
              )}

              {data.alerts.rcAboveSlaCount > 0 && (
                <div className="purch-dashboard__alert-row">
                  <AlertTriangle size={20} color="var(--color-warning-500)" aria-hidden="true" />
                  <span>{data.alerts.rcAboveSlaCount} RCs acima do SLA</span>
                  <a href="/purchase-requests?status=PENDENTE">Ver requisicoes</a>
                </div>
              )}

              {data.alerts.budgetExceededCount > 0 && (
                <div className="purch-dashboard__alert-row">
                  <AlertTriangle size={20} color="var(--color-warning-500)" aria-hidden="true" />
                  <span>Orcamento estourado em {data.alerts.budgetExceededCount} categorias</span>
                  <a href="/purchase-budgets">Ver orcamentos</a>
                </div>
              )}

              {data.alerts.lateDeliveriesCount > 0 && (
                <div className="purch-dashboard__alert-row purch-dashboard__alert-row--error">
                  <AlertCircle size={20} color="var(--color-error-500)" aria-hidden="true" />
                  <span>{data.alerts.lateDeliveriesCount} entregas atrasadas</span>
                  <a href="/purchasing-kanban?filter=late_deliveries">Ver no kanban</a>
                </div>
              )}
            </section>
          )}

          {/* Charts section */}
          <section aria-label="Graficos de compras">
            <div className="purch-dashboard__charts">
              <div className="purch-dashboard__chart-card">
                <h2 className="purch-dashboard__chart-title">Volume por etapa</h2>
                <Suspense
                  fallback={
                    <div
                      className="purch-dashboard__chart-skeleton"
                      aria-label="Carregando grafico"
                    />
                  }
                >
                  <VolumeByStageChart data={data.volumeByStage} />
                </Suspense>
              </div>

              <div className="purch-dashboard__chart-card">
                <h2 className="purch-dashboard__chart-title">Compras por categoria</h2>
                <Suspense
                  fallback={
                    <div
                      className="purch-dashboard__chart-skeleton"
                      aria-label="Carregando grafico"
                    />
                  }
                >
                  <PurchasesByCategoryChart data={data.purchasesByCategory} />
                </Suspense>
              </div>

              <div className="purch-dashboard__chart-card">
                <h2 className="purch-dashboard__chart-title">Evolucao mensal (12 meses)</h2>
                <Suspense
                  fallback={
                    <div
                      className="purch-dashboard__chart-skeleton"
                      aria-label="Carregando grafico"
                    />
                  }
                >
                  <MonthlyEvolutionChart data={data.monthlyEvolution} />
                </Suspense>
              </div>

              <div className="purch-dashboard__chart-card">
                <h2 className="purch-dashboard__chart-title">Urgentes vs planejadas</h2>
                <Suspense
                  fallback={
                    <div
                      className="purch-dashboard__chart-skeleton"
                      aria-label="Carregando grafico"
                    />
                  }
                >
                  <UrgentVsPlannedChart data={data.urgentVsPlanned} />
                </Suspense>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
