import { useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';

interface BoundaryPreviewMapProps {
  polygon: GeoJSON.Polygon;
  existingBoundary: GeoJSON.Polygon | null;
}

function BoundaryPreviewMap({ polygon, existingBoundary }: BoundaryPreviewMapProps) {
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const allCoords: [number, number][] = [];

    for (const coord of polygon.coordinates[0]) {
      allCoords.push([coord[1], coord[0]]);
    }

    if (existingBoundary) {
      for (const coord of existingBoundary.coordinates[0]) {
        allCoords.push([coord[1], coord[0]]);
      }
    }

    const lats = allCoords.map((c) => c[0]);
    const lngs = allCoords.map((c) => c[1]);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  }, [polygon, existingBoundary]);

  const newBoundaryFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [{ type: 'Feature' as const, properties: {}, geometry: polygon }],
    }),
    [polygon],
  );

  const existingBoundaryFC = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!existingBoundary) return null;
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature' as const, properties: {}, geometry: existingBoundary }],
    };
  }, [existingBoundary]);

  return (
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
      {existingBoundaryFC && (
        <GeoJSON
          data={existingBoundaryFC}
          style={{ color: '#ffffff', weight: 2, fillOpacity: 0.05, dashArray: '8 4' }}
        />
      )}
      <GeoJSON data={newBoundaryFC} style={{ color: '#2E7D32', weight: 3, fillOpacity: 0.15 }} />
    </MapContainer>
  );
}

export default BoundaryPreviewMap;
