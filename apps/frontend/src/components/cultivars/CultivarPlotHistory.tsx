import { useState, useCallback } from 'react';
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sprout,
  TrendingUp,
  Download,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useCultivarPlotHistory } from '@/hooks/useCultivarPlotHistory';
import type { CultivarPlotHistoryItem } from '@/types/cultivar';
import './CultivarPlotHistory.css';

const SEASON_LABELS: Record<string, string> = {
  SAFRA: 'Safra',
  SAFRINHA: 'Safrinha',
  INVERNO: 'Inverno',
};

function formatProductivity(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/ha`;
}

function formatProduction(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
}

function getBestSeason(plot: CultivarPlotHistoryItem) {
  const withProd = plot.seasons.filter((s) => s.productivityKgHa != null);
  if (withProd.length === 0) return null;
  return withProd.reduce((best, s) =>
    s.productivityKgHa! > (best.productivityKgHa ?? 0) ? s : best,
  );
}

function exportPlotHistoryCsv(plots: CultivarPlotHistoryItem[]) {
  const headers = [
    'Talhão',
    'Safra',
    'Tipo',
    'Cultivar',
    'Produtividade (kg/ha)',
    'Produção Total (kg)',
    'Observações',
  ];
  const rows = plots.flatMap((plot) =>
    plot.seasons.map((s) => [
      plot.plotName,
      s.seasonYear,
      SEASON_LABELS[s.seasonType] ?? s.seasonType,
      s.cultivarName ?? '',
      s.productivityKgHa != null ? String(s.productivityKgHa) : '',
      s.totalProductionKg != null ? String(s.totalProductionKg) : '',
      s.notes ?? '',
    ]),
  );

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico-cultivares-talhoes.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CultivarPlotHistory() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const [expandedPlots, setExpandedPlots] = useState<Set<string>>(new Set());

  const { plotHistory, isLoading, error } = useCultivarPlotHistory({
    farmId: selectedFarmId,
  });

  const togglePlot = useCallback((plotId: string) => {
    setExpandedPlots((prev) => {
      const next = new Set(prev);
      if (next.has(plotId)) {
        next.delete(plotId);
      } else {
        next.add(plotId);
      }
      return next;
    });
  }, []);

  if (!selectedFarmId) {
    return (
      <div className="plot-history__empty">
        <MapPin size={48} aria-hidden="true" />
        <h2 className="plot-history__empty-title">Selecione uma fazenda</h2>
        <p className="plot-history__empty-desc">
          Escolha uma fazenda no seletor acima para ver o histórico de cultivares por talhão.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plot-history__error" role="alert" aria-live="polite">
        <AlertCircle aria-hidden="true" size={16} />
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="plot-history__skeleton-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="plot-history__skeleton plot-history__skeleton--row" />
        ))}
      </div>
    );
  }

  if (plotHistory.length === 0) {
    return (
      <div className="plot-history__empty">
        <Sprout size={48} aria-hidden="true" />
        <h2 className="plot-history__empty-title">Nenhum histórico de safra</h2>
        <p className="plot-history__empty-desc">
          {selectedFarm?.name
            ? `A fazenda ${selectedFarm.name} ainda não tem safras com cultivares registradas.`
            : 'Nenhuma safra com cultivares registrada nesta fazenda.'}
        </p>
      </div>
    );
  }

  return (
    <div className="plot-history">
      <div className="plot-history__header">
        <p className="plot-history__summary">
          {plotHistory.length} {plotHistory.length === 1 ? 'talhão' : 'talhões'} com histórico de
          safras
        </p>
        <button
          type="button"
          className="plot-history__btn plot-history__btn--ghost"
          onClick={() => exportPlotHistoryCsv(plotHistory)}
          aria-label="Exportar histórico em CSV"
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>

      <ul className="plot-history__list" role="list">
        {plotHistory.map((plot) => {
          const isExpanded = expandedPlots.has(plot.plotId);
          const best = getBestSeason(plot);

          return (
            <li key={plot.plotId} className="plot-history__item">
              <button
                type="button"
                className="plot-history__item-header"
                onClick={() => togglePlot(plot.plotId)}
                aria-expanded={isExpanded}
                aria-controls={`plot-seasons-${plot.plotId}`}
              >
                <div className="plot-history__item-info">
                  <MapPin size={16} aria-hidden="true" className="plot-history__icon" />
                  <span className="plot-history__plot-name">{plot.plotName}</span>
                  <span className="plot-history__season-count">
                    {plot.seasons.length} {plot.seasons.length === 1 ? 'safra' : 'safras'}
                  </span>
                </div>
                <div className="plot-history__item-meta">
                  {best && (
                    <span className="plot-history__best-badge">
                      <TrendingUp size={14} aria-hidden="true" />
                      Melhor: {best.cultivarName} ({formatProductivity(best.productivityKgHa)})
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={16} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div
                  id={`plot-seasons-${plot.plotId}`}
                  className="plot-history__seasons"
                  role="region"
                  aria-label={`Safras do talhão ${plot.plotName}`}
                >
                  <table className="plot-history__table">
                    <thead>
                      <tr>
                        <th scope="col">Safra</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Cultivar</th>
                        <th scope="col">Produtividade</th>
                        <th scope="col">Produção Total</th>
                        <th scope="col">Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plot.seasons.map((season, idx) => {
                        const isBest =
                          best &&
                          season.seasonYear === best.seasonYear &&
                          season.seasonType === best.seasonType;
                        return (
                          <tr
                            key={`${season.seasonYear}-${season.seasonType}-${idx}`}
                            className={isBest ? 'plot-history__row--best' : ''}
                          >
                            <td>{season.seasonYear}</td>
                            <td>{SEASON_LABELS[season.seasonType] ?? season.seasonType}</td>
                            <td>{season.cultivarName ?? '—'}</td>
                            <td className="plot-history__td--mono">
                              {formatProductivity(season.productivityKgHa)}
                            </td>
                            <td className="plot-history__td--mono">
                              {formatProduction(season.totalProductionKg)}
                            </td>
                            <td className="plot-history__td--notes">{season.notes ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile: cards */}
                  <div className="plot-history__cards-mobile">
                    {plot.seasons.map((season, idx) => {
                      const isBest =
                        best &&
                        season.seasonYear === best.seasonYear &&
                        season.seasonType === best.seasonType;
                      return (
                        <div
                          key={`${season.seasonYear}-${season.seasonType}-${idx}`}
                          className={`plot-history__card-mobile ${isBest ? 'plot-history__card-mobile--best' : ''}`}
                        >
                          <div className="plot-history__card-mobile-header">
                            <span className="plot-history__card-mobile-year">
                              {season.seasonYear}
                            </span>
                            <span className="plot-history__badge">
                              {SEASON_LABELS[season.seasonType] ?? season.seasonType}
                            </span>
                          </div>
                          <div className="plot-history__card-mobile-body">
                            <div className="plot-history__card-mobile-field">
                              <span className="plot-history__card-mobile-label">Cultivar</span>
                              <span>{season.cultivarName ?? '—'}</span>
                            </div>
                            <div className="plot-history__card-mobile-field">
                              <span className="plot-history__card-mobile-label">Produtividade</span>
                              <span className="plot-history__mono">
                                {formatProductivity(season.productivityKgHa)}
                              </span>
                            </div>
                            <div className="plot-history__card-mobile-field">
                              <span className="plot-history__card-mobile-label">Produção</span>
                              <span className="plot-history__mono">
                                {formatProduction(season.totalProductionKg)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CultivarPlotHistory;
