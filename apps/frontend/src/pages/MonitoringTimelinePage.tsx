import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ArrowLeft, AlertCircle, Filter, TrendingUp } from 'lucide-react';
import { useMonitoringTimeline } from '@/hooks/useMonitoringTimeline';
import { usePests } from '@/hooks/usePests';
import { api } from '@/services/api';
import type { TimelinePestEntry } from '@/types/monitoring-record';
import './MonitoringTimelinePage.css';

const LEVEL_LABELS: Record<string, string> = {
  AUSENTE: 'Ausente',
  BAIXO: 'Baixo',
  MODERADO: 'Moderado',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

const PEST_COLORS = [
  '#2E7D32',
  '#1565C0',
  '#EF6C00',
  '#8E24AA',
  '#C62828',
  '#00838F',
  '#4E342E',
  '#AD1457',
  '#283593',
  '#558B2F',
];

type Aggregation = 'daily' | 'weekly' | 'monthly';

const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

function intensityToLevel(intensity: number): string {
  if (intensity <= 0) return 'AUSENTE';
  if (intensity <= 0.25) return 'BAIXO';
  if (intensity <= 0.5) return 'MODERADO';
  if (intensity <= 0.75) return 'ALTO';
  return 'CRITICO';
}

function MonitoringTimelinePage() {
  const { farmId = '', fieldPlotId = '' } = useParams<{
    farmId: string;
    fieldPlotId: string;
  }>();

  const [selectedPestIds, setSelectedPestIds] = useState<string[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [aggregation, setAggregation] = useState<Aggregation>('weekly');
  const [showFilters, setShowFilters] = useState(false);
  const [showPestMenu, setShowPestMenu] = useState(false);
  const [plotName, setPlotName] = useState('');

  const pestDropdownRef = useRef<HTMLDivElement>(null);

  const { data, summary, isLoading, error } = useMonitoringTimeline({
    farmId,
    fieldPlotId,
    pestIds: selectedPestIds.length > 0 ? selectedPestIds : undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    aggregation,
  });

  const { pests } = usePests({ limit: 100 });

  useEffect(() => {
    async function fetchPlotData() {
      try {
        const result = await api.get<{
          plots: Array<{ id: string; name: string }>;
        }>(`/org/farms/${farmId}/plots`);
        const plot = result.plots.find((p) => p.id === fieldPlotId);
        if (plot) setPlotName(plot.name);
      } catch {
        // ignore
      }
    }
    if (farmId && fieldPlotId) void fetchPlotData();
  }, [farmId, fieldPlotId]);

  // Close pest dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pestDropdownRef.current && !pestDropdownRef.current.contains(e.target as Node)) {
        setShowPestMenu(false);
      }
    }
    if (showPestMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPestMenu]);

  const handleTogglePest = useCallback((pestId: string) => {
    setSelectedPestIds((prev) =>
      prev.includes(pestId) ? prev.filter((id) => id !== pestId) : [...prev, pestId],
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedPestIds([]);
    setFilterStartDate('');
    setFilterEndDate('');
    setAggregation('weekly');
  }, []);

  const hasActiveFilters =
    selectedPestIds.length > 0 || filterStartDate || filterEndDate || aggregation !== 'weekly';

  // Build unique pest list from data for chart lines
  const uniquePests = useMemo(() => {
    const pestMap = new Map<string, string>();
    data.forEach((dp) => {
      dp.pests.forEach((p) => {
        if (!pestMap.has(p.pestId)) {
          pestMap.set(p.pestId, p.pestName);
        }
      });
    });
    return Array.from(pestMap.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  // Transform data for Recharts: each data point becomes { date, [pestId]: avgIntensity, ... }
  const chartData = useMemo(() => {
    return data.map((dp) => {
      const point: Record<string, string | number> = {
        date: new Date(dp.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        }),
      };
      dp.pests.forEach((p) => {
        point[p.pestId] = p.avgIntensity;
      });
      return point;
    });
  }, [data]);

  // Flatten data for the table
  const tableRows = useMemo(() => {
    const rows: Array<{
      date: string;
      pestName: string;
      avgIntensity: number;
      maxLevel: string;
      recordCount: number;
    }> = [];
    data.forEach((dp) => {
      dp.pests.forEach((p: TimelinePestEntry) => {
        rows.push({
          date: new Date(dp.date).toLocaleDateString('pt-BR'),
          pestName: p.pestName,
          avgIntensity: p.avgIntensity,
          maxLevel: p.maxLevel,
          recordCount: p.recordCount,
        });
      });
    });
    return rows;
  }, [data]);

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1];
  const yAxisLabels: Record<number, string> = {
    0: 'Ausente',
    0.25: 'Baixo',
    0.5: 'Moderado',
    0.75: 'Alto',
    1: 'Crítico',
  };

  const pestToggleLabel =
    selectedPestIds.length === 0
      ? 'Todas as pragas'
      : `${selectedPestIds.length} praga${selectedPestIds.length > 1 ? 's' : ''}`;

  return (
    <section className="mtp">
      {/* Breadcrumb */}
      <nav className="mtp__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-points`} className="mtp__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar aos pontos
        </Link>
      </nav>

      {/* Header */}
      <div className="mtp__header">
        <div className="mtp__header-text">
          <h1 className="mtp__title">Histórico de Evolução MIP</h1>
          <p className="mtp__subtitle">
            {plotName
              ? `Evolução da infestação — ${plotName}`
              : 'Acompanhe a evolução das pragas ao longo do tempo'}
          </p>
        </div>
        <div className="mtp__header-actions">
          <button
            type="button"
            className={`mtp__btn mtp__btn--secondary ${hasActiveFilters ? 'mtp__btn--active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="mtp-filters"
          >
            <Filter size={20} aria-hidden="true" />
            Filtros
            {hasActiveFilters && <span className="mtp__filter-badge" aria-label="Filtros ativos" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mtp__filters" id="mtp-filters">
          {/* Multi-select pest dropdown */}
          <div className="mtp__filter-field">
            <label id="mtp-pest-label" className="mtp__filter-label">
              Pragas
            </label>
            <div className="mtp__pest-dropdown" ref={pestDropdownRef}>
              <button
                type="button"
                className="mtp__pest-toggle"
                onClick={() => setShowPestMenu((v) => !v)}
                aria-labelledby="mtp-pest-label"
                aria-expanded={showPestMenu}
                aria-haspopup="listbox"
              >
                {pestToggleLabel}
              </button>
              {showPestMenu && (
                <div className="mtp__pest-menu" role="listbox" aria-multiselectable="true">
                  {pests.map((p) => (
                    <label key={p.id} className="mtp__pest-option">
                      <input
                        type="checkbox"
                        checked={selectedPestIds.includes(p.id)}
                        onChange={() => handleTogglePest(p.id)}
                        aria-label={p.commonName}
                      />
                      {p.commonName}
                    </label>
                  ))}
                  {pests.length === 0 && (
                    <div className="mtp__pest-option" style={{ color: 'var(--color-neutral-400)' }}>
                      Nenhuma praga cadastrada
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mtp__filter-field">
            <label htmlFor="mtp-filter-start" className="mtp__filter-label">
              Data início
            </label>
            <input
              type="date"
              id="mtp-filter-start"
              className="mtp__filter-input"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="mtp__filter-field">
            <label htmlFor="mtp-filter-end" className="mtp__filter-label">
              Data fim
            </label>
            <input
              type="date"
              id="mtp-filter-end"
              className="mtp__filter-input"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>

          {/* Aggregation toggle */}
          <div className="mtp__filter-field">
            <span className="mtp__filter-label" id="mtp-agg-label">
              Agregação
            </span>
            <div className="mtp__agg-group" role="group" aria-labelledby="mtp-agg-label">
              {AGGREGATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`mtp__agg-btn ${aggregation === opt.value ? 'mtp__agg-btn--active' : ''}`}
                  onClick={() => setAggregation(opt.value)}
                  aria-pressed={aggregation === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button type="button" className="mtp__btn mtp__btn--ghost" onClick={handleClearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mtp__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="mtp__skeleton-cards" aria-label="Carregando resumo">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mtp__skeleton-card" />
            ))}
          </div>
          <div className="mtp__skeleton-chart" aria-label="Carregando gráfico" />
          <div className="mtp__skeleton-table" aria-label="Carregando tabela" />
        </>
      )}

      {/* Empty state */}
      {!isLoading && !error && data.length === 0 && (
        <div className="mtp__empty">
          <TrendingUp size={48} aria-hidden="true" className="mtp__empty-icon" />
          <h2 className="mtp__empty-title">Sem dados de histórico</h2>
          <p className="mtp__empty-desc">
            Registre observações nos pontos de monitoramento para acompanhar a evolução da
            infestação ao longo do tempo.
          </p>
          <Link
            to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-records`}
            className="mtp__btn mtp__btn--primary"
          >
            Ir para registros
          </Link>
        </div>
      )}

      {/* Data loaded */}
      {!isLoading && !error && data.length > 0 && (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="mtp__summary-grid">
              <div className="mtp__summary-card">
                <p className="mtp__summary-card-label">Total de registros</p>
                <p className="mtp__summary-card-value">{summary.totalRecords}</p>
              </div>
              <div className="mtp__summary-card">
                <p className="mtp__summary-card-label">Período</p>
                <p className="mtp__summary-card-value" style={{ fontSize: 16 }}>
                  {summary.dateRange.start
                    ? `${new Date(summary.dateRange.start).toLocaleDateString('pt-BR')} — ${new Date(summary.dateRange.end).toLocaleDateString('pt-BR')}`
                    : '—'}
                </p>
              </div>
              <div className="mtp__summary-card">
                <p className="mtp__summary-card-label">Pragas encontradas</p>
                <p className="mtp__summary-card-value">{summary.pestsFound.length}</p>
                <p className="mtp__summary-card-detail">
                  {summary.pestsFound.slice(0, 3).join(', ')}
                  {summary.pestsFound.length > 3 && ` +${summary.pestsFound.length - 3}`}
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="mtp__chart-container">
            <h2 className="mtp__chart-title">Intensidade ao longo do tempo</h2>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                  stroke="var(--color-neutral-400)"
                />
                <YAxis
                  domain={[0, 1]}
                  ticks={yAxisTicks}
                  tickFormatter={(value: number) => yAxisLabels[value] ?? String(value)}
                  tick={{ fontSize: 11, fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
                  stroke="var(--color-neutral-400)"
                  width={72}
                />
                <RechartsTooltip
                  contentStyle={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.875rem',
                    borderRadius: 8,
                    border: '1px solid var(--color-neutral-200)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    const pestName = String(name ?? '');
                    const pest = uniquePests.find((p) => p.id === pestName);
                    const level = LEVEL_LABELS[intensityToLevel(numValue)] ?? '';
                    return [`${(numValue * 100).toFixed(0)}% (${level})`, pest?.name ?? pestName];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const pest = uniquePests.find((p) => p.id === value);
                    return pest?.name ?? value;
                  }}
                  wrapperStyle={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '13px',
                  }}
                />
                {uniquePests.map((pest, idx) => (
                  <Line
                    key={pest.id}
                    type="monotone"
                    dataKey={pest.id}
                    name={pest.id}
                    stroke={PEST_COLORS[idx % PEST_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: PEST_COLORS[idx % PEST_COLORS.length] }}
                    activeDot={{ r: 6, fill: PEST_COLORS[idx % PEST_COLORS.length] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="mtp__table-section">
            <h2 className="mtp__table-title">Dados detalhados</h2>

            {/* Desktop table */}
            <div className="mtp__table-wrapper">
              <table className="mtp__table">
                <caption className="sr-only">Dados detalhados do histórico de infestação</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Praga</th>
                    <th scope="col">Intensidade</th>
                    <th scope="col">Nível</th>
                    <th scope="col">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.date}</td>
                      <td>{row.pestName}</td>
                      <td className="mtp__table-intensity">
                        {(row.avgIntensity * 100).toFixed(0)}%
                      </td>
                      <td>
                        <span className={`mtp__badge mtp__badge--${row.maxLevel.toLowerCase()}`}>
                          {LEVEL_LABELS[row.maxLevel] ?? row.maxLevel}
                        </span>
                      </td>
                      <td className="mtp__table-count">{row.recordCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mtp__cards">
              {tableRows.map((row, idx) => (
                <div key={idx} className="mtp__card">
                  <div className="mtp__card-header">
                    <span className="mtp__card-date">{row.date}</span>
                    <span className={`mtp__badge mtp__badge--${row.maxLevel.toLowerCase()}`}>
                      {LEVEL_LABELS[row.maxLevel] ?? row.maxLevel}
                    </span>
                  </div>
                  <p className="mtp__card-pest">{row.pestName}</p>
                  <div className="mtp__card-row">
                    <span className="mtp__card-label">Intensidade</span>
                    <span className="mtp__card-value">{(row.avgIntensity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mtp__card-row">
                    <span className="mtp__card-label">Registros</span>
                    <span className="mtp__card-value">{row.recordCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default MonitoringTimelinePage;
