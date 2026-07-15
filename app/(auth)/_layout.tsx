import { Stack, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { consumePendingGangInvite } from '@/lib/gang-invite';

export default function AuthLayout() {
  const { session, isPending } = useAuth();
  const [pendingInvite, setPendingInvite] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setPendingInvite(undefined);
      return;
    }

    let cancelled = false;
    void consumePendingGangInvite().then((code) => {
      if (!cancelled) setPendingInvite(code);
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (isPending) return null;

  if (session) {
    if (pendingInvite === undefined) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      );
    }
    if (pendingInvite) return <Redirect href={`/invite/${pendingInvite}`} />;
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
