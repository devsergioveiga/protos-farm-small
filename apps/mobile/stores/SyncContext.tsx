import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFarmContext } from '@/stores/FarmContext';
import { useInitialSync } from '@/hooks/useInitialSync';
import { usePendingOperations } from '@/hooks/usePendingOperations';
import type { SyncProgress } from '@/services/sync';
import type { SyncMetrics } from '@/services/offline-queue';
import type { ConflictLogEntry } from '@/services/db/conflict-log-repository';

interface SyncContextValue {
  isSyncing: boolean;
  progress: SyncProgress[];
  lastSyncedAt: string | null;
  syncError: string | null;
  retrySync: () => void;
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

const SyncContext = createContext<SyncContextValue | null>(null);

function SyncProvider({ children }: { children: ReactNode }) {
  const { selectedFarmId } = useFarmContext();
  const { isSyncing, progress, lastSyncedAt, error, retrySync } = useInitialSync({
    farmId: selectedFarmId,
  });
  const {
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
  } = usePendingOperations();

  const value = useMemo<SyncContextValue>(
    () => ({
      isSyncing,
      progress,
      lastSyncedAt,
      syncError: error,
      retrySync,
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
    }),
    [
      isSyncing,
      progress,
      lastSyncedAt,
      error,
      retrySync,
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
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext deve ser usado dentro de SyncProvider');
  }
  return context;
}

export { SyncProvider, useSyncContext };
