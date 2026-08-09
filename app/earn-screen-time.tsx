import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, GlassSurface, ScreenBackground } from '@/components/ui';
import { useExercises } from '@/hooks/use-exercises';
import { useScreenTimeLock } from '@/hooks/use-screen-time-lock';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useMyTodaysDailyGoals } from '@/hooks/use-weekly-plans';
import {
  buildDailyChunkOffers,
  buildQuickEarnOffers,
  formatRemainingBudget,
  type EarnOffer,
} from '@/lib/earn-screen-time';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';
import {
  DEV_TEST_UNLOCK_MINUTES,
  grantTemporaryScreenTime,
} from '@/lib/screen-time-lock';

/** Leave earn / rep-counter overlays and land on the normal Today tab. */
function returnToToday() {
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.replace('/(tabs)');
}

function startEarnOffer(offer: EarnOffer) {
  router.push({
    pathname: '/rep-counter',
    params: {
      mode: 'earn',
      exerciseId: offer.exerciseId,
      exerciseName: offer.exerciseName,
      unit: offer.unit,
      targetAmount: String(offer.targetAmount),
      unlockMinutes: String(offer.unlockMinutes),
      dailyGoalId: offer.dailyGoalId ?? '',
      dailyGoalExerciseId: offer.dailyGoalExerciseId ?? '',
      gangId: offer.gangId ?? '',
      category: offer.category ?? '',
    },
  });
}

function OfferRow({
  offer,
  disabled,
  onPress,
}: {
  offer: EarnOffer;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useThemeTokens();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}. ${offer.subtitle}`}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <GlassSurface
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 16, color: t.heading }}>
            {offer.title}
          </Text>
          <Text style={[type.bodySm, { color: t.body }]}>{offer.subtitle}</Text>
        </View>
        <View
          style={{
            backgroundColor: t.accent,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 12, color: t.accentOnPrimary }}>
            {offer.unlockMinutes}m
          </Text>
        </View>
      </GlassSurface>
    </TouchableOpacity>
  );
}

export default function EarnScreenTimeScreen() {
  const t = useThemeTokens();
  const params = useLocalSearchParams<{ grantedMinutes?: string }>();
  const grantedRaw = Array.isArray(params.grantedMinutes)
    ? params.grantedMinutes[0]
    : params.grantedMinutes;
  const grantedMinutes = Number(grantedRaw);
  const justGranted = Number.isFinite(grantedMinutes) && grantedMinutes > 0;

  const {
    supported,
    isReady,
    status,
    temporaryUnlockActive,
    temporaryUnlockRemainingSeconds,
    refreshTemporaryUnlock,
    lockNow,
    clearDayUnlockAndLock,
  } = useScreenTimeLock();

  const { data: goals, isLoading: goalsLoading } = useMyTodaysDailyGoals();
  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const cameraOk = isRepCounterNativeSupported();
  const [isTestUnlocking, setIsTestUnlocking] = useState(false);
  const [testUnlockError, setTestUnlockError] = useState<string | null>(null);

  useEffect(() => {
    refreshTemporaryUnlock();
  }, [refreshTemporaryUnlock, justGranted]);

  const dailyOffers = useMemo(
    () => buildDailyChunkOffers(goals ?? []),
    [goals],
  );
  const quickOffers = useMemo(
    () => buildQuickEarnOffers(exercises ?? [], goals ?? []),
    [exercises, goals],
  );

  const canEarn =
    supported &&
    Platform.OS === 'ios' &&
    (status === 'locked' || status === 'temporarily_unlocked') &&
    !temporaryUnlockActive;
  const isLoading = !isReady || goalsLoading || exercisesLoading;

  async function handleDevTestUnlock() {
    setTestUnlockError(null);
    setIsTestUnlocking(true);
    try {
      const grant = await grantTemporaryScreenTime(DEV_TEST_UNLOCK_MINUTES, {
        allowBelowMinimum: true,
      });
      if (!grant.unlocked) {
        setTestUnlockError(
          'Unlock failed — Focus lock must be on with apps currently locked.',
        );
        return;
      }
      refreshTemporaryUnlock();
      router.replace({
        pathname: '/earn-screen-time',
        params: { grantedMinutes: String(grant.minutes) },
      });
    } finally {
      setIsTestUnlocking(false);
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
      >
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => {
              if (justGranted || temporaryUnlockActive) {
                returnToToday();
                return;
              }
              if (router.canGoBack()) {
                router.back();
                return;
              }
              returnToToday();
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={[type.heading, { color: t.heading }]}>Earn screen time</Text>
        </View>

        {justGranted || temporaryUnlockActive ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 12, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 14, color: t.body }}>
              {justGranted ? 'Unlocked' : 'Time remaining'}
            </Text>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: 56,
                lineHeight: 62,
                color: t.accent,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatRemainingBudget(
                temporaryUnlockRemainingSeconds || (justGranted ? grantedMinutes * 60 : 0),
              )}
            </Text>
            <Text style={[type.bodySm, { color: t.body, textAlign: 'center' }]}>
              Restricted apps lock again when this timer hits zero. Finish all of
              today’s goals to unlock for the rest of the day.
            </Text>
            <View style={{ width: '100%', gap: 8, marginTop: 4 }}>
              <Button
                label="LOCK APPS NOW"
                onPress={() => {
                  void (async () => {
                    await lockNow();
                    returnToToday();
                  })();
                }}
              />
              <Button label="DONE" variant="secondary" onPress={returnToToday} />
            </View>
          </GlassSurface>
        ) : !supported || Platform.OS !== 'ios' ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 8 }}>
            <Text style={[type.bodySm, { color: t.heading }]}>
              Earn screen time uses Focus lock on iPhone only.
            </Text>
          </GlassSurface>
        ) : isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : status === 'unlocked_today' ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading, fontSize: 16 }}>
              Already unlocked today
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Your apps stay open for the rest of the day. Focus lock returns after
              midnight — open GainGang again tomorrow to check for exercises.
            </Text>
            {__DEV__ ? (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={[type.bodySm, { color: t.placeholder }]}>
                  Dev: if this is wrong (exercises still incomplete), clear the day
                  unlock stamp and force shields back on.
                </Text>
                <Button
                  label="CLEAR DAY UNLOCK + LOCK"
                  variant="secondary"
                  onPress={() => {
                    void (async () => {
                      await clearDayUnlockAndLock();
                    })();
                  }}
                />
              </View>
            ) : null}
          </GlassSurface>
        ) : status !== 'locked' && status !== 'temporarily_unlocked' ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading, fontSize: 16 }}>
              Focus lock is off
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Turn on Focus lock and pick apps under Settings to earn temporary
              unlocks mid-day.
            </Text>
            <Button
              label="FOCUS LOCK SETTINGS"
              variant="secondary"
              onPress={() => router.push('/settings-screen-time')}
            />
          </GlassSurface>
        ) : (
          <>
            {!cameraOk ? (
              <GlassSurface style={{ padding: spacing.md }}>
                <Text style={[type.bodySm, { color: t.body }]}>
                  Camera tracking requires a rebuild of the iOS/Android dev client.
                </Text>
              </GlassSurface>
            ) : null}

            <Text style={[type.label, { color: t.body }]}>From today’s plan</Text>
            {dailyOffers.length === 0 ? (
              <GlassSurface style={{ padding: spacing.md }}>
                <Text style={[type.bodySm, { color: t.body }]}>
                  No camera-trackable exercises left on today’s goals. Try a quick
                  earn below, or finish the rest of your plan manually.
                </Text>
              </GlassSurface>
            ) : (
              <View className="gap-2">
                {dailyOffers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    disabled={!canEarn || !cameraOk}
                    onPress={() => startEarnOffer(offer)}
                  />
                ))}
              </View>
            )}

            <Text style={[type.label, { color: t.body, marginTop: spacing.sm }]}>
              Quick earn
            </Text>
            {quickOffers.length === 0 ? (
              <GlassSurface style={{ padding: spacing.md }}>
                <Text style={[type.bodySm, { color: t.body }]}>
                  No matching exercises in the catalog right now.
                </Text>
              </GlassSurface>
            ) : (
              <View className="gap-2">
                {quickOffers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    disabled={!canEarn || !cameraOk}
                    onPress={() => startEarnOffer(offer)}
                  />
                ))}
              </View>
            )}

            <Text style={[type.bodySm, { color: t.placeholder, marginTop: 4 }]}>
              Each offer unlocks about 15 minutes of time in your restricted apps. Finish every
              required exercise to unlock for the full day.
            </Text>

            {__DEV__ && canEarn ? (
              <GlassSurface style={{ padding: spacing.md, gap: 8, marginTop: spacing.sm }}>
                <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading, fontSize: 14 }}>
                  Dev testing
                </Text>
                <Text style={[type.bodySm, { color: t.body }]}>
                  Skip the workout and unlock for {DEV_TEST_UNLOCK_MINUTES} minute.
                  Keep GainGang open (or return to it) to verify the timer and re-lock —
                  Apple’s background schedule still floors at 15 minutes.
                </Text>
                {testUnlockError ? (
                  <Text style={[type.bodySm, { color: '#F87171' }]}>{testUnlockError}</Text>
                ) : null}
                <Button
                  label={
                    isTestUnlocking
                      ? 'UNLOCKING…'
                      : `TEST UNLOCK ${DEV_TEST_UNLOCK_MINUTES} MIN`
                  }
                  variant="secondary"
                  disabled={isTestUnlocking}
                  onPress={() => {
                    void handleDevTestUnlock();
                  }}
                />
              </GlassSurface>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
