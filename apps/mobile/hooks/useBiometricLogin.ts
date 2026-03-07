import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/stores/AuthContext';
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  getBiometricType,
  getBiometricCredentials,
  saveBiometricCredentials,
  clearBiometricCredentials,
  authenticateWithBiometrics,
  type BiometricType,
} from '@/services/biometrics';

interface UseBiometricLoginResult {
  canUseBiometrics: boolean;
  biometricType: BiometricType;
  loginWithBiometrics: () => Promise<void>;
  shouldPromptEnable: boolean;
  enableBiometrics: (email: string, password: string) => Promise<void>;
  dismissPrompt: () => void;
}

export function useBiometricLogin(): UseBiometricLoginResult {
  const { login } = useAuth();
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [shouldPromptEnable, setShouldPromptEnable] = useState(false);

  useEffect(() => {
    const check = async () => {
      const available = await isBiometricsAvailable();
      if (!available) return;

      const type = await getBiometricType();
      setBiometricType(type);

      const enabled = await isBiometricsEnabled();
      if (enabled) {
        const creds = await getBiometricCredentials();
        setCanUseBiometrics(!!creds);
      } else {
        // Available but not enabled — prompt after first login
        setShouldPromptEnable(true);
      }
    };
    void check();
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    const authenticated = await authenticateWithBiometrics();
    if (!authenticated) {
      const error = new Error('cancelled');
      throw error;
    }

    const creds = await getBiometricCredentials();
    if (!creds) {
      await clearBiometricCredentials();
      setCanUseBiometrics(false);
      throw new Error('Credenciais biométricas não encontradas');
    }

    try {
      await login(creds.email, creds.password);
    } catch (err) {
      const e = err as Error & { status?: number };
      // If password changed (401), clear biometric credentials
      if (e.status === 401) {
        await clearBiometricCredentials();
        setCanUseBiometrics(false);
      }
      throw err;
    }
  }, [login]);

  const enableBiometrics = useCallback(async (email: string, password: string) => {
    await saveBiometricCredentials(email, password);
    setCanUseBiometrics(true);
    setShouldPromptEnable(false);
  }, []);

  const dismissPrompt = useCallback(() => {
    setShouldPromptEnable(false);
  }, []);

  return {
    canUseBiometrics,
    biometricType,
    loginWithBiometrics,
    shouldPromptEnable,
    enableBiometrics,
    dismissPrompt,
  };
}
