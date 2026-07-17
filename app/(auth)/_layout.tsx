import { Stack, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';

export default function AuthLayout() {
  const { session, isPending } = useAuth();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Let the root gate send new accounts to welcome-crew.
  if (session) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
