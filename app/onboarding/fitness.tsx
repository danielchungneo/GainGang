import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import {
  useSaveOnboardingEquipment,
  useSaveOnboardingFitnessLevel,
} from '@/hooks/use-onboarding';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import type { FitnessLevel } from '@/types';

const LEVELS: {
  value: FitnessLevel;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'beginner',
    title: 'Beginner',
    body: 'Getting started or coming back after a break.',
    icon: 'leaf-outline',
  },
  {
    value: 'intermediate',
    title: 'Intermediate',
    body: 'Comfortable with common movements and weekly volume.',
    icon: 'fitness-outline',
  },
  {
    value: 'advanced',
    title: 'Advanced',
    body: 'Training hard already — ready for tougher gang goals.',
    icon: 'flash-outline',
  },
];

export default function OnboardingFitnessScreen() {
  const t = useThemeTokens();
  const saveLevel = useSaveOnboardingFitnessLevel();
  const saveEquipment = useSaveOnboardingEquipment();
  const [selected, setSelected] = useState<FitnessLevel>('beginner');
  const [hasPullUpBar, setHasPullUpBar] = useState(false);
  const [hasWeights, setHasWeights] = useState(false);

  async function continueWith(level: FitnessLevel) {
    try {
      await saveLevel.mutateAsync(level);
      await saveEquipment.mutateAsync({
        has_pull_up_bar: hasPullUpBar,
        has_weights: hasWeights,
      });
    } catch {
      // Defaults remain; don't block onboarding.
    }
    router.push('/onboarding/demo');
  }

  const isPending = saveLevel.isPending || saveEquipment.isPending;

  return (
    <OnboardingShell
      step={2}
      title="What's your level?"
      subtitle="We'll use this to personalize goals. You can change it later."
      scrollContent
      footer={
        <Button
          label="Ready to Work!"
          disabled={isPending}
          onPress={() => void continueWith(selected)}
        />
      }
    >
      <View style={styles.list}>
        {LEVELS.map((level) => {
          const isSelected = selected === level.value;
          return (
            <Pressable
              key={level.value}
              onPress={() => setSelected(level.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <GlassSurface
                style={[
                  styles.card,
                  isSelected && {
                    borderWidth: 1.5,
                    borderColor: t.accent,
                  },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
                  <Ionicons name={level.icon} size={22} color={t.accent} />
                </View>
                <View style={styles.copy}>
                  <Text
                    style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}
                  >
                    {level.title}
                  </Text>
                  <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
                    {level.body}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSelected ? t.accent : t.placeholder}
                />
              </GlassSurface>
            </Pressable>
          );
        })}
      </View>

      <GlassSurface style={[styles.equipmentCard, { marginTop: spacing.lg }]}>
        <Text style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}>
          Equipment access
        </Text>
        <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
          Optional. Turn these on if you have a pull-up bar or weights — your gang can plan those
          exercises for you.
        </Text>
        <View style={styles.equipmentRow}>
          <Text style={[type.body, { color: t.heading, flex: 1 }]}>Pull-up bar</Text>
          <Switch
            value={hasPullUpBar}
            onValueChange={setHasPullUpBar}
            trackColor={{ true: t.accent }}
          />
        </View>
        <View style={styles.equipmentRow}>
          <Text style={[type.body, { color: t.heading, flex: 1 }]}>Weights</Text>
          <Switch
            value={hasWeights}
            onValueChange={setHasWeights}
            trackColor={{ true: t.accent }}
          />
        </View>
      </GlassSurface>

      <Text
        style={[
          type.bodySm,
          {
            color: t.placeholder,
            textAlign: 'center',
            fontStyle: 'italic',
            lineHeight: 20,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        &ldquo;You are always becoming the person you will become.&rdquo;
      </Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  equipmentCard: {
    padding: 16,
    gap: 12,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
