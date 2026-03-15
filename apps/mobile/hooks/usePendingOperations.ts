import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useOfflineData } from './useOfflineData';
import { useConnectivity } from '@/stores/ConnectivityContext';
import type { SyncMetrics } from '@/services/offline-queue';
import type { ConflictLogEntry } from '@/services/db/conflict-log-repository';

interface UsePendingOperationsResult {
  pendingCount: number;
  isFlushing: boolean;
  flushProgress: { processed: number; total: number; failed: number };
  flushNow: () => Promise<void>;
  conflictCount: number;
  conflicts: ConflictLogEntry[];
  refreshConflicts: () => Promise<void>;
  reviewConflict: (id: number) => Promise<void>;
  reviewAllConflicts: () => Promise<void>;
  syncMetrics: SyncMetrics | null;
  latestMetrics: SyncMetrics[];
  priorityCounts: { critical: number; normal: number };
}

/**
 * Tracks pending offline operations and auto-flushes when online.
 * Exposes conflict data and sync metrics (US-127 / US-128).
 */
export function usePendingOperations(): UsePendingOperationsResult {
  const { queue } = useOfflineData();
  const { isConnected } = useConnectivity();
  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushProgress, setFlushProgress] = useState({ processed: 0, total: 0, failed: 0 });
  const [conflictCount, setConflictCount] = useState(0);
  const [conflicts, setConflicts] = useState<ConflictLogEntry[]>([]);
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<SyncMetrics[]>([]);
  const [priorityCounts, setPriorityCounts] = useState({ critical: 0, normal: 0 });
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const [count, cCount, pCounts] = await Promise.all([
      queue.pendingCount(),
      queue.conflictCount(),
      queue.countByPriority(),
    ]);
    setPendingCount(count);
    setConflictCount(cCount);
    setPriorityCounts(pCounts);
  }, [queue]);

  const refreshConflicts = useCallback(async () => {
    const [unreviewedConflicts, cCount] = await Promise.all([
      queue.getConflicts(),
      queue.conflictCount(),
    ]);
    setConflicts(unreviewedConflicts);
    setConflictCount(cCount);
  }, [queue]);

  const refreshMetrics = useCallback(async () => {
    const metrics = await queue.getMetrics(10);
    setLatestMetrics(metrics);
    if (metrics.length > 0) {
      setSyncMetrics(metrics[0]);
    }
  }, [queue]);

  const reviewConflict = useCallback(
    async (id: number) => {
      await queue.reviewConflict(id);
      await refreshConflicts();
    },
    [queue, refreshConflicts],
  );

  const reviewAllConflicts = useCallback(async () => {
    await queue.reviewAllConflicts();
    await refreshConflicts();
  }, [queue, refreshConflicts]);

  const flushNow = useCallback(async () => {
    if (flushingRef.current || !isConnected) return;
    flushingRef.current = true;
    setIsFlushing(true);

    try {
      const result = await queue.flush((_status, processed, total, failed) => {
        setFlushProgress({ processed, total, failed });
      });
      setFlushProgress({
        processed: result.processed,
        total: result.processed + result.failed,
        failed: result.failed,
      });
      setSyncMetrics(result.metrics);
    } finally {
      setIsFlushing(false);
      flushingRef.current = false;
      await refreshCount();
      await refreshConflicts();
      await refreshMetrics();
    }
  }, [queue, isConnected, refreshCount, refreshConflicts, refreshMetrics]);

  // Refresh count on mount and when app comes to foreground
  useEffect(() => {
    void refreshCount();
    void refreshConflicts();
    void refreshMetrics();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshCount();
        void refreshConflicts();
        void refreshMetrics();
      }
    });

    return () => subscription.remove();
  }, [refreshCount, refreshConflicts, refreshMetrics]);

  // Auto-flush when connectivity is restored
  useEffect(() => {
    if (isConnected && pendingCount > 0) {
      void flushNow();
    }
  }, [isConnected]);

  return {
    pendingCount,
    isFlushing,
    flushProgress,
    flushNow,
    conflictCount,
    conflicts,
    refreshConflicts,
    reviewConflict,
    reviewAllConflicts,
    syncMetrics,
    latestMetrics,
    priorityCounts,
  };
}
