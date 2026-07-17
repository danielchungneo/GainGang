import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GainGangLogo } from '@/brand';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

const VALUE_PROPS = [
  {
    icon: 'people' as const,
    title: 'Train with your Gang',
    body: 'Shared weekly goals keep everyone accountable together.',
  },
  {
    icon: 'flame' as const,
    title: 'Build streaks & level up',
    body: 'Hit daily targets, earn XP, and climb the leaderboard.',
  },
  {
    icon: 'camera' as const,
    title: 'Camera counts your reps',
    body: 'Point your phone and let GainGang verify your form and volume.',
  },
];

export default function OnboardingWelcomeScreen() {
  const t = useThemeTokens();

  return (
    <OnboardingShell
      step={1}
      title="Welcome to GainGang"
      subtitle="The social workout app that turns daily goals into a team game."
      footer={
        <Button label="Let's Go!" onPress={() => router.push('/onboarding/fitness')} />
      }
    >
      <View style={styles.logoWrap}>
        <GainGangLogo size="md" />
      </View>

      <View style={styles.list}>
        {VALUE_PROPS.map((item) => (
          <GlassSurface key={item.title} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
              <Ionicons name={item.icon} size={22} color={t.accent} />
            </View>
            <View style={styles.cardCopy}>
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

      <Text
        style={[
          type.bodySm,
          {
            color: t.placeholder,
            textAlign: 'center',
            fontStyle: 'italic',
            lineHeight: 20,
            marginTop: spacing.lg,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        &ldquo;Success is the sum of small efforts, repeated day in and day out.&rdquo;
      </Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
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
  cardCopy: {
    flex: 1,
  },
});
