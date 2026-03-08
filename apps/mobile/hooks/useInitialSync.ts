import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineData } from './useOfflineData';
import { useConnectivity } from '@/stores/ConnectivityContext';
import type { SyncProgress } from '@/services/sync';

interface UseInitialSyncOptions {
  farmId: string | null;
  enabled?: boolean;
}

interface UseInitialSyncResult {
  isSyncing: boolean;
  progress: SyncProgress[];
  lastSyncedAt: string | null;
  error: string | null;
  retrySync: () => void;
}

/**
 * Triggers initial data sync when a farm is selected.
 * Re-syncs when connectivity is restored after being offline.
 */
export function useInitialSync({
  farmId,
  enabled = true,
}: UseInitialSyncOptions): UseInitialSyncResult {
  const { sync, syncMeta } = useOfflineData();
  const { isConnected } = useConnectivity();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const doSync = useCallback(async () => {
    if (!farmId || !isConnected || syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      const result = await sync.syncFarmData(farmId, setProgress);
      const hasError = result.some((p) => p.status === 'error');
      if (hasError) {
        const errorEntities = result
          .filter((p) => p.status === 'error')
          .map((p) => p.entity)
          .join(', ');
        setError(`Falha ao sincronizar: ${errorEntities}`);
      }
      const meta = await syncMeta.get('farms');
      setLastSyncedAt(meta?.last_synced_at ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [farmId, isConnected, sync, syncMeta]);

  // Sync on farm selection
  useEffect(() => {
    if (!enabled || !farmId) return;
    void doSync();
  }, [farmId, enabled]);
  // Re-sync when connectivity is restored
  useEffect(() => {
    if (!enabled || !farmId || !isConnected) return;

    // Check if we have synced data — if not, trigger sync
    void (async () => {
      const hasFarms = await sync.hasSyncedData('farms');
      if (!hasFarms) {
        void doSync();
      }
    })();
  }, [isConnected]);
  // Load last sync time on mount
  useEffect(() => {
    void (async () => {
      const meta = await syncMeta.get('farms');
      setLastSyncedAt(meta?.last_synced_at ?? null);
    })();
  }, [syncMeta]);

  const retrySync = useCallback(() => {
    void doSync();
  }, [doSync]);

  return { isSyncing, progress, lastSyncedAt, error, retrySync };
}
