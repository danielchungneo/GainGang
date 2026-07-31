import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import {
  useCompleteEquipmentPrompt,
  useNeedsCrewSetup,
  useNeedsEquipmentPrompt,
} from '@/hooks/use-onboarding';
import { useProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

/**
 * One-time post-OTA prompt for existing accounts to opt into pull-up bar /
 * weights access. New accounts that already set this during fitness skip it.
 */
export default function WelcomeEquipmentScreen() {
  const t = useThemeTokens();
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsEquipmentPrompt, isLoading: promptLoading } = useNeedsEquipmentPrompt();
  const { data: profile } = useProfile();
  const completePrompt = useCompleteEquipmentPrompt();

  const [hasPullUpBar, setHasPullUpBar] = useState(false);
  const [hasWeights, setHasWeights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!profile || hydrated) return;
    setHasPullUpBar(!!profile.has_pull_up_bar);
    setHasWeights(!!profile.has_weights);
    setHydrated(true);
  }, [profile, hydrated]);

  useEffect(() => {
    if (authPending || crewLoading || promptLoading) return;
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (needsCrewSetup) {
      router.replace('/');
      return;
    }
    if (!needsEquipmentPrompt) {
      router.replace('/(tabs)');
    }
  }, [
    authPending,
    crewLoading,
    promptLoading,
    session,
    needsCrewSetup,
    needsEquipmentPrompt,
  ]);

  async function finish(saveChoices: boolean) {
    setError(null);
    try {
      await completePrompt.mutateAsync(
        saveChoices
          ? { has_pull_up_bar: hasPullUpBar, has_weights: hasWeights }
          : undefined,
      );
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save equipment preferences');
    }
  }

  if (
    authPending ||
    crewLoading ||
    promptLoading ||
    !session ||
    needsCrewSetup ||
    !needsEquipmentPrompt
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
          <Text style={[type.heading, { color: t.heading, fontSize: 28 }]}>
            What gear do you have?
          </Text>
          <Text style={[type.body, { color: t.body, marginTop: spacing.sm, lineHeight: 22 }]}>
            Your gang can plan pull-ups and weighted work. Tell us what you can access — you can
            change this anytime in your profile.
          </Text>
        </View>

        <GlassSurface style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
              <Ionicons name="barbell-outline" size={22} color={t.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}>
                Pull-up bar
              </Text>
              <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
                Doorway bar, gym station, or similar.
              </Text>
            </View>
            <Switch
              value={hasPullUpBar}
              onValueChange={setHasPullUpBar}
              trackColor={{ true: t.accent }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: t.buttonBorder }]} />

          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
              <Ionicons name="fitness-outline" size={22} color={t.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}>
                Weights
              </Text>
              <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
                Dumbbells, kettlebells, or a weight rack.
              </Text>
            </View>
            <Switch
              value={hasWeights}
              onValueChange={setHasWeights}
              trackColor={{ true: t.accent }}
            />
          </View>
        </GlassSurface>

        {error ? (
          <Text style={[type.bodySm, { color: '#F87171', marginTop: spacing.md }]}>{error}</Text>
        ) : null}

        <View style={styles.footer}>
          <Button
            label="Continue"
            disabled={completePrompt.isPending}
            onPress={() => void finish(true)}
          />
          <Button
            label="Not now"
            variant="ghost"
            disabled={completePrompt.isPending}
            onPress={() => void finish(false)}
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
  card: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
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
