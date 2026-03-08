import { useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeftRight, Settings, Info, LogOut, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import { useSyncContext } from '@/stores/SyncContext';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { LucideIcon } from 'lucide-react-native';

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onPress: () => void;
}

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const, paddingTop: spacing[6] },
  headerCard: {
    backgroundColor: c.neutral[0],
    marginHorizontal: spacing[4],
    borderRadius: 12,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: c.neutral[200],
  },
  farmName: { fontFamily: 'DMSans_700Bold', fontSize: fontSize.md, color: c.neutral[800] },
  email: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: spacing[1],
  },
  menuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    marginHorizontal: spacing[4],
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  menuItemPressed: { opacity: 0.7, backgroundColor: c.neutral[100] },
  menuLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  menuLabelDestructive: { color: c.error[500] as string },
  version: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    textAlign: 'center' as const,
    paddingVertical: spacing[4],
  },
});

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { selectedFarm } = useFarmContext();
  const { lastSyncedAt, retrySync, isSyncing } = useSyncContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const syncLabel = isSyncing
    ? 'Sincronizando...'
    : lastSyncedAt
      ? `Sincronizar (última: ${formatRelativeTime(lastSyncedAt)})`
      : 'Sincronizar dados';

  const menuItems: MenuItem[] = [
    {
      id: 'sync',
      label: syncLabel,
      icon: RefreshCw,
      onPress: retrySync,
    },
    {
      id: 'switch-farm',
      label: 'Trocar Fazenda',
      icon: ArrowLeftRight,
      onPress: () => router.push('/(app)/select-farm'),
    },
    { id: 'settings', label: 'Configurações', icon: Settings, onPress: () => {} },
    { id: 'about', label: 'Sobre', icon: Info, onPress: () => {} },
    { id: 'logout', label: 'Sair', icon: LogOut, destructive: true, onPress: () => void logout() },
  ];

  const handlePress = useCallback((item: MenuItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onPress();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MenuItem }) => {
      const Icon = item.icon;
      const iconColor = item.destructive ? colors.error[500] : colors.neutral[500];
      return (
        <Pressable
          onPress={() => handlePress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
          <Icon size={20} color={iconColor} aria-hidden />
          <Text style={[styles.menuLabel, item.destructive && styles.menuLabelDestructive]}>
            {item.label}
          </Text>
        </Pressable>
      );
    },
    [colors, styles, handlePress],
  );

  const keyExtractor = useCallback((item: MenuItem) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.farmName} numberOfLines={1}>
            {selectedFarm?.name ?? 'Nenhuma fazenda selecionada'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <FlatList
          data={menuItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          scrollEnabled={false}
          ListFooterComponent={<Text style={styles.version}>Protos Farm v1.0.0</Text>}
        />
      </View>
    </SafeAreaView>
  );
}
