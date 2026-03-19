import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../stores/AuthContext';

export interface NotificationPreference {
  eventType: string;
  badge: boolean;
  email: boolean;
}

interface UseNotificationPreferencesResult {
  preferences: NotificationPreference[];
  loading: boolean;
  error: string | null;
  savingKey: string | null;
  errorToast: string | null;
  togglePreference: (
    eventType: string,
    channel: 'badge' | 'email',
    enabled: boolean,
  ) => Promise<void>;
  retry: () => void;
}

export function useNotificationPreferences(): UseNotificationPreferencesResult {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NotificationPreference[]>(
        `/org/${orgId}/notification-preferences`,
      );
      setPreferences(data);
    } catch {
      setError('Nao foi possivel carregar suas preferencias. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const togglePreference = useCallback(
    async (eventType: string, channel: 'badge' | 'email', enabled: boolean) => {
      // Optimistic update
      setPreferences((prev) =>
        prev.map((p) => (p.eventType === eventType ? { ...p, [channel]: enabled } : p)),
      );

      try {
        await api.put(`/org/${orgId}/notification-preferences`, {
          eventType,
          channel,
          enabled,
        });

        // Show inline success indicator for 1s
        const key = `${eventType}:${channel}`;
        setSavingKey(key);
        setTimeout(() => setSavingKey(null), 1000);
      } catch {
        // Revert optimistic update
        setPreferences((prev) =>
          prev.map((p) => (p.eventType === eventType ? { ...p, [channel]: !enabled } : p)),
        );
        setErrorToast('Nao foi possivel salvar sua preferencia. Tente novamente.');
        setTimeout(() => setErrorToast(null), 5000);
      }
    },
    [orgId],
  );

  return {
    preferences,
    loading,
    error,
    savingKey,
    errorToast,
    togglePreference,
    retry: fetchPreferences,
  };
}
