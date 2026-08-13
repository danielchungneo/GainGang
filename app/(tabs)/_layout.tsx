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

import { useNeedsGangWarAttempts } from "@/hooks/use-gang-wars";

import { status, useTheme } from "@/lib/gaingang-theme";

const TAB_BAR_CONTENT_HEIGHT = 58;
const TAB_BAR_TOP_PAD = 8;
const TAB_BAR_BOTTOM_PAD = 4;

/** Per-tab active accents — Shop gold + War dark red are intentional brand picks. */
const TAB_ACTIVE = {
  feed: "#4D8CFF",
  gangs: "#8B6CFF",
  war: "#A31828",
  shop: "#F5A524",
} as const;

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, isPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsPostAuthNotifications, isLoading: notifLoading } =
    useNeedsPostAuthNotifications();
  const { needsFocusLockIntro, isLoading: focusIntroLoading } = useNeedsFocusLockIntro();
  const { needsEquipmentPrompt, isLoading: equipmentLoading } = useNeedsEquipmentPrompt();
  const needsWarAttempts = useNeedsGangWarAttempts();

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
      {/* Visual order: Feed · Gangs · Gain · War · Shop */}
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarActiveTintColor: TAB_ACTIVE.feed,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "newspaper" : "newspaper-outline"}
              size={size}
              color={focused ? TAB_ACTIVE.feed : color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: "Gangs",
          tabBarActiveTintColor: TAB_ACTIVE.gangs,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={size}
              color={focused ? TAB_ACTIVE.gangs : color}
            />
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
          tabBarActiveTintColor: TAB_ACTIVE.war,
          tabBarBadge: needsWarAttempts ? "" : undefined,
          tabBarBadgeStyle: badgeStyle,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="sword-cross"
              size={size}
              color={focused ? TAB_ACTIVE.war : color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarActiveTintColor: TAB_ACTIVE.shop,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "storefront" : "storefront-outline"}
              size={size}
              color={focused ? TAB_ACTIVE.shop : color}
            />
          ),
        }}
      />

      {/* Reachable via Profile HUD — not shown in the tab bar. */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
