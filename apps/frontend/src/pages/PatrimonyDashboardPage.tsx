import { useFarms } from '@/hooks/useFarms';
import { usePatrimonyDashboard } from '@/hooks/usePatrimonyDashboard';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, AlertCircle } from 'lucide-react';
import { ASSET_TYPE_LABELS, ASSET_STATUS_LABELS } from '@/types/asset';
import type { AssetType, AssetStatus } from '@/types/asset';
import './PatrimonyDashboardPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(value: number): string {
  return currencyFmt.format(value);
}

const CHART_COLORS = [
  'var(--color-primary-600)',
  '#0288d1',
  '#f57c00',
  '#7b1fa2',
  '#c62828',
  '#00695c',
  '#1565c0',
  '#558b2f',
];

const MONTH_LABELS: Record<number, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Marco',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro',
};

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: 'gain' | 'loss' | 'neutral';
}

function KpiCard({ label, value, sub, variant = 'neutral' }: KpiCardProps) {
  return (
    <div className="patrimony-dashboard__kpi-card">
      <span className="patrimony-dashboard__kpi-label">{label}</span>
      <span className={`patrimony-dashboard__kpi-value patrimony-dashboard__kpi-value--${variant}`}>
        {variant === 'gain' && <TrendingUp size={18} aria-hidden="true" />}
        {variant === 'loss' && <TrendingDown size={18} aria-hidden="true" />}
        {value}
      </span>
      {sub && <span className="patrimony-dashboard__kpi-sub">{sub}</span>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="patrimony-dashboard__skeleton" role="status" aria-label="Carregando dashboard">
      <div className="patrimony-dashboard__kpi-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="patrimony-dashboard__skeleton-card" />
        ))}
      </div>
      <div className="patrimony-dashboard__skeleton-chart" />
      <div className="patrimony-dashboard__skeleton-chart" />
    </div>
  );
}

// ─── PatrimonyDashboardPage ───────────────────────────────────────────────────

export default function PatrimonyDashboardPage() {
  const { data, isLoading, error, year, month, farmId, setYear, setMonth, setFarmId } =
    usePatrimonyDashboard();
  const { farms } = useFarms();

  const gainLoss = data?.disposalsInPeriod.totalGainLoss ?? 0;
  const gainLossVariant = gainLoss > 0 ? 'gain' : gainLoss < 0 ? 'loss' : 'neutral';

  // Prepare chart data
  const typeChartData =
    data?.assetCountByType.map((d) => ({
      name: ASSET_TYPE_LABELS[d.assetType as AssetType] ?? d.assetType,
      value: d.count,
    })) ?? [];

  const statusChartData =
    data?.assetCountByStatus.map((d) => ({
      name: ASSET_STATUS_LABELS[d.status as AssetStatus] ?? d.status,
      value: d.count,
    })) ?? [];

  return (
    <main className="patrimony-dashboard" id="main-content">
      {/* Breadcrumb */}
      <nav className="patrimony-dashboard__breadcrumb" aria-label="Caminho de navegacao">
        <span>Inicio</span>
        <span aria-hidden="true">&gt;</span>
        <span>Patrimonio</span>
        <span aria-hidden="true">&gt;</span>
        <span aria-current="page">Dashboard Patrimonial</span>
      </nav>

      {/* Header */}
      <header className="patrimony-dashboard__header">
        <div className="patrimony-dashboard__header-left">
          <BarChart3 size={28} aria-hidden="true" className="patrimony-dashboard__header-icon" />
          <h1 className="patrimony-dashboard__title">Dashboard Patrimonial</h1>
        </div>

        {/* Period filters */}
        <div className="patrimony-dashboard__filters">
          <div className="patrimony-dashboard__filter-field">
            <label htmlFor="pd-year" className="patrimony-dashboard__filter-label">
              Ano
            </label>
            <select
              id="pd-year"
              className="patrimony-dashboard__select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="patrimony-dashboard__filter-field">
            <label htmlFor="pd-month" className="patrimony-dashboard__filter-label">
              Mes
            </label>
            <select
              id="pd-month"
              className="patrimony-dashboard__select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Object.entries(MONTH_LABELS).map(([num, label]) => (
                <option key={num} value={num}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="patrimony-dashboard__filter-field">
            <label htmlFor="pd-farm" className="patrimony-dashboard__filter-label">
              Fazenda
            </label>
            <select
              id="pd-farm"
              className="patrimony-dashboard__select"
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
        </div>
      </header>

      {/* Error */}
      {error && !isLoading && (
        <div className="patrimony-dashboard__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && !data && <DashboardSkeleton />}

      {/* Content */}
      {data && (
        <div className="patrimony-dashboard__content">
          {/* KPI Cards */}
          <section className="patrimony-dashboard__kpi-section" aria-label="Indicadores chave">
            <div className="patrimony-dashboard__kpi-grid">
              <KpiCard label="Valor Total Ativos" value={formatBRL(data.totalActiveValue)} />
              <KpiCard
                label="Depreciacao Acumulada"
                value={formatBRL(data.accumulatedDepreciation)}
                variant="loss"
              />
              <KpiCard label="Valor Contabil Liquido" value={formatBRL(data.netBookValue)} />
              <KpiCard
                label="Ganho/Perda no Periodo"
                value={formatBRL(Math.abs(gainLoss))}
                variant={gainLossVariant}
                sub={gainLoss >= 0 ? 'Ganho' : 'Perda'}
              />
            </div>
          </section>

          {/* Period summary */}
          <section className="patrimony-dashboard__period-section" aria-label="Resumo do periodo">
            <div className="patrimony-dashboard__period-grid">
              <div className="patrimony-dashboard__period-card">
                <h3 className="patrimony-dashboard__period-title">Aquisicoes no Periodo</h3>
                <div className="patrimony-dashboard__period-stats">
                  <span className="patrimony-dashboard__period-count">
                    {data.acquisitionsInPeriod.count} ativos
                  </span>
                  <span className="patrimony-dashboard__period-value">
                    {formatBRL(data.acquisitionsInPeriod.totalValue)}
                  </span>
                </div>
              </div>

              <div className="patrimony-dashboard__period-card">
                <h3 className="patrimony-dashboard__period-title">Baixas no Periodo</h3>
                <div className="patrimony-dashboard__period-stats">
                  <span className="patrimony-dashboard__period-count">
                    {data.disposalsInPeriod.count} ativos
                  </span>
                  <span className="patrimony-dashboard__period-value">
                    {formatBRL(data.disposalsInPeriod.totalSaleValue)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Charts */}
          <section className="patrimony-dashboard__charts-section" aria-label="Graficos">
            <div className="patrimony-dashboard__charts-grid">
              {/* Type distribution */}
              <div className="patrimony-dashboard__chart-card">
                <h3 className="patrimony-dashboard__chart-title">Distribuicao por Tipo</h3>
                {typeChartData.length === 0 ? (
                  <p className="patrimony-dashboard__chart-empty">Sem dados para exibir.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        nameKey="name"
                        labelLine={false}
                      >
                        {typeChartData.map((_, index) => (
                          <Cell
                            key={`cell-type-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status distribution */}
              <div className="patrimony-dashboard__chart-card">
                <h3 className="patrimony-dashboard__chart-title">Distribuicao por Status</h3>
                {statusChartData.length === 0 ? (
                  <p className="patrimony-dashboard__chart-empty">Sem dados para exibir.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statusChartData} layout="vertical">
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--color-primary-600)" radius={[0, 4, 4, 0]}>
                        {statusChartData.map((_, index) => (
                          <Cell
                            key={`cell-status-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
