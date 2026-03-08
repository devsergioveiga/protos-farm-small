import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon, UrlTile } from 'react-native-maps';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Download,
  Trash2,
  Map as MapIcon,
  WifiOff,
  CheckCircle,
  MapPin,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import {
  createFarmRepository,
  createFieldPlotRepository,
  createFarmLocationRepository,
} from '@/services/db';
import {
  createTileCacheService,
  computeBBoxFromGeoJSON,
  computeBBoxFromCenter,
  estimateTileCount,
  estimateSizeMB,
} from '@/services/tile-cache';
import type { BoundingBox, TileDownloadProgress } from '@/services/tile-cache';
import { getMapCacheLimitMB } from '@/services/map-settings';
import type { TileCacheMeta } from '@/types/offline';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { LatLng } from 'react-native-maps';

// ─── Color maps (matching frontend FarmMap) ─────────────────────────────────

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

// ─── GeoJSON helpers ────────────────────────────────────────────────────────

interface ParsedPolygon {
  id: string;
  name: string;
  type: 'farm' | 'plot' | 'pasture' | 'facility';
  coordinates: LatLng[];
  color: string;
  areaHa: number | null;
  extra?: string | null;
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

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;
    const intersect =
      yi > point.longitude !== yj > point.longitude &&
      point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const DEFAULT_REGION = {
  latitude: -15.7801,
  longitude: -47.9292,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const createStyles = (c: ThemeColors) => ({
  container: { flex: 1 as const, backgroundColor: c.neutral[50] },
  map: { flex: 1 as const },
  overlay: {
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
  overlayTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[800],
    marginBottom: spacing[2],
  },
  overlayText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginBottom: spacing[3],
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: spacing[2],
  },
  downloadButton: {
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 48,
    gap: spacing[2],
  },
  downloadButtonDisabled: {
    backgroundColor: c.neutral[300],
  },
  deleteButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.error[100],
    borderRadius: 8,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 48,
  },
  buttonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[0],
  },
  progressBar: {
    height: 4,
    backgroundColor: c.neutral[200],
    borderRadius: 2,
    marginBottom: spacing[2],
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 4,
    backgroundColor: c.primary[500],
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    marginBottom: spacing[2],
    flexWrap: 'wrap' as const,
  },
  statusText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  cachedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    backgroundColor: c.success[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
  },
  cachedText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.success[500],
  },
  emptyContainer: {
    flex: 1 as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
    marginTop: spacing[4],
    textAlign: 'center' as const,
  },
  emptyDescription: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
    marginTop: spacing[2],
    lineHeight: fontSize.base * 1.5,
  },
  // Location info card
  locationCard: {
    position: 'absolute' as const,
    top: Platform.OS === 'ios' ? spacing[3] : spacing[4],
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
  },
  locationCardContent: {
    flex: 1 as const,
  },
  locationCardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.sm,
    color: c.neutral[800],
  },
  locationCardSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    marginTop: 2,
  },
  locationCardArea: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.xs,
    color: c.neutral[600],
    marginTop: 2,
  },
  locationCardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  closeButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatArea(ha: number | null): string {
  if (ha == null) return '';
  return `${Number(ha).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;
}

function getLocationTypeLabel(type: string, extra?: string | null): string {
  if (type === 'plot') return extra ? `Talhão — ${extra}` : 'Talhão';
  if (type === 'pasture') return 'Pasto';
  if (type === 'facility') return 'Instalação';
  return 'Perímetro da fazenda';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { selectedFarm, selectedFarmId } = useFarmContext();
  const { isConnected } = useConnectivity();

  const mapRef = useRef<React.ComponentRef<typeof MapView>>(null);
  const tileCacheService = useRef(createTileCacheService(db)).current;
  const farmRepo = useRef(createFarmRepository(db)).current;
  const plotRepo = useRef(createFieldPlotRepository(db)).current;
  const locationRepo = useRef(createFarmLocationRepository(db)).current;

  const [cacheMeta, setCacheMeta] = useState<TileCacheMeta | null>(null);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TileDownloadProgress | null>(null);
  const [estimatedTiles, setEstimatedTiles] = useState(0);

  // Polygon data
  const [farmBoundaryCoords, setFarmBoundaryCoords] = useState<LatLng[] | null>(null);
  const [polygons, setPolygons] = useState<ParsedPolygon[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<ParsedPolygon | null>(null);

  // GPS-based current location identification (CA4)
  const [currentLocation, setCurrentLocation] = useState<ParsedPolygon | null>(null);
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);

  // Load cache metadata, compute bounding box, and load polygons
  const loadCacheState = useCallback(async () => {
    if (!selectedFarmId) return;

    const meta = await tileCacheService.getCacheMeta(selectedFarmId);
    setCacheMeta(meta);

    const farm = await farmRepo.getById(selectedFarmId);
    if (!farm) return;

    let computedBbox: BoundingBox | null = null;

    // Farm boundary
    if (farm.boundary_geojson) {
      computedBbox = computeBBoxFromGeoJSON(farm.boundary_geojson);
      const coords = parseGeoJSONToCoords(farm.boundary_geojson);
      setFarmBoundaryCoords(coords);
    }

    if (!computedBbox && farm.latitude && farm.longitude) {
      computedBbox = computeBBoxFromCenter(
        farm.latitude,
        farm.longitude,
        farm.total_area_ha ?? 100,
      );
    }

    if (computedBbox) {
      setBbox(computedBbox);
      setEstimatedTiles(estimateTileCount(computedBbox));
    }

    // Load plots and locations for polygon rendering (CA2)
    const allPolygons: ParsedPolygon[] = [];

    const plots = await plotRepo.getByFarmId(selectedFarmId);
    for (const plot of plots) {
      const coords = parseGeoJSONToCoords(plot.boundary_geojson);
      if (coords) {
        allPolygons.push({
          id: plot.id,
          name: plot.name,
          type: 'plot',
          coordinates: coords,
          color: getCropColor(plot.current_crop),
          areaHa: plot.boundary_area_ha,
          extra: plot.current_crop,
        });
      }
    }

    const locations = await locationRepo.getByFarmId(selectedFarmId);
    for (const loc of locations) {
      const coords = parseGeoJSONToCoords(loc.boundary_geojson);
      if (coords) {
        allPolygons.push({
          id: loc.id,
          name: loc.name,
          type: loc.type === 'PASTURE' ? 'pasture' : 'facility',
          coordinates: coords,
          color: loc.type === 'PASTURE' ? PASTURE_COLOR : FACILITY_COLOR,
          areaHa: loc.boundary_area_ha,
        });
      }
    }

    setPolygons(allPolygons);
  }, [selectedFarmId, tileCacheService, farmRepo, plotRepo, locationRepo]);

  useEffect(() => {
    void loadCacheState();
  }, [loadCacheState]);

  // Identify current talhão/pasto based on GPS (CA4)
  useEffect(() => {
    if (!userPosition || polygons.length === 0) {
      setCurrentLocation(null);
      return;
    }

    // Check plots first (more specific), then locations
    const plotMatch = polygons.find(
      (p) =>
        (p.type === 'plot' || p.type === 'pasture') && pointInPolygon(userPosition, p.coordinates),
    );
    setCurrentLocation(plotMatch ?? null);
  }, [userPosition, polygons]);

  const handleUserLocationChange = useCallback((event: { nativeEvent: { coordinate: LatLng } }) => {
    setUserPosition(event.nativeEvent.coordinate);
  }, []);

  const handlePolygonPress = useCallback((polygon: ParsedPolygon) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPolygon(polygon);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!selectedFarmId || !bbox || isDownloading) return;

    const sizeMB = estimateSizeMB(estimatedTiles);
    const cacheLimitMB = await getMapCacheLimitMB();
    if (sizeMB > cacheLimitMB) {
      Alert.alert(
        'Limite de cache',
        `O download estimado (~${sizeMB} MB) excede o limite configurado de ${cacheLimitMB} MB. Ajuste o limite em Mais > Configurações.`,
      );
      return;
    }
    Alert.alert(
      'Baixar mapa offline',
      `Serão baixados ~${estimatedTiles} tiles (~${sizeMB} MB). Limite: ${cacheLimitMB} MB.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Baixar',
          onPress: async () => {
            setIsDownloading(true);
            setDownloadProgress({
              total: estimatedTiles,
              downloaded: 0,
              failed: 0,
              cacheSizeBytes: 0,
              status: 'downloading',
            });

            try {
              const result = await tileCacheService.downloadTilesForFarm(
                selectedFarmId,
                bbox,
                (progress) => setDownloadProgress({ ...progress }),
              );

              if (result.status === 'complete') {
                Alert.alert('Sucesso', 'Mapa offline baixado com sucesso!');
              } else {
                Alert.alert(
                  'Atenção',
                  `Download concluído com ${result.failed} tiles com falha. O mapa pode ter áreas em branco.`,
                );
              }
            } catch {
              Alert.alert('Erro', 'Não foi possível baixar o mapa offline.');
            } finally {
              setIsDownloading(false);
              setDownloadProgress(null);
              void loadCacheState();
            }
          },
        },
      ],
    );
  }, [selectedFarmId, bbox, isDownloading, estimatedTiles, tileCacheService, loadCacheState]);

  const handleDelete = useCallback(async () => {
    if (!selectedFarmId) return;

    Alert.alert(
      'Excluir cache do mapa',
      'Tem certeza que deseja excluir os tiles salvos? Você precisará baixar novamente para usar offline.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await tileCacheService.clearFarmCache(selectedFarmId);
            setCacheMeta(null);
          },
        },
      ],
    );
  }, [selectedFarmId, tileCacheService]);

  // Info card content (selected polygon or GPS-identified location)
  const infoCard = selectedPolygon ?? currentLocation;

  // No farm selected
  if (!selectedFarm || !selectedFarmId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <MapIcon size={64} color={colors.neutral[300]} aria-hidden />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Mapa da Fazenda
          </Text>
          <Text style={styles.emptyDescription}>Selecione uma fazenda para visualizar o mapa.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mapRegion = bbox
    ? {
        latitude: (bbox.north + bbox.south) / 2,
        longitude: (bbox.east + bbox.west) / 2,
        latitudeDelta: (bbox.north - bbox.south) * 1.2,
        longitudeDelta: (bbox.east - bbox.west) * 1.2,
      }
    : selectedFarm.latitude && selectedFarm.longitude
      ? {
          latitude: selectedFarm.latitude,
          longitude: selectedFarm.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : DEFAULT_REGION;

  const hasCachedTiles = cacheMeta?.status === 'complete';
  const tileUrlTemplate = hasCachedTiles
    ? tileCacheService.getTileUrlTemplate(selectedFarmId)
    : null;

  const progressPercent = downloadProgress
    ? Math.round((downloadProgress.downloaded / Math.max(downloadProgress.total, 1)) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        mapType="standard"
        accessibilityLabel="Mapa da fazenda"
        onUserLocationChange={handleUserLocationChange}
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

        {/* Farm boundary (CA2) */}
        {farmBoundaryCoords && (
          <Polygon
            coordinates={farmBoundaryCoords}
            strokeColor={FARM_BOUNDARY_COLOR}
            fillColor={`${FARM_BOUNDARY_COLOR}1A`}
            strokeWidth={3}
            zIndex={2}
          />
        )}

        {/* Field plots and farm locations (CA2) */}
        {polygons.map((poly) => (
          <Polygon
            key={poly.id}
            coordinates={poly.coordinates}
            strokeColor={poly.color}
            fillColor={`${poly.color}4D`}
            strokeWidth={2}
            tappable
            onPress={() => handlePolygonPress(poly)}
            zIndex={3}
          />
        ))}
      </MapView>

      {/* GPS-identified location or selected polygon info card (CA4) */}
      {infoCard && (
        <View
          style={styles.locationCard}
          accessibilityLabel={`Você está em: ${infoCard.name}`}
          accessibilityRole="text"
        >
          <View style={[styles.locationCardDot, { backgroundColor: infoCard.color }]} />
          <View style={styles.locationCardContent}>
            <Text style={styles.locationCardTitle}>{infoCard.name}</Text>
            <Text style={styles.locationCardSubtitle}>
              {getLocationTypeLabel(infoCard.type, infoCard.extra)}
            </Text>
            {infoCard.areaHa != null && (
              <Text style={styles.locationCardArea}>{formatArea(infoCard.areaHa)}</Text>
            )}
          </View>
          {infoCard === currentLocation && (
            <MapPin size={20} color={colors.primary[500]} aria-hidden />
          )}
          {selectedPolygon && (
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedPolygon(null)}
              accessible
              accessibilityLabel="Fechar detalhes"
              accessibilityRole="button"
            >
              <X size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          )}
        </View>
      )}

      {/* Download overlay */}
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>{selectedFarm.name}</Text>

        {/* Status row */}
        <View style={styles.statusRow}>
          {hasCachedTiles && (
            <View
              style={styles.cachedBadge}
              accessibilityLabel="Mapa offline disponível"
              accessibilityRole="text"
            >
              <CheckCircle size={14} color={colors.success[500]} aria-hidden />
              <Text style={styles.cachedText}>
                Offline ({formatBytes(cacheMeta.cache_size_bytes)})
              </Text>
            </View>
          )}
          {polygons.length > 0 && (
            <View
              style={[styles.cachedBadge, { backgroundColor: colors.info[100] }]}
              accessibilityLabel={`${polygons.length} áreas no mapa`}
              accessibilityRole="text"
            >
              <Text style={[styles.cachedText, { color: colors.info[500] }]}>
                {polygons.length} áreas
              </Text>
            </View>
          )}
          {!isConnected && (
            <View
              style={[styles.cachedBadge, { backgroundColor: colors.warning[100] }]}
              accessibilityLabel="Sem conexão"
              accessibilityRole="text"
            >
              <WifiOff size={14} color={colors.warning[500]} aria-hidden />
              <Text style={[styles.cachedText, { color: colors.warning[500] }]}>Offline</Text>
            </View>
          )}
        </View>

        {/* Download progress */}
        {isDownloading && downloadProgress && (
          <>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progressPercent}%` as `${number}%` }]}
              />
            </View>
            <Text style={styles.statusText}>
              {downloadProgress.downloaded}/{downloadProgress.total} tiles ({progressPercent}%)
              {downloadProgress.failed > 0 && ` — ${downloadProgress.failed} falhas`}
            </Text>
          </>
        )}

        {/* Info when no cache */}
        {!hasCachedTiles && !isDownloading && bbox && (
          <Text style={styles.overlayText}>
            Baixe o mapa para usar sem internet. ~{estimatedTiles} tiles (~
            {estimateSizeMB(estimatedTiles)} MB)
          </Text>
        )}

        {!hasCachedTiles && !bbox && (
          <Text style={styles.overlayText}>
            Sincronize os dados da fazenda para habilitar o download do mapa offline.
          </Text>
        )}

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          {!hasCachedTiles && (
            <Pressable
              style={({ pressed }) => [
                styles.downloadButton,
                (!bbox || !isConnected || isDownloading) && styles.downloadButtonDisabled,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleDownload}
              disabled={!bbox || !isConnected || isDownloading}
              accessible
              accessibilityLabel="Baixar mapa offline"
              accessibilityRole="button"
              accessibilityState={{ disabled: !bbox || !isConnected || isDownloading }}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color={colors.neutral[0]} />
              ) : (
                <Download size={20} color={colors.neutral[0]} aria-hidden />
              )}
              <Text style={styles.buttonText}>{isDownloading ? 'Baixando...' : 'Baixar mapa'}</Text>
            </Pressable>
          )}

          {hasCachedTiles && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.downloadButton,
                  (!isConnected || isDownloading) && styles.downloadButtonDisabled,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleDownload}
                disabled={!isConnected || isDownloading}
                accessible
                accessibilityLabel="Atualizar mapa offline"
                accessibilityRole="button"
              >
                <Download size={20} color={colors.neutral[0]} aria-hidden />
                <Text style={styles.buttonText}>Atualizar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={handleDelete}
                accessible
                accessibilityLabel="Excluir cache do mapa"
                accessibilityRole="button"
              >
                <Trash2 size={20} color={colors.error[500]} aria-hidden />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
