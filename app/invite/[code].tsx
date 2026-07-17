import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { GangBanner } from '@/components/ui/gang-banner';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import { useGangInvitePreview, useJoinGang } from '@/hooks/use-gangs';
import {
  useCompleteCrewSetup,
  useNeedsCrewSetup,
  useNeedsPreAuthOnboarding,
} from '@/hooks/use-onboarding';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { savePendingGangInvite } from '@/lib/gang-invite';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

export default function GangInviteScreen() {
  const t = useThemeTokens();
  const { session, isPending: authPending } = useAuth();
  const { needsPreAuthOnboarding, isLoading: preAuthLoading } = useNeedsPreAuthOnboarding();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const completeCrewSetup = useCompleteCrewSetup();
  const { code: codeParam } = useLocalSearchParams<{ code: string }>();
  const inviteCode =
    (Array.isArray(codeParam) ? codeParam[0] : codeParam)?.trim().toUpperCase() ?? '';

  const [error, setError] = useState<string | null>(null);
  const { data: preview, isLoading, isError, error: previewError } =
    useGangInvitePreview(inviteCode);
  const joinGang = useJoinGang();

  useEffect(() => {
    if (authPending || preAuthLoading || crewLoading) return;
    if (!inviteCode) return;

    // Unauthenticated: save invite, then onboarding tour or sign-in.
    if (!session) {
      void savePendingGangInvite(inviteCode).then(() => {
        if (needsPreAuthOnboarding) router.replace('/onboarding');
        else router.replace('/(auth)/sign-in');
      });
    }
  }, [
    authPending,
    preAuthLoading,
    crewLoading,
    session,
    inviteCode,
    needsPreAuthOnboarding,
  ]);

  async function handleJoin() {
    setError(null);
    try {
      const gang = await joinGang.mutateAsync(inviteCode);
      if (needsCrewSetup) {
        try {
          await completeCrewSetup.mutateAsync({});
        } catch {
          // Joined successfully; crew flag can be fixed on next gate pass.
        }
      }
      router.replace({ pathname: '/(tabs)/groups', params: { gangId: gang.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join Gang');
    }
  }

  function handleDecline() {
    if (needsCrewSetup) {
      router.replace('/welcome-crew');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/groups');
  }

  if (authPending || preAuthLoading || crewLoading || !session) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  if (!inviteCode) {
    return (
      <ScreenBackground>
        <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1, justifyContent: 'center' }}>
          <GlassSurface style={{ padding: 20, gap: 12 }}>
            <Text style={[type.heading, { color: t.heading, fontSize: 22 }]}>Invalid invite</Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              This invite link is missing or incomplete. Ask your friend to send a new one.
            </Text>
            <TouchableOpacity
              onPress={handleDecline}
              className="mt-2 items-center rounded-xl py-3"
              style={{ backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentOnPrimary, fontFamily: fontFamily.bodySemi }}>
                Back to Gangs
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={{ padding: spacing.lg, gap: spacing.md, flex: 1, paddingTop: spacing.xl }}>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={handleDecline} accessibilityLabel="Close invite">
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={[type.heading, { color: t.heading, fontSize: 22, flex: 1 }]}>
            Gang invite
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : isError || !preview ? (
          <GlassSurface style={{ padding: 20, gap: 12 }}>
            <Text style={[type.heading, { color: t.heading, fontSize: 20 }]}>
              Invite not found
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              {previewError instanceof Error
                ? previewError.message
                : 'This invite may be invalid or expired.'}
            </Text>
            <TouchableOpacity
              onPress={handleDecline}
              className="mt-2 items-center rounded-xl py-3"
              style={{ backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentOnPrimary, fontFamily: fontFamily.bodySemi }}>
                Back to Gangs
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        ) : preview.already_member ? (
          <GlassSurface style={{ padding: 20, gap: 14 }}>
            <GangPreviewCard
              bannerUrl={preview.banner_url}
              name={preview.name}
              description={preview.description}
              memberCount={preview.member_count}
            />
            <Text style={[type.bodySm, { color: t.body }]}>You&apos;re already in this gang.</Text>
            <TouchableOpacity
              onPress={() =>
                router.replace({ pathname: '/(tabs)/groups', params: { gangId: preview.id } })
              }
              className="items-center rounded-xl py-3"
              style={{ backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentOnPrimary, fontFamily: fontFamily.bodySemi }}>
                Open gang
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        ) : (
          <GlassSurface style={{ padding: 20, gap: 16 }}>
            <Text style={[type.bodySm, { color: t.body }]}>
              You&apos;ve been invited to join this crew. Confirm to hop in, or pass for now.
            </Text>

            <GangPreviewCard
              bannerUrl={preview.banner_url}
              name={preview.name}
              description={preview.description}
              memberCount={preview.member_count}
            />

            {error ? <Text style={{ color: '#ef4444', fontSize: 13 }}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleJoin}
              disabled={joinGang.isPending}
              className="items-center rounded-xl py-3.5"
              style={{ backgroundColor: t.accent, opacity: joinGang.isPending ? 0.7 : 1 }}
            >
              {joinGang.isPending ? (
                <ActivityIndicator color={t.accentOnPrimary} />
              ) : (
                <Text style={{ color: t.accentOnPrimary, fontFamily: fontFamily.bodySemi }}>
                  Join {preview.name}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDecline}
              disabled={joinGang.isPending}
              className="items-center rounded-xl py-3.5"
              style={{
                backgroundColor: t.buttonBg,
                borderWidth: 1,
                borderColor: t.buttonBorder,
              }}
            >
              <Text style={{ color: t.heading, fontFamily: fontFamily.bodySemi }}>Not now</Text>
            </TouchableOpacity>
          </GlassSurface>
        )}
      </View>
    </ScreenBackground>
  );
}

function GangPreviewCard({
  bannerUrl,
  name,
  description,
  memberCount,
}: {
  bannerUrl: string | null;
  name: string;
  description: string | null;
  memberCount: number;
}) {
  const t = useThemeTokens();

  return (
    <View className="gap-3">
      <GangBanner uri={bannerUrl} name={name} />
      <View className="gap-1">
        <Text style={{ color: t.heading, fontFamily: fontFamily.bodySemi, fontSize: 20 }}>
          {name}
        </Text>
        <Text style={[type.bodySm, { color: t.body }]}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
      {description ? (
        <Text style={[type.bodySm, { color: t.body, lineHeight: 20 }]}>{description}</Text>
      ) : null}
    </View>
  );
}
