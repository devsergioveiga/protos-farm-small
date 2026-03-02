import { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { BulkPreviewFeature } from '@/types/farm';
import type { LatLngBoundsExpression } from 'leaflet';
import './BulkImportModal.css';

interface BulkPreviewMapProps {
  features: BulkPreviewFeature[];
  farmBoundary?: GeoJSON.Polygon | null;
  selectedIndices: Set<number>;
}

function getFeatureColor(feature: BulkPreviewFeature, isSelected: boolean): string {
  if (!feature.validation.valid) return '#C62828';
  if (feature.validation.warnings.length > 0) return '#F9A825';
  if (isSelected) return '#2E7D32';
  return '#9E9E9E';
}

function BulkPreviewMap({ features, farmBoundary, selectedIndices }: BulkPreviewMapProps) {
  const bounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    const allCoords: [number, number][] = [];

    if (farmBoundary) {
      for (const coord of farmBoundary.coordinates[0]) {
        allCoords.push([coord[1], coord[0]]);
      }
    }

    for (const f of features) {
      if (f.validation.valid) {
        for (const coord of f.polygon.coordinates[0]) {
          allCoords.push([coord[1], coord[0]]);
        }
      }
    }

    if (allCoords.length === 0) return undefined;

    const lats = allCoords.map((c) => c[0]);
    const lngs = allCoords.map((c) => c[1]);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [features, farmBoundary]);

  const featureCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature' as const,
        properties: {
          index: f.index,
          valid: f.validation.valid,
          hasWarnings: f.validation.warnings.length > 0,
          color: getFeatureColor(f, selectedIndices.has(f.index)),
        },
        geometry: f.polygon,
      })),
    };
  }, [features, selectedIndices]);

  const farmFeatureCollection = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!farmBoundary) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: farmBoundary,
        },
      ],
    };
  }, [farmBoundary]);

  if (!bounds) return null;

  return (
    <div className="bulk-preview-map">
      <MapContainer
        bounds={bounds}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        preferCanvas={true}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
        />
        {farmFeatureCollection && (
          <GeoJSON
            data={farmFeatureCollection}
            style={{ color: '#ffffff', weight: 2, fillOpacity: 0.05, dashArray: '8 4' }}
          />
        )}
        <GeoJSON
          key={JSON.stringify(selectedIndices.size)}
          data={featureCollection}
          style={(feature) => ({
            color: (feature?.properties?.color as string) ?? '#9E9E9E',
            weight: 2,
            fillOpacity: 0.3,
          })}
        />
      </MapContainer>
    </div>
  );
}

export default BulkPreviewMap;
