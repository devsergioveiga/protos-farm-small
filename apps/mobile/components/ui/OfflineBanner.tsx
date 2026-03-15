import { View, Text } from 'react-native';
import { WifiOff, AlertTriangle } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { useSyncContext } from '@/stores/SyncContext';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  bgDefault: {
    backgroundColor: c.sync.offline,
  },
  bgWarning: {
    backgroundColor: c.warning[500],
  },
  bgCritical: {
    backgroundColor: c.error[500],
  },
  text: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[0],
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.neutral[0],
  },
});

function formatOfflineDuration(hours: number): string {
  if (hours < 1) return '';
  const roundedHours = Math.floor(hours);
  if (roundedHours < 24) {
    return ` (${roundedHours}h sem conexão)`;
  }
  const days = Math.floor(roundedHours / 24);
  const remainingHours = roundedHours % 24;
  if (remainingHours === 0) {
    return ` (${days}d sem conexão)`;
  }
  return ` (${days}d ${remainingHours}h sem conexão)`;
}

/**
 * Enhanced offline banner that shows:
 * - Pending operations count
 * - Duration offline if > 1 hour
 * - Warning color escalation: gray (normal) -> orange (>1h) -> red (>24h)
 */
export function OfflineBanner() {
  const { isConnected, offlineDurationHours, showOfflineAlert } = useConnectivity();
  const { pendingCount } = useSyncContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (isConnected) return null;

  // Determine banner color based on offline duration
  let bgStyle = styles.bgDefault;
  let IconComponent = WifiOff;
  if (showOfflineAlert) {
    bgStyle = styles.bgCritical;
    IconComponent = AlertTriangle;
  } else if (offlineDurationHours >= 1) {
    bgStyle = styles.bgWarning;
  }

  const durationText = formatOfflineDuration(offlineDurationHours);
  const mainText = `Sem conexão${durationText}`;

  const accessibilityLabel =
    pendingCount > 0 ? `${mainText}. ${pendingCount} alterações pendentes` : mainText;

  return (
    <View
      style={[styles.banner, bgStyle]}
      accessibilityRole="alert"
      accessibilityLabel={accessibilityLabel}
    >
      <IconComponent size={16} color={colors.neutral[0]} aria-hidden />
      <Text style={styles.text}>{mainText}</Text>
      {pendingCount > 0 && (
        <View style={styles.pendingBadge} accessibilityLabel={`${pendingCount} pendentes`}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      )}
    </View>
  );
}
