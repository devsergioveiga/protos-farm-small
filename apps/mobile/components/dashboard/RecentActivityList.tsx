import { View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { OrgDashboardStats } from '@/types/dashboard';

type ActivityItem = OrgDashboardStats['recentActivity'][number];

interface RecentActivityListProps {
  activities: ActivityItem[];
  isLoading: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'criou',
  UPDATE: 'atualizou',
  DELETE: 'removeu',
  LOGIN: 'fez login',
  LOGOUT: 'fez logout',
};

const TARGET_LABELS: Record<string, string> = {
  ORGANIZATION: 'organização',
  USER: 'usuário',
  FARM: 'fazenda',
  PRODUCER: 'produtor',
  PLOT: 'talhão',
  ROLE: 'papel',
  ANIMAL: 'animal',
  LOT: 'lote',
};

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  return `${diffDays}d atrás`;
}

function truncateEmail(email: string): string {
  const [local] = email.split('@');
  if (local.length <= 10) return local;
  return `${local.slice(0, 10)}...`;
}

const createStyles = (c: ThemeColors) => ({
  container: { paddingHorizontal: spacing[4] },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: c.neutral[800],
    marginBottom: spacing[3],
  },
  activityItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  activityContent: { flex: 1 as const },
  activityText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  activityBold: { fontFamily: 'SourceSans3_600SemiBold' },
  activityTime: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    marginTop: spacing[1],
  },
  emptyContainer: { alignItems: 'center' as const, paddingVertical: spacing[4] },
  emptyText: { fontFamily: 'SourceSans3_400Regular', fontSize: fontSize.sm, color: c.neutral[500] },
  bottomSpacer: { height: spacing[8] },
});

export function RecentActivityList({ activities, isLoading }: RecentActivityListProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton width="40%" height={20} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginTop: 12 }}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="30%" height={12} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    );
  }

  const items = activities.slice(0, 5);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Atividade recente
      </Text>
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhuma atividade recente</Text>
        </View>
      ) : (
        items.map((activity) => {
          const actionLabel = ACTION_LABELS[activity.action] ?? activity.action.toLowerCase();
          const targetLabel =
            TARGET_LABELS[activity.targetType] ?? activity.targetType.toLowerCase();
          return (
            <View key={activity.id} style={styles.activityItem}>
              <Clock size={16} color={colors.neutral[400]} aria-hidden />
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityBold}>{truncateEmail(activity.actorEmail)}</Text>{' '}
                  {actionLabel} {targetLabel}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(activity.createdAt)}</Text>
              </View>
            </View>
          );
        })
      )}
      <View style={styles.bottomSpacer} />
    </View>
  );
}
