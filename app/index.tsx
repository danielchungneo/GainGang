import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { consumePendingGangInvite } from '@/lib/gang-invite';

/**
 * Entry gate. Sends authenticated users to the main tabs (or a pending gang
 * invite) and everyone else to the sign-in flow.
 */
export default function AppIndex() {
  const { session, isPending } = useAuth();
  const [pendingInvite, setPendingInvite] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setPendingInvite(null);
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

  if (isPending || (session && pendingInvite === undefined)) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (pendingInvite) {
    return <Redirect href={`/invite/${pendingInvite}`} />;
  }

  return <Redirect href="/(tabs)" />;
}
