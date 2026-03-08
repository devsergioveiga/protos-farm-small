import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFarmContext } from '@/stores/FarmContext';
import { useInitialSync } from '@/hooks/useInitialSync';
import type { SyncProgress } from '@/services/sync';

interface SyncContextValue {
  isSyncing: boolean;
  progress: SyncProgress[];
  lastSyncedAt: string | null;
  syncError: string | null;
  retrySync: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

function SyncProvider({ children }: { children: ReactNode }) {
  const { selectedFarmId } = useFarmContext();
  const { isSyncing, progress, lastSyncedAt, error, retrySync } = useInitialSync({
    farmId: selectedFarmId,
  });

  const value = useMemo<SyncContextValue>(
    () => ({
      isSyncing,
      progress,
      lastSyncedAt,
      syncError: error,
      retrySync,
    }),
    [isSyncing, progress, lastSyncedAt, error, retrySync],
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
