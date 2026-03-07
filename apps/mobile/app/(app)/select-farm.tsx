import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Tractor } from 'lucide-react-native';
import { colors, spacing, fontSize } from '@protos-farm/shared';
import { useFarmContext } from '@/stores/FarmContext';
import { FarmCard } from '@/components/farm/FarmCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { FarmListItem } from '@/types/auth';

export default function SelectFarmScreen() {
  const { farms, isLoadingFarms, selectFarm, refreshFarms } = useFarmContext();
  const router = useRouter();

  // Auto-select if single farm
  useEffect(() => {
    if (!isLoadingFarms && farms.length === 1) {
      selectFarm(farms[0].id);
      router.replace('/(app)/(tabs)');
    }
  }, [isLoadingFarms, farms, selectFarm, router]);

  const handleSelectFarm = useCallback(
    (farm: FarmListItem) => {
      selectFarm(farm.id);
      router.replace('/(app)/(tabs)');
    },
    [selectFarm, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: FarmListItem }) => <FarmCard farm={item} onPress={handleSelectFarm} />,
    [handleSelectFarm],
  );

  const keyExtractor = useCallback((item: FarmListItem) => item.id, []);

  if (isLoadingFarms) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title} accessibilityRole="header">
            Selecione uma fazenda
          </Text>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (farms.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Tractor size={64} color={colors.neutral[300]} aria-hidden />
          <Text style={styles.emptyTitle}>Nenhuma fazenda encontrada</Text>
          <Text style={styles.emptyDescription}>
            Você ainda não tem acesso a nenhuma fazenda. Entre em contato com o administrador.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Selecione uma fazenda
        </Text>
        <FlatList
          data={farms}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingFarms}
              onRefresh={() => void refreshFarms()}
              tintColor={colors.primary[600]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: colors.neutral[800],
    marginBottom: spacing[6],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: colors.neutral[700],
    marginTop: spacing[4],
  },
  emptyDescription: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: fontSize.base * 1.5,
  },
});
