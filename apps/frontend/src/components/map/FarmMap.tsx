import { useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapAutoFit from './MapAutoFit';
import PlotLabels from './PlotLabels';
import type { BaseMapType } from './BaseMapSelector';
import type { FarmMapData } from '@/hooks/useFarmMap';
import type { FarmRegistration, FieldPlot } from '@/types/farm';
import type { FarmLocationMapItem } from '@/types/farm-location';
import { PASTURE_STATUS_COLORS, FACILITY_TYPE_COLORS } from './LocationLegend';

const TILE_URLS: Record<BaseMapType, { url: string; attribution: string; maxZoom: number }> = {
  topographic: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 18,
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 18,
  },
};

const HYBRID_LABELS_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const REGISTRATION_COLORS = ['#e65100', '#1565c0', '#f9a825', '#ad1457', '#00897b', '#6a1b9a'];

export const CROP_COLORS: Record<string, string> = {
  soja: '#DAA520',
  milho: '#228B22',
  café: '#8B4513',
  cafe: '#8B4513',
  algodão: '#E6E6FA',
  algodao: '#E6E6FA',
  cana: '#90EE90',
  'cana-de-açúcar': '#90EE90',
  pasto: '#7CFC00',
  pastagem: '#7CFC00',
  arroz: '#F0E68C',
  feijão: '#CD853F',
  feijao: '#CD853F',
  trigo: '#F5DEB3',
  sorgo: '#D2691E',
};

export const NO_CROP_COLOR = '#6B7280';

export function getCropColor(crop: string | null): string {
  if (!crop) return NO_CROP_COLOR;
  const key = crop.toLowerCase().trim();
  return CROP_COLORS[key] ?? NO_CROP_COLOR;
}

function getPlotStyle(crop: string | null): L.PathOptions {
  const color = getCropColor(crop);
  return {
    color,
    weight: 2,
    fillOpacity: 0.3,
    fillColor: color,
  };
}

export function formatArea(ha: number | null): string {
  if (ha == null) return '—';
  return `${Number(ha).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;
}

const FARM_STYLE: L.PathOptions = {
  color: '#2E7D32',
  weight: 3,
  fillOpacity: 0.1,
  fillColor: '#2E7D32',
};

function getRegistrationStyle(index: number): L.PathOptions {
  const color = REGISTRATION_COLORS[index % REGISTRATION_COLORS.length];
  return {
    color,
    weight: 2,
    fillOpacity: 0.15,
    fillColor: color,
    dashArray: '6 4',
  };
}

const VERSION_OVERLAY_STYLE: L.PathOptions = {
  color: '#FF6F00',
  weight: 3,
  fillOpacity: 0.15,
  fillColor: '#FF6F00',
  dashArray: '8 6',
};

interface FarmMapProps {
  data: FarmMapData;
  baseMap: BaseMapType;
  showFarmBoundary: boolean;
  showRegistrations: boolean;
  showPlots?: boolean;
  showPastures?: boolean;
  showFacilities?: boolean;
  onPlotClick?: (plot: FieldPlot) => void;
  onLocationClick?: (location: FarmLocationMapItem) => void;
  cropFilter?: Set<string>;
  versionOverlay?: GeoJSON.Polygon | null;
}

function FarmMap({
  data,
  baseMap,
  showFarmBoundary,
  showRegistrations,
  showPlots = true,
  showPastures = false,
  showFacilities = false,
  onPlotClick,
  onLocationClick,
  cropFilter,
  versionOverlay,
}: FarmMapProps) {
  const { farm, farmBoundary, registrationBoundaries, plotBoundaries, locationBoundaries } = data;
  const tile = TILE_URLS[baseMap];

  const bounds = useMemo(() => {
    if (farmBoundary.hasBoundary && farmBoundary.boundaryGeoJSON) {
      const geoLayer = L.geoJSON(farmBoundary.boundaryGeoJSON);
      return geoLayer.getBounds();
    }
    if (farm.latitude != null && farm.longitude != null) {
      return L.latLngBounds(
        [farm.latitude - 0.01, farm.longitude - 0.01],
        [farm.latitude + 0.01, farm.longitude + 0.01],
      );
    }
    return null;
  }, [farmBoundary, farm.latitude, farm.longitude]);

  const registrationMap = useMemo(() => {
    const map = new Map<string, FarmRegistration>();
    for (const reg of farm.registrations) {
      map.set(reg.id, reg);
    }
    return map;
  }, [farm.registrations]);

  const filteredPlotBoundaries = useMemo(() => {
    if (!cropFilter || cropFilter.size === 0) return plotBoundaries;
    return plotBoundaries.filter((pb) => {
      const cropKey = pb.plot.currentCrop?.toLowerCase().trim() ?? '__none__';
      return cropFilter.has(cropKey);
    });
  }, [plotBoundaries, cropFilter]);

  const makePlotEachFeature = useCallback(
    (plot: FieldPlot) => {
      return (_feature: GeoJSON.Feature, layer: L.Layer) => {
        const soilLabel = plot.soilType ? plot.soilType.replace(/_/g, ' ') : null;
        const statusLabel =
          plot.status === 'PLANTADO'
            ? '🌱 Plantado'
            : plot.status === 'ACTIVE'
              ? 'Disponível'
              : plot.status;
        const tooltipLines = [
          `<strong>${plot.name}</strong>`,
          `Status: ${statusLabel}`,
          `Área: ${formatArea(plot.boundaryAreaHa)}`,
          plot.currentCrop ? `Cultura: ${plot.currentCrop}` : null,
          soilLabel ? `Solo: ${soilLabel}` : null,
        ].filter(Boolean);

        layer.bindTooltip(tooltipLines.join('<br>'), {
          sticky: true,
          direction: 'auto',
          className: 'plot-tooltip',
        });

        layer.on('click', () => {
          onPlotClick?.(plot);
        });
      };
    },
    [onPlotClick],
  );

  const getLocationColor = useCallback((loc: FarmLocationMapItem): string => {
    if (loc.type === 'PASTURE') {
      return PASTURE_STATUS_COLORS[loc.pastureStatus ?? 'EM_USO'] ?? '#6B7280';
    }
    return FACILITY_TYPE_COLORS[loc.facilityType ?? 'OUTRO'] ?? '#757575';
  }, []);

  const getLocationStyle = useCallback(
    (loc: FarmLocationMapItem): L.PathOptions => {
      const color = getLocationColor(loc);
      return {
        color,
        weight: 2,
        fillOpacity: 0.25,
        fillColor: color,
        dashArray: loc.type === 'FACILITY' ? '4 4' : undefined,
      };
    },
    [getLocationColor],
  );

  const makeLocationEachFeature = useCallback(
    (loc: FarmLocationMapItem) => {
      return (_feature: GeoJSON.Feature, layer: L.Layer) => {
        const occupancyDot =
          loc.occupancy.occupancyPercent != null
            ? ` | Ocupação: ${loc.occupancy.occupancyPercent}%`
            : '';
        const tooltipLines = [
          `<strong>${loc.name}</strong>`,
          loc.type === 'PASTURE' ? 'Pasto' : 'Instalação',
          loc.boundaryAreaHa ? `Área: ${formatArea(loc.boundaryAreaHa)}` : null,
          loc.capacityUA ? `Capacidade: ${loc.capacityUA} UA` : null,
          loc.capacityAnimals ? `Capacidade: ${loc.capacityAnimals} animais` : null,
          occupancyDot ? `${loc.occupancy.totalAnimals} animais${occupancyDot}` : null,
        ].filter(Boolean);

        layer.bindTooltip(tooltipLines.join('<br>'), {
          sticky: true,
          direction: 'auto',
          className: 'plot-tooltip',
        });

        layer.on('click', () => {
          onLocationClick?.(loc);
        });
      };
    },
    [onLocationClick],
  );

  const filteredPastures = useMemo(
    () => locationBoundaries.filter((l) => l.type === 'PASTURE' && l.boundaryGeoJSON),
    [locationBoundaries],
  );

  const filteredFacilities = useMemo(
    () => locationBoundaries.filter((l) => l.type === 'FACILITY' && l.boundaryGeoJSON),
    [locationBoundaries],
  );

  const classificationLabels: Record<string, string> = {
    MINIFUNDIO: 'Minifúndio',
    PEQUENA: 'Pequena',
    MEDIA: 'Média',
    GRANDE: 'Grande',
  };

  return (
    <MapContainer
      center={[-15.78, -47.93]}
      zoom={4}
      preferCanvas={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
      {baseMap === 'hybrid' && <TileLayer url={HYBRID_LABELS_URL} maxZoom={18} />}
      <MapAutoFit bounds={bounds} />

      {showFarmBoundary && farmBoundary.hasBoundary && farmBoundary.boundaryGeoJSON && (
        <GeoJSON
          key={`farm-boundary-${farm.id}`}
          data={farmBoundary.boundaryGeoJSON}
          style={FARM_STYLE}
        >
          <Popup>
            <strong>{farm.name}</strong>
            <br />
            Área total: {formatArea(Number(farm.totalAreaHa))}
            <br />
            Estado: {farm.state}
            {farm.landClassification && (
              <>
                <br />
                Classificação:{' '}
                {classificationLabels[farm.landClassification] ?? farm.landClassification}
              </>
            )}
          </Popup>
        </GeoJSON>
      )}

      {showRegistrations &&
        registrationBoundaries
          .filter((rb) => rb.boundary.hasBoundary && rb.boundary.boundaryGeoJSON)
          .map((rb, index) => {
            const reg = registrationMap.get(rb.registrationId);
            return (
              <GeoJSON
                key={`reg-boundary-${rb.registrationId}`}
                data={rb.boundary.boundaryGeoJSON!}
                style={getRegistrationStyle(index)}
              >
                <Popup>
                  <strong>Matrícula {reg?.number ?? '—'}</strong>
                  <br />
                  Cartório: {reg?.cartorioName ?? '—'}
                  <br />
                  Comarca: {reg?.comarca ?? '—'}
                  <br />
                  Área: {formatArea(reg?.areaHa ?? null)}
                </Popup>
              </GeoJSON>
            );
          })}

      {showPlots &&
        filteredPlotBoundaries
          .filter((pb) => pb.boundary.hasBoundary && pb.boundary.boundaryGeoJSON)
          .map((pb) => (
            <GeoJSON
              key={`plot-boundary-${pb.plotId}-${pb.plot.currentCrop ?? 'none'}-${pb.plot.status}-${cropFilter?.size ?? 0}`}
              data={pb.boundary.boundaryGeoJSON!}
              style={getPlotStyle(pb.plot.currentCrop)}
              onEachFeature={makePlotEachFeature(pb.plot)}
            />
          ))}

      {showPlots && <PlotLabels plotBoundaries={filteredPlotBoundaries} />}

      {showPastures &&
        filteredPastures.map((loc) => {
          const geojson = loc.boundaryGeoJSON!;
          const geojsonType = (geojson as GeoJSON.Geometry).type;

          if (geojsonType === 'Point') {
            const coords = (geojson as GeoJSON.Point).coordinates;
            return (
              <CircleMarker
                key={`loc-${loc.id}`}
                center={[coords[1], coords[0]]}
                radius={10}
                pathOptions={getLocationStyle(loc)}
                eventHandlers={{
                  click: () => onLocationClick?.(loc),
                }}
              />
            );
          }

          return (
            <GeoJSON
              key={`loc-${loc.id}`}
              data={geojson as GeoJSON.GeoJsonObject}
              style={getLocationStyle(loc)}
              onEachFeature={makeLocationEachFeature(loc)}
            />
          );
        })}

      {showFacilities &&
        filteredFacilities.map((loc) => {
          const geojson = loc.boundaryGeoJSON!;
          const geojsonType = (geojson as GeoJSON.Geometry).type;

          if (geojsonType === 'Point') {
            const coords = (geojson as GeoJSON.Point).coordinates;
            return (
              <CircleMarker
                key={`loc-${loc.id}`}
                center={[coords[1], coords[0]]}
                radius={8}
                pathOptions={getLocationStyle(loc)}
                eventHandlers={{
                  click: () => onLocationClick?.(loc),
                }}
              />
            );
          }

          return (
            <GeoJSON
              key={`loc-${loc.id}`}
              data={geojson as GeoJSON.GeoJsonObject}
              style={getLocationStyle(loc)}
              onEachFeature={makeLocationEachFeature(loc)}
            />
          );
        })}

      {versionOverlay && (
        <GeoJSON
          key={`version-overlay-${JSON.stringify(versionOverlay.coordinates[0]?.[0])}`}
          data={versionOverlay}
          style={VERSION_OVERLAY_STYLE}
        >
          <Popup>Versão anterior do perímetro</Popup>
        </GeoJSON>
      )}
    </MapContainer>
  );
}

export default FarmMap;
