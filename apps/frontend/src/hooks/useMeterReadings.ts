import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────

export interface MeterReading {
  id: string;
  assetId: string;
  readingDate: string;
  readingType: 'HOURMETER' | 'ODOMETER';
  value: string;
  previousValue: string | null;
  createdAt: string;
}

export interface LatestReadings {
  hourmeter: MeterReading | null;
  odometer: MeterReading | null;
}

export interface CreateMeterReadingInput {
  assetId: string;
  readingDate: string;
  readingType: 'HOURMETER' | 'ODOMETER';
  value: string;
}

interface MeterReadingListResponse {
  data: MeterReading[];
  total: number;
  page: number;
  limit: number;
}

// ─── useMeterReadings ─────────────────────────────────────────────────

export function useMeterReadings(assetId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [latest, setLatest] = useState<LatestReadings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<MeterReadingListResponse>(
        `/org/${orgId}/meter-readings?assetId=${assetId}`,
      );
      setReadings(result.data);
    } catch {
      setError('Nao foi possivel carregar as leituras.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  const fetchLatest = useCallback(async () => {
    if (!orgId || !assetId) return;
    try {
      const result = await api.get<LatestReadings>(
        `/org/${orgId}/meter-readings/latest/${assetId}`,
      );
      setLatest(result);
    } catch {
      // Non-critical
    }
  }, [orgId, assetId]);

  useEffect(() => {
    if (assetId) {
      void fetchReadings();
      void fetchLatest();
    } else {
      setReadings([]);
      setLatest(null);
    }
  }, [assetId, fetchReadings, fetchLatest]);

  const createReading = useCallback(
    async (input: CreateMeterReadingInput) => {
      if (!orgId) return;
      setSubmitError(null);
      try {
        await api.post(`/org/${orgId}/meter-readings`, input);
        await Promise.all([fetchReadings(), fetchLatest()]);
      } catch (err) {
        // Anti-regression: 400 error with message about regression
        const apiErr = err as Error & { status?: number };
        if (apiErr.status === 400) {
          setSubmitError(
            apiErr.message || 'Leitura nao pode ser menor ou igual a ultima registrada.',
          );
          throw err; // Re-throw so caller knows it failed
        }
        throw err;
      }
    },
    [orgId, fetchReadings, fetchLatest],
  );

  return { readings, latest, loading, error, submitError, createReading, setSubmitError };
}
