import { Modal, View, Text, StyleSheet } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { colors, spacing, fontSize, radius } from '@protos-farm/shared';
import { Button } from '@/components/ui/Button';
import type { BiometricType } from '@/services/biometrics';

interface BiometricPromptModalProps {
  visible: boolean;
  biometricType: BiometricType;
  onEnable: () => void;
  onDismiss: () => void;
}

export function BiometricPromptModal({
  visible,
  biometricType,
  onEnable,
  onDismiss,
}: BiometricPromptModalProps) {
  const isFacial = biometricType === 'facial';
  const Icon = isFacial ? ScanFace : Fingerprint;
  const typeLabel = isFacial ? 'Face ID' : 'impressão digital';

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  modal: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: colors.neutral[800],
    marginTop: spacing[4],
  },
  description: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[6],
    lineHeight: fontSize.base * 1.5,
  },
  actions: {
    width: '100%',
    gap: spacing[3],
  },
});
