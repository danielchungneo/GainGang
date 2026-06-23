import "../global.css";

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";

import * as SplashScreen from "expo-splash-screen";

import { StatusBar } from "expo-status-bar";

import { useEffect } from "react";

import { LogBox } from "react-native";

import "react-native-reanimated";

import { AuthProvider } from "@/context/auth-context";

import { QueryProvider } from "@/context/query-client";

import { GainGangProvider, useGainGangFonts } from "@/lib/gaingang-theme";

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

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />

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
          name="log-activity"
          options={{ presentation: "modal", headerShown: false }}
        />

        <Stack.Screen name="activity/[id]" options={{ headerShown: false }} />

        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>

      <StatusBar style="auto" />
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
