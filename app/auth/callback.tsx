import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { completeOAuthFromUrl } from '@/lib/google-auth';
import { useTheme } from '@/lib/gaingang-theme';

/** Handles OAuth deep links when the app is opened from a Google redirect. */
export default function AuthCallbackScreen() {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          if (!cancelled) router.replace('/(auth)/sign-in');
          return;
        }

        await completeOAuthFromUrl(url);
        if (!cancelled) router.replace('/');
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Sign-in could not be completed.';
        setError(message);
        setTimeout(() => router.replace('/(auth)/sign-in'), 2000);
      }
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: theme.colors.bg }}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {error ? (
        <Text style={{ color: theme.colors.textDim, marginTop: 16, textAlign: 'center' }}>{error}</Text>
      ) : null}
    </View>
  );
}
