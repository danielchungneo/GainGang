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
import { GangSelector } from '@/components/gang-selector';
import { GangWarContributionsSheet } from '@/components/gang-war-contributions-sheet';
import { GangWarDayBreakdownSheet } from '@/components/gang-war-day-breakdown-sheet';
import { GangWarMatchupOverlay } from '@/components/gang-war-matchup-overlay';
import { GangWarResultOverlay } from '@/components/gang-war-result-overlay';
import { Button, GlassSurface, ScreenBackground } from '@/components/ui';
import {
  useGangWarHistory,
  useGangWarState,
  useMarkGangWarSeen,
  type GangWarDayRow,
} from '@/hooks/use-gang-wars';
import { useMyGangs } from '@/hooks/use-gangs';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import { fontFamily, spacing, useTheme } from '@/lib/gaingang-theme';
import {
  isWarDivision,
  WAR_DIVISION_LABELS,
} from '@/lib/gang-wars/divisions';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';
import type { ExerciseUnit, WarDivision } from '@/types';

const US_BAR = '#4ADE80';
const THEM_BAR = '#F87171';

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
  const [contributionsGang, setContributionsGang] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [dayBreakdown, setDayBreakdown] = useState<GangWarDayRow | null>(null);

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

  const todayUnit: ExerciseUnit =
    todayDay?.unit === 'seconds' ? 'seconds' : 'reps';
  const topScores = war?.my_top_scores ?? [];

  const ourWeekScore = Math.round(Number(war?.match?.our_score ?? 0));
  const theirWeekScore = Math.round(Number(war?.match?.their_score ?? 0));
  const weekScoreTotal = ourWeekScore + theirWeekScore;
  const ourBarShare = weekScoreTotal > 0 ? ourWeekScore / weekScoreTotal : 0.5;
  const theirBarShare = weekScoreTotal > 0 ? theirWeekScore / weekScoreTotal : 0.5;

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
            {gangs.length > 1 ? (
              <GangSelector
                gangs={gangs}
                selectedId={gangId!}
                onSelect={setSelectedGangId}
              />
            ) : null}

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
                {todayDay ? (
                  <GlassSurface style={{ padding: spacing.md, gap: spacing.sm }}>
                    <View className="flex-row items-start justify-between gap-3">
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
                        <View className="flex-row items-center gap-2">
                          <Text
                            style={{
                              flexShrink: 1,
                              fontFamily: fontFamily.display,
                              color: t.heading,
                              fontSize: 22,
                            }}
                            numberOfLines={1}
                          >
                            {todayDay.exercise_name}
                          </Text>
                          <View
                            style={{
                              backgroundColor: theme.colors.primary,
                              paddingHorizontal: 9,
                              paddingVertical: 5,
                              borderRadius: 8,
                              minWidth: 40,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: fontFamily.bodySemi,
                                fontSize: 12,
                                fontVariant: ['tabular-nums'],
                                color: '#FFFFFF',
                                letterSpacing: 0.3,
                              }}
                            >
                              60s
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-1.5 pt-0.5">
                        <Text
                          style={{
                            color: '#F97316',
                            fontSize: 12,
                            fontFamily: fontFamily.bodySemi,
                            textAlign: 'right',
                          }}
                        >
                          Improve Your Scores
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-2">
                      {[0, 1].map((slot) => {
                        const score = topScores[slot];
                        const hasScore = score != null;
                        return (
                          <View
                            key={slot}
                            style={{
                              flex: 1,
                              gap: 4,
                              paddingVertical: 12,
                              paddingHorizontal: 12,
                              borderRadius: 14,
                              backgroundColor: 'rgba(77,140,255,0.08)',
                              borderWidth: 1,
                              borderColor: hasScore
                                ? 'rgba(74,222,128,0.28)'
                                : theme.colors.border,
                            }}
                          >
                            <Text
                              style={{
                                color: t.placeholder,
                                fontSize: 11,
                                letterSpacing: 0.4,
                                fontFamily: fontFamily.bodySemi,
                                textTransform: 'uppercase',
                              }}
                            >
                              {slot === 0 ? 'Best' : '2nd Best'}
                            </Text>
                            <Text
                              style={{
                                fontFamily: fontFamily.display,
                                fontSize: 28,
                                lineHeight: 32,
                                color: hasScore ? t.heading : t.placeholder,
                                fontVariant: ['tabular-nums'],
                              }}
                              numberOfLines={1}
                            >
                              {hasScore ? formatAmount(score, todayUnit) : '---'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <Button
                      label={cameraOk ? 'Go To War' : 'Camera Required'}
                      onPress={startToday}
                      disabled={!cameraOk}
                    />
                  </GlassSurface>
                ) : null}

                <GlassSurface style={{ padding: spacing.md, gap: spacing.md }}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Pressable
                      className="items-center gap-2 flex-1"
                      onPress={() =>
                        setContributionsGang({
                          id: war.gang.id,
                          name: war.gang.name,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`View ${war.gang.name} contributions`}
                    >
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
                    </Pressable>

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

                    <Pressable
                      className="items-center gap-2 flex-1"
                      onPress={() =>
                        setContributionsGang({
                          id: war.match.opponent.id,
                          name: war.match.opponent.name,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`View ${war.match.opponent.name} contributions`}
                    >
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
                    </Pressable>
                  </View>

                  <View style={{ gap: 10 }}>
                    <View
                      style={{
                        height: 28,
                        borderRadius: 999,
                        overflow: 'hidden',
                        flexDirection: 'row',
                        backgroundColor: 'rgba(148,163,184,0.16)',
                      }}
                    >
                      <View
                        style={{
                          flex: Math.max(ourBarShare, weekScoreTotal === 0 ? 0.5 : 0.0001),
                          backgroundColor: US_BAR,
                        }}
                      />
                      <View
                        style={{
                          flex: Math.max(theirBarShare, weekScoreTotal === 0 ? 0.5 : 0.0001),
                          backgroundColor: THEM_BAR,
                        }}
                      />
                    </View>
                    <View className="flex-row items-start justify-between gap-3">
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            color: US_BAR,
                            fontFamily: fontFamily.bodySemi,
                            fontSize: 13,
                          }}
                          numberOfLines={1}
                        >
                          {war.gang.name}
                        </Text>
                        <Text
                          style={{
                            color: t.heading,
                            fontFamily: fontFamily.display,
                            fontSize: 18,
                          }}
                        >
                          {formatAmount(ourWeekScore, 'reps')}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
                        <Text
                          style={{
                            color: THEM_BAR,
                            fontFamily: fontFamily.bodySemi,
                            fontSize: 13,
                            textAlign: 'right',
                          }}
                          numberOfLines={1}
                        >
                          {war.match.opponent.name}
                        </Text>
                        <Text
                          style={{
                            color: t.heading,
                            fontFamily: fontFamily.display,
                            fontSize: 18,
                            textAlign: 'right',
                          }}
                        >
                          {formatAmount(theirWeekScore, 'reps')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassSurface>

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
                      Daily Breakdown
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
                              <View className="flex-row items-center gap-2">
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
                                <Pressable
                                  onPress={() => setDayBreakdown(day)}
                                  hitSlop={10}
                                  accessibilityRole="button"
                                  accessibilityLabel={`View ${weekdayName(day.day_on)} contribution details`}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(77,140,255,0.12)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(77,140,255,0.28)',
                                  }}
                                >
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={18}
                                    color={t.accent}
                                  />
                                </Pressable>
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

      {contributionsGang && war?.match ? (
        <GangWarContributionsSheet
          matchId={war.match.id}
          gangId={contributionsGang.id}
          gangName={contributionsGang.name}
          visible
          onClose={() => setContributionsGang(null)}
          unit="reps"
        />
      ) : null}

      {dayBreakdown && war?.match ? (
        <GangWarDayBreakdownSheet
          matchId={war.match.id}
          dayOn={dayBreakdown.day_on}
          exerciseName={dayBreakdown.exercise_name}
          unit={dayBreakdown.unit === 'seconds' ? 'seconds' : 'reps'}
          ourGangId={war.gang.id}
          ourGangName={war.gang.name}
          theirGangId={war.match.opponent.id}
          theirGangName={war.match.opponent.name}
          visible
          onClose={() => setDayBreakdown(null)}
        />
      ) : null}
    </ScreenBackground>
  );
}
