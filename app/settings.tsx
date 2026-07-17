import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AppVersionLabel } from "@/components/app-version-label";

import { GlassSurface, ScreenBackground } from "@/components/ui";

import { useAuth } from "@/context/auth-context";

import { usePushNotifications } from "@/hooks/use-push-notifications";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { spacing, type, useTheme } from "@/lib/gaingang-theme";

import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const t = useThemeTokens();

  const { mode, setMode } = useTheme();

  const { session } = useAuth();

  const {
    permission: pushPermission,
    isRegistering: isPushRegistering,
    enablePushNotifications,
  } = usePushNotifications();

  const [signingOut, setSigningOut] = useState(false);

  async function handleTogglePush(enabled: boolean) {
    if (!enabled) {
      Alert.alert(
        "Turn off alerts in system settings",
        "Open your phone's notification settings for GainGang to mute push alerts. In-app alerts still appear on your profile.",
      );
      return;
    }

    const ok = await enablePushNotifications();
    if (!ok && pushPermission === "denied") {
      Alert.alert(
        "Notifications blocked",
        "Enable notifications for GainGang in your phone's settings, then try again.",
      );
    }
  }

  async function handleSignOut() {
    setSigningOut(true);

    await supabase.auth.signOut();

    router.replace("/(auth)/sign-in");
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
      >
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={28} color={t.body} />
          </TouchableOpacity>

          <Text style={[type.heading, { color: t.heading }]}>Settings</Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 4 }}>
          <Text style={[type.labelSm, { color: t.body }]}>Account</Text>

          <Text
            style={[
              {
                fontFamily: type.body.fontFamily,
                fontSize: 16,
                color: t.heading,
              },
            ]}
          >
            {session?.user.email ?? "Not signed in"}
          </Text>
        </GlassSurface>

        <TouchableOpacity
          onPress={() => router.push("/edit-profile")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <GlassSurface
            style={{
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[type.labelSm, { color: t.body }]}>Profile</Text>
              <Text style={[type.bodySm, { color: t.heading }]}>
                Photo, name, bio
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.body} />
          </GlassSurface>
        </TouchableOpacity>

        <GlassSurface
          style={{
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.labelSm, { color: t.body }]}>Appearance</Text>

            <Text style={[type.bodySm, { color: t.heading }]}>
              {mode === "dark" ? "Dark mode" : "Light mode"}
            </Text>
          </View>

          <Switch
            value={mode === "dark"}
            onValueChange={(value) => setMode(value ? "dark" : "light")}
          />
        </GlassSurface>

        <GlassSurface
          style={{
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.labelSm, { color: t.body }]}>Push notifications</Text>
            <Text style={[type.bodySm, { color: t.heading }]}>
              {pushPermission === "unavailable"
                ? "Not available on this device"
                : pushPermission === "granted"
                  ? "On — kudos, comments, pokes, gang wins"
                  : pushPermission === "denied"
                    ? "Blocked in system settings"
                    : "Get notification on your device"}
            </Text>
          </View>

          {isPushRegistering ? (
            <ActivityIndicator color={t.accent} />
          ) : (
            <Switch
              value={pushPermission === "granted"}
              disabled={pushPermission === "unavailable"}
              onValueChange={(value) => {
                void handleTogglePush(value);
              }}
            />
          )}
        </GlassSurface>

        <TouchableOpacity
          style={
            mode === "light"
              ? styles.dangerButtonLight
              : styles.dangerButtonDark
          }
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator
              color={mode === "light" ? "#b91c1c" : "#f87171"}
            />
          ) : (
            <Text
              style={{ color: mode === "light" ? "#b91c1c" : "#f87171" }}
              className="font-semibold"
            >
              Sign out
            </Text>
          )}
        </TouchableOpacity>

        <GlassSurface style={{ padding: 20, gap: 4 }}>
          <Text style={[type.labelSm, { color: t.body }]}>App version</Text>
          <AppVersionLabel
            color={t.heading}
            style={{ textAlign: "left", opacity: 1 }}
          />
        </GlassSurface>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  dangerButtonLight: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",

    borderWidth: 1,

    borderColor: "rgba(239, 68, 68, 0.35)",

    borderRadius: 12,

    paddingVertical: 16,

    alignItems: "center",
  },

  dangerButtonDark: {
    backgroundColor: "rgba(248, 113, 113, 0.08)",

    borderWidth: 1,

    borderColor: "rgba(248, 113, 113, 0.35)",

    borderRadius: 12,

    paddingVertical: 16,

    alignItems: "center",
  },
});
