import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

export const NOTIFICATION_EVENT_GROUPS = {
  SOLICITANTE: ['RC_APPROVED', 'RC_REJECTED', 'DELIVERY_CONFIRMED'],
  APROVADOR: ['RC_PENDING', 'SLA_REMINDER'],
  COMPRADOR: ['RC_APPROVED', 'QUOTATION_DEADLINE_NEAR', 'PO_OVERDUE'],
  FINANCEIRO: ['GR_CONFIRMED'],
  GERENTE: ['DAILY_DIGEST'],
} as const;

export const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'DIGEST'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const EVENT_TYPE_LABELS: Record<string, string> = {
  RC_APPROVED: 'Requisicao aprovada',
  RC_REJECTED: 'Requisicao rejeitada',
  RC_RETURNED: 'Requisicao devolvida',
  RC_PENDING: 'Nova pendencia de aprovacao',
  SLA_REMINDER: 'Lembrete de SLA',
  QUOTATION_PENDING_APPROVAL: 'Cotacao pendente de aprovacao',
  QUOTATION_APPROVED: 'Cotacao aprovada',
  QUOTATION_DEADLINE_NEAR: 'Prazo de cotacao proximo',
  PO_OVERDUE: 'Pedido em atraso',
  GR_CONFIRMED: 'Recebimento confirmado',
  DELIVERY_CONFIRMED: 'Entrega confirmada',
  DAILY_DIGEST: 'Resumo diario',
};

export const ROLE_GROUP_LABELS: Record<string, string> = {
  SOLICITANTE: 'Solicitante',
  APROVADOR: 'Aprovador',
  COMPRADOR: 'Comprador',
  FINANCEIRO: 'Financeiro',
  GERENTE: 'Gerente',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPref {
  eventType: string;
  channel: string;
  enabled: boolean;
}

type PrefMap = Map<string, boolean>;

function makeKey(eventType: string, channel: string): string {
  return `${eventType}::${channel}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseNotificationPreferencesResult {
  preferences: NotificationPref[];
  isLoading: boolean;
  error: string | null;
  updatePreference: (eventType: string, channel: string, enabled: boolean) => void;
  savePreferences: () => Promise<void>;
  isDirty: boolean;
}

export function useNotificationPreferences(): UseNotificationPreferencesResult {
  const [prefMap, setPrefMap] = useState<PrefMap>(new Map());
  const [originalMap, setOriginalMap] = useState<PrefMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const fetched = await api.get<NotificationPref[]>('/org/notifications/preferences');

        // Build defaults: all event types x IN_APP + PUSH channels = true
        // DIGEST only for DAILY_DIGEST
        const defaults = new Map<string, boolean>();
        for (const [, eventTypes] of Object.entries(NOTIFICATION_EVENT_GROUPS)) {
          for (const eventType of eventTypes) {
            defaults.set(makeKey(eventType, 'IN_APP'), true);
            defaults.set(makeKey(eventType, 'PUSH'), true);
            if (eventType === 'DAILY_DIGEST') {
              defaults.set(makeKey(eventType, 'DIGEST'), true);
            }
          }
        }

        // Merge fetched preferences over defaults
        for (const pref of fetched) {
          defaults.set(makeKey(pref.eventType, pref.channel), pref.enabled);
        }

        if (!cancelled) {
          setPrefMap(new Map(defaults));
          setOriginalMap(new Map(defaults));
          setIsDirty(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Erro ao carregar preferencias de notificacao',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const updatePreference = useCallback((eventType: string, channel: string, enabled: boolean) => {
    setPrefMap((prev) => {
      const next = new Map(prev);
      next.set(makeKey(eventType, channel), enabled);
      return next;
    });
    setIsDirty(true);
  }, []);

  const savePreferences = useCallback(async () => {
    // Collect only changed prefs
    const changed: NotificationPref[] = [];
    for (const [key, enabled] of prefMap.entries()) {
      const [eventType, channel] = key.split('::');
      if (!eventType || !channel) continue;
      const originalEnabled = originalMap.get(key) ?? true;
      if (originalEnabled !== enabled) {
        changed.push({ eventType, channel, enabled });
      }
    }

    await api.patch<unknown>('/org/notifications/preferences', { preferences: changed });

    // Update original to current state
    setOriginalMap(new Map(prefMap));
    setIsDirty(false);
  }, [prefMap, originalMap]);

  // Compute preferences array from map
  const preferences: NotificationPref[] = [];
  for (const [key, enabled] of prefMap.entries()) {
    const [eventType, channel] = key.split('::');
    if (eventType && channel) {
      preferences.push({ eventType, channel, enabled });
    }
  }

  return {
    preferences,
    isLoading,
    error,
    updatePreference,
    savePreferences,
    isDirty,
  };
}
