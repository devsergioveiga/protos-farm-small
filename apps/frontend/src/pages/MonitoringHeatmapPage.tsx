import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, AlertCircle, Flame, Filter } from 'lucide-react';
import MapAutoFit from '@/components/map/MapAutoFit';
import { useMonitoringHeatmap } from '@/hooks/useMonitoringHeatmap';
import { usePests } from '@/hooks/usePests';
import { api } from '@/services/api';
import type { HeatmapPoint } from '@/types/monitoring-record';
import './MonitoringHeatmapPage.css';

const LEVEL_COLORS: Record<string, string> = {
  AUSENTE: '#4CAF50',
  BAIXO: '#8BC34A',
  MODERADO: '#FFC107',
  ALTO: '#FF9800',
  CRITICO: '#F44336',
};

const LEVEL_LABELS: Record<string, string> = {
  AUSENTE: 'Ausente',
  BAIXO: 'Baixo',
  MODERADO: 'Moderado',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

function intensityToColor(intensity: number): string {
  if (intensity <= 0) return LEVEL_COLORS.AUSENTE;
  if (intensity <= 0.25) return LEVEL_COLORS.BAIXO;
  if (intensity <= 0.5) return LEVEL_COLORS.MODERADO;
  if (intensity <= 0.75) return LEVEL_COLORS.ALTO;
  return LEVEL_COLORS.CRITICO;
}

function intensityToRadius(intensity: number): number {
  return 8 + intensity * 16;
}

function MonitoringHeatmapPage() {
  const { farmId = '', fieldPlotId = '' } = useParams<{
    farmId: string;
    fieldPlotId: string;
  }>();

  const [filterPestId, setFilterPestId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [plotName, setPlotName] = useState('');
  const [plotBoundary, setPlotBoundary] = useState<GeoJSON.GeoJsonObject | null>(null);

  const { points, isLoading, error } = useMonitoringHeatmap({
    farmId,
    fieldPlotId,
    pestId: filterPestId || undefined,
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
  });

  const { pests } = usePests({ limit: 100 });

  useEffect(() => {
    async function fetchPlotData() {
      try {
        const data = await api.get<{
          plots: Array<{ id: string; name: string }>;
        }>(`/org/farms/${farmId}/plots`);
        const plot = data.plots.find((p) => p.id === fieldPlotId);
        if (plot) setPlotName(plot.name);
      } catch {
        // ignore
      }
      try {
        const boundary = await api.get<{
          hasBoundary: boolean;
          boundaryGeoJSON?: GeoJSON.GeoJsonObject;
        }>(`/org/farms/${farmId}/plots/${fieldPlotId}/boundary`);
        if (boundary.hasBoundary && boundary.boundaryGeoJSON) {
          setPlotBoundary(boundary.boundaryGeoJSON);
        }
      } catch {
        // ignore
      }
    }
    if (farmId && fieldPlotId) void fetchPlotData();
  }, [farmId, fieldPlotId]);

  const mapBounds = useMemo(() => {
    if (plotBoundary) {
      const geoLayer = L.geoJSON(plotBoundary);
      return geoLayer.getBounds();
    }
    if (points.length > 0) {
      const lats = points.map((p) => p.latitude);
      const lngs = points.map((p) => p.longitude);
      return L.latLngBounds(
        [Math.min(...lats) - 0.001, Math.min(...lngs) - 0.001],
        [Math.max(...lats) + 0.001, Math.max(...lngs) + 0.001],
      );
    }
    return null;
  }, [plotBoundary, points]);

  const handleClearFilters = useCallback(() => {
    setFilterPestId('');
    setFilterStartDate('');
    setFilterEndDate('');
  }, []);

  const hasActiveFilters = filterPestId || filterStartDate || filterEndDate;

  return (
    <section className="mhp">
      {/* Breadcrumb */}
      <nav className="mhp__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-points`} className="mhp__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar aos pontos
        </Link>
      </nav>

      {/* Header */}
      <div className="mhp__header">
        <div className="mhp__header-text">
          <h1 className="mhp__title">Mapa de Calor MIP</h1>
          <p className="mhp__subtitle">
            {plotName
              ? `Incidência de pragas — ${plotName}`
              : 'Visualização da pressão de pragas por ponto de monitoramento'}
          </p>
        </div>
        <div className="mhp__header-actions">
          <button
            type="button"
            className={`mhp__btn mhp__btn--secondary ${hasActiveFilters ? 'mhp__btn--active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="mhp-filters"
          >
            <Filter size={20} aria-hidden="true" />
            Filtros
            {hasActiveFilters && <span className="mhp__filter-badge" aria-label="Filtros ativos" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mhp__filters" id="mhp-filters">
          <div className="mhp__filter-field">
            <label htmlFor="mhp-filter-pest" className="mhp__filter-label">
              Praga
            </label>
            <select
              id="mhp-filter-pest"
              className="mhp__filter-select"
              value={filterPestId}
              onChange={(e) => setFilterPestId(e.target.value)}
            >
              <option value="">Todas</option>
              {pests.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.commonName}
                </option>
              ))}
            </select>
          </div>
          <div className="mhp__filter-field">
            <label htmlFor="mhp-filter-start" className="mhp__filter-label">
              Data início
            </label>
            <input
              type="date"
              id="mhp-filter-start"
              className="mhp__filter-input"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="mhp__filter-field">
            <label htmlFor="mhp-filter-end" className="mhp__filter-label">
              Data fim
            </label>
            <input
              type="date"
              id="mhp-filter-end"
              className="mhp__filter-input"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
          {hasActiveFilters && (
            <button type="button" className="mhp__btn mhp__btn--ghost" onClick={handleClearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mhp__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mhp__map-container">
          <div className="mhp__skeleton-map" aria-label="Carregando mapa" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && points.length === 0 && (
        <div className="mhp__empty">
          <Flame size={48} aria-hidden="true" className="mhp__empty-icon" />
          <h2 className="mhp__empty-title">Sem dados para o mapa de calor</h2>
          <p className="mhp__empty-desc">
            Registre observações nos pontos de monitoramento para visualizar a pressão de pragas.
          </p>
          <Link
            to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-records`}
            className="mhp__btn mhp__btn--primary"
          >
            Ir para registros
          </Link>
        </div>
      )}

      {/* Map */}
      {!isLoading && !error && points.length > 0 && (
        <>
          <div className="mhp__map-container">
            <MapContainer
              center={[-15.78, -47.93]}
              zoom={4}
              preferCanvas={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri"
                maxZoom={18}
              />
              <MapAutoFit bounds={mapBounds} />

              {plotBoundary && (
                <GeoJSON
                  key={`plot-boundary-${fieldPlotId}`}
                  data={plotBoundary}
                  style={{
                    color: '#FFFFFF',
                    weight: 2,
                    fillOpacity: 0.05,
                    fillColor: '#FFFFFF',
                  }}
                />
              )}

              {points.map((point) => (
                <HeatmapMarker key={point.monitoringPointId} point={point} />
              ))}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mhp__legend" role="img" aria-label="Legenda do mapa de calor">
            <h3 className="mhp__legend-title">Nível de infestação</h3>
            <ul className="mhp__legend-list">
              {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                <li key={level} className="mhp__legend-item">
                  <span
                    className="mhp__legend-dot"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span>{LEVEL_LABELS[level]}</span>
                </li>
              ))}
            </ul>
            <p className="mhp__legend-note">Tamanho do círculo proporcional à intensidade média</p>
          </div>

          {/* Summary cards */}
          <div className="mhp__summary">
            <h3 className="mhp__summary-title">Resumo por ponto</h3>
            <div className="mhp__summary-cards">
              {points.map((point) => (
                <div
                  key={point.monitoringPointId}
                  className="mhp__summary-card"
                  style={{ borderLeftColor: intensityToColor(point.intensity) }}
                >
                  <div className="mhp__summary-card-header">
                    <span className="mhp__summary-code">{point.code}</span>
                    <span className={`mrp__badge mrp__badge--${point.maxLevel.toLowerCase()}`}>
                      {LEVEL_LABELS[point.maxLevel] ?? point.maxLevel}
                    </span>
                  </div>
                  <p className="mhp__summary-info">
                    {point.recordCount} registro{point.recordCount !== 1 ? 's' : ''}
                  </p>
                  {point.topPests.length > 0 && (
                    <ul className="mhp__summary-pests">
                      {point.topPests.map((pest) => (
                        <li key={pest.pestId}>
                          {pest.pestName} ({pest.count})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function HeatmapMarker({ point }: { point: HeatmapPoint }) {
  const color = intensityToColor(point.intensity);
  const radius = intensityToRadius(point.intensity);

  return (
    <CircleMarker
      center={[point.latitude, point.longitude]}
      radius={radius}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.6,
        weight: 2,
        opacity: 0.8,
      }}
    >
      <Tooltip direction="top" offset={[0, -radius]}>
        <strong>{point.code}</strong>
        <br />
        Nível máx.: {LEVEL_LABELS[point.maxLevel] ?? point.maxLevel}
        <br />
        {point.recordCount} registro{point.recordCount !== 1 ? 's' : ''}
        {point.topPests.length > 0 && (
          <>
            <br />
            {point.topPests.map((p) => p.pestName).join(', ')}
          </>
        )}
      </Tooltip>
    </CircleMarker>
  );
}

export default MonitoringHeatmapPage;
