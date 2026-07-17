import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GainGangLogo } from '@/brand';
import { AuthDivider } from '@/components/google-sign-in-button';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useCompletePreAuthOnboarding } from '@/hooks/use-onboarding';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

/**
 * Final pre-auth onboarding step — create an account (or sign in).
 * Marks the device tour complete when the user chooses an auth path.
 */
export default function OnboardingAuthScreen() {
  const t = useThemeTokens();
  const completePreAuth = useCompletePreAuthOnboarding();

  async function goToAuth(href: '/(auth)/sign-up' | '/(auth)/sign-in') {
    // Navigate first so the onboarding layout doesn't bounce to sign-in mid-tap.
    if (href === '/(auth)/sign-up') {
      router.replace({ pathname: '/(auth)/sign-up', params: { claimReward: '1' } });
    } else {
      router.replace(href);
    }
    void completePreAuth.mutateAsync();
  }

  return (
    <OnboardingShell
      step={4}
      title="Claim your reward"
      subtitle="Create a free account to lock in your starter boost and start training with your Gang."
    >
      <View style={styles.body}>
        <GlassSurface style={styles.card}>
          <View style={styles.logoWrap}>
            <GainGangLogo size="sm" />
          </View>
          <Text style={[type.heading, { color: t.heading, fontSize: 22, textAlign: 'center' }]}>
            Your first win is waiting
          </Text>
          <Text style={[type.bodySm, { color: t.body, textAlign: 'center', lineHeight: 21 }]}>
            Sign up to claim the reward you just earned, track every rep, and turn today&apos;s
            momentum into a streak with friends.
          </Text>
          <View style={[styles.quoteBlock, { borderColor: t.buttonBorder }]}>
            <Text
              style={[
                type.body,
                {
                  color: t.heading,
                  textAlign: 'center',
                  fontFamily: fontFamily.bodySemi,
                  fontStyle: 'italic',
                  lineHeight: 22,
                },
              ]}
            >
              &ldquo;The only bad workout is the one that didn&apos;t happen.&rdquo;
            </Text>
          </View>
        </GlassSurface>

        <View style={styles.actions}>
          <Button
            label="Create Account & Claim"
            disabled={completePreAuth.isPending}
            onPress={() => void goToAuth('/(auth)/sign-up')}
          />
          <AuthDivider />
          <Button
            label="I already have an account"
            variant="secondary"
            disabled={completePreAuth.isPending}
            onPress={() => void goToAuth('/(auth)/sign-in')}
          />
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  card: {
    padding: 22,
    gap: spacing.sm,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: spacing.xs,
  },
  quoteBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  actions: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
