import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useOfflineData } from './useOfflineData';
import { useConnectivity } from '@/stores/ConnectivityContext';
import type { SyncProgress } from '@/services/sync';

/** Re-sync interval: 15 minutes */
const RESYNC_INTERVAL_MS = 15 * 60 * 1000;

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
 * Triggers data sync when:
 * 1. A farm is selected (initial sync)
 * 2. Connectivity is restored after being offline
 * 3. App returns to foreground after >15min since last sync
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
  const wasDisconnectedRef = useRef(false);

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

  // 1. Sync on farm selection
  useEffect(() => {
    if (!enabled || !farmId) return;
    void doSync();
  }, [farmId, enabled]);

  // 2. Track disconnection and re-sync on reconnect
  useEffect(() => {
    if (!isConnected) {
      wasDisconnectedRef.current = true;
      return;
    }
    if (wasDisconnectedRef.current && enabled && farmId) {
      wasDisconnectedRef.current = false;
      void doSync();
    }
  }, [isConnected]);

  // 3. Re-sync when app returns to foreground after interval
  useEffect(() => {
    if (!enabled || !farmId) return;

    const handleAppState = async (state: AppStateStatus) => {
      if (state !== 'active' || !isConnected) return;

      const meta = await syncMeta.get('farms');
      if (!meta) {
        void doSync();
        return;
      }

      const lastSync = new Date(meta.last_synced_at).getTime();
      if (Date.now() - lastSync > RESYNC_INTERVAL_MS) {
        void doSync();
      }
    };

    const subscription = AppState.addEventListener('change', (state) => {
      void handleAppState(state);
    });

    return () => subscription.remove();
  }, [farmId, enabled, isConnected, syncMeta, doSync]);

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
