import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { createReferenceDataRepository } from '@/services/db';
import type { ReferenceEntityType } from '@/services/db';

interface UseReferenceDataResult<T> {
  data: T[];
  isLoading: boolean;
  lastSyncedAt: string | null;
  search: (query: string) => Promise<T[]>;
  refresh: () => Promise<void>;
}

/**
 * Hook to access cached reference data from the local SQLite store.
 * Returns data for a specific farm and entity type.
 *
 * @param farmId - The farm ID to scope data to, or null if no farm selected.
 * @param entityType - The reference entity type to retrieve.
 */
export function useReferenceData<T>(
  farmId: string | null,
  entityType: ReferenceEntityType,
): UseReferenceDataResult<T> {
  const db = useSQLiteContext();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) {
      setData([]);
      setIsLoading(false);
      setLastSyncedAt(null);
      return;
    }

    setIsLoading(true);
    try {
      const repo = createReferenceDataRepository(db);
      await repo.init();
      const items = await repo.getReferenceData<T>(farmId, entityType);
      const syncedAt = await repo.getLastSyncedAt(farmId, entityType);
      setData(items);
      setLastSyncedAt(syncedAt);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [db, farmId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(
    async (query: string): Promise<T[]> => {
      if (!farmId) return [];
      const repo = createReferenceDataRepository(db);
      await repo.init();
      return repo.searchReferenceData<T>(farmId, entityType, query);
    },
    [db, farmId, entityType],
  );

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { data, isLoading, lastSyncedAt, search, refresh };
}
