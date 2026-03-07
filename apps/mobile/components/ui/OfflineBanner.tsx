import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useConnectivity } from '@/stores/ConnectivityContext';
import type { ThemeColors } from '@/stores/ThemeContext';

const createStyles = (c: ThemeColors) => ({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.sync.offline,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  text: { fontFamily: 'SourceSans3_600SemiBold', fontSize: fontSize.sm, color: c.neutral[0] },
});

export function OfflineBanner() {
  const { isConnected } = useConnectivity();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (isConnected) return null;
  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel="Sem conexão com a internet"
    >
      <WifiOff size={16} color={colors.neutral[0]} aria-hidden />
      <Text style={styles.text}>Sem conexão</Text>
    </View>
  );
}
