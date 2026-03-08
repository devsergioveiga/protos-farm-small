import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useOfflineData } from './useOfflineData';
import { useConnectivity } from '@/stores/ConnectivityContext';

interface UsePendingOperationsResult {
  pendingCount: number;
  isFlushing: boolean;
  flushProgress: { processed: number; total: number; failed: number };
  flushNow: () => Promise<void>;
}

/**
 * Tracks pending offline operations and auto-flushes when online.
 */
export function usePendingOperations(): UsePendingOperationsResult {
  const { queue } = useOfflineData();
  const { isConnected } = useConnectivity();
  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushProgress, setFlushProgress] = useState({ processed: 0, total: 0, failed: 0 });
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await queue.pendingCount();
    setPendingCount(count);
  }, [queue]);

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
    } finally {
      setIsFlushing(false);
      flushingRef.current = false;
      await refreshCount();
    }
  }, [queue, isConnected, refreshCount]);

  // Refresh count on mount and when app comes to foreground
  useEffect(() => {
    void refreshCount();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshCount();
      }
    });

    return () => subscription.remove();
  }, [refreshCount]);

  // Auto-flush when connectivity is restored
  useEffect(() => {
    if (isConnected && pendingCount > 0) {
      void flushNow();
    }
  }, [isConnected]);

  return { pendingCount, isFlushing, flushProgress, flushNow };
}
