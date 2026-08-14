import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button, ExerciseIcon, GlassSurface, LeaderboardRow } from '@/components/ui';
import { GradientTabSelect } from '@/components/ui/gradient-tab-select';
import { useAuth } from '@/context/auth-context';
import {
  useChallengeLeaderboard,
  useCurrentWeeklyChallenge,
  type ChallengeLeaderboardScope,
} from '@/hooks/use-challenges';
import { useCosmeticCatalog } from '@/hooks/use-cosmetics';
import { useMyGangs } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import { fontFamily, spacing, useTheme } from '@/lib/gaingang-theme';
import { isRepCounterNativeSupported } from '@/lib/rep-counting/platform';

type ScopeTab = 'world' | 'my_gangs';

function daysLeftLabel(endsOn: string): string {
  const end = new Date(`${endsOn}T23:59:59`);
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ends today';
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Compact weekly challenge strip + leaderboard for the Gain tab. */
export function WeeklyChallengesPanel() {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { data: challenge, isLoading } = useCurrentWeeklyChallenge();
  const { data: gangs } = useMyGangs();
  const { data: catalog } = useCosmeticCatalog();

  const [scopeTab, setScopeTab] = useState<ScopeTab>('world');
  const [gangPickerOpen, setGangPickerOpen] = useState(false);
  const [selectedGangId, setSelectedGangId] = useState<string | undefined>();

  const effectiveScope: ChallengeLeaderboardScope =
    scopeTab === 'my_gangs' && selectedGangId
      ? 'gang'
      : scopeTab === 'my_gangs'
        ? 'my_gangs'
        : 'world';

  const unit = challenge?.challenge_type.unit ?? 'reps';
  const { data: board, isLoading: boardLoading } = useChallengeLeaderboard(
    challenge?.id,
    unit,
    effectiveScope,
    selectedGangId,
  );

  const cosmeticById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof catalog>[number]>();
    for (const item of catalog ?? []) map.set(item.id, item);
    return map;
  }, [catalog]);

  const selectedGang = gangs?.find((g) => g.id === selectedGangId);
  const cameraOk = isRepCounterNativeSupported();

  function startChallenge() {
    if (!challenge) return;
    const ct = challenge.challenge_type;
    router.push({
      pathname: '/rep-counter',
      params: {
        mode: 'challenge',
        weeklyChallengeId: challenge.id,
        exerciseId: ct.exercise_id,
        exerciseName: ct.exercise.name,
        unit: ct.unit,
        challengeMode: ct.mode,
        timeLimitSeconds:
          ct.time_limit_seconds != null ? String(ct.time_limit_seconds) : '',
      },
    });
  }

  return (
    <>
      {isLoading ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 12 }} />
      ) : !challenge ? (
        <GlassSurface style={{ padding: spacing.md, gap: 6 }}>
          <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading, fontSize: 16 }}>
            No active challenge
          </Text>
          <Text style={{ color: t.body, fontSize: 13, lineHeight: 18 }}>
            The next weekly challenge rolls out Monday morning.
          </Text>
        </GlassSurface>
      ) : (
        <View style={{ gap: spacing.md }}>
          <GlassSurface style={{ padding: spacing.md, gap: spacing.sm }}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-2.5" style={{ minWidth: 0 }}>
                <ExerciseIcon
                  exerciseName={challenge.challenge_type.exercise.name}
                  size={36}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fontFamily.display,
                    fontSize: 18,
                    color: t.heading,
                  }}
                  numberOfLines={1}
                >
                  {challenge.challenge_type.name}
                </Text>
              </View>
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
                  {challenge.challenge_type.mode === 'timed_reps'
                    ? `${challenge.challenge_type.time_limit_seconds}s`
                    : 'Max hold'}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text style={{ color: t.placeholder, fontSize: 12 }}>
                {daysLeftLabel(challenge.ends_on)} · camera
              </Text>
              {challenge.my_entry ? (
                <Text style={{ color: t.body, fontSize: 12 }}>
                  · Best{' '}
                  <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading }}>
                    {formatAmount(Number(challenge.my_entry.best_score), unit)}
                  </Text>
                </Text>
              ) : null}
            </View>

            <Button
              label={cameraOk ? 'Start Challenge' : 'Camera Required'}
              onPress={startChallenge}
              disabled={!cameraOk}
            />
            {!cameraOk ? (
              <Text style={{ color: t.body, fontSize: 12, textAlign: 'center' }}>
                Rebuild the iOS/Android dev client to enable pose tracking.
              </Text>
            ) : null}
          </GlassSurface>

          <View style={{ gap: spacing.sm }}>
            <GradientTabSelect
              tabs={[
                { key: 'world', label: 'World', icon: 'globe-outline' },
                { key: 'my_gangs', label: 'My Gangs', icon: 'people-outline' },
              ]}
              selected={scopeTab}
              onSelect={(key) => {
                setScopeTab(key);
                if (key === 'world') setSelectedGangId(undefined);
              }}
            />

            {scopeTab === 'my_gangs' ? (
              <TouchableOpacity
                onPress={() => setGangPickerOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Filter by gang"
                className="flex-row items-center justify-between"
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Text style={{ fontFamily: fontFamily.bodySemi, color: t.heading }}>
                  {selectedGang ? selectedGang.name : 'All'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={t.body} />
              </TouchableOpacity>
            ) : null}

            {boardLoading ? (
              <ActivityIndicator color={t.accent} style={{ marginTop: 8 }} />
            ) : (board ?? []).length === 0 ? (
              <GlassSurface style={{ padding: spacing.md }}>
                <Text style={{ color: t.body, textAlign: 'center' }}>
                  No scores yet. Be the first on the board.
                </Text>
              </GlassSurface>
            ) : (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  overflow: 'hidden',
                }}
              >
                {(board ?? []).map((row) => (
                  <LeaderboardRow
                    key={row.user_id}
                    position={row.position}
                    name={row.full_name}
                    avatarUrl={row.avatar_url}
                    amount={row.total}
                    unit={row.unit}
                    level={row.level}
                    isYou={row.user_id === session?.user.id}
                    bannerStyle={
                      row.equipped_banner_id
                        ? (cosmeticById.get(row.equipped_banner_id)?.style ?? null)
                        : null
                    }
                    avatarBorderStyle={
                      row.equipped_avatar_border_id
                        ? (cosmeticById.get(row.equipped_avatar_border_id)?.style ??
                          null)
                        : null
                    }
                    levelBorderStyle={
                      row.equipped_level_border_id
                        ? (cosmeticById.get(row.equipped_level_border_id)?.style ??
                          null)
                        : null
                    }
                    title={
                      row.equipped_title_id
                        ? (cosmeticById.get(row.equipped_title_id)?.name ?? null)
                        : null
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <Modal
        visible={gangPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGangPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setGangPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: spacing.lg,
              gap: 8,
              maxHeight: '60%',
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.display,
                fontSize: 18,
                color: t.heading,
                marginBottom: 8,
              }}
            >
              Leaderboard scope
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedGangId(undefined);
                setGangPickerOpen(false);
              }}
              style={{ paddingVertical: 14 }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  color: !selectedGangId ? theme.colors.primary : t.heading,
                }}
              >
                All my gangs
              </Text>
            </TouchableOpacity>
            {(gangs ?? []).map((gang) => (
              <TouchableOpacity
                key={gang.id}
                onPress={() => {
                  setSelectedGangId(gang.id);
                  setGangPickerOpen(false);
                }}
                style={{ paddingVertical: 14 }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    color:
                      selectedGangId === gang.id ? theme.colors.primary : t.heading,
                  }}
                >
                  {gang.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
