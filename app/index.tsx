import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';

/**
 * Entry gate. Sends authenticated users to the main tabs and everyone else to
 * the sign-in flow. Replace this logic with onboarding / feature-flag routing
 * as your app grows.
 */
export default function AppIndex() {
  const { session, isPending } = useAuth();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}
