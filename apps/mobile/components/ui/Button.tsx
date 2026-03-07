import { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize, radius } from '@protos-farm/shared';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/stores/ThemeContext';
import type { ThemeColors } from '@/stores/ThemeContext';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

const createStyles = (c: ThemeColors) => ({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  primary: { backgroundColor: c.primary[600] },
  secondary: {
    backgroundColor: 'transparent' as const,
    borderWidth: 1,
    borderColor: c.primary[600],
  },
  disabled: { opacity: 0.5 },
  label: { fontFamily: 'SourceSans3_600SemiBold', fontSize: fontSize.base },
  labelPrimary: { color: c.neutral[0] },
  labelSecondary: { color: c.primary[600] },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.neutral[0] : colors.primary[600]}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelPrimary : styles.labelSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
