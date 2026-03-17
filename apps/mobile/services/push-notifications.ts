import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * Request permission and register device for push notifications.
 * Returns the Expo push token, or null if permission was denied.
 * Safe to call multiple times — will re-register with latest token.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Physical device check is enforced by Expo SDK itself
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[PushNotifications] Permission not granted');
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.expoConfig as { projectId?: string } | undefined)?.projectId;

  const tokenOptions = projectId ? { projectId } : {};
  const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
  const token = tokenData.data;

  // Register token with backend — fire-and-forget to avoid blocking caller
  void (async () => {
    try {
      await api.post('/api/org/notifications/register-push-token', {
        token,
        platform: Platform.OS,
      });
    } catch (err) {
      console.warn('[PushNotifications] Failed to register token with backend', err);
    }
  })();

  return token;
}

/**
 * Configure notification handlers and set up navigation on notification tap.
 * Call once at app startup (e.g., in the root layout).
 * Returns a cleanup function that removes the listener.
 */
export function setupNotificationHandlers(
  onPurchaseRequestNotification?: (referenceId: string) => void,
): () => void {
  // Handle notifications received while app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Handle notification tap — navigate to RC detail
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | null;
    if (data?.referenceType === 'purchase_request' && typeof data?.referenceId === 'string') {
      onPurchaseRequestNotification?.(data.referenceId);
    }
  });

  return () => subscription.remove();
}
