import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useConnectivity } from '@/stores/ConnectivityContext';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 50,
    paddingHorizontal: spacing[6],
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.neutral[100],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[4],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[800],
    textAlign: 'center' as const,
    marginBottom: spacing[2],
  },
  description: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
    marginBottom: spacing[3],
  },
  syncInfo: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[400],
    textAlign: 'center' as const,
  },
});

function formatTimestamp(isoDate: string | null): string {
  if (!isoDate) return 'Nunca sincronizado';
  const date = new Date(isoDate);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface OnlineRequiredOverlayProps {
  /** Optional last sync timestamp to show context. */
  lastSyncedAt?: string | null;
  /** Optional custom message. Defaults to generic connectivity required message. */
  message?: string;
}

/**
 * Overlay shown on screens that require online access.
 * Renders a semi-transparent overlay with a wifi icon and informational message.
 * Only renders when the device is offline; returns null when connected.
 */
export function OnlineRequiredOverlay({
  lastSyncedAt = null,
  message,
}: OnlineRequiredOverlayProps) {
  const { isConnected } = useConnectivity();
  const styles = useThemedStyles(createStyles);

  if (isConnected) return null;

  return (
    <View style={styles.overlay} accessibilityRole="alert">
      <View style={styles.iconContainer}>
        <WifiOff size={32} color="#78909C" aria-hidden />
      </View>
      <Text style={styles.title}>Conexão necessária</Text>
      <Text style={styles.description}>
        {message ?? 'Esta funcionalidade requer conexão com a internet'}
      </Text>
      <Text style={styles.syncInfo}>Última sync: {formatTimestamp(lastSyncedAt)}</Text>
    </View>
  );
}
