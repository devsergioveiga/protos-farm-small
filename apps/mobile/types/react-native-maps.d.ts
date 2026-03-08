/* eslint-disable @typescript-eslint/no-explicit-any */
// Workaround: react-native-maps uses class components incompatible with React 19 JSX types.
declare module 'react-native-maps' {
  import type { ViewProps } from 'react-native';

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface LatLng {
    latitude: number;
    longitude: number;
  }

  export interface MapViewProps extends ViewProps {
    ref?: React.Ref<any>;
    initialRegion?: Region;
    region?: Region;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
    onRegionChange?: (region: Region) => void;
    onRegionChangeComplete?: (region: Region) => void;
    onPress?: (event: any) => void;
    children?: React.ReactNode;
    style?: any;
    accessibilityLabel?: string;
  }

  export interface UrlTileProps {
    urlTemplate: string;
    maximumZ?: number;
    minimumZ?: number;
    offlineMode?: boolean;
    tileSize?: number;
    zIndex?: number;
    tileCachePath?: string;
  }

  export interface PolygonProps {
    coordinates: LatLng[];
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    tappable?: boolean;
    onPress?: () => void;
    zIndex?: number;
  }

  export interface MarkerProps {
    coordinate: LatLng;
    title?: string;
    description?: string;
    pinColor?: string;
    children?: React.ReactNode;
  }

  const MapView: React.FC<MapViewProps>;
  export const UrlTile: React.FC<UrlTileProps>;
  export const Polygon: React.FC<PolygonProps>;
  export const Marker: React.FC<MarkerProps>;

  export default MapView;
}
