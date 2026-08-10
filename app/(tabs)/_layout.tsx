import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Redirect, Tabs } from "expo-router";

import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GainTabButton } from "@/components/gain-tab-button";
import { HapticTab } from "@/components/haptic-tab";

import { useAuth } from "@/context/auth-context";

import {
  useNeedsCrewSetup,
  useNeedsEquipmentPrompt,
  useNeedsFocusLockIntro,
  useNeedsPostAuthNotifications,
} from "@/hooks/use-onboarding";

import { useUnreadNotificationCount } from "@/hooks/use-notifications";

import { useUnopenedCrateCount } from "@/hooks/use-reward-crates";

import { status, useTheme } from "@/lib/gaingang-theme";

const TAB_BAR_CONTENT_HEIGHT = 58;
const TAB_BAR_TOP_PAD = 8;
const TAB_BAR_BOTTOM_PAD = 4;

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, isPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsPostAuthNotifications, isLoading: notifLoading } =
    useNeedsPostAuthNotifications();
  const { needsFocusLockIntro, isLoading: focusIntroLoading } = useNeedsFocusLockIntro();
  const { needsEquipmentPrompt, isLoading: equipmentLoading } = useNeedsEquipmentPrompt();
  const unreadAlerts = useUnreadNotificationCount();
  const unopenedCrates = useUnopenedCrateCount();
  const profileAttention = unreadAlerts + unopenedCrates;

  const tabBarBottomPad = insets.bottom + TAB_BAR_BOTTOM_PAD;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + TAB_BAR_TOP_PAD + tabBarBottomPad;

  const c = theme.colors;

  if (
    isPending ||
    (session && (crewLoading || notifLoading || focusIntroLoading || equipmentLoading))
  ) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  if (needsCrewSetup && needsPostAuthNotifications) {
    return <Redirect href="/welcome-notifications" />;
  }

  if (needsCrewSetup) return <Redirect href="/welcome-crew" />;

  if (needsFocusLockIntro) return <Redirect href="/welcome-focus-lock" />;

  if (needsEquipmentPrompt) return <Redirect href="/welcome-equipment" />;

  const badgeStyle = {
    backgroundColor: status.danger,
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700" as const,
    minWidth: 16,
    height: 16,
    lineHeight: 14,
    borderRadius: 8,
  };

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarButton: HapticTab,

        tabBarActiveTintColor: c.primary,

        tabBarInactiveTintColor: c.textMuted,

        headerShown: false,

        tabBarStyle: {
          backgroundColor: c.surface,

          borderTopColor: c.border,

          height: tabBarHeight,

          paddingTop: TAB_BAR_TOP_PAD,

          paddingBottom: tabBarBottomPad,
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
      {/* Visual order: Feed · Gangs · Gain · War · Profile */}
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",

          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
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
        name="index"
        options={{
          title: "Gain",
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <GainTabButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="war"
        options={{
          title: "War",

          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="sword-cross" size={size} color={color} />
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

          tabBarBadgeStyle: badgeStyle,

          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
