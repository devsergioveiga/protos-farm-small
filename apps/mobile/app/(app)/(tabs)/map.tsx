import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { UrlTile } from 'react-native-maps';
import { useSQLiteContext } from 'expo-sqlite';
import { Download, Trash2, Map as MapIcon, WifiOff, CheckCircle } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { createFarmRepository } from '@/services/db';
import {
  createTileCacheService,
  computeBBoxFromGeoJSON,
  computeBBoxFromCenter,
  estimateTileCount,
  estimateSizeMB,
} from '@/services/tile-cache';
import type { BoundingBox, TileDownloadProgress } from '@/services/tile-cache';
import type { TileCacheMeta } from '@/types/offline';
import type { ThemeColors } from '@/stores/ThemeContext';

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
  deleteButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.error[500],
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
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const db = useSQLiteContext();
  const { selectedFarm, selectedFarmId } = useFarmContext();
  const { isConnected } = useConnectivity();

  const mapRef = useRef<React.ComponentRef<typeof MapView>>(null);
  const tileCacheService = useRef(createTileCacheService(db)).current;
  const farmRepo = useRef(createFarmRepository(db)).current;

  const [cacheMeta, setCacheMeta] = useState<TileCacheMeta | null>(null);
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TileDownloadProgress | null>(null);
  const [estimatedTiles, setEstimatedTiles] = useState(0);

  // Load cache metadata and compute bounding box
  const loadCacheState = useCallback(async () => {
    if (!selectedFarmId) return;

    const meta = await tileCacheService.getCacheMeta(selectedFarmId);
    setCacheMeta(meta);

    // Compute bounding box from farm data
    const farm = await farmRepo.getById(selectedFarmId);
    if (!farm) return;

    let computedBbox: BoundingBox | null = null;

    if (farm.boundary_geojson) {
      computedBbox = computeBBoxFromGeoJSON(farm.boundary_geojson);
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
  }, [selectedFarmId, tileCacheService, farmRepo]);

  useEffect(() => {
    void loadCacheState();
  }, [loadCacheState]);

  const handleDownload = useCallback(async () => {
    if (!selectedFarmId || !bbox || isDownloading) return;

    const sizeMB = estimateSizeMB(estimatedTiles);
    Alert.alert(
      'Baixar mapa offline',
      `Serão baixados ~${estimatedTiles} tiles (~${sizeMB} MB). Isso pode levar alguns minutos.`,
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
      </MapView>

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
