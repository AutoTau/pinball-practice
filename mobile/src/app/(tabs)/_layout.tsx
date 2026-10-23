import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, headerOptions, useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Practice', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'machines', title: 'Machines', icon: 'albums-outline', iconActive: 'albums' },
  { name: 'stats', title: 'Stats', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

/** The app's four main sections. Detail screens (sessions, machines) open above this, without the tab bar. */
export default function TabsLayout() {
  const { colors } = useTheme();
  // The bar grows by the bottom safe area (the iPhone home indicator) so labels are never clipped.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        ...headerOptions(colors),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + bottom,
          paddingTop: 6,
          paddingBottom: Math.max(bottom, 8),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.headingSemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
