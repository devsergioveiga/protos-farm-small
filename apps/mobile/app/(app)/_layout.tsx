import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { FarmProvider } from '@/stores/FarmContext';
import { SyncProvider } from '@/stores/SyncContext';

export default function AppLayout() {
  return (
    <FarmProvider>
      <SyncProvider>
        <View style={styles.container}>
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </View>
      </SyncProvider>
    </FarmProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
