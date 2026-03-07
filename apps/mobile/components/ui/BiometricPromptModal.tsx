import { Modal, View, Text } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { spacing, fontSize, radius } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Button } from '@/components/ui/Button';
import type { BiometricType } from '@/services/biometrics';
import type { ThemeColors } from '@/stores/ThemeContext';

interface BiometricPromptModalProps {
  visible: boolean;
  biometricType: BiometricType;
  onEnable: () => void;
  onDismiss: () => void;
}

const createStyles = (c: ThemeColors) => ({
  overlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0, 0, 0, 0.5)' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[6],
  },
  modal: {
    backgroundColor: c.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center' as const,
    width: '100%' as const,
    maxWidth: 360,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[800],
    marginTop: spacing[4],
  },
  description: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[600],
    textAlign: 'center' as const,
    marginTop: spacing[2],
    marginBottom: spacing[6],
    lineHeight: fontSize.base * 1.5,
  },
  actions: { width: '100%' as const, gap: spacing[3] },
});

export function BiometricPromptModal({
  visible,
  biometricType,
  onEnable,
  onDismiss,
}: BiometricPromptModalProps) {
  const isFacial = biometricType === 'facial';
  const Icon = isFacial ? ScanFace : Fingerprint;
  const typeLabel = isFacial ? 'Face ID' : 'impressão digital';
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal} accessibilityRole="alert">
          <Icon size={48} color={colors.primary[600]} aria-hidden />
          <Text style={styles.title} accessibilityRole="header">
            Login rápido
          </Text>
          <Text style={styles.description}>
            Deseja usar {typeLabel} para entrar mais rápido nas próximas vezes?
          </Text>
          <View style={styles.actions}>
            <Button label="Ativar" onPress={onEnable} />
            <Button label="Agora não" onPress={onDismiss} variant="secondary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
