import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import type { IconName } from '@/components/ui';
import { colors } from '@/theme';

function icon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Accueil', tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="mileage"
        options={{ title: 'Kilométrage', tabBarIcon: icon('speedometer') }}
      />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents', tabBarIcon: icon('warning') }} />
      <Tabs.Screen name="history" options={{ title: 'Historique', tabBarIcon: icon('time') }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: icon('person-circle') }}
      />
    </Tabs>
  );
}
