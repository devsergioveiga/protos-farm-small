import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { LucideIcon } from 'lucide-react-native';

interface PlaceholderScreenProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: {
    flex: 1 as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[8],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
    marginTop: spacing[4],
    textAlign: 'center' as const,
  },
  description: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
    marginTop: spacing[2],
    lineHeight: fontSize.base * 1.5,
  },
});

export function PlaceholderScreen({ icon: Icon, title, description }: PlaceholderScreenProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Icon size={64} color={colors.neutral[300]} aria-hidden />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </SafeAreaView>
  );
}
