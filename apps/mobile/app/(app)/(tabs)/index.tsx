import { useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@protos-farm/shared';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { AlertsSection } from '@/components/dashboard/AlertsSection';
import { RecentActivityList } from '@/components/dashboard/RecentActivityList';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  scrollContent: { gap: spacing[4], paddingBottom: spacing[6] },
});

export default function HomeScreen() {
  const { user } = useAuth();
  const { selectedFarm } = useFarmContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, isLoading, refresh } = useDashboard();

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        <DashboardHeader
          userName={user?.email ?? ''}
          farmName={selectedFarm?.name ?? 'Sem fazenda'}
        />
        <SummaryCards
          totalFarms={data?.summary.totalFarms ?? 0}
          totalPlots={data?.summary.totalPlots ?? 0}
          totalAreaHa={data?.summary.totalAreaHa ?? 0}
          activeUsers={data?.summary.activeUsers ?? 0}
          isLoading={isLoading}
        />
        <AlertsSection alerts={data?.alerts ?? null} isLoading={isLoading} />
        <RecentActivityList activities={data?.recentActivity ?? []} isLoading={isLoading} />
      </ScrollView>
    </SafeAreaView>
  );
}
