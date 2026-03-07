import { View, Text } from 'react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';

interface DashboardHeaderProps {
  userName: string;
  farmName: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const createStyles = (c: ThemeColors) => ({
  container: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2] },
  greeting: { fontFamily: 'DMSans_700Bold', fontSize: fontSize.xl, color: c.neutral[800] },
  farmName: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.primary[600],
    marginTop: spacing[1],
  },
  date: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: spacing[1],
  },
});

export function DashboardHeader({ userName, farmName }: DashboardHeaderProps) {
  const styles = useThemedStyles(createStyles);
  const firstName = userName.split('@')[0];

  return (
    <View style={styles.container}>
      <Text style={styles.greeting} accessibilityRole="header">
        {getGreeting()}, {firstName}!
      </Text>
      <Text style={styles.farmName} numberOfLines={1}>
        {farmName}
      </Text>
      <Text style={styles.date}>{formatDate()}</Text>
    </View>
  );
}
