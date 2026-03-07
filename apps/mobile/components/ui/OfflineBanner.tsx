import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors, spacing, fontSize } from '@protos-farm/shared';
import { useConnectivity } from '@/stores/ConnectivityContext';

export function OfflineBanner() {
  const { isConnected } = useConnectivity();

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

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.sync.offline,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  text: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: colors.neutral[0],
  },
});
