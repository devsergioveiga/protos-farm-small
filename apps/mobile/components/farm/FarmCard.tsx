import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin, Ruler } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, radius } from '@protos-farm/shared';
import type { FarmListItem } from '@/types/auth';

interface FarmCardProps {
  farm: FarmListItem;
  onPress: (farm: FarmListItem) => void;
}

function FarmCardComponent({ farm, onPress }: FarmCardProps) {
  const location = [farm.city, farm.state].filter(Boolean).join('/');

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(farm);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Selecionar fazenda ${farm.name}`}
      accessibilityHint="Seleciona esta fazenda como ativa"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.name} numberOfLines={1}>
        {farm.name}
      </Text>
      {location ? (
        <View style={styles.row}>
          <MapPin size={14} color={colors.neutral[500]} aria-hidden />
          <Text style={styles.detail}>{location}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Ruler size={14} color={colors.neutral[500]} aria-hidden />
        <Text style={styles.detail}>{farm.totalAreaHa.toLocaleString('pt-BR')} ha</Text>
      </View>
    </Pressable>
  );
}

export const FarmCard = React.memo(FarmCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  name: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  detail: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[500],
  },
});
