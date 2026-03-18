import { View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    paddingVertical: spacing[1],
  },
  text: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },
});

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

interface LastSyncIndicatorProps {
  /** ISO timestamp of the last sync. If null, displays "Nunca sincronizado". */
  lastSyncedAt: string | null;
}

/**
 * Small component showing "Última sync: X min atrás" below data headers.
 * Displays an informational timestamp of the most recent data synchronization.
 */
export function LastSyncIndicator({ lastSyncedAt }: LastSyncIndicatorProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const label = lastSyncedAt
    ? `Última sync: ${formatRelativeTime(lastSyncedAt)}`
    : 'Nunca sincronizado';

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={label}>
      <Clock size={12} color={colors.neutral[400]} aria-hidden />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}
