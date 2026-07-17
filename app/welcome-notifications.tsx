import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import {
  useCompletePostAuthNotifications,
  useNeedsCrewSetup,
  useNeedsPostAuthNotifications,
} from '@/hooks/use-onboarding';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

const SOCIAL_POINTS = [
  {
    icon: 'person-add-outline' as const,
    title: 'Follow friends',
    body: 'See their activity and cheer them on from their profile.',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Stay motivated',
    body: 'Get pokes, kudos, and gang updates when your crew needs you.',
  },
];

/**
 * First post-sign-in step for new accounts — enable push / social framing,
 * then continue to join/create crew.
 */
export default function WelcomeNotificationsScreen() {
  const t = useThemeTokens();
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsPostAuthNotifications, isLoading: notifLoading } =
    useNeedsPostAuthNotifications();
  const completeNotifications = useCompletePostAuthNotifications();
  const { permission, isRegistering, enablePushNotifications, refreshPermission } =
    usePushNotifications();
  const [error, setError] = useState<string | null>(null);
  const granted = permission === 'granted';

  useEffect(() => {
    if (authPending || crewLoading || notifLoading) return;
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (!needsCrewSetup) {
      router.replace('/');
      return;
    }
    if (!needsPostAuthNotifications) {
      router.replace('/welcome-crew');
    }
  }, [
    authPending,
    crewLoading,
    notifLoading,
    session,
    needsCrewSetup,
    needsPostAuthNotifications,
  ]);

  async function continueToCrew() {
    try {
      await completeNotifications.mutateAsync();
    } catch {
      // Still continue — they can enable notifications later in Settings.
    }
    router.replace('/welcome-crew');
  }

  async function handleEnable() {
    setError(null);
    const ok = await enablePushNotifications();
    if (ok) {
      await continueToCrew();
      return;
    }
    await refreshPermission();
    setError('Notifications are blocked. Open Settings to enable them, or tap Not now to continue.');
  }

  if (
    authPending ||
    crewLoading ||
    notifLoading ||
    !session ||
    !needsCrewSetup ||
    !needsPostAuthNotifications
  ) {
    return (
      <ScreenBackground>
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={[type.heading, { color: t.heading, fontSize: 28 }]}>Stay in the loop</Text>
          <Text style={[type.body, { color: t.body, marginTop: spacing.sm, lineHeight: 22 }]}>
            GainGang is better with your people. Follow friends and turn on push notifications so
            nudges and wins reach you.
          </Text>
        </View>

        <View style={styles.list}>
          {SOCIAL_POINTS.map((item) => (
            <GlassSurface key={item.title} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
                <Ionicons name={item.icon} size={22} color={t.accent} />
              </View>
              <View style={styles.copy}>
                <Text style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}>
                  {item.title}
                </Text>
                <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
                  {item.body}
                </Text>
              </View>
            </GlassSurface>
          ))}
        </View>

        {granted ? (
          <Text
            style={[
              type.bodySm,
              { color: t.accent, marginTop: spacing.md, fontFamily: fontFamily.bodySemi },
            ]}
          >
            Notifications enabled
          </Text>
        ) : null}
        {error ? (
          <Text style={[type.bodySm, { color: '#F87171', marginTop: spacing.md }]}>{error}</Text>
        ) : null}

        <View style={styles.footer}>
          {granted ? (
            <Button
              label="Continue"
              disabled={completeNotifications.isPending}
              onPress={() => void continueToCrew()}
            />
          ) : (
            <Button
              label={isRegistering ? 'Enabling…' : 'Enable notifications'}
              disabled={isRegistering || completeNotifications.isPending}
              onPress={() => void handleEnable()}
            />
          )}
          {error ? (
            <Button
              label="Open Settings"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          <Button
            label="Not now"
            variant="ghost"
            disabled={completeNotifications.isPending}
            onPress={() => void continueToCrew()}
          />
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
});
