import "../global.css";

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";

import * as SplashScreen from "expo-splash-screen";

import { useEffect } from "react";

import { LogBox } from "react-native";

import "react-native-reanimated";

import { AuthProvider } from "@/context/auth-context";

import { QueryProvider } from "@/context/query-client";

import { GainGangProvider, useGainGangFonts, useTheme } from "@/lib/gaingang-theme";

import { useColorScheme } from "@/hooks/use-color-scheme";

SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

export const unstable_settings = {
  anchor: "index",
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />

        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen name="gang/[id]" options={{ headerShown: false }} />

        <Stack.Screen
          name="gang/create"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="gang/join"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="gang/new-goal"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="gang/edit"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="log-daily-goal"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="log-activity"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen
          name="rep-counter"
          options={{ presentation: "fullScreenModal", headerShown: false }}
        />

        <Stack.Screen name="activity/[id]" options={{ headerShown: false }} />

        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const fontsLoaded = useGainGangFonts();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryProvider>
      <AuthProvider>
        <GainGangProvider followSystem>
          <RootNavigator />
        </GainGangProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
