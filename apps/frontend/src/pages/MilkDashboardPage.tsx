import { useState, useCallback } from 'react';
import {
  Milk,
  Download,
  AlertCircle,
  Droplets,
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart3,
  DollarSign,
  Heart,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useMilkDashboard } from '@/hooks/useMilkDashboard';
import { useLots } from '@/hooks/useLots';
import type { MilkDashboardPeriod } from '@/hooks/useMilkDashboard';
import type { CowRankingItem } from '@/types/milk-dashboard';
import './MilkDashboardPage.css';

const PERIOD_OPTIONS: { value: MilkDashboardPeriod; label: string }[] = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '365d', label: '365 dias' },
];

function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qualityBadgeClass(type: 'scc' | 'tbc', value: number | null): string {
  if (value === null) return 'milk-dashboard__quality-badge--neutral';
  if (type === 'scc') {
    if (value <= 200000) return 'milk-dashboard__quality-badge--good';
    if (value <= 400000) return 'milk-dashboard__quality-badge--warning';
    return 'milk-dashboard__quality-badge--danger';
  }
  // TBC
  if (value <= 100000) return 'milk-dashboard__quality-badge--good';
  if (value <= 300000) return 'milk-dashboard__quality-badge--warning';
  return 'milk-dashboard__quality-badge--danger';
}

function formatScc(value: number | null): string {
  if (value === null) return '—';
  return `${formatNumber(Math.round(value))} cel/mL`;
}

function formatTbc(value: number | null): string {
  if (value === null) return '—';
  return `${formatNumber(Math.round(value))} UFC/mL`;
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === 'IMPROVING') {
    return (
      <span className="milk-dashboard__trend milk-dashboard__trend--good" aria-label="Melhorando">
        <TrendingDown size={16} aria-hidden="true" />
        Melhorando
      </span>
    );
  }
  if (trend === 'WORSENING') {
    return (
      <span className="milk-dashboard__trend milk-dashboard__trend--danger" aria-label="Piorando">
        <TrendingUp size={16} aria-hidden="true" />
        Piorando
      </span>
    );
  }
  if (trend === 'STABLE') {
    return (
      <span className="milk-dashboard__trend milk-dashboard__trend--neutral" aria-label="Estável">
        <Minus size={16} aria-hidden="true" />
        Estável
      </span>
    );
  }
  return <span className="milk-dashboard__trend milk-dashboard__trend--neutral">—</span>;
}

function CowRankingTable({
  title,
  cows,
  variant,
}: {
  title: string;
  cows: CowRankingItem[];
  variant: 'top' | 'bottom';
}) {
  if (cows.length === 0) return null;

  return (
    <div className="milk-dashboard__ranking">
      <div className={`milk-dashboard__ranking-header milk-dashboard__ranking-header--${variant}`}>
        <h3>{title}</h3>
      </div>
      <div className="milk-dashboard__table-wrapper">
        <table className="milk-dashboard__table">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Brinco</th>
              <th scope="col">Nome</th>
              <th scope="col">Total (L)</th>
              <th scope="col">Média/dia (L)</th>
              <th scope="col">Lote</th>
            </tr>
          </thead>
          <tbody>
            {cows.map((cow) => (
              <tr key={cow.animalId}>
                <td className="milk-dashboard__mono">{cow.earTag}</td>
                <td>{cow.animalName || '—'}</td>
                <td className="milk-dashboard__mono">{formatNumber(cow.totalLiters, 1)}</td>
                <td className="milk-dashboard__mono">{formatNumber(cow.avgLitersPerDay, 2)}</td>
                <td>{cow.lotName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MilkDashboardPage() {
  const { selectedFarm } = useFarmContext();
  const [period, setPeriod] = useState<MilkDashboardPeriod>('30d');
  const [lotFilter, setLotFilter] = useState('');

  const { lots } = useLots({ farmId: selectedFarm?.id ?? null, limit: 200 });

  const { data, isLoading, error } = useMilkDashboard({
    farmId: selectedFarm?.id ?? null,
    period,
    lotId: lotFilter || undefined,
  });

  const handleExport = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (lotFilter) params.set('lotId', lotFilter);
      const qs = params.toString();
      const url = `/org/farms/${selectedFarm.id}/milk-dashboard/export${qs ? `?${qs}` : ''}`;

      const response = await fetch(`/api${url}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('protos_access_token') ?? ''}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao exportar');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dashboard-leite.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // silent
    }
  }, [selectedFarm, period, lotFilter]);

  if (!selectedFarm) {
    return (
      <section className="milk-dashboard">
        <div className="milk-dashboard__empty">
          <Milk size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver o dashboard de produção de leite.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="milk-dashboard">
      {/* Header */}
      <header className="milk-dashboard__header">
        <div>
          <h1>Dashboard de produção de leite</h1>
          <p>Visão consolidada da produção leiteira — {selectedFarm.name}</p>
        </div>
        <div className="milk-dashboard__header-actions">
          <button
            type="button"
            className="milk-dashboard__btn-export"
            onClick={() => void handleExport()}
            aria-label="Exportar relatório de leite em CSV"
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="milk-dashboard__filters">
        {/* Period toggle */}
        <div className="milk-dashboard__period-toggle" role="group" aria-label="Período">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`milk-dashboard__period-btn ${period === opt.value ? 'milk-dashboard__period-btn--active' : ''}`}
              onClick={() => setPeriod(opt.value)}
              aria-pressed={period === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Lot filter */}
        <label className="milk-dashboard__filter-label" htmlFor="milk-lot-filter">
          Lote
        </label>
        <select
          id="milk-lot-filter"
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
          aria-label="Filtrar por lote"
        >
          <option value="">Todos os lotes</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="milk-dashboard__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="milk-dashboard__skeletons">
          <div className="milk-dashboard__skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="milk-dashboard__skeleton-card" />
            ))}
          </div>
          <div className="milk-dashboard__skeleton-bar" />
          <div className="milk-dashboard__skeleton-grid milk-dashboard__skeleton-grid--2col">
            <div className="milk-dashboard__skeleton-card milk-dashboard__skeleton-card--tall" />
            <div className="milk-dashboard__skeleton-card milk-dashboard__skeleton-card--tall" />
          </div>
        </div>
      )}

      {/* Dashboard content */}
      {!isLoading && data && (
        <>
          {/* KPIs (CA1) */}
          <div className="milk-dashboard__kpis">
            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--green">
                <Droplets size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">{formatNumber(data.kpis.todayLiters, 1)}</p>
              <p className="milk-dashboard__kpi-unit">litros</p>
              <p className="milk-dashboard__kpi-label">Produção hoje</p>
            </div>

            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--green">
                <BarChart3 size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">{formatNumber(data.kpis.monthLiters, 1)}</p>
              <p className="milk-dashboard__kpi-unit">litros</p>
              <p className="milk-dashboard__kpi-label">Produção mês</p>
            </div>

            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--blue">
                <BarChart3 size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">
                {formatNumber(data.kpis.accumulatedLiters, 1)}
              </p>
              <p className="milk-dashboard__kpi-unit">litros</p>
              <p className="milk-dashboard__kpi-label">Acumulado período</p>
            </div>

            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--green">
                <Milk size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">
                {formatNumber(data.kpis.avgLitersPerCow, 2)}
              </p>
              <p className="milk-dashboard__kpi-unit">L/vaca/dia</p>
              <p className="milk-dashboard__kpi-label">Média por vaca</p>
            </div>

            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--blue">
                <Heart size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">{data.kpis.cowsInLactation}</p>
              <p className="milk-dashboard__kpi-label">Vacas em lactação</p>
            </div>

            <div className="milk-dashboard__kpi">
              <div className="milk-dashboard__kpi-icon milk-dashboard__kpi-icon--orange">
                <Heart size={24} aria-hidden="true" />
              </div>
              <p className="milk-dashboard__kpi-value">{data.kpis.dryCows}</p>
              <p className="milk-dashboard__kpi-label">Vacas secas</p>
            </div>
          </div>

          {/* Evolution chart (CA2) */}
          {data.evolution.length > 0 && (
            <div className="milk-dashboard__section">
              <h2 className="milk-dashboard__section-title">Evolução da produção diária</h2>
              <div className="milk-dashboard__chart">
                {(() => {
                  const maxLiters = Math.max(...data.evolution.map((e) => e.totalLiters));
                  return data.evolution.map((point, i) => {
                    const pct = maxLiters > 0 ? (point.totalLiters / maxLiters) * 100 : 0;
                    const dateStr = new Date(point.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    });
                    return (
                      <div key={i} className="milk-dashboard__bar-group">
                        <div className="milk-dashboard__bar-label">
                          <span>{dateStr}</span>
                          <span className="milk-dashboard__mono">
                            {formatNumber(point.totalLiters, 1)} L
                          </span>
                        </div>
                        <div className="milk-dashboard__bar">
                          <div
                            className="milk-dashboard__bar-fill"
                            style={{ width: `${pct}%` }}
                            role="img"
                            aria-label={`${dateStr}: ${formatNumber(point.totalLiters, 1)} litros`}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Rankings (CA3) */}
          {(data.topCows.length > 0 || data.bottomCows.length > 0) && (
            <div className="milk-dashboard__section">
              <h2 className="milk-dashboard__section-title">Ranking de produção</h2>
              <div className="milk-dashboard__rankings">
                <CowRankingTable title="Top 10 vacas" cows={data.topCows} variant="top" />
                <CowRankingTable title="Bottom 10 vacas" cows={data.bottomCows} variant="bottom" />
              </div>
            </div>
          )}

          {/* Quality (CA4) */}
          <div className="milk-dashboard__section">
            <h2 className="milk-dashboard__section-title">Qualidade do leite</h2>
            <div className="milk-dashboard__quality-grid">
              <div className="milk-dashboard__quality-card">
                <p className="milk-dashboard__quality-label">CCS médio</p>
                <p className="milk-dashboard__quality-value">
                  <span
                    className={`milk-dashboard__quality-badge ${qualityBadgeClass('scc', data.quality.avgScc)}`}
                  >
                    {formatScc(data.quality.avgScc)}
                  </span>
                </p>
              </div>

              <div className="milk-dashboard__quality-card">
                <p className="milk-dashboard__quality-label">CBT médio</p>
                <p className="milk-dashboard__quality-value">
                  <span
                    className={`milk-dashboard__quality-badge ${qualityBadgeClass('tbc', data.quality.avgTbc)}`}
                  >
                    {formatTbc(data.quality.avgTbc)}
                  </span>
                </p>
              </div>

              <div className="milk-dashboard__quality-card">
                <p className="milk-dashboard__quality-label">Tendência CCS</p>
                <div className="milk-dashboard__quality-value">
                  <TrendIcon trend={data.quality.sccTrend} />
                </div>
              </div>

              <div className="milk-dashboard__quality-card">
                <p className="milk-dashboard__quality-label">Tendência CBT</p>
                <div className="milk-dashboard__quality-value">
                  <TrendIcon trend={data.quality.tbcTrend} />
                </div>
              </div>
            </div>
          </div>

          {/* Financial (CA5-CA7) */}
          <div className="milk-dashboard__section">
            <h2 className="milk-dashboard__section-title">Financeiro</h2>
            <div className="milk-dashboard__financial-grid">
              <div className="milk-dashboard__financial-card">
                <DollarSign
                  size={20}
                  aria-hidden="true"
                  className="milk-dashboard__financial-icon"
                />
                <p className="milk-dashboard__financial-label">Custo/litro</p>
                <p className="milk-dashboard__financial-value milk-dashboard__mono">
                  {formatCurrency(data.financial.costPerLiter)}
                </p>
              </div>

              <div className="milk-dashboard__financial-card">
                <DollarSign
                  size={20}
                  aria-hidden="true"
                  className="milk-dashboard__financial-icon"
                />
                <p className="milk-dashboard__financial-label">Receita/litro</p>
                <p className="milk-dashboard__financial-value milk-dashboard__mono">
                  {formatCurrency(data.financial.revenuePerLiter)}
                </p>
              </div>

              <div className="milk-dashboard__financial-card">
                <DollarSign
                  size={20}
                  aria-hidden="true"
                  className="milk-dashboard__financial-icon"
                />
                <p className="milk-dashboard__financial-label">Margem/litro</p>
                <p
                  className={`milk-dashboard__financial-value milk-dashboard__mono ${
                    data.financial.marginPerLiter !== null
                      ? data.financial.marginPerLiter >= 0
                        ? 'milk-dashboard__financial-value--positive'
                        : 'milk-dashboard__financial-value--negative'
                      : ''
                  }`}
                >
                  {formatCurrency(data.financial.marginPerLiter)}
                </p>
              </div>

              <div className="milk-dashboard__financial-card">
                <DollarSign
                  size={20}
                  aria-hidden="true"
                  className="milk-dashboard__financial-icon"
                />
                <p className="milk-dashboard__financial-label">Margem total</p>
                <p
                  className={`milk-dashboard__financial-value milk-dashboard__mono ${
                    data.financial.totalMargin !== null
                      ? data.financial.totalMargin >= 0
                        ? 'milk-dashboard__financial-value--positive'
                        : 'milk-dashboard__financial-value--negative'
                      : ''
                  }`}
                >
                  {formatCurrency(data.financial.totalMargin)}
                </p>
              </div>
            </div>

            {/* Cost breakdown bar */}
            {data.financial.breakdown && (
              <div className="milk-dashboard__breakdown">
                <p className="milk-dashboard__breakdown-title">Composição de custos</p>
                {(() => {
                  const { feedCost, healthCost, laborCost } = data.financial.breakdown;
                  const total = feedCost + healthCost + laborCost;
                  if (total === 0) {
                    return (
                      <p className="milk-dashboard__breakdown-empty">
                        Nenhum custo registrado no período.
                      </p>
                    );
                  }
                  const feedPct = (feedCost / total) * 100;
                  const healthPct = (healthCost / total) * 100;
                  const laborPct = (laborCost / total) * 100;
                  return (
                    <>
                      <div
                        className="milk-dashboard__breakdown-bar"
                        role="img"
                        aria-label={`Alimentação: ${feedPct.toFixed(0)}%, Saúde: ${healthPct.toFixed(0)}%, Mão de obra: ${laborPct.toFixed(0)}%`}
                      >
                        {feedPct > 0 && (
                          <div
                            className="milk-dashboard__breakdown-segment milk-dashboard__breakdown-segment--feed"
                            style={{ width: `${feedPct}%` }}
                          />
                        )}
                        {healthPct > 0 && (
                          <div
                            className="milk-dashboard__breakdown-segment milk-dashboard__breakdown-segment--health"
                            style={{ width: `${healthPct}%` }}
                          />
                        )}
                        {laborPct > 0 && (
                          <div
                            className="milk-dashboard__breakdown-segment milk-dashboard__breakdown-segment--labor"
                            style={{ width: `${laborPct}%` }}
                          />
                        )}
                      </div>
                      <div className="milk-dashboard__breakdown-legend">
                        <span className="milk-dashboard__legend-item">
                          <span className="milk-dashboard__legend-dot milk-dashboard__legend-dot--feed" />
                          Alimentação ({feedPct.toFixed(0)}%) — {formatCurrency(feedCost)}
                        </span>
                        <span className="milk-dashboard__legend-item">
                          <span className="milk-dashboard__legend-dot milk-dashboard__legend-dot--health" />
                          Saúde ({healthPct.toFixed(0)}%) — {formatCurrency(healthCost)}
                        </span>
                        <span className="milk-dashboard__legend-item">
                          <span className="milk-dashboard__legend-dot milk-dashboard__legend-dot--labor" />
                          Mão de obra ({laborPct.toFixed(0)}%) — {formatCurrency(laborCost)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
