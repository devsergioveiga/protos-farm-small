import { View, Text, Pressable } from 'react-native';
import { WifiOff, RefreshCw, CloudUpload, AlertTriangle } from 'lucide-react-native';
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
    minHeight: 36,
  },
  offlineBg: { backgroundColor: c.sync.offline },
  syncingBg: { backgroundColor: c.sync.syncing },
  errorBg: { backgroundColor: c.error[500] },
  pendingBg: { backgroundColor: c.sync.syncing },
  text: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[0],
    flex: 1,
  },
  textDark: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[800],
  },
  badge: {
    backgroundColor: c.neutral[0],
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
    color: c.sync.syncing,
  },
  retryButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    minHeight: 28,
    justifyContent: 'center' as const,
  },
  retryText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.neutral[0],
  },
});

export function SyncStatusBanner() {
  const { isConnected } = useConnectivity();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isSyncing, syncError, retrySync, pendingCount, isFlushing, flushProgress, flushNow } =
    useSyncContext();

  // 1. Offline
  if (!isConnected) {
    return (
      <View
        style={[styles.banner, styles.offlineBg]}
        accessibilityRole="alert"
        accessibilityLabel={
          pendingCount > 0
            ? `Sem conexão. ${pendingCount} alterações pendentes`
            : 'Sem conexão com a internet'
        }
      >
        <WifiOff size={16} color={colors.neutral[0]} aria-hidden />
        <Text style={styles.text}>Sem conexão</Text>
        {pendingCount > 0 && (
          <View style={styles.badge} accessibilityLabel={`${pendingCount} pendentes`}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
    );
  }

  // 2. Syncing (downloading data)
  if (isSyncing) {
    return (
      <View
        style={[styles.banner, styles.syncingBg]}
        accessibilityRole="alert"
        accessibilityLabel="Sincronizando dados"
      >
        <RefreshCw size={16} color={colors.neutral[800]} aria-hidden />
        <Text style={styles.textDark}>Sincronizando dados...</Text>
      </View>
    );
  }

  // 3. Flushing (uploading pending ops)
  if (isFlushing) {
    const { processed, total } = flushProgress;
    return (
      <View
        style={[styles.banner, styles.syncingBg]}
        accessibilityRole="alert"
        accessibilityLabel={`Enviando alterações: ${processed} de ${total}`}
      >
        <CloudUpload size={16} color={colors.neutral[800]} aria-hidden />
        <Text style={styles.textDark}>
          Enviando alterações ({processed}/{total})...
        </Text>
      </View>
    );
  }

  // 4. Sync error
  if (syncError) {
    return (
      <View
        style={[styles.banner, styles.errorBg]}
        accessibilityRole="alert"
        accessibilityLabel={`Erro de sincronização: ${syncError}`}
      >
        <AlertTriangle size={16} color={colors.neutral[0]} aria-hidden />
        <Text style={styles.text} numberOfLines={1}>
          {syncError}
        </Text>
        <Pressable
          style={styles.retryButton}
          onPress={retrySync}
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Text style={styles.retryText}>Tentar</Text>
        </Pressable>
      </View>
    );
  }

  // 5. Pending operations waiting to sync
  if (pendingCount > 0) {
    return (
      <Pressable
        style={[styles.banner, styles.pendingBg]}
        onPress={() => void flushNow()}
        accessibilityRole="button"
        accessibilityLabel={`${pendingCount} alterações pendentes. Toque para sincronizar`}
        accessibilityHint="Envia alterações para o servidor"
      >
        <CloudUpload size={16} color={colors.neutral[800]} aria-hidden />
        <Text style={styles.textDark}>
          {pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      </Pressable>
    );
  }

  // 6. All synced — hide banner
  return null;
}
