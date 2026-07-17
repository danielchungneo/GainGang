import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { RewardReveal } from '@/components/reward-reveal';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import {
  getOnboardingDemoOption,
  ONBOARDING_DEMO_CONTEXT_ID,
  ONBOARDING_DEMO_OPTIONS,
  ONBOARDING_STARTER_XP,
  type OnboardingDemoOptionId,
} from '@/lib/onboarding';
import {
  buildRepCounterSessionKey,
  consumePendingRepCount,
} from '@/lib/rep-counting/pending-result';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';

const ONBOARDING_DEMO_REWARDS = [
  {
    label: 'XP BONUS',
    value: `+${ONBOARDING_STARTER_XP}`,
    icon: '✦',
    color: '#FFBD52',
  },
];

const DEMO_QUOTE =
  'I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.';

export default function OnboardingDemoScreen() {
  const t = useThemeTokens();
  const [selectedId, setSelectedId] = useState<OnboardingDemoOptionId>('pushup');
  const [completedByOption, setCompletedByOption] = useState<
    Partial<Record<OnboardingDemoOptionId, number>>
  >({});
  const [showReward, setShowReward] = useState(false);
  const nativeSupported = isRepCounterNativeSupported();

  const selected = getOnboardingDemoOption(selectedId);
  const completedOption = ONBOARDING_DEMO_OPTIONS.find(
    (option) => (completedByOption[option.id] ?? 0) >= option.targetReps,
  );
  const isComplete = !!completedOption;
  const completedReps = completedByOption[selectedId] ?? 0;

  useFocusEffect(
    useCallback(() => {
      const next: Partial<Record<OnboardingDemoOptionId, number>> = {};
      for (const option of ONBOARDING_DEMO_OPTIONS) {
        const sessionKey = buildRepCounterSessionKey(
          option.exerciseId,
          ONBOARDING_DEMO_CONTEXT_ID,
        );
        const pending = consumePendingRepCount(sessionKey);
        if (pending != null && pending >= option.targetReps) {
          next[option.id] = pending;
        }
      }
      if (Object.keys(next).length > 0) {
        setCompletedByOption((prev) => ({ ...prev, ...next }));
      }
    }, []),
  );

  function openCameraDemo() {
    if (!nativeSupported) {
      Alert.alert(
        'Dev client required',
        'Camera rep counting needs a custom Expo dev client with Vision Camera. Build one, or use a physical device with the GainGang native build.',
      );
      return;
    }

    router.push({
      pathname: '/rep-counter',
      params: {
        exerciseId: selected.exerciseId,
        exerciseName: selected.exerciseName,
        unit: 'reps',
        sessionKey: buildRepCounterSessionKey(
          selected.exerciseId,
          ONBOARDING_DEMO_CONTEXT_ID,
        ),
        contextId: ONBOARDING_DEMO_CONTEXT_ID,
        mode: 'onboarding',
        targetReps: String(selected.targetReps),
      },
    });
  }

  function handleDevBypass() {
    if (!__DEV__) return;
    setCompletedByOption((prev) => ({
      ...prev,
      [selectedId]: selected.targetReps,
    }));
  }

  function handleCollectReward() {
    setShowReward(true);
  }

  function handleRewardClaim() {
    setShowReward(false);
    router.push('/onboarding/auth');
  }

  return (
    <>
      <OnboardingShell
        step={3}
        title={isComplete ? 'Great work!' : 'Try camera counting'}
        subtitle={
          isComplete
            ? 'You just verified real reps with the camera. Collect your starter reward to continue.'
            : 'See GainGang in action — knock out a few reps and watch the camera count them for you. This is how every workout feels.'
        }
        footer={
          <>
            {isComplete ? (
              <Button label="Collect Reward" onPress={handleCollectReward} />
            ) : (
              <Button
                label={
                  completedReps > 0
                    ? `Resume ${selected.label}`
                    : `Start ${selected.label}`
                }
                onPress={openCameraDemo}
              />
            )}
            {__DEV__ && !nativeSupported ? (
              <Button
                label="Dev: mark demo complete"
                variant="ghost"
                onPress={handleDevBypass}
              />
            ) : null}
          </>
        }
      >
        <View style={styles.picker}>
          {ONBOARDING_DEMO_OPTIONS.filter((option) =>
            isComplete ? option.id === completedOption?.id : true,
          ).map((option) => {
            const isSelected = selectedId === option.id;
            const optionDone =
              (completedByOption[option.id] ?? 0) >= option.targetReps;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  if (!isComplete) setSelectedId(option.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected || optionDone }}
                disabled={isComplete}
              >
                <GlassSurface
                  style={[
                    styles.optionCard,
                    (isSelected || optionDone) && {
                      borderWidth: 1.5,
                      borderColor: t.accent,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
                    <Ionicons
                      name={option.id === 'pushup' ? 'barbell-outline' : 'body-outline'}
                      size={22}
                      color={t.accent}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text
                      style={[
                        type.body,
                        { color: t.heading, fontFamily: fontFamily.bodySemi },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 18 }]}
                    >
                      {option.body}
                    </Text>
                  </View>
                  {optionDone ? (
                    <Ionicons name="checkmark-circle" size={22} color={t.accent} />
                  ) : (
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={isSelected ? t.accent : t.placeholder}
                    />
                  )}
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>

        <GlassSurface style={styles.progressCard}>
          {isComplete && completedOption ? (
            <>
              <View style={[styles.celebrateBadge, { backgroundColor: `${t.accent}22` }]}>
                <Ionicons name="trophy" size={28} color={t.accent} />
              </View>
              <Text
                style={[
                  type.heading,
                  {
                    color: t.heading,
                    fontSize: 22,
                    textAlign: 'center',
                    fontFamily: fontFamily.bodySemi,
                  },
                ]}
              >
                Great work!
              </Text>
              <Text style={[type.bodySm, { color: t.body, textAlign: 'center', lineHeight: 20 }]}>
                {completedOption.label} verified. Tap Collect Reward to open your first GainGang
                drop.
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[type.bodySm, { color: t.placeholder, fontFamily: fontFamily.bodySemi }]}
              >
                Progress · {selected.label}
              </Text>
              <Text
                style={[
                  type.heading,
                  {
                    color: t.heading,
                    fontSize: 28,
                    fontFamily: fontFamily.bodySemi,
                  },
                ]}
              >
                {Math.min(completedReps, selected.targetReps)} / {selected.targetReps}
              </Text>
              <View style={styles.hintRow}>
                <Ionicons name="lock-closed-outline" size={16} color={t.placeholder} />
                <Text style={[type.bodySm, { color: t.placeholder, flex: 1, lineHeight: 18 }]}>
                  Complete either demo to continue. You&apos;ll see camera tips, then start
                  counting.
                </Text>
              </View>
            </>
          )}
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
              paddingHorizontal: spacing.sm,
            },
          ]}
        >
          &ldquo;{DEMO_QUOTE}&rdquo;
        </Text>
      </OnboardingShell>

      <Modal
        visible={showReward}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleRewardClaim}
      >
        <View style={styles.revealBackdrop}>
          <RewardReveal
            visible={showReward}
            tier="aura"
            kicker="DEMO COMPLETE"
            title="First Verified Reps"
            subtitle="Camera counting checked out. Claim your starter boost and create your account."
            claimLabel="CLAIM REWARD"
            emblemLevel={1}
            rewards={ONBOARDING_DEMO_REWARDS}
            onClaim={handleRewardClaim}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionCard: {
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
  optionCopy: {
    flex: 1,
  },
  progressCard: {
    padding: 18,
    gap: spacing.sm,
    alignItems: 'center',
  },
  celebrateBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  revealBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,7,15,0.92)',
  },
});
