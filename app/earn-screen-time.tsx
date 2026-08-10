import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import {
  fontFamily,
  radius,
  spacing,
  type,
  useTheme,
} from '@/lib/gaingang-theme';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';
import {
  DEV_TEST_UNLOCK_MINUTES,
  grantTemporaryScreenTime,
} from '@/lib/screen-time-lock';

const GRID_GAP = 10;
const H_PAD = spacing.lg;
/** BlurView ignores % widths — compute equal tiles from the window. */
const TILE_WIDTH = Math.floor(
  (Dimensions.get('window').width - H_PAD * 2 - GRID_GAP) / 2,
);

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

function offerIcon(offer: EarnOffer): keyof typeof Ionicons.glyphMap {
  if (offer.unit === 'seconds') return 'timer-outline';
  const name = offer.exerciseName.toLowerCase();
  if (name.includes('push')) return 'fitness-outline';
  if (name.includes('squat')) return 'body-outline';
  if (name.includes('sit')) return 'accessibility-outline';
  return 'barbell-outline';
}

function SectionHeader({ label }: { label: string }) {
  const t = useThemeTokens();
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={[type.label, { color: t.body }]}>{label}</Text>
    </View>
  );
}

function RewardChip({ minutes }: { minutes: number }) {
  const t = useThemeTokens();
  return (
    <View
      style={{
        backgroundColor: t.accent,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.sm,
        minWidth: 44,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.monoBold,
          fontSize: 12,
          color: t.accentOnPrimary,
          letterSpacing: 0.4,
        }}
      >
        +{minutes}m
      </Text>
    </View>
  );
}

function OfferTile({
  offer,
  disabled,
  onPress,
}: {
  offer: EarnOffer;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const iconTint = theme.mode === 'dark' ? theme.colors.primaryGlow : t.accent;
  const isDaily = offer.kind === 'daily_chunk';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}. Earn ${offer.unlockMinutes} minutes`}
      style={({ pressed }) => [
        styles.tile,
        { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 },
      ]}
    >
      {/* Outer View owns the width — iOS BlurView does not honor flex/% sizing. */}
      <View style={styles.tileFrame}>
        <GlassSurface style={styles.tileSurface}>
          <View style={styles.tileTop}>
            <View
              style={[
                styles.iconWell,
                {
                  backgroundColor: isDaily
                    ? theme.mode === 'dark'
                      ? 'rgba(77,140,255,0.14)'
                      : 'rgba(47,109,255,0.10)'
                    : theme.mode === 'dark'
                      ? 'rgba(157,78,221,0.16)'
                      : 'rgba(123,47,222,0.10)',
                },
              ]}
            >
              <Ionicons name={offerIcon(offer)} size={20} color={iconTint} />
            </View>
            <RewardChip minutes={offer.unlockMinutes} />
          </View>

          <Text
            style={{
              fontFamily: fontFamily.bodySemi,
              fontSize: 15,
              color: t.heading,
            }}
            numberOfLines={2}
          >
            {offer.title}
          </Text>
        </GlassSurface>
      </View>
    </Pressable>
  );
}

function OfferGrid({
  offers,
  disabled,
  onPress,
}: {
  offers: EarnOffer[];
  disabled: boolean;
  onPress: (offer: EarnOffer) => void;
}) {
  const rows: EarnOffer[][] = [];
  for (let i = 0; i < offers.length; i += 2) {
    rows.push(offers.slice(i, i + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((o) => o.id).join('|')} style={styles.row}>
          {row.map((offer) => (
            <OfferTile
              key={offer.id}
              offer={offer}
              disabled={disabled}
              onPress={() => onPress(offer)}
            />
          ))}
          {row.length === 1 ? <View style={styles.tile} /> : null}
        </View>
      ))}
    </View>
  );
}

function EmptyOffersCard({ message }: { message: string }) {
  const t = useThemeTokens();
  return (
    <GlassSurface style={{ padding: spacing.md, gap: 8 }}>
      <Text style={[type.bodySm, { color: t.body }]}>{message}</Text>
    </GlassSurface>
  );
}

export default function EarnScreenTimeScreen() {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
  const showEarnOffers =
    status === 'locked' || status === 'temporarily_unlocked';

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

  function handleBack() {
    if (justGranted || temporaryUnlockActive) {
      returnToToday();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    returnToToday();
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingTop: Math.max(insets.top, spacing.md),
          paddingBottom: Math.max(insets.bottom, 40) + spacing.lg,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="chevron-back" size={28} color={t.body} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.heading, { color: t.heading, fontSize: 24 }]}>
              Earn screen time
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Quick sets unlock your apps for 15 minutes
            </Text>
          </View>
        </View>

        {justGranted || temporaryUnlockActive ? (
          <GlassSurface
            style={{
              padding: spacing.lg,
              gap: 16,
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={
                theme.mode === 'dark'
                  ? ['rgba(77,140,255,0.22)', 'rgba(157,78,221,0.10)', 'transparent']
                  : ['rgba(47,109,255,0.14)', 'rgba(123,47,222,0.08)', 'transparent']
              }
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 140,
              }}
            />
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(45,212,191,0.16)'
                    : 'rgba(45,212,191,0.14)',
              }}
            >
              <Ionicons name="lock-open" size={26} color="#2DD4BF" />
            </View>
            <Text style={[type.label, { color: t.body }]}>
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
                temporaryUnlockRemainingSeconds ||
                  (justGranted ? grantedMinutes * 60 : 0),
              )}
            </Text>
            <Text
              style={[
                type.bodySm,
                { color: t.body, textAlign: 'center', maxWidth: 280 },
              ]}
            >
              Restricted apps lock again when this hits zero. Finish today’s
              goals to stay unlocked for the rest of the day.
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
          <EmptyOffersCard message="Earn screen time uses Focus lock on iPhone only." />
        ) : isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : status === 'unlocked_today' ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(45,212,191,0.16)'
                    : 'rgba(45,212,191,0.14)',
              }}
            >
              <Ionicons name="checkmark-circle" size={26} color="#2DD4BF" />
            </View>
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                color: t.heading,
                fontSize: 18,
              }}
            >
              Already unlocked today
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              Your apps stay open for the rest of the day. Focus lock returns
              after midnight.
            </Text>
            {__DEV__ ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={[type.bodySm, { color: t.placeholder }]}>
                  Dev: clear the day unlock stamp and force shields back on.
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
        ) : !showEarnOffers ? (
          <GlassSurface style={{ padding: spacing.lg, gap: 12 }}>
            <Text
              style={{
                fontFamily: fontFamily.bodySemi,
                color: t.heading,
                fontSize: 18,
              }}
            >
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
            <GlassSurface style={{ overflow: 'hidden', padding: 0 }}>
              <LinearGradient
                colors={theme.aura}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md + 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                  }}
                >
                  <Ionicons name="phone-portrait-outline" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.mono,
                      fontSize: 11,
                      letterSpacing: 1.6,
                      color: 'rgba(255,255,255,0.78)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Each set unlocks
                  </Text>
                  <Text
                    style={{
                      fontFamily: fontFamily.display,
                      fontSize: 28,
                      lineHeight: 32,
                      color: '#FFFFFF',
                    }}
                  >
                    15 minutes
                  </Text>
                </View>
              </LinearGradient>
            </GlassSurface>

            {!cameraOk ? (
              <EmptyOffersCard message="Camera tracking requires a rebuild of the iOS/Android dev client." />
            ) : null}

            <SectionHeader label="From today’s plan" />
            {dailyOffers.length === 0 ? (
              <EmptyOffersCard message="Nothing left on today’s plan that the camera can track. Grab a quick earn below, or finish the rest manually." />
            ) : (
              <OfferGrid
                offers={dailyOffers}
                disabled={!canEarn || !cameraOk}
                onPress={startEarnOffer}
              />
            )}

            <SectionHeader label="Quick earn" />
            {quickOffers.length === 0 ? (
              <EmptyOffersCard message="No matching exercises in the catalog right now." />
            ) : (
              <OfferGrid
                offers={quickOffers}
                disabled={!canEarn || !cameraOk}
                onPress={startEarnOffer}
              />
            )}

            <Text
              style={[
                type.bodySm,
                { color: t.placeholder, textAlign: 'center', marginTop: 4 },
              ]}
            >
              Finish every required exercise to unlock for the full day.
            </Text>

            {__DEV__ && canEarn ? (
              <GlassSurface
                style={{ padding: spacing.md, gap: 8, marginTop: spacing.sm }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    color: t.heading,
                    fontSize: 14,
                  }}
                >
                  Dev testing
                </Text>
                <Text style={[type.bodySm, { color: t.body }]}>
                  Skip the workout and unlock for {DEV_TEST_UNLOCK_MINUTES}{' '}
                  minute. Keep GainGang open (or return to it) to verify the
                  timer and re-lock — Apple’s background schedule still floors
                  at 15 minutes.
                </Text>
                {testUnlockError ? (
                  <Text style={[type.bodySm, { color: '#F87171' }]}>
                    {testUnlockError}
                  </Text>
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

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    gap: GRID_GAP,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  tile: {
    width: TILE_WIDTH,
  },
  tileFrame: {
    width: TILE_WIDTH,
    height: 120,
  },
  tileSurface: {
    width: TILE_WIDTH,
    height: 120,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
