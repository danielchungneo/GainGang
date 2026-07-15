import { Ionicons } from "@expo/vector-icons";

import { Redirect, Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";

import { useAuth } from "@/context/auth-context";

import { useUnreadNotificationCount } from "@/hooks/use-notifications";

import { useUnopenedCrateCount } from "@/hooks/use-reward-crates";

import { status, useTheme } from "@/lib/gaingang-theme";

export default function TabLayout() {
  const { theme } = useTheme();
  const { session, isPending } = useAuth();
  const unreadAlerts = useUnreadNotificationCount();
  const unopenedCrates = useUnopenedCrateCount();
  const profileAttention = unreadAlerts + unopenedCrates;

  const c = theme.colors;

  if (isPending) return null;

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        tabBarButton: HapticTab,

        tabBarActiveTintColor: c.primary,

        tabBarInactiveTintColor: c.textMuted,

        headerShown: false,

        tabBarStyle: {
          backgroundColor: c.surface,

          borderTopColor: c.border,

          height: 66,

          paddingTop: 6,

          paddingBottom: 8,
        },

        tabBarLabelStyle: {
          fontWeight: "700",

          fontSize: 12,
        },

        sceneStyle: {
          backgroundColor: c.bg,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",

          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: "Gangs",

          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          tabBarBadge:
            profileAttention > 0
              ? profileAttention > 99
                ? "99+"
                : profileAttention
              : undefined,

          tabBarBadgeStyle: {
            backgroundColor: status.danger,
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "700",
            minWidth: 16,
            height: 16,
            lineHeight: 14,
            borderRadius: 8,
          },

          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
