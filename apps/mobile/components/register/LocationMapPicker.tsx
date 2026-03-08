import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon, UrlTile } from 'react-native-maps';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { X, Check, MapPin } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useConnectivity } from '@/stores/ConnectivityContext';
import {
  createFarmRepository,
  createFieldPlotRepository,
  createFarmLocationRepository,
  createTileCacheRepository,
} from '@/services/db';
import { createTileCacheService, computeBBoxFromGeoJSON } from '@/services/tile-cache';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { FieldOperationLocationType } from '@/types/offline';
import type { LatLng } from 'react-native-maps';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MapPickerResult {
  id: string;
  name: string;
  type: FieldOperationLocationType;
}

interface LocationMapPickerProps {
  farmId: string;
  onSelect: (result: MapPickerResult) => void;
  onClose: () => void;
}

interface ParsedPolygon {
  id: string;
  name: string;
  type: 'plot' | 'pasture' | 'facility';
  locationType: FieldOperationLocationType;
  coordinates: LatLng[];
  color: string;
  areaHa: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CROP_COLORS: Record<string, string> = {
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
const NO_CROP_COLOR = '#6B7280';
const FARM_BOUNDARY_COLOR = '#2E7D32';
const PASTURE_COLOR = '#43A047';
const FACILITY_COLOR = '#FF6F00';

function getCropColor(crop: string | null): string {
  if (!crop) return NO_CROP_COLOR;
  return CROP_COLORS[crop.toLowerCase().trim()] ?? NO_CROP_COLOR;
}

function parseGeoJSONToCoords(geojsonStr: string | null): LatLng[] | null {
  if (!geojsonStr) return null;
  try {
    const geojson = JSON.parse(geojsonStr);
    const ring = geojson.coordinates?.[0];
    if (!ring || !Array.isArray(ring)) return null;
    return ring.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return null;
  }
}

function formatArea(ha: number | null): string {
  if (ha == null) return '';
  return `${Number(ha).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;
}

function getTypeLabel(type: string): string {
  if (type === 'plot') return 'Talhão';
  if (type === 'pasture') return 'Pasto';
  return 'Instalação';
}

const DEFAULT_REGION = {
  latitude: -15.7801,
  longitude: -47.9292,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1 as const, backgroundColor: c.neutral[50] },
  map: { flex: 1 as const },
  topBar: {
    position: 'absolute' as const,
    top: Platform.OS === 'ios' ? spacing[1] : spacing[3],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  topBarHint: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
  },
  closeButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  // Selected polygon card at bottom
  selectionCard: {
    position: 'absolute' as const,
    bottom: spacing[6],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  selectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  selectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  selectionContent: { flex: 1 as const },
  selectionName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  selectionType: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: 2,
  },
  selectionArea: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    marginTop: 2,
  },
  confirmButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  confirmButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[0],
  },
  emptyHint: {
    position: 'absolute' as const,
    bottom: spacing[6],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyHintText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    textAlign: 'center' as const,
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export function LocationMapPicker({ farmId, onSelect, onClose }: LocationMapPickerProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isConnected } = useConnectivity();

  const mapRef = useRef<React.ComponentRef<typeof MapView>>(null);
  const tileCacheService = useMemo(() => createTileCacheService(db), [db]);

  const [farmBoundaryCoords, setFarmBoundaryCoords] = useState<LatLng[] | null>(null);
  const [polygons, setPolygons] = useState<ParsedPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<ParsedPolygon | null>(null);
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [tileUrlTemplate, setTileUrlTemplate] = useState<string | null>(null);

  // Load farm data and polygons
  useEffect(() => {
    async function load() {
      const farmRepo = createFarmRepository(db);
      const plotRepo = createFieldPlotRepository(db);
      const locRepo = createFarmLocationRepository(db);
      const tileCacheRepo = createTileCacheRepository(db);

      const farm = await farmRepo.getById(farmId);
      if (!farm) return;

      // Region from boundary or center
      if (farm.boundary_geojson) {
        const bbox = computeBBoxFromGeoJSON(farm.boundary_geojson);
        if (bbox) {
          setMapRegion({
            latitude: (bbox.north + bbox.south) / 2,
            longitude: (bbox.east + bbox.west) / 2,
            latitudeDelta: (bbox.north - bbox.south) * 1.3,
            longitudeDelta: (bbox.east - bbox.west) * 1.3,
          });
        }
        const coords = parseGeoJSONToCoords(farm.boundary_geojson);
        setFarmBoundaryCoords(coords);
      } else if (farm.latitude && farm.longitude) {
        setMapRegion({
          latitude: farm.latitude,
          longitude: farm.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }

      // Check tile cache
      const meta = await tileCacheRepo.getByFarmId(farmId);
      if (meta?.status === 'complete') {
        setTileUrlTemplate(tileCacheService.getTileUrlTemplate(farmId));
      }

      // Load polygons
      const allPolygons: ParsedPolygon[] = [];

      const plots = await plotRepo.getByFarmId(farmId);
      for (const plot of plots) {
        const coords = parseGeoJSONToCoords(plot.boundary_geojson);
        if (coords) {
          allPolygons.push({
            id: plot.id,
            name: plot.name,
            type: 'plot',
            locationType: 'PLOT',
            coordinates: coords,
            color: getCropColor(plot.current_crop),
            areaHa: plot.boundary_area_ha,
          });
        }
      }

      const locations = await locRepo.getByFarmId(farmId);
      for (const loc of locations) {
        const coords = parseGeoJSONToCoords(loc.boundary_geojson);
        if (coords) {
          allPolygons.push({
            id: loc.id,
            name: loc.name,
            type: loc.type === 'PASTURE' ? 'pasture' : 'facility',
            locationType: loc.type === 'PASTURE' ? 'PASTURE' : 'FACILITY',
            coordinates: coords,
            color: loc.type === 'PASTURE' ? PASTURE_COLOR : FACILITY_COLOR,
            areaHa: loc.boundary_area_ha,
          });
        }
      }

      setPolygons(allPolygons);
    }

    void load();
  }, [db, farmId, tileCacheService]);

  const handlePolygonPress = useCallback((polygon: ParsedPolygon) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPolygon(polygon);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedPolygon) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect({
      id: selectedPolygon.id,
      name: selectedPolygon.name,
      type: selectedPolygon.locationType,
    });
  }, [selectedPolygon, onSelect]);

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        mapType="standard"
        accessibilityLabel="Mapa para selecionar talhão ou pasto"
      >
        {tileUrlTemplate && (
          <UrlTile
            urlTemplate={tileUrlTemplate}
            maximumZ={16}
            minimumZ={10}
            offlineMode={!isConnected}
            tileSize={256}
            zIndex={1}
          />
        )}

        {farmBoundaryCoords && (
          <Polygon
            coordinates={farmBoundaryCoords}
            strokeColor={FARM_BOUNDARY_COLOR}
            fillColor={`${FARM_BOUNDARY_COLOR}1A`}
            strokeWidth={3}
            zIndex={2}
          />
        )}

        {polygons.map((poly) => (
          <Polygon
            key={poly.id}
            coordinates={poly.coordinates}
            strokeColor={selectedPolygon?.id === poly.id ? colors.primary[700] : poly.color}
            fillColor={
              selectedPolygon?.id === poly.id ? `${colors.primary[500]}66` : `${poly.color}4D`
            }
            strokeWidth={selectedPolygon?.id === poly.id ? 3 : 2}
            tappable
            onPress={() => handlePolygonPress(poly)}
            zIndex={selectedPolygon?.id === poly.id ? 4 : 3}
          />
        ))}
      </MapView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle} accessibilityRole="header">
            Selecionar no mapa
          </Text>
          <Text style={styles.topBarHint}>Toque em um talhão ou pasto</Text>
        </View>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          accessible
          accessibilityLabel="Fechar seleção no mapa"
          accessibilityRole="button"
        >
          <X size={24} color={colors.neutral[500]} />
        </Pressable>
      </View>

      {/* Selection card */}
      {selectedPolygon ? (
        <View style={styles.selectionCard}>
          <View style={styles.selectionRow}>
            <View style={[styles.selectionDot, { backgroundColor: selectedPolygon.color }]} />
            <View style={styles.selectionContent}>
              <Text style={styles.selectionName}>{selectedPolygon.name}</Text>
              <Text style={styles.selectionType}>{getTypeLabel(selectedPolygon.type)}</Text>
              {selectedPolygon.areaHa != null && (
                <Text style={styles.selectionArea}>{formatArea(selectedPolygon.areaHa)}</Text>
              )}
            </View>
            <MapPin size={20} color={colors.primary[500]} aria-hidden />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleConfirm}
            accessible
            accessibilityLabel={`Confirmar seleção: ${selectedPolygon.name}`}
            accessibilityRole="button"
          >
            <Check size={20} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.confirmButtonText}>Confirmar</Text>
          </Pressable>
        </View>
      ) : polygons.length === 0 ? (
        <View style={styles.emptyHint}>
          <MapPin size={32} color={colors.neutral[300]} aria-hidden />
          <Text style={styles.emptyHintText}>
            Nenhum talhão ou pasto com área definida. Sincronize os dados da fazenda.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
