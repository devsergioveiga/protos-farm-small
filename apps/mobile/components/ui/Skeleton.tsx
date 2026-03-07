import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle, AccessibilityInfo } from 'react-native';
import { colors, radius } from '@protos-farm/shared';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = radius.md,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
      if (enabled) {
        opacity.setValue(0.6);
        return;
      }

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 750,
            useNativeDriver: true,
          }),
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
      style={[styles.skeleton, { width, height, borderRadius, opacity }, style]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
      <Skeleton width="30%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.neutral[200],
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
});
