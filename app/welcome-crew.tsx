import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthDivider } from '@/components/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import {
  useApplyPendingFitnessLevel,
  useCompleteCrewSetup,
  useNeedsCrewSetup,
} from '@/hooks/use-onboarding';
import { useGangInvitePreview } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { consumePendingGangInvite, peekPendingGangInvite } from '@/lib/gang-invite';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

/**
 * First screen after sign-up for new accounts: create or join a Gang.
 * Also surfaces pending SMS invite links when present.
 */
export default function WelcomeCrewScreen() {
  const t = useThemeTokens();
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const completeCrewSetup = useCompleteCrewSetup();
  useApplyPendingFitnessLevel();

  const [pendingCode, setPendingCode] = useState<string | null | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void peekPendingGangInvite().then((code) => {
      if (!cancelled) setPendingCode(code);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authPending || crewLoading) return;
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (!needsCrewSetup) {
      router.replace('/');
    }
  }, [authPending, crewLoading, session, needsCrewSetup]);

  const inviteCode = pendingCode ?? '';
  const { data: preview, isLoading: previewLoading } = useGangInvitePreview(inviteCode);

  async function finishAndGo(destination: 'invite' | 'create' | 'join' | 'tabs') {
    setActionError(null);
    try {
      await completeCrewSetup.mutateAsync({});

      if (destination === 'invite' && pendingCode) {
        await consumePendingGangInvite();
        router.replace(`/invite/${pendingCode}`);
        return;
      }

      if (destination === 'tabs') {
        router.replace('/(tabs)');
        return;
      }

      if (pendingCode) await consumePendingGangInvite();

      if (destination === 'create') {
        router.replace('/gang/create');
        return;
      }
      router.replace('/gang/join');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not continue');
    }
  }

  if (authPending || crewLoading || pendingCode === undefined || !session || !needsCrewSetup) {
    return (
      <ScreenBackground>
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  const hasInvite = !!pendingCode;

  return (
    <ScreenBackground>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={[type.heading, { color: t.heading, fontSize: 28 }]}>Join your crew</Text>
          <Text style={[type.body, { color: t.body, marginTop: spacing.sm, lineHeight: 22 }]}>
            {hasInvite
              ? 'You were invited to a Gang. Join it to start working out together.'
              : 'Create a Gang or join one to start working out. Training alone can wait — the Gang is the game.'}
          </Text>
        </View>

        <View style={styles.body}>
          <GlassSurface style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
              <Ionicons name="people" size={28} color={t.accent} />
            </View>
            {hasInvite ? (
              <>
                <Text
                  style={[type.heading, { color: t.heading, fontSize: 20, textAlign: 'center' }]}
                >
                  {previewLoading ? 'Loading invite…' : preview?.name ?? 'Gang invite'}
                </Text>
                {preview?.description ? (
                  <Text
                    style={[type.bodySm, { color: t.body, textAlign: 'center', lineHeight: 20 }]}
                  >
                    {preview.description}
                  </Text>
                ) : (
                  <Text
                    style={[type.bodySm, { color: t.body, textAlign: 'center', lineHeight: 20 }]}
                  >
                    Accept your invite to unlock shared daily goals with your crew.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text
                  style={[type.heading, { color: t.heading, fontSize: 20, textAlign: 'center' }]}
                >
                  Gangs unlock the fun
                </Text>
                <Text style={[type.bodySm, { color: t.body, textAlign: 'center', lineHeight: 20 }]}>
                  Shared weekly plans, leaderboards, and pokes only kick in once you&apos;re in a
                  Gang.
                </Text>
              </>
            )}
            <View style={[styles.inviteTip, { borderColor: t.buttonBorder }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.accent} />
              <Text style={[type.bodySm, { color: t.body, flex: 1, lineHeight: 18 }]}>
                Invited over text? Open the invite link in that message to join the Gang you were
                invited to.
              </Text>
            </View>
          </GlassSurface>

          <View style={styles.actions}>
            <View style={styles.primaryActions}>
              {hasInvite ? (
                <Button
                  label={
                    completeCrewSetup.isPending
                      ? 'Joining…'
                      : preview?.name
                        ? `Join ${preview.name}`
                        : 'Join your Gang'
                  }
                  disabled={completeCrewSetup.isPending || previewLoading}
                  onPress={() => void finishAndGo('invite')}
                />
              ) : (
                <>
                  <Button
                    label="Create a Gang"
                    disabled={completeCrewSetup.isPending}
                    onPress={() => void finishAndGo('create')}
                  />
                  <AuthDivider />
                  <Button
                    label="Join a Gang"
                    disabled={completeCrewSetup.isPending}
                    onPress={() => void finishAndGo('join')}
                  />
                </>
              )}
              {actionError ? (
                <Text style={[type.bodySm, { color: '#F87171', textAlign: 'center' }]}>
                  {actionError}
                </Text>
              ) : null}
            </View>

            <View style={styles.laterBlock}>
              <View style={[styles.laterLine, { backgroundColor: t.buttonBorder }]} />
              <View style={styles.laterWrap}>
                <Button
                  label="I'll do this later"
                  variant="ghost"
                  disabled={completeCrewSetup.isPending}
                  onPress={() => void finishAndGo('tabs')}
                />
              </View>
            </View>
          </View>
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
  body: {
    flex: 1,
  },
  inviteTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  actions: {
    flex: 1,
  },
  primaryActions: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  laterBlock: {
    gap: spacing.sm,
  },
  laterWrap: {
    alignItems: 'center',
  },
  laterLine: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  card: {
    padding: 22,
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
