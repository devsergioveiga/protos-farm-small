import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { FarmProvider } from '@/stores/FarmContext';

export default function AppLayout() {
  return (
    <FarmProvider>
      <View style={styles.container}>
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </View>
    </FarmProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
