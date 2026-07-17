import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useNeedsPreAuthOnboarding } from '@/hooks/use-onboarding';

/**
 * Pre-auth product tour. No session required.
 * Authenticated users are sent back to the root gate.
 */
export default function OnboardingLayout() {
  const { session, isPending: authPending } = useAuth();
  const { needsPreAuthOnboarding, isLoading } = useNeedsPreAuthOnboarding();

  if (authPending || isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Already signed in — root gate decides crew setup vs tabs.
  if (session) return <Redirect href="/" />;

  // Tour already finished on this device — go sign in / sign up.
  if (!needsPreAuthOnboarding) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="fitness" />
      <Stack.Screen name="demo" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}
