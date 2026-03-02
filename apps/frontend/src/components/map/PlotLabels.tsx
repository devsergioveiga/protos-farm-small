import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { FarmMapData } from '@/hooks/useFarmMap';

type PlotBoundary = FarmMapData['plotBoundaries'][number];

const LABEL_ZOOM_THRESHOLD = 15;
const MAX_LABEL_LENGTH = 15;

interface PlotLabelsProps {
  plotBoundaries: PlotBoundary[];
}

function PlotLabels({ plotBoundaries }: PlotLabelsProps) {
  const map = useMap();
  const tooltipLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  useEffect(() => {
    tooltipLayerRef.current.addTo(map);
    return () => {
      tooltipLayerRef.current.remove();
    };
  }, [map]);

  useEffect(() => {
    const updateLabels = () => {
      const group = tooltipLayerRef.current;
      group.clearLayers();

      if (map.getZoom() < LABEL_ZOOM_THRESHOLD) return;

      for (const pb of plotBoundaries) {
        if (!pb.boundary.hasBoundary || !pb.boundary.boundaryGeoJSON) continue;

        const geoLayer = L.geoJSON(pb.boundary.boundaryGeoJSON);
        const center = geoLayer.getBounds().getCenter();

        const label =
          pb.plot.name.length > MAX_LABEL_LENGTH
            ? pb.plot.name.slice(0, MAX_LABEL_LENGTH) + '...'
            : pb.plot.name;

        const marker = L.marker(center, {
          opacity: 0,
          interactive: false,
        });

        marker.bindTooltip(label, {
          permanent: true,
          direction: 'center',
          className: 'plot-label-tooltip',
        });

        group.addLayer(marker);
      }
    };

    updateLabels();

    map.on('zoomend', updateLabels);
    return () => {
      map.off('zoomend', updateLabels);
    };
  }, [map, plotBoundaries]);

  // Listen for zoom events to trigger re-render context
  useMapEvents({});

  return null;
}

export default PlotLabels;
