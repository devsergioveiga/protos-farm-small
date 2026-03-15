import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { useSyncContext } from '@/stores/SyncContext';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
    backgroundColor: c.neutral[100],
    minHeight: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: c.sync.synced,
  },
  dotOffline: {
    backgroundColor: c.neutral[400],
  },
  dotSyncing: {
    backgroundColor: c.info[500],
  },
  label: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[600],
  },
  pendingBadge: {
    backgroundColor: c.warning[500],
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    marginLeft: spacing[1],
  },
  pendingBadgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 10,
    color: c.neutral[0],
  },
  tooltip: {
    position: 'absolute' as const,
    top: 32,
    right: 0,
    backgroundColor: c.neutral[800],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 8,
    zIndex: 100,
    minWidth: 160,
  },
  tooltipText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[0],
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

/**
 * Persistent connection status indicator shown on every screen.
 * - Online: green dot + "Online"
 * - Offline: gray dot + "Offline"
 * - Syncing: blue pulsing dot + "Sincronizando..."
 * Shows pending count badge and last sync time on long press.
 */
export function ConnectionStatusBadge() {
  const { isConnected } = useConnectivity();
  const { isSyncing, pendingCount, lastSyncedAt } = useSyncContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [showTooltip, setShowTooltip] = useState(false);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  // Pulse animation for syncing state
  useEffect(() => {
    if (!isSyncing) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isSyncing, pulseAnim]);

  const handleLongPress = useCallback(() => {
    setShowTooltip((prev) => !prev);
  }, []);

  // Auto-hide tooltip after 3 seconds
  useEffect(() => {
    if (!showTooltip) return;
    const timeout = setTimeout(() => setShowTooltip(false), 3000);
    return () => clearTimeout(timeout);
  }, [showTooltip]);

  let dotStyle = styles.dotOnline;
  let label = 'Online';
  let IconComponent = Wifi;
  let iconColor = colors.sync.synced;

  if (isSyncing) {
    dotStyle = styles.dotSyncing;
    label = 'Sincronizando...';
    IconComponent = RefreshCw;
    iconColor = colors.info[500];
  } else if (!isConnected) {
    dotStyle = styles.dotOffline;
    label = 'Offline';
    IconComponent = WifiOff;
    iconColor = colors.neutral[400];
  }

  const accessibilityLabel =
    pendingCount > 0 ? `${label}. ${pendingCount} alterações pendentes` : label;

  return (
    <View>
      <Pressable
        onLongPress={handleLongPress}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        style={styles.container}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isSyncing ? (
          <Animated.View style={[styles.dot, dotStyle, { opacity: pulseAnim }]} />
        ) : (
          <View style={[styles.dot, dotStyle]} />
        )}
        <IconComponent size={12} color={iconColor} aria-hidden />
        <Text style={styles.label}>{label}</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge} accessibilityLabel={`${pendingCount} pendentes`}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </Pressable>
      {showTooltip && lastSyncedAt && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>Última sync: {formatRelativeTime(lastSyncedAt)}</Text>
        </View>
      )}
    </View>
  );
}
