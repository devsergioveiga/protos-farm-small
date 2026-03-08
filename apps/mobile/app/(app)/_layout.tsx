import { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SyncStatusBanner } from '@/components/ui/SyncStatusBanner';
import { SyncProgressOverlay } from '@/components/ui/SyncProgressOverlay';
import { FarmProvider } from '@/stores/FarmContext';
import { SyncProvider, useSyncContext } from '@/stores/SyncContext';

function AppContent() {
  const { isSyncing, progress } = useSyncContext();
  const [showProgress, setShowProgress] = useState(true);

  const handleDismiss = useCallback(() => {
    setShowProgress(false);
  }, []);

  // Show overlay only during initial sync (when progress has items)
  const showOverlay = showProgress && progress.length > 0 && isSyncing;
  // Also show when sync just completed (all done) so user sees the result
  const allDone =
    progress.length > 0 && progress.every((p) => p.status === 'done' || p.status === 'error');
  const showCompleted = showProgress && allDone && progress.length > 0;

  return (
    <View style={styles.container}>
      <SyncStatusBanner />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <SyncProgressOverlay
        visible={showOverlay || showCompleted}
        progress={progress}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

export default function AppLayout() {
  return (
    <FarmProvider>
      <SyncProvider>
        <AppContent />
      </SyncProvider>
    </FarmProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
