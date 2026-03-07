import { useState } from 'react';
import { View, Text, TextInput, Pressable, type TextInputProps } from 'react-native';
import { AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { spacing, fontSize, radius } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { ThemeColors } from '@/stores/ThemeContext';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
}

const createStyles = (c: ThemeColors) => ({
  container: { gap: spacing[1] },
  label: { fontFamily: 'SourceSans3_600SemiBold', fontSize: fontSize.sm, color: c.neutral[700] },
  required: { color: c.error[500] },
  inputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: radius.md,
    backgroundColor: c.neutral[0],
  },
  inputError: { borderColor: c.error[500] },
  input: {
    flex: 1 as const,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[800],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 48,
  },
  eyeButton: {
    paddingHorizontal: spacing[3],
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  errorContainer: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing[1] },
  errorText: { fontFamily: 'SourceSans3_400Regular', fontSize: fontSize.xs, color: c.error[500] },
});

export function Input({ label, error, required, secureTextEntry, ...props }: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = secureTextEntry !== undefined;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.neutral[400]}
          secureTextEntry={isPassword && !isPasswordVisible}
          accessibilityLabel={label}
          aria-required={required}
          {...props}
        />
        {isPassword && (
          <Pressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeButton}
            accessibilityLabel={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={colors.neutral[500]} />
            ) : (
              <Eye size={20} color={colors.neutral[500]} />
            )}
          </Pressable>
        )}
      </View>
      {error && (
        <View style={styles.errorContainer} accessibilityRole="alert">
          <AlertCircle size={14} color={colors.error[500]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}
