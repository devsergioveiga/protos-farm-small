import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';

interface MapAutoFitProps {
  bounds: LatLngBoundsExpression | null;
}

function MapAutoFit({ bounds }: MapAutoFitProps) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [map, bounds]);

  return null;
}

export default MapAutoFit;
