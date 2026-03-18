import { useState, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Wallet,
  AlertCircle,
  BarChart2,
} from 'lucide-react';
import { usePurchaseDashboard, type DashboardFilters } from '@/hooks/usePurchaseDashboard';
import type { KpiValue } from '@/hooks/usePurchaseDashboard';
import { useFarmContext } from '@/stores/FarmContext';
import './PurchaseDashboardPage.css';

// ─── Lazy-loaded chart components ─────────────────────────────────────────────

const PurchaseCategoryChart = lazy(
  () => import('@/components/purchase-dashboard/PurchaseCategoryChart'),
);
const PurchaseSavingChart = lazy(
  () => import('@/components/purchase-dashboard/PurchaseSavingChart'),
);
const BudgetVsActualChart = lazy(
  () => import('@/components/purchase-dashboard/BudgetVsActualChart'),
);

// ─── Date helpers ─────────────────────────────────────────────────────────────

interface DatePreset {
  label: string;
  start: string;
  end: string;
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}

function getDatePresets(): DatePreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  return [
    {
      label: 'Mes atual',
      start: fmt(new Date(Date.UTC(y, m, 1))),
      end: fmt(new Date(Date.UTC(y, m + 1, 0))),
    },
    {
      label: 'Trimestre',
      start: fmt(new Date(Date.UTC(y, m - 2, 1))),
      end: fmt(new Date(Date.UTC(y, m + 1, 0))),
    },
    {
      label: 'Safra',
      start: fmt(new Date(Date.UTC(y - 1, 6, 1))),
      end: fmt(new Date(Date.UTC(y, 5, 30))),
    },
    {
      label: 'Ano',
      start: fmt(new Date(Date.UTC(y, 0, 1))),
      end: fmt(new Date(Date.UTC(y, 11, 31))),
    },
  ];
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number): string {
  return `${value.toFixed(1)} dias`;
}

// ─── Comparison Badge ─────────────────────────────────────────────────────────

interface ChangeBadgeProps {
  kpi: KpiValue;
  invertColors?: boolean; // true = positive change is bad (e.g. cycle time)
}

function ChangeBadge({ kpi, invertColors = false }: ChangeBadgeProps) {
  const pct = kpi.changePercent;

  if (pct === 0 || kpi.previous === 0) {
    return <span className="kpi-badge kpi-badge--neutral">—</span>;
  }

  const isPositive = pct > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  const className = `kpi-badge ${isGood ? 'kpi-badge--positive' : 'kpi-badge--negative'}`;
  const sign = isPositive ? '+' : '';

  return (
    <span className={className}>
      {isPositive ? (
        <ArrowUp size={12} aria-hidden="true" />
      ) : (
        <ArrowDown size={12} aria-hidden="true" />
      )}
      {sign}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  kpi: KpiValue;
  invertColors?: boolean;
}

function KpiCard({ icon: Icon, label, value, kpi, invertColors }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <ChangeBadge kpi={kpi} invertColors={invertColors} />
    </article>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando dashboard de compras">
      <div className="kpi-grid">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="kpi-card kpi-card--skeleton" />
        ))}
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-skeleton" aria-label="Carregando grafico" />
        </div>
        <div className="chart-card">
          <div className="chart-skeleton" aria-label="Carregando grafico" />
        </div>
        <div className="chart-card chart-card--full">
          <div className="chart-skeleton" aria-label="Carregando grafico" />
        </div>
      </div>
      <div className="alerts-panel" style={{ marginTop: 24 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="alert-item--skeleton" />
        ))}
      </div>
    </div>
  );
}

// ─── Alert type icon ──────────────────────────────────────────────────────────

function alertIcon(type: string) {
  switch (type) {
    case 'PENDING_RC_AGING':
      return <Clock size={20} className="alert-item__icon" aria-hidden="true" />;
    case 'PO_OVERDUE':
      return <AlertTriangle size={20} className="alert-item__icon" aria-hidden="true" />;
    case 'BUDGET_OVERAGE':
      return <Wallet size={20} className="alert-item__icon" aria-hidden="true" />;
    default:
      return <AlertCircle size={20} className="alert-item__icon" aria-hidden="true" />;
  }
}

function alertPath(type: string): string {
  switch (type) {
    case 'PENDING_RC_AGING':
      return '/purchase-requests';
    case 'PO_OVERDUE':
      return '/purchase-orders';
    case 'BUDGET_OVERAGE':
      return '/purchase-budgets';
    default:
      return '/purchase-requests';
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchaseDashboardPage() {
  const { farms } = useFarmContext();
  const navigate = useNavigate();
  const presets = getDatePresets();
  const defaultPreset = presets[0]!;

  const [startDate, setStartDate] = useState(defaultPreset.start);
  const [endDate, setEndDate] = useState(defaultPreset.end);
  const [activePreset, setActivePreset] = useState(defaultPreset.label);
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(undefined);

  const filters: DashboardFilters = {
    startDate,
    endDate,
    farmId,
    category,
  };

  const { metrics, charts, alerts, isLoading, error } = usePurchaseDashboard(filters);

  function handlePreset(preset: DatePreset) {
    setStartDate(preset.start);
    setEndDate(preset.end);
    setActivePreset(preset.label);
  }

  return (
    <main className="pur-dashboard" id="main-content">
      {/* Breadcrumb */}
      <nav className="pur-dashboard__breadcrumb" aria-label="Trilha de navegacao">
        <Link to="/suppliers">Compras</Link>
        <span aria-hidden="true">/</span>
        <span>Dashboard</span>
      </nav>

      {/* Header */}
      <header className="pur-dashboard__header">
        <h1 className="pur-dashboard__title">Dashboard de Compras</h1>
      </header>

      {/* Filters */}
      <div
        className="pur-dashboard__filters"
        role="search"
        aria-label="Filtros do dashboard de compras"
      >
        <div className="pur-dashboard__presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`pur-dashboard__preset-btn ${activePreset === p.label ? 'active' : ''}`}
              onClick={() => handlePreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="pur-dashboard__date-range">
          <div className="pur-dashboard__filter-group">
            <label htmlFor="pur-filter-start">De</label>
            <input
              id="pur-filter-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>
          <div className="pur-dashboard__filter-group">
            <label htmlFor="pur-filter-end">Ate</label>
            <input
              id="pur-filter-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>
          {farms.length > 0 && (
            <div className="pur-dashboard__filter-group">
              <label htmlFor="pur-filter-farm">Fazenda</label>
              <select
                id="pur-filter-farm"
                value={farmId ?? ''}
                onChange={(e) => setFarmId(e.target.value || undefined)}
              >
                <option value="">Todas</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="pur-dashboard__filter-group">
            <label htmlFor="pur-filter-cat">Categoria</label>
            <select
              id="pur-filter-cat"
              value={category ?? ''}
              onChange={(e) => setCategory(e.target.value || undefined)}
            >
              <option value="">Todas</option>
              <option value="INPUTS">Insumos</option>
              <option value="SERVICES">Servicos</option>
              <option value="EQUIPMENT">Equipamentos</option>
              <option value="FUEL">Combustivel</option>
              <option value="OTHER">Outros</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && <DashboardSkeleton />}

      {/* Error */}
      {!isLoading && error && (
        <div className="pur-dashboard__error" role="alert">
          <AlertCircle size={48} aria-hidden="true" />
          <h2>Nao foi possivel carregar o dashboard</h2>
          <p>Verifique sua conexao e tente novamente.</p>
        </div>
      )}

      {/* Dashboard content */}
      {!isLoading && !error && metrics && charts && (
        <>
          {/* KPI Cards */}
          <section aria-label="Indicadores principais de compras">
            <div className="kpi-grid">
              <KpiCard
                icon={DollarSign}
                label="Volume Total"
                value={formatBRL(metrics.totalVolume.current)}
                kpi={metrics.totalVolume}
              />
              <KpiCard
                icon={FileText}
                label="Requisicoes"
                value={String(metrics.requestCount.current)}
                kpi={metrics.requestCount}
              />
              <KpiCard
                icon={Clock}
                label="Ciclo Medio"
                value={formatDays(metrics.avgCycleTimeDays.current)}
                kpi={metrics.avgCycleTimeDays}
                invertColors
              />
              <KpiCard
                icon={CheckCircle}
                label="Entrega no Prazo"
                value={formatPercent(metrics.onTimeDeliveryPct.current)}
                kpi={metrics.onTimeDeliveryPct}
              />
              <KpiCard
                icon={TrendingDown}
                label="Saving Acumulado"
                value={formatBRL(metrics.accumulatedSaving.current)}
                kpi={metrics.accumulatedSaving}
              />
            </div>
          </section>

          {/* Charts */}
          <section aria-label="Graficos de compras" className="charts-grid">
            <div className="chart-card">
              <h2 className="chart-title">Compras por Categoria</h2>
              <Suspense
                fallback={
                  <div
                    className="chart-skeleton"
                    aria-label="Carregando grafico de compras por categoria"
                  />
                }
              >
                <PurchaseCategoryChart data={charts.purchasesByCategory} />
              </Suspense>
            </div>

            <div className="chart-card">
              <h2 className="chart-title">Evolucao do Saving</h2>
              <Suspense
                fallback={
                  <div
                    className="chart-skeleton"
                    aria-label="Carregando grafico de evolucao do saving"
                  />
                }
              >
                <PurchaseSavingChart data={charts.savingEvolution} />
              </Suspense>
            </div>

            <div className="chart-card chart-card--full">
              <h2 className="chart-title">Orcamento vs Realizado</h2>
              <Suspense
                fallback={
                  <div
                    className="chart-skeleton"
                    aria-label="Carregando grafico de orcamento vs realizado"
                  />
                }
              >
                <BudgetVsActualChart data={charts.budgetVsActual} />
              </Suspense>
            </div>
          </section>

          {/* Alerts Panel */}
          <section className="alerts-panel" aria-label="Alertas de compras" role="status">
            <div className="alerts-panel__header">
              <AlertTriangle
                size={20}
                color="var(--color-warning-600, #e65100)"
                aria-hidden="true"
              />
              <h2 className="alerts-panel__title">Alertas</h2>
            </div>

            {alerts.length === 0 ? (
              <div className="alerts-panel__empty">
                <CheckCircle
                  size={24}
                  color="var(--color-success-600, #2e7d32)"
                  aria-hidden="true"
                />
                <span>Nenhum alerta no momento</span>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {alerts.map((alert, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      className="alert-item"
                      onClick={() => navigate(alertPath(alert.type))}
                    >
                      {alertIcon(alert.type)}
                      <span className="alert-item__message">{alert.message}</span>
                      <span className="alert-count" aria-label={`${alert.count} itens`}>
                        {alert.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Empty state when loaded but no data */}
      {!isLoading && !error && !metrics && (
        <div className="pur-dashboard__error" role="status">
          <BarChart2 size={64} color="var(--color-neutral-300)" aria-hidden="true" />
          <h2>Nenhum dado no periodo</h2>
          <p>Selecione um periodo com movimentacoes de compra para visualizar o dashboard.</p>
        </div>
      )}
    </main>
  );
}
