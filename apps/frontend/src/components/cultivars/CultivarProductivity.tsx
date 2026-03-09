import { useState, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sprout,
  MapPin,
  Download,
  BarChart3,
  Table2,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useCultivarProductivity } from '@/hooks/useCultivarProductivity';
import { CROP_OPTIONS } from '@/types/cultivar';
import type { CultivarProductivityComparison } from '@/types/cultivar';
import './CultivarProductivity.css';

const BAR_COLORS = [
  '#2E7D32',
  '#1565C0',
  '#E65100',
  '#6A1B9A',
  '#00838F',
  '#AD1457',
  '#558B2F',
  '#283593',
  '#BF360C',
  '#4527A0',
];

const SEASON_LABELS: Record<string, string> = {
  SAFRA: 'Safra',
  SAFRINHA: 'Safrinha',
  INVERNO: 'Inverno',
};

type SortField = 'name' | 'productivity' | 'plantings';
type SortDir = 'asc' | 'desc';
type ViewMode = 'chart' | 'table';

function formatProductivity(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/ha`;
}

function exportProductivityCsv(data: CultivarProductivityComparison[]) {
  const headers = [
    'Cultivar',
    'Cultura',
    'Produtividade Média (kg/ha)',
    'Qtd. Plantios',
    'Safra',
    'Tipo',
    'Talhão',
    'Área (ha)',
    'Produtividade (kg/ha)',
    'Produção (kg)',
  ];
  const rows = data.flatMap((d) =>
    d.entries.map((e) => [
      d.cultivarName,
      d.crop,
      d.avgProductivityKgHa != null ? String(d.avgProductivityKgHa) : '',
      String(d.totalPlantings),
      e.seasonYear,
      SEASON_LABELS[e.seasonType] ?? e.seasonType,
      e.plotName,
      e.plantedAreaHa != null ? String(e.plantedAreaHa) : '',
      e.productivityKgHa != null ? String(e.productivityKgHa) : '',
      e.totalProductionKg != null ? String(e.totalProductionKg) : '',
    ]),
  );

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'comparativo-produtividade-cultivares.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function formatTooltip(
  value: string | number | undefined,
  _name: string | undefined,
  entry: { payload?: { fullName: string; plantings: number } },
) {
  const v = Number(value ?? 0);
  const p = entry.payload;
  if (!p) return [String(v), ''];
  return [
    `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/ha (${p.plantings} plantios)`,
    p.fullName,
  ];
}

function CultivarProductivity() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [cropFilter, setCropFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('productivity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('chart');

  const { productivity, isLoading, error } = useCultivarProductivity({
    farmId: selectedFarmId,
    crop: cropFilter || undefined,
  });

  const sorted = useMemo(() => {
    const copy = [...productivity];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.cultivarName.localeCompare(b.cultivarName, 'pt-BR');
      } else if (sortField === 'productivity') {
        cmp = (a.avgProductivityKgHa ?? 0) - (b.avgProductivityKgHa ?? 0);
      } else {
        cmp = a.totalPlantings - b.totalPlantings;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [productivity, sortField, sortDir]);

  const chartData = useMemo(
    () =>
      sorted
        .filter((d) => d.avgProductivityKgHa != null)
        .map((d) => ({
          name: d.cultivarName.length > 15 ? d.cultivarName.slice(0, 14) + '…' : d.cultivarName,
          fullName: d.cultivarName,
          value: d.avgProductivityKgHa!,
          plantings: d.totalPlantings,
        })),
    [sorted],
  );

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'name' ? 'asc' : 'desc');
      return field;
    });
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} aria-hidden="true" />
    ) : (
      <ChevronDown size={14} aria-hidden="true" />
    );
  };

  if (!selectedFarmId) {
    return (
      <div className="prod-comp__empty">
        <MapPin size={48} aria-hidden="true" />
        <h2 className="prod-comp__empty-title">Selecione uma fazenda</h2>
        <p className="prod-comp__empty-desc">
          Escolha uma fazenda no seletor acima para comparar a produtividade das cultivares.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prod-comp__error" role="alert" aria-live="polite">
        <AlertCircle aria-hidden="true" size={16} />
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="prod-comp__skeleton-list">
        <div className="prod-comp__skeleton prod-comp__skeleton--chart" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="prod-comp__skeleton prod-comp__skeleton--row" />
        ))}
      </div>
    );
  }

  if (productivity.length === 0) {
    return (
      <div className="prod-comp__empty">
        <Sprout size={48} aria-hidden="true" />
        <h2 className="prod-comp__empty-title">Sem dados de produtividade</h2>
        <p className="prod-comp__empty-desc">
          {selectedFarm?.name
            ? `A fazenda ${selectedFarm.name} ainda não tem safras com cultivares e produtividade registradas.`
            : 'Nenhuma safra com dados de produtividade encontrada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="prod-comp">
      {/* Toolbar */}
      <div className="prod-comp__toolbar">
        <select
          className="prod-comp__filter-select"
          value={cropFilter}
          onChange={(e) => setCropFilter(e.target.value)}
          aria-label="Filtrar por cultura"
        >
          <option value="">Todas culturas</option>
          {CROP_OPTIONS.map((crop) => (
            <option key={crop} value={crop}>
              {crop}
            </option>
          ))}
        </select>

        <div className="prod-comp__view-toggle" role="group" aria-label="Modo de visualização">
          <button
            type="button"
            className={`prod-comp__view-btn ${viewMode === 'chart' ? 'prod-comp__view-btn--active' : ''}`}
            onClick={() => setViewMode('chart')}
            aria-pressed={viewMode === 'chart'}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Gráfico
          </button>
          <button
            type="button"
            className={`prod-comp__view-btn ${viewMode === 'table' ? 'prod-comp__view-btn--active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
          >
            <Table2 size={16} aria-hidden="true" />
            Tabela
          </button>
        </div>

        <button
          type="button"
          className="prod-comp__btn prod-comp__btn--ghost"
          onClick={() => exportProductivityCsv(sorted)}
          aria-label="Exportar dados em CSV"
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>

      {/* Chart (CA8) */}
      {viewMode === 'chart' && chartData.length > 0 && (
        <div
          className="prod-comp__chart-wrapper"
          aria-label="Gráfico de produtividade por cultivar"
        >
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40 + 80)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 20, right: 40, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                label={{ value: 'kg/ha', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={130}
                tick={{ fontSize: 13, fontFamily: 'Source Sans 3, system-ui, sans-serif' }}
              />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{
                  fontFamily: 'Source Sans 3, system-ui, sans-serif',
                  fontSize: 13,
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table (CA4) */}
      {viewMode === 'table' && (
        <>
          <table className="prod-comp__table">
            <thead>
              <tr>
                <th scope="col">
                  <button
                    type="button"
                    className="prod-comp__sort-btn"
                    onClick={() => handleSort('name')}
                  >
                    Cultivar {renderSortIcon('name')}
                  </button>
                </th>
                <th scope="col">Cultura</th>
                <th scope="col">
                  <button
                    type="button"
                    className="prod-comp__sort-btn"
                    onClick={() => handleSort('productivity')}
                  >
                    Prod. Média {renderSortIcon('productivity')}
                  </button>
                </th>
                <th scope="col">
                  <button
                    type="button"
                    className="prod-comp__sort-btn"
                    onClick={() => handleSort('plantings')}
                  >
                    Plantios {renderSortIcon('plantings')}
                  </button>
                </th>
                <th scope="col" aria-label="Expandir"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const isExpanded = expandedRows.has(row.cultivarId);
                return (
                  <CultivarProductivityRow
                    key={row.cultivarId}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={toggleRow}
                  />
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="prod-comp__cards-mobile">
            {sorted.map((row) => {
              const isExpanded = expandedRows.has(row.cultivarId);
              return (
                <div key={row.cultivarId} className="prod-comp__card-mobile">
                  <button
                    type="button"
                    className="prod-comp__card-mobile-header"
                    onClick={() => toggleRow(row.cultivarId)}
                    aria-expanded={isExpanded}
                  >
                    <div>
                      <span className="prod-comp__card-mobile-name">{row.cultivarName}</span>
                      <span className="prod-comp__badge">{row.crop}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div className="prod-comp__card-mobile-stats">
                    <div className="prod-comp__card-mobile-stat">
                      <TrendingUp size={14} aria-hidden="true" />
                      <span className="prod-comp__mono">
                        {formatProductivity(row.avgProductivityKgHa)}
                      </span>
                    </div>
                    <span className="prod-comp__card-mobile-plantings">
                      {row.totalPlantings} {row.totalPlantings === 1 ? 'plantio' : 'plantios'}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="prod-comp__card-mobile-entries">
                      {row.entries.map((e, idx) => (
                        <div key={idx} className="prod-comp__card-mobile-entry">
                          <div className="prod-comp__card-mobile-entry-head">
                            <span>
                              {e.seasonYear} — {SEASON_LABELS[e.seasonType] ?? e.seasonType}
                            </span>
                            <span className="prod-comp__mono">
                              {formatProductivity(e.productivityKgHa)}
                            </span>
                          </div>
                          <span className="prod-comp__card-mobile-plot">{e.plotName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CultivarProductivityRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: CultivarProductivityComparison;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <tr className={isExpanded ? 'prod-comp__row--expanded' : ''}>
        <td className="prod-comp__td-name">{row.cultivarName}</td>
        <td>
          <span className="prod-comp__badge prod-comp__badge--crop">{row.crop}</span>
        </td>
        <td className="prod-comp__td--mono">{formatProductivity(row.avgProductivityKgHa)}</td>
        <td>{row.totalPlantings}</td>
        <td>
          <button
            type="button"
            className="prod-comp__expand-btn"
            onClick={() => onToggle(row.cultivarId)}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} detalhes de ${row.cultivarName}`}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {isExpanded &&
        row.entries.map((entry, idx) => (
          <tr key={idx} className="prod-comp__detail-row">
            <td className="prod-comp__detail-indent">{entry.plotName}</td>
            <td>
              {entry.seasonYear} — {SEASON_LABELS[entry.seasonType] ?? entry.seasonType}
            </td>
            <td className="prod-comp__td--mono">{formatProductivity(entry.productivityKgHa)}</td>
            <td className="prod-comp__td--mono">
              {entry.plantedAreaHa != null
                ? `${entry.plantedAreaHa.toLocaleString('pt-BR')} ha`
                : '—'}
            </td>
            <td></td>
          </tr>
        ))}
    </>
  );
}

export default CultivarProductivity;
