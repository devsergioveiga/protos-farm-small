import { Tabs } from 'expo-router';
import { Home } from 'lucide-react-native';
import { colors, fontSize } from '@protos-farm/shared';
import { useSessionKeepAlive } from '@/hooks/useSessionKeepAlive';

export default function TabsLayout() {
  useSessionKeepAlive();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarLabelStyle: {
          fontFamily: 'SourceSans3_600SemiBold',
          fontSize: fontSize.xs,
        },
        tabBarStyle: {
          borderTopColor: colors.neutral[200],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
