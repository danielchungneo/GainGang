import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useSaveOnboardingFitnessLevel } from '@/hooks/use-onboarding';
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
  const [selected, setSelected] = useState<FitnessLevel>('beginner');

  async function continueWith(level: FitnessLevel) {
    try {
      await saveLevel.mutateAsync(level);
    } catch {
      // Default remains on profile; don't block onboarding.
    }
    router.push('/onboarding/demo');
  }

  return (
    <OnboardingShell
      step={2}
      title="What's your level?"
      subtitle="We'll use this to personalize goals. You can change it later."
      footer={
        <Button
          label="Ready to Work!"
          disabled={saveLevel.isPending}
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
});
