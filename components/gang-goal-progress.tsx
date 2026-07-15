import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { CircularProgress } from '@/components/ui/circular-progress';
import { GlassSurface } from '@/components/ui/glass-surface';
import {
  type ExerciseContributor,
  useExerciseContributions,
  useSendGangPoke,
} from '@/hooks/use-exercise-contributions';
import { formatAmount } from '@/lib/format';
import {
  fontFamily,
  radius,
  spacing,
  status,
  useTheme,
} from '@/lib/gaingang-theme';
import type { DailyGoalExerciseWithProgress, DailyGoalWithProgress } from '@/types';

const GRID_GAP = spacing.sm + 4;

interface GangGoalProgressProps {
  goal: DailyGoalWithProgress;
  gangId: string;
}

function progressRatio(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

export function GangGoalProgress({ goal, gangId }: GangGoalProgressProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [selectedExercise, setSelectedExercise] =
    useState<DailyGoalExerciseWithProgress | null>(null);

  return (
    <>
      <FlatList
        data={goal.exercises}
        keyExtractor={(item) => item.id}
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: exercise }) => {
          const ratio = progressRatio(exercise.gang_total, exercise.gang_target);
          const complete =
            exercise.gang_target > 0 && exercise.gang_total >= exercise.gang_target;
          const pctLabel = `${Math.round(ratio * 100)}%`;

          return (
            <View style={styles.cardSlot}>
              <Pressable
                onPress={() => setSelectedExercise(exercise)}
                accessibilityRole="button"
                accessibilityHint="Shows who has contributed"
                accessibilityLabel={`View contributors for ${exercise.exercise_name}`}
                style={({ pressed }) => [
                  styles.pressable,
                  { transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <GlassSurface style={styles.exerciseCard}>
                  <CircularProgress
                    value={ratio}
                    size={88}
                    strokeWidth={8}
                    label={complete ? '✓' : pctLabel}
                    complete={complete}
                  />
                  <Text style={[styles.exerciseName, { color: c.text }]} numberOfLines={2}>
                    {exercise.exercise_name}
                  </Text>
                  <View style={[styles.footer, { borderTopColor: c.border }]}>
                    <View style={styles.tapHintRow}>
                      <Ionicons name="people-outline" size={14} color={c.primaryGlow} />
                      <Text style={[styles.tapHint, { color: c.textDim }]}>
                        {exercise.contributor_count}/{goal.member_count}
                      </Text>
                    </View>
                    <View style={styles.footerChevron}>
                      <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
                    </View>
                  </View>
                </GlassSurface>
              </Pressable>
            </View>
          );
        }}
      />

      <ExerciseContributorsModal
        visible={!!selectedExercise}
        gangId={gangId}
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
      />
    </>
  );
}

interface ExerciseContributorsModalProps {
  visible: boolean;
  gangId: string;
  exercise: DailyGoalExerciseWithProgress | null;
  onClose: () => void;
}

function ExerciseContributorsModal({
  visible,
  gangId,
  exercise,
  onClose,
}: ExerciseContributorsModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const poke = useSendGangPoke(gangId);
  const [pokingUserId, setPokingUserId] = useState<string | null>(null);

  const { data: contributors, isLoading } = useExerciseContributions({
    gangId,
    exerciseId: exercise?.id ?? null,
    individualTarget: exercise?.individual_target ?? 0,
    unit: exercise?.unit ?? 'reps',
    enabled: visible && !!exercise,
  });

  const done = (contributors ?? []).filter((m) => m.is_complete);
  const pending = (contributors ?? []).filter((m) => !m.is_complete);

  async function handlePoke(member: ExerciseContributor) {
    if (!exercise || member.is_self || member.is_complete) return;
    setPokingUserId(member.user_id);
    try {
      await poke.mutateAsync({
        targetUserId: member.user_id,
        dailyGoalExerciseId: exercise.id,
      });
      Alert.alert('Poke sent', `${member.full_name} got a nudge to finish ${exercise.exercise_name}.`);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : 'Could not send poke. Try again later.';
      Alert.alert('Poke failed', message);
    } finally {
      setPokingUserId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalSheet, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text style={[styles.modalEyebrow, { color: c.primaryGlow }]}>CREW STATUS</Text>
              <Text style={[styles.modalTitle, { color: c.text }]} numberOfLines={1}>
                {exercise?.exercise_name ?? 'Exercise'}
              </Text>
              {exercise ? (
                <Text style={[styles.modalSubtitle, { color: c.textDim }]}>
                  Personal target {formatAmount(exercise.individual_target, exercise.unit)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close contributors"
            >
              <Ionicons name="close" size={24} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 28 }} />
          ) : (
            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              <ContributorSection
                title="Contributed"
                empty="Nobody has finished this yet."
                members={done}
                accent={status.success}
                onPoke={handlePoke}
                pokingUserId={pokingUserId}
              />
              <ContributorSection
                title="Still needed"
                empty="Everyone has contributed. Nice."
                members={pending}
                accent={status.warning}
                onPoke={handlePoke}
                pokingUserId={pokingUserId}
                showPoke
              />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ContributorSectionProps {
  title: string;
  empty: string;
  members: ExerciseContributor[];
  accent: string;
  onPoke: (member: ExerciseContributor) => void;
  pokingUserId: string | null;
  showPoke?: boolean;
}

function ContributorSection({
  title,
  empty,
  members,
  accent,
  onPoke,
  pokingUserId,
  showPoke = false,
}: ContributorSectionProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: accent }]}>
        {title} · {members.length}
      </Text>
      {members.length === 0 ? (
        <Text style={[styles.emptySection, { color: c.textMuted }]}>{empty}</Text>
      ) : (
        members.map((member) => (
          <View
            key={member.user_id}
            style={[styles.memberRow, { backgroundColor: c.surface2, borderColor: c.border }]}
          >
            <Avatar name={member.full_name} uri={member.avatar_url} size={40} />
            <View style={styles.memberMeta}>
              <Text style={[styles.memberName, { color: c.text }]} numberOfLines={1}>
                {member.full_name}
                {member.is_self ? ' (you)' : ''}
              </Text>
              <Text style={[styles.memberProgress, { color: c.textMuted }]}>
                {formatAmount(member.user_total, member.unit)} /{' '}
                {formatAmount(member.individual_target, member.unit)}
              </Text>
            </View>
            {showPoke && !member.is_self ? (
              <TouchableOpacity
                onPress={() => onPoke(member)}
                disabled={pokingUserId === member.user_id}
                style={[styles.pokeButton, { backgroundColor: c.primary }]}
                accessibilityLabel={`Poke ${member.full_name}`}
              >
                {pokingUserId === member.user_id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={14} color="#FFFFFF" />
                    <Text style={[styles.pokeLabel, { color: '#FFFFFF' }]}>Poke</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : member.is_complete ? (
              <Ionicons name="checkmark-circle" size={22} color={status.success} />
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: GRID_GAP,
  },
  columnWrapper: {
    gap: GRID_GAP,
  },
  cardSlot: {
    flex: 1,
    maxWidth: '50%',
  },
  pressable: {
    width: '100%',
  },
  exerciseCard: {
    width: '100%',
    paddingTop: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 2,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  exerciseName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  footer: {
    alignSelf: 'stretch',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  footerChevron: {
    position: 'absolute',
    right: 0,
    top: 6,
    bottom: 0,
    justifyContent: 'center',
  },
  tapHint: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 2,
  },
  modalEyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  modalTitle: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 26,
  },
  modalSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  modalList: {
    flexGrow: 0,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  emptySection: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberMeta: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  memberProgress: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  pokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    minWidth: 72,
    justifyContent: 'center',
  },
  pokeLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
});
