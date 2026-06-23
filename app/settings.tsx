import { Ionicons } from "@expo/vector-icons";

import { router } from "expo-router";

import { useState } from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { GlassSurface, ScreenBackground } from "@/components/ui";

import { useAuth } from "@/context/auth-context";

import { useThemeTokens } from "@/hooks/use-theme-tokens";

import { spacing, type, useTheme } from "@/lib/gaingang-theme";

import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const t = useThemeTokens();

  const { mode, setMode } = useTheme();

  const { session } = useAuth();

  const [signingOut, setSigningOut] = useState(false);

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
