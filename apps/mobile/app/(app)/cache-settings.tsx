import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Trash2, Database, HardDrive, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { createReferenceDataRepository } from '@/services/db';
import { createFarmRepository } from '@/services/db';
import type { ThemeColors } from '@/stores/ThemeContext';

interface FarmCacheInfo {
  farmId: string;
  farmName: string;
  totalBytes: number;
  entities: Array<{ entity_type: string; synced_at: string; size_bytes: number }>;
}

const ENTITY_LABELS: Record<string, string> = {
  bulls: 'Touros',
  semen_batches: 'Lotes de sêmen',
  iatf_protocols: 'Protocolos IATF',
  mating_plans: 'Planos de monta',
  diseases: 'Doenças',
  treatment_protocols: 'Protocolos de tratamento',
  exam_types: 'Tipos de exame',
  feed_ingredients: 'Ingredientes de ração',
  diets: 'Dietas',
  products: 'Produtos',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const, paddingHorizontal: spacing[4] },
  totalCard: {
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: c.neutral[200],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
  },
  totalLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  totalValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: c.neutral[800],
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[800],
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  farmCard: {
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: c.neutral[200],
  },
  farmHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing[3],
  },
  farmName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[800],
    flex: 1,
  },
  farmSize: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  entityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  entityName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    flex: 1,
  },
  entityMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  entitySize: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },
  entitySync: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },
  clearButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    marginTop: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.error[500],
    minHeight: 48,
  },
  clearButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.error[500],
  },
  clearAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    marginTop: spacing[4],
    marginBottom: spacing[8],
    paddingVertical: spacing[3],
    borderRadius: 8,
    backgroundColor: c.error[500],
    minHeight: 48,
  },
  clearAllButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[0],
  },
  emptyText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[400],
    textAlign: 'center' as const,
    marginTop: spacing[8],
  },
});

export default function CacheSettingsScreen() {
  const db = useSQLiteContext();
  const { farms } = useFarmContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [farmCaches, setFarmCaches] = useState<FarmCacheInfo[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadCacheInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const refRepo = createReferenceDataRepository(db);
      await refRepo.init();
      const farmRepo = createFarmRepository(db);

      const sizeByFarm = await refRepo.getCacheSizeByFarm();
      const total = await refRepo.getCacheSize();
      setTotalSize(total);

      const cacheInfoList: FarmCacheInfo[] = [];
      for (const entry of sizeByFarm) {
        const farm = farms.find((f) => f.id === entry.farm_id);
        let farmName = farm?.name ?? 'Fazenda desconhecida';
        if (!farm) {
          const localFarm = await farmRepo.getById(entry.farm_id);
          if (localFarm) farmName = localFarm.name;
        }
        const entities = await refRepo.getFarmCacheDetails(entry.farm_id);
        cacheInfoList.push({
          farmId: entry.farm_id,
          farmName,
          totalBytes: entry.total_bytes,
          entities,
        });
      }

      setFarmCaches(cacheInfoList);
    } catch {
      // Silently handle errors
    } finally {
      setIsLoading(false);
    }
  }, [db, farms]);

  useEffect(() => {
    void loadCacheInfo();
  }, [loadCacheInfo]);

  const handleClearFarm = useCallback(
    (farmId: string, farmName: string) => {
      Alert.alert(
        'Limpar cache',
        `Tem certeza que deseja limpar o cache da fazenda "${farmName}"? Os dados serão baixados novamente na próxima sincronização.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Limpar',
            style: 'destructive',
            onPress: async () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              const refRepo = createReferenceDataRepository(db);
              await refRepo.init();
              await refRepo.clearFarmCache(farmId);
              await loadCacheInfo();
            },
          },
        ],
      );
    },
    [db, loadCacheInfo],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Limpar todo o cache',
      'Tem certeza que deseja limpar o cache de referência de todas as fazendas? Os dados serão baixados novamente na próxima sincronização.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar tudo',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const refRepo = createReferenceDataRepository(db);
            await refRepo.init();
            await refRepo.clearAll();
            await loadCacheInfo();
          },
        },
      ],
    );
  }, [db, loadCacheInfo]);

  const renderFarmCard = useCallback(
    ({ item }: { item: FarmCacheInfo }) => (
      <View style={styles.farmCard}>
        <View style={styles.farmHeader}>
          <Text style={styles.farmName} numberOfLines={1}>
            {item.farmName}
          </Text>
          <Text style={styles.farmSize}>{formatBytes(item.totalBytes)}</Text>
        </View>
        {item.entities.map((entity) => (
          <View key={entity.entity_type} style={styles.entityRow}>
            <Text style={styles.entityName}>
              {ENTITY_LABELS[entity.entity_type] ?? entity.entity_type}
            </Text>
            <View style={styles.entityMeta}>
              <Text style={styles.entitySize}>{formatBytes(entity.size_bytes)}</Text>
              <Clock size={10} color={colors.neutral[400]} aria-hidden />
              <Text style={styles.entitySync}>{formatRelativeTime(entity.synced_at)}</Text>
            </View>
          </View>
        ))}
        <Pressable
          style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
          onPress={() => handleClearFarm(item.farmId, item.farmName)}
          accessibilityRole="button"
          accessibilityLabel={`Limpar cache da fazenda ${item.farmName}`}
        >
          <Trash2 size={16} color={colors.error[500]} aria-hidden />
          <Text style={styles.clearButtonText}>Limpar cache</Text>
        </Pressable>
      </View>
    ),
    [styles, colors, handleClearFarm],
  );

  const keyExtractor = useCallback((item: FarmCacheInfo) => item.farmId, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: true, title: 'Cache de dados' }} />
      <View style={styles.container}>
        <View style={styles.totalCard}>
          <HardDrive size={24} color={colors.primary[500]} aria-hidden />
          <View>
            <Text style={styles.totalLabel}>Armazenamento total do cache</Text>
            <Text style={styles.totalValue}>{formatBytes(totalSize)}</Text>
          </View>
        </View>

        {!isLoading && farmCaches.length === 0 && (
          <View>
            <Database
              size={48}
              color={colors.neutral[300]}
              style={{ alignSelf: 'center', marginTop: spacing[8] }}
              aria-hidden
            />
            <Text style={styles.emptyText}>
              Nenhum dado de referência em cache.{'\n'}Sincronize uma fazenda para começar.
            </Text>
          </View>
        )}

        <FlatList
          data={farmCaches}
          renderItem={renderFarmCard}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            farmCaches.length > 0 ? (
              <Text style={styles.sectionTitle}>Cache por fazenda</Text>
            ) : null
          }
          ListFooterComponent={
            farmCaches.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.clearAllButton, pressed && { opacity: 0.85 }]}
                onPress={handleClearAll}
                accessibilityRole="button"
                accessibilityLabel="Limpar todo o cache de dados"
              >
                <Trash2 size={20} color={colors.neutral[0]} aria-hidden />
                <Text style={styles.clearAllButtonText}>Limpar todo o cache</Text>
              </Pressable>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}
