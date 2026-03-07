import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIO_EMAIL_KEY = 'protos_bio_email';
const BIO_PASSWORD_KEY = 'protos_bio_password';
const BIO_ENABLED_KEY = 'protos_bio_enabled';

export type BiometricType = 'fingerprint' | 'facial' | 'none';

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export async function getBiometricType(): Promise<BiometricType> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'facial';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  return 'none';
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
  return enabled === 'true';
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIO_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIO_PASSWORD_KEY, password);
  await SecureStore.setItemAsync(BIO_ENABLED_KEY, 'true');
}

export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(BIO_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIO_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
}

export async function getBiometricCredentials(): Promise<{
  email: string;
  password: string;
} | null> {
  const email = await SecureStore.getItemAsync(BIO_EMAIL_KEY);
  const password = await SecureStore.getItemAsync(BIO_PASSWORD_KEY);
  if (!email || !password) return null;
  return { email, password };
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Autentique-se para acessar o Protos Farm',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: true,
  });
  return result.success;
}
