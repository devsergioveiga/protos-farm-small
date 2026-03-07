import { View, Text } from 'react-native';
import { Tractor, Grid3x3, Ruler, Users } from 'lucide-react-native';
import { spacing, fontSize, radius } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { LucideIcon } from 'lucide-react-native';

interface SummaryCardsProps {
  totalFarms: number;
  totalPlots: number;
  totalAreaHa: number;
  activeUsers: number;
  isLoading: boolean;
}

interface CardData {
  label: string;
  value: string;
  icon: LucideIcon;
}

const createStyles = (c: ThemeColors) => ({
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: c.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[4],
    flex: 1 as const,
    minWidth: '45%' as unknown as number,
    borderWidth: 1,
    borderColor: c.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  cardLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    textTransform: 'uppercase' as const,
  },
  cardValue: { fontFamily: 'DMSans_700Bold', fontSize: fontSize.xl, color: c.neutral[800] },
});

export function SummaryCards({
  totalFarms,
  totalPlots,
  totalAreaHa,
  activeUsers,
  isLoading,
}: SummaryCardsProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="60%" height={24} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }

  const cards: CardData[] = [
    { label: 'FAZENDAS', value: String(totalFarms), icon: Tractor },
    { label: 'TALHÕES', value: String(totalPlots), icon: Grid3x3 },
    { label: 'ÁREA TOTAL', value: `${totalAreaHa.toLocaleString('pt-BR')} ha`, icon: Ruler },
    { label: 'USUÁRIOS', value: String(activeUsers), icon: Users },
  ];

  return (
    <View style={styles.grid} accessibilityRole="summary">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <View key={card.label} style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon size={20} color={colors.primary[500]} aria-hidden />
              <Text style={styles.cardLabel}>{card.label}</Text>
            </View>
            <Text style={styles.cardValue}>{card.value}</Text>
          </View>
        );
      })}
    </View>
  );
}
