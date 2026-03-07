import { useState, useCallback } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sprout } from 'lucide-react-native';
import { colors, spacing, fontSize } from '@protos-farm/shared';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/stores/AuthContext';
import { useBiometricLogin } from '@/hooks/useBiometricLogin';
import { BiometricPromptModal } from '@/components/ui/BiometricPromptModal';

export default function LoginScreen() {
  const { login } = useAuth();
  const {
    canUseBiometrics,
    biometricType,
    loginWithBiometrics,
    shouldPromptEnable,
    enableBiometrics,
    dismissPrompt,
  } = useBiometricLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const handleLogin = useCallback(async () => {
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Preencha email e senha');
      return;
    }
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      // After successful login, check if we should prompt for biometrics
      if (shouldPromptEnable) {
        setShowBiometricPrompt(true);
      }
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setError('Credenciais inválidas');
      } else if (e.status === 403) {
        setError('Conta inativa. Entre em contato com o administrador.');
      } else if (e.message?.includes('fetch') || e.message?.includes('network')) {
        setError('Sem conexão. Verifique sua internet e tente novamente.');
      } else {
        setError(e.message || 'Não foi possível fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, login, shouldPromptEnable]);

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    setError('');
    try {
      await loginWithBiometrics();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setError('Sua senha foi alterada. Faça login com email e senha.');
      } else if (e.message !== 'cancelled') {
        setError('Não foi possível autenticar com biometria.');
      }
    } finally {
      setBiometricLoading(false);
    }
  }, [loginWithBiometrics]);

  const handleEnableBiometrics = useCallback(async () => {
    await enableBiometrics(email.trim(), password);
    setShowBiometricPrompt(false);
  }, [enableBiometrics, email, password]);

  const handleDismissBiometricPrompt = useCallback(() => {
    dismissPrompt();
    setShowBiometricPrompt(false);
  }, [dismissPrompt]);

  const biometricLabel =
    biometricType === 'facial' ? 'Entrar com Face ID' : 'Entrar com impressão digital';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Sprout size={64} color={colors.primary[600]} aria-hidden />
            <Text style={styles.title} accessibilityRole="header">
              Protos Farm
            </Text>
            <Text style={styles.subtitle}>Entre na sua conta</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              required
            />

            <Input
              label="Senha"
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={() => void handleLogin()}
              required
            />

            {error ? (
              <View style={styles.errorContainer} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              label="Entrar"
              onPress={() => void handleLogin()}
              loading={loading}
              disabled={loading || biometricLoading}
              accessibilityHint="Faz login com email e senha"
            />

            {canUseBiometrics && (
              <Button
                label={biometricLabel}
                onPress={() => void handleBiometricLogin()}
                variant="secondary"
                loading={biometricLoading}
                disabled={loading || biometricLoading}
                accessibilityHint="Faz login usando biometria"
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BiometricPromptModal
        visible={showBiometricPrompt}
        biometricType={biometricType}
        onEnable={() => void handleEnableBiometrics()}
        onDismiss={handleDismissBiometricPrompt}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[10],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[10],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize['2xl'],
    color: colors.neutral[800],
    marginTop: spacing[4],
  },
  subtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[500],
    marginTop: spacing[2],
  },
  form: {
    gap: spacing[4],
  },
  errorContainer: {
    backgroundColor: colors.error[100],
    padding: spacing[3],
    borderRadius: 8,
  },
  errorText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.error[500],
    textAlign: 'center',
  },
});
