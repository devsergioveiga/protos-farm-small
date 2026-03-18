import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  SanitaryAlertsResponse,
  SanitaryAlertItem,
  SanitaryAlertsSummary,
  AlertUrgency,
} from '@/types/sanitary-protocol';

interface UseSanitaryAlertsParams {
  farmId?: string;
  daysAhead?: number;
  urgency?: AlertUrgency;
  procedureType?: string;
  targetCategory?: string;
}

interface UseSanitaryAlertsResult {
  alerts: SanitaryAlertItem[];
  summary: SanitaryAlertsSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSanitaryAlerts(params: UseSanitaryAlertsParams): UseSanitaryAlertsResult {
  const [alerts, setAlerts] = useState<SanitaryAlertItem[]>([]);
  const [summary, setSummary] = useState<SanitaryAlertsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, daysAhead, urgency, procedureType, targetCategory } = params;

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (farmId) query.set('farmId', farmId);
      if (daysAhead) query.set('daysAhead', String(daysAhead));
      if (urgency) query.set('urgency', urgency);
      if (procedureType) query.set('procedureType', procedureType);
      if (targetCategory) query.set('targetCategory', targetCategory);

      const qs = query.toString();
      const path = `/org/sanitary-protocols/alerts${qs ? `?${qs}` : ''}`;
      const result = await api.get<SanitaryAlertsResponse>(path);
      setAlerts(result.alerts);
      setSummary(result.summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar alertas sanitários';
      setError(message);
      setAlerts([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, daysAhead, urgency, procedureType, targetCategory]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, summary, isLoading, error, refetch: fetchAlerts };
}
