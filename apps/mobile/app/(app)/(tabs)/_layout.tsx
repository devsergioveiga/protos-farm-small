import { Tabs } from 'expo-router';
import { Home, Map, PlusCircle, Beef, MoreHorizontal } from 'lucide-react-native';
import { fontSize } from '@protos-farm/shared';
import { useSessionKeepAlive } from '@/hooks/useSessionKeepAlive';
import { useTheme } from '@/stores/ThemeContext';

export default function TabsLayout() {
  useSessionKeepAlive();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarLabelStyle: { fontFamily: 'SourceSans3_600SemiBold', fontSize: fontSize.xs },
        tabBarStyle: { borderTopColor: colors.neutral[200], backgroundColor: colors.neutral[0] },
        tabBarItemStyle: { minHeight: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color }) => <Home size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Mapa', tabBarIcon: ({ color }) => <Map size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="register"
        options={{
          title: 'Registrar',
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="herd"
        options={{ title: 'Rebanho', tabBarIcon: ({ color }) => <Beef size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color }) => <MoreHorizontal size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
