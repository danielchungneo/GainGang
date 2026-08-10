import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GangBannerWithDivisionBorder } from '@/components/gang-banner-with-division-border';
import { GangWarMatchupOverlay } from '@/components/gang-war-matchup-overlay';
import { GangWarResultOverlay } from '@/components/gang-war-result-overlay';
import { GangSelector } from '@/components/gang-selector';
import { Button, GlassSurface, ScreenBackground } from '@/components/ui';
import { useMyGangs } from '@/hooks/use-gangs';
import {
  useGangWarHistory,
  useGangWarState,
  useMarkGangWarSeen,
} from '@/hooks/use-gang-wars';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  isWarDivision,
  WAR_DIVISION_LABELS,
} from '@/lib/gang-wars/divisions';
import { fontFamily, spacing, useTheme } from '@/lib/gaingang-theme';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';
import type { WarDivision } from '@/types';

function divisionLabel(value: string | null | undefined): string {
  if (isWarDivision(value)) return WAR_DIVISION_LABELS[value];
  return value ? value : 'Iron';
}

function weekdayName(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
  });
}

function weekRangeLabel(startsOn: string, endsOn: string): string {
  const start = new Date(`${startsOn}T12:00:00`);
  const end = new Date(`${endsOn}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export default function WarScreen() {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs } = useMyGangs();
  const [selectedGangId, setSelectedGangId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const gangId = selectedGangId ?? gangs?.[0]?.id;
  const selectedGang = gangs?.find((g) => g.id === gangId);

  useEffect(() => {
    if (!selectedGangId && gangs?.[0]?.id) setSelectedGangId(gangs[0].id);
  }, [gangs, selectedGangId]);

  const { data: war, isLoading: warLoading, refetch: refetchWar } = useGangWarState(gangId);
  const { data: history, refetch: refetchHistory } = useGangWarHistory(
    showHistory ? gangId : undefined,
  );
  const markSeen = useMarkGangWarSeen();
  const cameraOk = isRepCounterNativeSupported();

  const refreshAll = async () => {
    await Promise.all([
      refetchGangs(),
      refetchWar(),
      showHistory ? refetchHistory() : Promise.resolve(),
    ]);
  };
  const { isRefreshing, onRefresh } = usePullToRefresh(refreshAll);

  const todayDay = useMemo(
    () => war?.match?.days.find((d) => d.is_today),
    [war?.match?.days],
  );

  const leading =
    war?.match != null
      ? Number(war.match.our_score) === Number(war.match.their_score)
        ? 'tie'
        : Number(war.match.our_score) > Number(war.match.their_score)
          ? 'us'
          : 'them'
      : null;

  const pendingResult = war?.pending_result ?? null;
  const showResultOverlay = !!pendingResult && !!gangId;
  const showVsOverlay =
    !showResultOverlay &&
    war?.state === 'active' &&
    !!war.match &&
    !war.match.vs_seen &&
    !!gangId;

  function startToday() {
    if (!war?.match || !todayDay || !gangId) return;
    router.push({
      pathname: '/rep-counter',
      params: {
        mode: 'gang_war',
        gangWarMatchId: war.match.id,
        gangId,
        exerciseId: todayDay.exercise_id,
        exerciseName: todayDay.exercise_name,
        unit: todayDay.unit === 'seconds' ? 'seconds' : 'reps',
        timeLimitSeconds: '60',
      },
    });
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 56,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-end justify-between">
          <View style={{ gap: 4 }}>
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: 30,
                color: t.heading,
                letterSpacing: 0.3,
              }}
            >
              Gang Wars
            </Text>
            {war?.match ? (
              <Text style={{ color: t.placeholder, fontSize: 13 }}>
                {weekRangeLabel(war.match.starts_on, war.match.ends_on)} ·{' '}
                {divisionLabel(war.match.division)}
              </Text>
            ) : (
              <Text style={{ color: t.placeholder, fontSize: 13 }}>
                Weekly division battles
              </Text>
            )}
          </View>
          {gangId ? (
            <Pressable
              onPress={() => setShowHistory((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Toggle war history"
              hitSlop={8}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: showHistory
                  ? 'rgba(77,140,255,0.16)'
                  : theme.colors.surface,
                borderWidth: 1,
                borderColor: showHistory
                  ? 'rgba(77,140,255,0.35)'
                  : theme.colors.border,
              }}
            >
              <Text style={{ color: t.accent, fontFamily: fontFamily.bodySemi, fontSize: 13 }}>
                {showHistory ? 'Live' : 'History'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {gangsLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : !gangs || gangs.length === 0 ? (
          <GlassSurface style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 18, color: t.heading }}>
              Join a Gang to go to War
            </Text>
            <Text style={{ color: t.body, lineHeight: 20 }}>
              Create or join a gang to get matched each week in your division.
            </Text>
            <Button label="FIND A GANG" onPress={() => router.push('/(tabs)/groups')} />
          </GlassSurface>
        ) : (
          <>
            <GangSelector
              gangs={gangs}
              selectedId={gangId!}
              onSelect={setSelectedGangId}
            />

            {showHistory ? (
              <View style={{ gap: spacing.sm }}>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    color: t.heading,
                    fontSize: 15,
                    letterSpacing: 0.4,
                  }}
                >
                  Past wars
                </Text>
                {(history ?? []).length === 0 ? (
                  <GlassSurface style={{ padding: spacing.lg }}>
                    <Text style={{ color: t.body, textAlign: 'center' }}>
                      No past wars yet.
                    </Text>
                  </GlassSurface>
                ) : (
                  (history ?? []).map((row) => (
                    <GlassSurface
                      key={row.match_id}
                      style={{ padding: spacing.md, gap: 8 }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          style={{
                            fontFamily: fontFamily.bodySemi,
                            color: t.heading,
                            flex: 1,
                            fontSize: 15,
                          }}
                          numberOfLines={1}
                        >
                          vs {row.opponent_name}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: row.won
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(239,68,68,0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: fontFamily.bodySemi,
                              fontSize: 11,
                              letterSpacing: 0.8,
                              color: row.won ? '#22c55e' : '#ef4444',
                            }}
                          >
                            {row.won ? 'WIN' : 'LOSS'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: t.placeholder, fontSize: 12 }}>
                        {divisionLabel(row.division)} ·{' '}
                        {weekRangeLabel(row.starts_on, row.ends_on)}
                      </Text>
                      <Text
                        style={{
                          color: t.heading,
                          fontFamily: fontFamily.display,
                          fontSize: 20,
                        }}
                      >
                        {Math.round(Number(row.our_score ?? 0))}
                        <Text style={{ color: t.placeholder, fontSize: 16 }}> – </Text>
                        {Math.round(Number(row.their_score ?? 0))}
                      </Text>
                    </GlassSurface>
                  ))
                )}
              </View>
            ) : warLoading ? (
              <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
            ) : war?.state === 'unmatched' ? (
              <GlassSurface style={{ padding: spacing.lg, gap: spacing.sm }}>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={18} color={t.accent} />
                  <Text
                    style={{ fontFamily: fontFamily.bodySemi, fontSize: 17, color: t.heading }}
                  >
                    Matched next week
                  </Text>
                </View>
                <Text style={{ color: t.body, lineHeight: 21 }}>
                  {selectedGang?.name} is in{' '}
                  {divisionLabel(war.gang.war_division)}. New Gang Wars pairings
                  drop Monday morning.
                </Text>
              </GlassSurface>
            ) : war?.match ? (
              <View style={{ gap: spacing.md }}>
                <GlassSurface style={{ padding: spacing.md, gap: spacing.md }}>
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="items-center gap-2 flex-1">
                      <GangBannerWithDivisionBorder
                        uri={war.gang.banner_url}
                        name={war.gang.name}
                        division={war.gang.war_division}
                        size={92}
                      />
                      <Text
                        style={{
                          fontFamily: fontFamily.bodySemi,
                          color: t.heading,
                          textAlign: 'center',
                          fontSize: 14,
                        }}
                        numberOfLines={2}
                      >
                        {war.gang.name}
                      </Text>
                      <Text
                        style={{
                          color: t.placeholder,
                          fontSize: 11,
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                        }}
                      >
                        {divisionLabel(war.gang.war_division)}
                      </Text>
                    </View>

                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(168,85,247,0.14)',
                        borderWidth: 1,
                        borderColor: 'rgba(192,132,252,0.35)',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fontFamily.display,
                          fontSize: 14,
                          color: '#E9D5FF',
                          letterSpacing: 0.5,
                        }}
                      >
                        VS
                      </Text>
                    </View>

                    <View className="items-center gap-2 flex-1">
                      <GangBannerWithDivisionBorder
                        uri={war.match.opponent.banner_url}
                        name={war.match.opponent.name}
                        division={war.match.opponent.war_division}
                        size={92}
                      />
                      <Text
                        style={{
                          fontFamily: fontFamily.bodySemi,
                          color: t.heading,
                          textAlign: 'center',
                          fontSize: 14,
                        }}
                        numberOfLines={2}
                      >
                        {war.match.opponent.name}
                      </Text>
                      <Text
                        style={{
                          color: t.placeholder,
                          fontSize: 11,
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                        }}
                      >
                        {divisionLabel(war.match.opponent.war_division)}
                        {war.match.opponent.is_bot ? ' · Bot' : ''}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.colors.border,
                      opacity: 0.7,
                    }}
                  />

                  <View className="flex-row items-end justify-center gap-8">
                    <View className="items-center gap-1">
                      <Text
                        style={{
                          color: leading === 'us' ? '#86efac' : t.placeholder,
                          fontSize: 11,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                          fontFamily: fontFamily.bodySemi,
                        }}
                      >
                        Us
                      </Text>
                      <Text
                        style={{
                          fontFamily: fontFamily.display,
                          fontSize: 40,
                          color: leading === 'us' ? '#86efac' : t.heading,
                        }}
                      >
                        {Math.round(Number(war.match.our_score))}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: t.placeholder,
                        marginBottom: 10,
                        fontSize: 18,
                      }}
                    >
                      –
                    </Text>
                    <View className="items-center gap-1">
                      <Text
                        style={{
                          color: leading === 'them' ? '#fca5a5' : t.placeholder,
                          fontSize: 11,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                          fontFamily: fontFamily.bodySemi,
                        }}
                      >
                        Them
                      </Text>
                      <Text
                        style={{
                          fontFamily: fontFamily.display,
                          fontSize: 40,
                          color: leading === 'them' ? '#fca5a5' : t.heading,
                        }}
                      >
                        {Math.round(Number(war.match.their_score))}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: t.placeholder,
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {leading === 'us'
                      ? "You're ahead this week"
                      : leading === 'them'
                        ? "They're ahead this week"
                        : 'Tied this week'}
                  </Text>
                </GlassSurface>

                {todayDay ? (
                  <GlassSurface style={{ padding: spacing.md, gap: spacing.sm }}>
                    <View className="flex-row items-center justify-between">
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={{
                            color: t.accent,
                            fontSize: 11,
                            letterSpacing: 1.2,
                            fontFamily: fontFamily.bodySemi,
                          }}
                        >
                          TODAY'S CHALLENGE
                        </Text>
                        <Text
                          style={{
                            fontFamily: fontFamily.display,
                            color: t.heading,
                            fontSize: 22,
                          }}
                        >
                          {todayDay.exercise_name}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(77,140,255,0.12)',
                        }}
                      >
                        <Ionicons name="timer-outline" size={22} color={t.accent} />
                      </View>
                    </View>
                    <Text style={{ color: t.body, fontSize: 13, lineHeight: 19 }}>
                      60-second max reps. Your top 2 attempts count for{' '}
                      {selectedGang?.name ?? 'your gang'}.
                    </Text>
                    <Button
                      label={cameraOk ? 'Go To War' : 'Camera Required'}
                      onPress={startToday}
                      disabled={!cameraOk}
                    />
                  </GlassSurface>
                ) : null}

                <GlassSurface style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingTop: 10,
                      paddingBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamily.bodySemi,
                        color: t.heading,
                        fontSize: 15,
                      }}
                    >
                      Daily breakdown
                    </Text>
                  </View>
                  {war.match.days.map((day, index) => {
                    const our = Math.round(Number(day.our_score ?? 0));
                    const their = Math.round(Number(day.their_score ?? 0));
                    const dayLead =
                      day.is_future || our === their
                        ? null
                        : our > their
                          ? 'us'
                          : 'them';

                    return (
                      <View key={day.day_on}>
                        {index > 0 ? (
                          <View
                            style={{
                              height: StyleSheet.hairlineWidth,
                              backgroundColor: theme.colors.border,
                              marginHorizontal: 12,
                              opacity: 0.65,
                            }}
                          />
                        ) : null}
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            borderRadius: 12,
                            marginHorizontal: 4,
                            backgroundColor: day.is_today
                              ? 'rgba(77,140,255,0.08)'
                              : 'transparent',
                            opacity: day.is_future ? 0.5 : 1,
                          }}
                        >
                          <View className="flex-row items-center justify-between gap-3">
                            <View style={{ flex: 1, gap: 2 }}>
                              <View className="flex-row items-center gap-2">
                                <Text
                                  style={{
                                    fontFamily: fontFamily.bodySemi,
                                    color: day.is_today ? t.accent : t.heading,
                                    fontSize: 14,
                                  }}
                                >
                                  {weekdayName(day.day_on)}
                                </Text>
                                {day.is_today ? (
                                  <View
                                    style={{
                                      paddingHorizontal: 7,
                                      paddingVertical: 2,
                                      borderRadius: 999,
                                      backgroundColor: 'rgba(77,140,255,0.18)',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: t.accent,
                                        fontSize: 10,
                                        fontFamily: fontFamily.bodySemi,
                                        letterSpacing: 0.5,
                                      }}
                                    >
                                      TODAY
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={{ color: t.placeholder, fontSize: 12 }}>
                                {day.exercise_name}
                              </Text>
                            </View>
                            {day.is_future ? (
                              <Text style={{ color: t.placeholder, fontSize: 14 }}>—</Text>
                            ) : (
                              <View className="flex-row items-baseline gap-1.5">
                                <Text
                                  style={{
                                    fontFamily: fontFamily.bodySemi,
                                    fontSize: 15,
                                    color: dayLead === 'us' ? '#86efac' : t.heading,
                                  }}
                                >
                                  {our}
                                </Text>
                                <Text style={{ color: t.placeholder, fontSize: 12 }}>:</Text>
                                <Text
                                  style={{
                                    fontFamily: fontFamily.bodySemi,
                                    fontSize: 15,
                                    color: dayLead === 'them' ? '#fca5a5' : t.heading,
                                  }}
                                >
                                  {their}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </GlassSurface>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {showResultOverlay && pendingResult && gangId ? (
        <GangWarResultOverlay
          won={pendingResult.won}
          division={pendingResult.division as WarDivision}
          ourScore={Number(pendingResult.our_score ?? 0)}
          theirScore={Number(pendingResult.their_score ?? 0)}
          ourName={war?.gang.name ?? selectedGang?.name}
          ourBannerUrl={war?.gang.banner_url ?? selectedGang?.banner_url}
          onDismiss={() => {
            markSeen.mutate({
              matchId: pendingResult.match_id,
              kind: 'result',
              gangId,
            });
          }}
          onClaimReward={() => {
            markSeen.mutate({
              matchId: pendingResult.match_id,
              kind: 'result',
              gangId,
            });
            router.push('/inventory');
          }}
        />
      ) : null}

      {showVsOverlay && war?.match && gangId ? (
        <GangWarMatchupOverlay
          ourName={war.gang.name}
          ourBannerUrl={war.gang.banner_url}
          ourDivision={war.gang.war_division}
          theirName={war.match.opponent.name}
          theirBannerUrl={war.match.opponent.banner_url}
          theirDivision={war.match.opponent.war_division}
          onDismiss={() => {
            markSeen.mutate({
              matchId: war.match!.id,
              kind: 'vs',
              gangId,
            });
          }}
        />
      ) : null}
    </ScreenBackground>
  );
}
