import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { BoundaryVersionItem, BoundaryVersionDetail } from '@/types/farm';

interface UseBoundaryVersionsResult {
  versions: BoundaryVersionItem[];
  isLoading: boolean;
  error: string | null;
  fetchVersionGeometry: (versionId: string) => Promise<BoundaryVersionDetail | null>;
}

export function useBoundaryVersions(
  farmId: string | undefined,
  registrationId?: string,
): UseBoundaryVersionsResult {
  const [versions, setVersions] = useState<BoundaryVersionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;

    let cancelled = false;

    const basePath = registrationId
      ? `/org/farms/${farmId}/registrations/${registrationId}/boundary/versions`
      : `/org/farms/${farmId}/boundary/versions`;

    api
      .get<BoundaryVersionItem[]>(basePath)
      .then((data) => {
        if (!cancelled) {
          setVersions(data);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Erro ao carregar versões';
          setError(message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, registrationId]);

  const fetchVersionGeometry = useCallback(
    async (versionId: string): Promise<BoundaryVersionDetail | null> => {
      if (!farmId) return null;

      const basePath = registrationId
        ? `/org/farms/${farmId}/registrations/${registrationId}/boundary/versions/${versionId}`
        : `/org/farms/${farmId}/boundary/versions/${versionId}`;

      try {
        return await api.get<BoundaryVersionDetail>(basePath);
      } catch {
        return null;
      }
    },
    [farmId, registrationId],
  );

  return { versions, isLoading, error, fetchVersionGeometry };
}
