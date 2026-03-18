import { useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Map as MapIcon,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  BarChart3,
  Download,
  GitCompareArrows,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useFarmMap } from '@/hooks/useFarmMap';
import { useProductivityMap } from '@/hooks/useProductivityMap';
import { useSeasonComparison } from '@/hooks/useSeasonComparison';
import MapAutoFit from '@/components/map/MapAutoFit';
import { formatArea } from '@/components/map/FarmMap';
import type { BaseMapType } from '@/components/map/BaseMapSelector';
import type { ProductivityLevel, CultureType } from '@/types/productivity-map';
import './ProductivityMapPage.css';

const TILE_URLS: Record<string, { url: string; attribution: string; maxZoom: number }> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 18,
  },
  topographic: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};

const LEVEL_COLORS: Record<ProductivityLevel, string> = {
  ALTA: '#2E7D32',
  MEDIA: '#F9A825',
  BAIXA: '#C62828',
  SEM_DADOS: '#9E9E9E',
};

const LEVEL_LABELS: Record<ProductivityLevel, string> = {
  ALTA: 'Acima da meta',
  MEDIA: 'Na meta',
  BAIXA: 'Abaixo da meta',
  SEM_DADOS: 'Sem dados',
};

const LEVEL_ICONS: Record<ProductivityLevel, React.ElementType> = {
  ALTA: TrendingUp,
  MEDIA: Minus,
  BAIXA: TrendingDown,
  SEM_DADOS: HelpCircle,
};

const CULTURE_OPTIONS: { value: CultureType | ''; label: string }[] = [
  { value: '', label: 'Todas as culturas' },
  { value: 'GRAOS', label: 'Grãos' },
  { value: 'CAFE', label: 'Café' },
];

function ProductivityMapPage() {
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const { data: farmMapData, isLoading: mapLoading } = useFarmMap(selectedFarmId ?? undefined);

  const [cultureType, setCultureType] = useState<CultureType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMapType>('satellite');

  const {
    data: prodData,
    isLoading: prodLoading,
    error,
  } = useProductivityMap({
    farmId: selectedFarmId,
    cultureType: cultureType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const isLoading = mapLoading || prodLoading;

  const productivityLookup = useMemo(() => {
    if (!prodData)
      return new Map<
        string,
        {
          level: ProductivityLevel;
          productivityPerHa: number;
          deviationFromAvg: number;
          crop: string;
          totalProduction: number;
          productionUnit: string;
          productivityUnit: string;
          harvestCount: number;
        }
      >();
    const map = new Map<
      string,
      {
        level: ProductivityLevel;
        productivityPerHa: number;
        deviationFromAvg: number;
        crop: string;
        totalProduction: number;
        productionUnit: string;
        productivityUnit: string;
        harvestCount: number;
      }
    >();
    for (const p of prodData.plots) {
      map.set(p.fieldPlotId, {
        level: p.level,
        productivityPerHa: p.productivityPerHa,
        deviationFromAvg: p.deviationFromAvg,
        crop: p.crop,
        totalProduction: p.totalProduction,
        productionUnit: p.productionUnit,
        productivityUnit: p.productivityUnit,
        harvestCount: p.harvestCount,
      });
    }
    return map;
  }, [prodData]);

  const bounds = useMemo(() => {
    if (!farmMapData?.farmBoundary.hasBoundary || !farmMapData.farmBoundary.boundaryGeoJSON) {
      return null;
    }
    return L.geoJSON(farmMapData.farmBoundary.boundaryGeoJSON).getBounds();
  }, [farmMapData]);

  const getPlotStyle = useCallback(
    (plotId: string): L.PathOptions => {
      const info = productivityLookup.get(plotId);
      const level: ProductivityLevel = info?.level ?? 'SEM_DADOS';
      const color = LEVEL_COLORS[level];
      return {
        color,
        weight: 2,
        fillOpacity: 0.5,
        fillColor: color,
      };
    },
    [productivityLookup],
  );

  const tile = TILE_URLS[baseMap] ?? TILE_URLS.satellite;

  const handleClearFilters = useCallback(() => {
    setCultureType('');
    setDateFrom('');
    setDateTo('');
  }, []);

  const hasActiveFilters = cultureType !== '' || dateFrom !== '' || dateTo !== '';

  // CA5 — Season comparison
  const [showSeasons, setShowSeasons] = useState(false);
  const { data: seasonData, isLoading: seasonLoading } = useSeasonComparison({
    farmId: showSeasons ? selectedFarmId : null,
  });

  // CA6 — Export map as image
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const handleExportImage = useCallback(async () => {
    const container = mapContainerRef.current;
    if (!container) return;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(container, { useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = `mapa-produtividade-${selectedFarm?.name ?? 'fazenda'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('Não foi possível exportar o mapa. Tente novamente.');
    }
  }, [selectedFarm]);

  // ─── Ranking (CA4 data, shown alongside map) ──────────────────
  const ranking = useMemo(() => {
    if (!prodData) return [];
    return [...prodData.plots]
      .filter((p) => p.level !== 'SEM_DADOS')
      .sort((a, b) => b.productivityPerHa - a.productivityPerHa);
  }, [prodData]);

  // ─── No farm selected ──────────────────────────────────────────
  if (!selectedFarmId) {
    return (
      <div className="prod-map">
        <div className="prod-map__empty">
          <MapIcon size={48} aria-hidden="true" className="prod-map__empty-icon" />
          <h2 className="prod-map__empty-title">Selecione uma fazenda</h2>
          <p className="prod-map__empty-text">
            Escolha uma fazenda no seletor acima para visualizar o mapa de produtividade.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prod-map">
        <div className="prod-map__error">
          <AlertCircle size={48} aria-hidden="true" />
          <h2 className="prod-map__error-title">Erro ao carregar dados</h2>
          <p className="prod-map__error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prod-map">
      <header className="prod-map__header">
        <div className="prod-map__header-info">
          <nav className="prod-map__breadcrumb" aria-label="Breadcrumb">
            <span>Início</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Mapa de produtividade</span>
          </nav>
          <h1 className="prod-map__title">Mapa de produtividade</h1>
          {selectedFarm && <p className="prod-map__subtitle">{selectedFarm.name}</p>}
        </div>

        <div className="prod-map__header-actions">
          <button
            type="button"
            className="prod-map__filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="productivity-filters"
          >
            <Filter size={20} aria-hidden="true" />
            Filtros
            {hasActiveFilters && (
              <span className="prod-map__filter-badge" aria-label="Filtros ativos" />
            )}
            {showFilters ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="prod-map__filter-toggle"
            onClick={() => setShowSeasons(!showSeasons)}
            aria-expanded={showSeasons}
          >
            <GitCompareArrows size={20} aria-hidden="true" />
            Safras
          </button>
          <button
            type="button"
            className="prod-map__filter-toggle"
            onClick={() => void handleExportImage()}
            aria-label="Exportar mapa como imagem"
          >
            <Download size={20} aria-hidden="true" />
            Exportar
          </button>
        </div>
      </header>

      {showFilters && (
        <section
          id="productivity-filters"
          className="prod-map__filters"
          aria-label="Filtros de produtividade"
        >
          <div className="prod-map__filter-group">
            <label htmlFor="filter-culture" className="prod-map__filter-label">
              Cultura
            </label>
            <select
              id="filter-culture"
              className="prod-map__filter-select"
              value={cultureType}
              onChange={(e) => setCultureType(e.target.value as CultureType | '')}
            >
              {CULTURE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="prod-map__filter-group">
            <label htmlFor="filter-date-from" className="prod-map__filter-label">
              Data início
            </label>
            <input
              id="filter-date-from"
              type="date"
              className="prod-map__filter-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="prod-map__filter-group">
            <label htmlFor="filter-date-to" className="prod-map__filter-label">
              Data fim
            </label>
            <input
              id="filter-date-to"
              type="date"
              className="prod-map__filter-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <button type="button" className="prod-map__filter-clear" onClick={handleClearFilters}>
              Limpar filtros
            </button>
          )}
        </section>
      )}

      <div className="prod-map__content">
        <div className="prod-map__map-container" ref={mapContainerRef}>
          {isLoading ? (
            <div className="prod-map__skeleton" aria-busy="true">
              <div className="prod-map__skeleton-pulse" />
            </div>
          ) : farmMapData ? (
            <MapContainer
              center={[-15.78, -47.93]}
              zoom={4}
              preferCanvas={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
              <MapAutoFit bounds={bounds} />

              {/* Farm boundary */}
              {farmMapData.farmBoundary.hasBoundary && farmMapData.farmBoundary.boundaryGeoJSON && (
                <GeoJSON
                  key={`farm-boundary-${farmMapData.farm.id}`}
                  data={farmMapData.farmBoundary.boundaryGeoJSON}
                  style={{
                    color: '#FFFFFF',
                    weight: 2,
                    fillOpacity: 0,
                    dashArray: '6 4',
                  }}
                />
              )}

              {/* Plot polygons colored by productivity */}
              {farmMapData.plotBoundaries
                .filter((pb) => pb.boundary.hasBoundary && pb.boundary.boundaryGeoJSON)
                .map((pb) => {
                  const info = productivityLookup.get(pb.plotId);
                  const level = info?.level ?? 'SEM_DADOS';
                  return (
                    <GeoJSON
                      key={`prod-plot-${pb.plotId}-${level}-${cultureType}-${dateFrom}-${dateTo}`}
                      data={pb.boundary.boundaryGeoJSON!}
                      style={getPlotStyle(pb.plotId)}
                      onEachFeature={(_feature: GeoJSON.Feature, layer: L.Layer) => {
                        const tooltipLines = [
                          `<strong>${pb.plot.name}</strong>`,
                          `Área: ${formatArea(pb.plot.boundaryAreaHa)}`,
                          info && info.harvestCount > 0
                            ? `Produtividade: ${info.productivityPerHa.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${info.productivityUnit}`
                            : 'Sem dados de colheita',
                          info && info.harvestCount > 0
                            ? `Variação: ${info.deviationFromAvg > 0 ? '+' : ''}${info.deviationFromAvg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                            : null,
                        ].filter(Boolean);

                        layer.bindTooltip(tooltipLines.join('<br>'), {
                          sticky: true,
                          direction: 'auto',
                          className: 'plot-tooltip',
                        });
                      }}
                    >
                      <Popup>
                        <div className="prod-map__popup">
                          <strong>{pb.plot.name}</strong>
                          <br />
                          Área: {formatArea(pb.plot.boundaryAreaHa)}
                          {info && info.harvestCount > 0 ? (
                            <>
                              <br />
                              Cultura: {info.crop}
                              <br />
                              Produção total: {info.totalProduction.toLocaleString('pt-BR')}{' '}
                              {info.productionUnit}
                              <br />
                              Produtividade:{' '}
                              {info.productivityPerHa.toLocaleString('pt-BR', {
                                maximumFractionDigits: 2,
                              })}{' '}
                              {info.productivityUnit}
                              <br />
                              Variação da média: {info.deviationFromAvg > 0 ? '+' : ''}
                              {info.deviationFromAvg.toLocaleString('pt-BR', {
                                maximumFractionDigits: 1,
                              })}
                              %
                              <br />
                              Colheitas: {info.harvestCount}
                            </>
                          ) : (
                            <>
                              <br />
                              <em>Sem dados de colheita</em>
                            </>
                          )}
                        </div>
                      </Popup>
                    </GeoJSON>
                  );
                })}
            </MapContainer>
          ) : null}

          {/* Base map toggle */}
          <div className="prod-map__basemap-toggle">
            <button
              type="button"
              className={`prod-map__basemap-btn ${baseMap === 'satellite' ? 'prod-map__basemap-btn--active' : ''}`}
              onClick={() => setBaseMap('satellite')}
              aria-label="Mapa satélite"
            >
              Satélite
            </button>
            <button
              type="button"
              className={`prod-map__basemap-btn ${baseMap === 'topographic' ? 'prod-map__basemap-btn--active' : ''}`}
              onClick={() => setBaseMap('topographic')}
              aria-label="Mapa topográfico"
            >
              Topo
            </button>
          </div>

          {/* Legend */}
          <div className="prod-map__legend" role="region" aria-label="Legenda de produtividade">
            <h3 className="prod-map__legend-title">PRODUTIVIDADE</h3>
            {(Object.keys(LEVEL_COLORS) as ProductivityLevel[]).map((level) => {
              const Icon = LEVEL_ICONS[level];
              const count = prodData?.summary.levels[level] ?? 0;
              return (
                <div key={level} className="prod-map__legend-item">
                  <span
                    className="prod-map__legend-swatch"
                    style={{ backgroundColor: LEVEL_COLORS[level] }}
                    aria-hidden="true"
                  />
                  <Icon size={14} aria-hidden="true" />
                  <span className="prod-map__legend-label">{LEVEL_LABELS[level]}</span>
                  <span className="prod-map__legend-count">{count}</span>
                </div>
              );
            })}
            {prodData && (
              <div className="prod-map__legend-avg">
                Média:{' '}
                {prodData.summary.avgProductivityPerHa.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}{' '}
                {prodData.summary.productivityUnit}
              </div>
            )}
          </div>
        </div>

        {/* CA4 — Ranking sidebar */}
        <aside className="prod-map__ranking" aria-label="Ranking de talhões">
          <h2 className="prod-map__ranking-title">
            <BarChart3 size={20} aria-hidden="true" />
            Ranking por talhão
          </h2>

          {prodData && (
            <div className="prod-map__ranking-summary">
              <span className="prod-map__ranking-summary-item">
                {prodData.summary.plotsWithData} de {prodData.summary.totalPlots} talhões com dados
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="prod-map__ranking-loading" aria-busy="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="prod-map__ranking-skeleton" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <div className="prod-map__ranking-empty">
              <BarChart3 size={32} aria-hidden="true" />
              <p>Nenhum dado de colheita encontrado para os filtros selecionados.</p>
            </div>
          ) : (
            <ol className="prod-map__ranking-list">
              {ranking.map((plot, index) => {
                const Icon = LEVEL_ICONS[plot.level];
                return (
                  <li key={plot.fieldPlotId} className="prod-map__ranking-item">
                    <span className="prod-map__ranking-pos">{index + 1}</span>
                    <div className="prod-map__ranking-info">
                      <span className="prod-map__ranking-name">{plot.fieldPlotName}</span>
                      <span className="prod-map__ranking-detail">
                        {plot.productivityPerHa.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        {plot.productivityUnit}
                        {' · '}
                        {plot.crop}
                        {' · '}
                        {formatArea(plot.fieldPlotAreaHa)}
                      </span>
                    </div>
                    <div
                      className={`prod-map__ranking-badge prod-map__ranking-badge--${plot.level.toLowerCase()}`}
                      title={`${plot.deviationFromAvg > 0 ? '+' : ''}${plot.deviationFromAvg}% da média`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      <span>
                        {plot.deviationFromAvg > 0 ? '+' : ''}
                        {plot.deviationFromAvg.toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>

      {/* CA5 — Season comparison */}
      {showSeasons && (
        <section className="prod-map__seasons" aria-label="Comparativo por safra">
          <h2 className="prod-map__seasons-title">
            <GitCompareArrows size={20} aria-hidden="true" />
            Comparativo safra a safra
          </h2>
          {seasonLoading ? (
            <div className="prod-map__ranking-loading" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="prod-map__ranking-skeleton" />
              ))}
            </div>
          ) : seasonData.length === 0 ? (
            <p className="prod-map__seasons-empty">
              Nenhum dado de colheita encontrado para comparação entre safras.
            </p>
          ) : (
            <div className="prod-map__seasons-grid">
              {seasonData.map((plot) => (
                <div key={plot.fieldPlotId} className="prod-map__season-card">
                  <div className="prod-map__season-card-header">
                    <strong>{plot.fieldPlotName}</strong>
                    <span className="prod-map__ranking-detail">
                      {formatArea(plot.fieldPlotAreaHa)}
                    </span>
                    {plot.variationPct != null && (
                      <span
                        className={`prod-map__ranking-badge prod-map__ranking-badge--${plot.variationPct >= 0 ? 'alta' : 'baixa'}`}
                      >
                        {plot.variationPct >= 0 ? (
                          <TrendingUp size={14} aria-hidden="true" />
                        ) : (
                          <TrendingDown size={14} aria-hidden="true" />
                        )}
                        <span>
                          {plot.variationPct > 0 ? '+' : ''}
                          {plot.variationPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                        </span>
                      </span>
                    )}
                  </div>
                  <table className="prod-map__season-table">
                    <thead>
                      <tr>
                        <th scope="col">Safra</th>
                        <th scope="col">Produtividade</th>
                        <th scope="col">Produção</th>
                        <th scope="col">Colheitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plot.seasons.map((s) => (
                        <tr key={s.season}>
                          <td>{s.season}</td>
                          <td>
                            {s.productivityPerHa.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })}{' '}
                            {s.productivityUnit}
                          </td>
                          <td>
                            {s.totalProduction.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })}{' '}
                            {s.productionUnit}
                          </td>
                          <td>{s.harvestCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ProductivityMapPage;
