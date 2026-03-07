import { useEffect, useState } from 'react';
import { View, Animated, type ViewStyle, AccessibilityInfo } from 'react-native';
import { radius } from '@protos-farm/shared';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

const createStyles = (c: ThemeColors) => ({
  skeleton: { backgroundColor: c.neutral[200] },
  card: { backgroundColor: c.neutral[0], borderRadius: radius.lg, padding: 16, marginBottom: 12 },
});

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius: br = radius.md,
  style,
}: SkeletonProps) {
  const [opacity] = useState(() => new Animated.Value(0.4));
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (enabled) {
        opacity.setValue(0.6);
        return;
      }
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.7, duration: 750, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    });
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="none"
      accessibilityLabel="Carregando"
      style={[styles.skeleton, { width, height, borderRadius: br, opacity }, style]}
    />
  );
}

export function SkeletonCard() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
      <Skeleton width="30%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}
