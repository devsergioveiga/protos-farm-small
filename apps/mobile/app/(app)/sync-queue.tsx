import { Stack } from 'expo-router';
import SyncQueueScreen from '@/components/sync/SyncQueueScreen';

export default function SyncQueueRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Fila de sincronizacao',
          headerBackTitle: 'Voltar',
        }}
      />
      <SyncQueueScreen />
    </>
  );
}
