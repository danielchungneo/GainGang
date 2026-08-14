import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ui';
import { ExerciseIcon } from '@/components/ui/exercise-icon';
import { useExercises } from '@/hooks/use-exercises';
import { useGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  buildDaysPayload,
  useCreateWeeklyPlan,
  useUpdateWeeklyPlan,
  useWeeklyPlan,
} from '@/hooks/use-weekly-plans';
import {
  formatAmountInputValue,
  parseActivityAmount,
  sanitizeAmountInput,
} from '@/lib/activity-amount';
import { equipmentLabel } from '@/lib/equipment';
import { formatAmount, goalDateForWeekDay } from '@/lib/format';
import { fontFamily, useTheme } from '@/lib/gaingang-theme';
import {
  CATEGORY_LABELS,
  WEEK_DAYS,
  mondayOfWeek,
  type ExerciseCategory,
  type ExerciseRequiredEquipment,
  type ExerciseUnit,
  type WeeklyPlanWithGoals,
} from '@/types';

interface DayExerciseDraft {
  exerciseId: string;
  name: string;
  unit: ExerciseUnit;
  individualTarget: string;
  requiredEquipment?: ExerciseRequiredEquipment | null;
}

interface DayDraft {
  exercises: DayExerciseDraft[];
}

type PickerFilter = 'all' | ExerciseCategory;

const TARGET_STEP: Record<ExerciseUnit, number> = {
  reps: 5,
  seconds: 15,
  miles: 0.5,
};

const DEFAULT_TARGET: Record<ExerciseUnit, string> = {
  reps: '20',
  seconds: '60',
  miles: '2',
};

/** Exercise add-chip size — two rows fit in the pinned picker. */
const ADD_CHIP_HEIGHT = 32;
const ADD_CHIP_GAP = 6;

const FILTER_OPTIONS: { key: PickerFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key: key as ExerciseCategory,
    label,
  })),
];

function isoWeekdayToday(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function buildInitialDays(): Record<number, DayDraft> {
  const days: Record<number, DayDraft> = {};
  for (const wd of WEEK_DAYS) {
    days[wd.dayOfWeek] = { exercises: [] };
  }
  return days;
}

function buildDaysFromPlan(plan: WeeklyPlanWithGoals): Record<number, DayDraft> {
  const days = buildInitialDays();
  for (const goal of plan.daily_goals) {
    days[goal.day_of_week] = {
      exercises: goal.exercises.map((e) => ({
        exerciseId: e.exercise_id,
        name: e.exercise_name,
        unit: e.unit,
        individualTarget: formatAmountInputValue(e.individual_target, e.unit),
        requiredEquipment: e.required_equipment,
      })),
    };
  }
  return days;
}

function formatWeekOf(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatDayKicker(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`)
    .toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();
}

function unitMemberLabel(unit: ExerciseUnit): string {
  if (unit === 'reps') return 'REPS / MEMBER';
  if (unit === 'seconds') return 'SECONDS / MEMBER';
  return 'MILES / MEMBER';
}

function cloneExercises(exercises: DayExerciseDraft[]): DayExerciseDraft[] {
  return exercises.map((e) => ({ ...e }));
}

export default function NewGoalScreen() {
  const { gangId, planId } = useLocalSearchParams<{ gangId: string; planId?: string }>();
  const isEditing = !!planId;
  const t = useThemeTokens();
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const createPlan = useCreateWeeklyPlan();
  const updatePlan = useUpdateWeeklyPlan();
  const { data: gang } = useGang(gangId ?? '');
  const { data: existingPlan, isLoading: loadingPlan } = useWeeklyPlan(
    isEditing ? planId : undefined,
  );
  const { data: exercises } = useExercises(undefined, gangId);

  const [selectedDay, setSelectedDay] = useState(isoWeekdayToday);
  const [days, setDays] = useState(() => buildInitialDays());
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<PickerFilter>('all');
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{
    exerciseId: string;
    unit: ExerciseUnit;
    value: string;
  } | null>(null);

  useEffect(() => {
    if (!isEditing || !existingPlan || hasPrefilled) return;
    setDays(buildDaysFromPlan(existingPlan));
    setIsAdaptive(existingPlan.is_adaptive);
    setHasPrefilled(true);
  }, [isEditing, existingPlan, hasPrefilled]);

  const weekStarts = isEditing && existingPlan ? existingPlan.starts_on : mondayOfWeek();
  const memberCount = gang?.member_count ?? 1;
  const isPending = createPlan.isPending || updatePlan.isPending;
  const currentDay = days[selectedDay];
  const selectedWd = WEEK_DAYS.find((wd) => wd.dayOfWeek === selectedDay) ?? WEEK_DAYS[0];
  const selectedIso = goalDateForWeekDay(weekStarts, selectedDay);

  const daysSet = useMemo(
    () => WEEK_DAYS.filter((wd) => (days[wd.dayOfWeek]?.exercises.length ?? 0) > 0).length,
    [days],
  );

  const availableExercises = useMemo(() => {
    const used = new Set(currentDay.exercises.map((e) => e.exerciseId));
    return (exercises ?? []).filter((e) => {
      if (used.has(e.id)) return false;
      if (pickerFilter !== 'all' && e.category !== pickerFilter) return false;
      return true;
    });
  }, [exercises, currentDay.exercises, pickerFilter]);

  function addExercise(exerciseId: string) {
    const ex = exercises?.find((e) => e.id === exerciseId);
    if (!ex) return;
    const dayOfWeek = selectedDay;

    setDays((prev) => {
      const day = prev[dayOfWeek];
      return {
        ...prev,
        [dayOfWeek]: {
          exercises: [
            ...day.exercises,
            {
              exerciseId: ex.id,
              name: ex.name,
              unit: ex.unit,
              individualTarget: DEFAULT_TARGET[ex.unit],
              requiredEquipment: ex.required_equipment,
            },
          ],
        },
      };
    });
  }

  function removeExercise(exerciseId: string) {
    const dayOfWeek = selectedDay;
    setDays((prev) => {
      const day = prev[dayOfWeek];
      return {
        ...prev,
        [dayOfWeek]: {
          exercises: day.exercises.filter((e) => e.exerciseId !== exerciseId),
        },
      };
    });
  }

  function bumpTarget(exerciseId: string, unit: ExerciseUnit, dir: 1 | -1) {
    const step = TARGET_STEP[unit];
    setDays((prev) => {
      const day = prev[selectedDay];
      return {
        ...prev,
        [selectedDay]: {
          exercises: day.exercises.map((e) => {
            if (e.exerciseId !== exerciseId) return e;
            const current = parseActivityAmount(e.individualTarget, e.unit) ?? step;
            const next = Math.max(step, Math.round((current + dir * step) * 10) / 10);
            return { ...e, individualTarget: formatAmountInputValue(next, e.unit) };
          }),
        },
      };
    });
  }

  function commitTargetEdit() {
    if (!editingTarget) return;
    const sanitized = sanitizeAmountInput(editingTarget.value, editingTarget.unit);
    const parsed = parseActivityAmount(sanitized, editingTarget.unit);
    if (parsed !== null) {
      const exerciseId = editingTarget.exerciseId;
      setDays((prev) => {
        const day = prev[selectedDay];
        return {
          ...prev,
          [selectedDay]: {
            exercises: day.exercises.map((e) =>
              e.exerciseId === exerciseId
                ? { ...e, individualTarget: formatAmountInputValue(parsed, e.unit) }
                : e,
            ),
          },
        };
      });
    }
    setEditingTarget(null);
  }

  function copyToRest() {
    setDays((prev) => {
      const src = prev[selectedDay];
      if (src.exercises.length === 0) return prev;
      const next = { ...prev };
      for (const wd of WEEK_DAYS) {
        if (wd.dayOfWeek <= selectedDay) continue;
        if (next[wd.dayOfWeek].exercises.length > 0) continue;
        next[wd.dayOfWeek] = { exercises: cloneExercises(src.exercises) };
      }
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);

    const payload = buildDaysPayload(days);
    const hasAnyExercise = payload.some((d) => d.exercises.length > 0);
    if (!hasAnyExercise) {
      setError('Add at least one exercise to your weekly plan');
      return;
    }

    try {
      if (isEditing && planId) {
        await updatePlan.mutateAsync({ planId, days: payload, isAdaptive });
      } else {
        await createPlan.mutateAsync({
          gangId: gangId!,
          startsOn: weekStarts,
          days: payload,
          isAdaptive,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save weekly plan');
    }
  }

  if (isEditing && loadingPlan) {
    return (
      <ScreenBackground edges={['left', 'right']}>
        <View
          className="flex-1 items-center justify-center"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  if (isEditing && !loadingPlan && !existingPlan) {
    return (
      <ScreenBackground edges={['left', 'right']}>
        <View
          className="flex-1 items-center justify-center p-6"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <Text style={{ color: t.body, fontFamily: fontFamily.body }}>Weekly plan not found</Text>
        </View>
      </ScreenBackground>
    );
  }

  const quietText = t.isLight ? c.textMuted : '#5B678C';
  const quietestText = t.isLight ? '#8A93AD' : '#4A5474';
  const accentSoft = t.isLight ? c.primaryGlow : '#CFDCFF';
  const selectedBorder = t.isLight ? 'rgba(47,109,255,0.55)' : 'rgba(77,140,255,0.55)';
  const dashedBorder = t.isLight ? 'rgba(47,109,255,0.22)' : 'rgba(125,165,255,0.16)';
  const restDashed = t.isLight ? 'rgba(47,109,255,0.24)' : 'rgba(125,165,255,0.18)';
  const divider = t.isLight ? 'rgba(47,109,255,0.12)' : 'rgba(125,165,255,0.12)';
  const chipIdleBg = c.surface2;
  const addChipBg = t.isLight ? 'rgba(47,109,255,0.07)' : 'rgba(77,140,255,0.07)';
  const addChipBorder = t.isLight ? 'rgba(47,109,255,0.22)' : 'rgba(77,140,255,0.22)';
  const filterActiveBg = t.isLight ? 'rgba(47,109,255,0.16)' : 'rgba(77,140,255,0.2)';
  const filterActiveBorder = t.isLight ? 'rgba(47,109,255,0.45)' : 'rgba(77,140,255,0.5)';

  return (
    <ScreenBackground edges={['left', 'right']}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Close"
            style={[styles.closeBtn, { borderColor: c.border }]}
          >
            <Ionicons name="close" size={18} color={c.textDim} />
          </TouchableOpacity>

          <View style={styles.headerMid}>
            <Text style={[styles.kicker, { color: c.textMuted }]} numberOfLines={1}>
              {(gang?.name ?? 'Gang').toUpperCase()} · {memberCount} MEMBER
              {memberCount === 1 ? '' : 'S'}
            </Text>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              Week of {formatWeekOf(weekStarts)}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.daysSetLabel, { color: c.textMuted }]}>DAYS SET</Text>
            <Text style={[styles.daysSetValue, { color: c.primaryGlow }]}>
              {daysSet}
              <Text style={{ color: quietText, fontSize: 13 }}>/7</Text>
            </Text>
          </View>
        </View>

        {/* Week board */}
        <View style={styles.boardPad}>
          <View style={styles.board}>
            {WEEK_DAYS.map((wd) => {
              const count = days[wd.dayOfWeek]?.exercises.length ?? 0;
              const filled = count > 0;
              const selected = selectedDay === wd.dayOfWeek;
              const dayColor = selected
                ? t.isLight
                  ? c.text
                  : '#FFFFFF'
                : filled
                  ? c.textDim
                  : quietText;
              const footerColor = selected ? accentSoft : filled ? c.textMuted : quietestText;

              const cellInner = (
                <>
                  <Text
                    style={[
                      styles.boardDay,
                      { color: dayColor, fontFamily: fontFamily.monoBold },
                    ]}
                  >
                    {wd.shortLabel.toUpperCase()}
                  </Text>
                  <Text style={[styles.boardFooter, { color: footerColor }]}>
                    {filled ? `${count} EX` : 'REST'}
                  </Text>
                </>
              );

              return (
                <TouchableOpacity
                  key={wd.dayOfWeek}
                  onPress={() => setSelectedDay(wd.dayOfWeek)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${wd.label}, ${filled ? `${count} exercises` : 'rest day'}`}
                  style={styles.boardCellTouch}
                >
                  {selected ? (
                    <LinearGradient
                      colors={[
                        t.isLight ? 'rgba(47,109,255,0.22)' : 'rgba(77,140,255,0.28)',
                        t.isLight ? 'rgba(123,47,222,0.16)' : 'rgba(157,78,221,0.2)',
                      ]}
                      start={{ x: 0.1, y: 0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={[
                        styles.boardCell,
                        {
                          borderColor: selectedBorder,
                          shadowColor: c.primary,
                          shadowOpacity: 0.7,
                          shadowRadius: 9,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 6,
                        },
                      ]}
                    >
                      {cellInner}
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.boardCell,
                        filled
                          ? { backgroundColor: c.surface, borderColor: c.border }
                          : {
                              backgroundColor: 'transparent',
                              borderColor: dashedBorder,
                              borderStyle: 'dashed',
                            },
                      ]}
                    >
                      {cellInner}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category + exercise picker — pinned under week board */}
        <View style={styles.filterPinned}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = pickerFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setPickerFilter(opt.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? filterActiveBg : chipIdleBg,
                      borderColor: active ? filterActiveBorder : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? accentSoft : c.textMuted },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.addChipsScroll}
          >
            <View style={styles.addChips}>
              {availableExercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => addExercise(ex.id)}
                  style={[
                    styles.addChip,
                    { backgroundColor: addChipBg, borderColor: addChipBorder },
                  ]}
                >
                  <Ionicons name="add" size={11} color={c.primaryGlow} />
                  <ExerciseIcon exerciseName={ex.name} size={16} />
                  <Text style={[styles.addChipText, { color: accentSoft }]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {availableExercises.length === 0 ? (
                <Text style={{ color: c.textMuted, fontSize: 13, alignSelf: 'center' }}>
                  {pickerFilter === 'all'
                    ? 'All exercises are already on this day.'
                    : 'No exercises left in this category.'}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.divider, { backgroundColor: divider }]} />

        {/* Day panel (scrolls) */}
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dayHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.kicker, { color: c.textMuted, marginBottom: 3 }]}>
                {formatDayKicker(selectedIso)}
              </Text>
              <Text style={[styles.dayName, { color: c.text }]}>{selectedWd.label}</Text>
            </View>
            <TouchableOpacity
              onPress={copyToRest}
              accessibilityLabel="Copy to rest"
              style={[styles.copyPill, { borderColor: c.border }]}
            >
              <Ionicons name="copy-outline" size={13} color={c.primaryGlow} />
              <Text style={[styles.copyLabel, { color: c.primaryGlow }]}>Copy to rest</Text>
            </TouchableOpacity>
          </View>

          {currentDay.exercises.map((ex) => {
            const parsedTarget = parseActivityAmount(ex.individualTarget, ex.unit);
            const gangTarget = parsedTarget !== null ? parsedTarget * memberCount : null;
            return (
              <View
                key={ex.exerciseId}
                style={[styles.exCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={styles.exTop}>
                  <ExerciseIcon exerciseName={ex.name} size={28} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.exName, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {ex.name}
                    </Text>
                    {ex.requiredEquipment ? (
                      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>
                        Requires {equipmentLabel(ex.requiredEquipment)?.toLowerCase()}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeExercise(ex.exerciseId)}
                    accessibilityLabel={`Remove ${ex.name}`}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close" size={16} color={quietText} />
                  </TouchableOpacity>
                </View>

                <View style={styles.exBottom}>
                  <View
                    style={[
                      styles.stepper,
                      { backgroundColor: c.surface2, borderColor: c.border },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => bumpTarget(ex.exerciseId, ex.unit, -1)}
                      accessibilityLabel={`Decrease ${ex.name} target`}
                      style={styles.stepBtn}
                    >
                      <Ionicons name="remove" size={18} color={c.textDim} />
                    </TouchableOpacity>
                    <Pressable
                      onPress={() =>
                        setEditingTarget({
                          exerciseId: ex.exerciseId,
                          unit: ex.unit,
                          value: ex.individualTarget,
                        })
                      }
                      style={styles.stepCenter}
                      accessibilityLabel={`${ex.name} target ${ex.individualTarget}. Tap to edit`}
                    >
                      <Text style={[styles.stepValue, { color: c.text }]}>
                        {ex.individualTarget || '—'}
                      </Text>
                      <Text style={[styles.stepUnit, { color: c.textMuted }]}>
                        {unitMemberLabel(ex.unit)}
                      </Text>
                    </Pressable>
                    <TouchableOpacity
                      onPress={() => bumpTarget(ex.exerciseId, ex.unit, 1)}
                      accessibilityLabel={`Increase ${ex.name} target`}
                      style={styles.stepBtn}
                    >
                      <Ionicons name="add" size={18} color={c.primaryGlow} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.gangLabel, { color: c.textMuted }]}>GANG TARGET</Text>
                    <Text style={[styles.gangValue, { color: c.primaryGlow }]} numberOfLines={1}>
                      {gangTarget !== null ? formatAmount(gangTarget, ex.unit) : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {currentDay.exercises.length === 0 ? (
            <View style={[styles.restEmpty, { borderColor: restDashed }]}>
              <Text style={[styles.restTitle, { color: c.text }]}>Rest day</Text>
              <Text style={{ color: c.textMuted, fontSize: 13, textAlign: 'center' }}>
                Add an exercise above to make it a training day.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer */}
        <LinearGradient
          colors={[
            t.isLight ? 'rgba(244,246,252,0)' : 'rgba(5,7,15,0)',
            c.bg,
            c.bg,
          ]}
          locations={[0, 0.45, 1]}
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footerRow}>
            <View style={[styles.adaptiveFooter, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={[styles.adaptiveFooterLabel, { color: c.textMuted }]}>Adaptive Plan</Text>
              <View style={styles.adaptiveToggleRow}>
                <Switch
                  value={isAdaptive}
                  onValueChange={setIsAdaptive}
                  trackColor={{ false: c.surface3, true: c.primary }}
                  thumbColor="#FFFFFF"
                  style={styles.adaptiveSwitch}
                  accessibilityLabel="Adaptive plan"
                  accessibilityHint="Increases difficulty next week when the gang completes all goals"
                />
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Adaptive plan',
                      'If the gang completes every exercise every day, next week’s targets go up (+5 reps, +30 sec, or +0.5 mi). Miss a week and the same plan repeats.',
                    )
                  }
                  hitSlop={8}
                  accessibilityLabel="What is an adaptive plan?"
                  accessibilityRole="button"
                >
                  <Ionicons name="help-circle-outline" size={20} color={c.primaryGlow} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isPending}
              accessibilityRole="button"
              activeOpacity={0.9}
              style={styles.ctaTouch}
            >
              <LinearGradient
                colors={[...theme.aura]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.cta,
                  {
                    shadowColor: c.primary,
                    opacity: isPending ? 0.7 : 1,
                  },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaLabel}>
                    {isEditing ? 'SAVE CHANGES' : 'PUBLISH'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <Modal
        visible={!!editingTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingTarget(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>Set target</Text>
            <TextInput
              autoFocus
              value={editingTarget?.value ?? ''}
              onChangeText={(v) =>
                setEditingTarget((prev) =>
                  prev
                    ? { ...prev, value: sanitizeAmountInput(v, prev.unit) }
                    : prev,
                )
              }
              keyboardType={
                editingTarget?.unit === 'miles' ? 'decimal-pad' : 'number-pad'
              }
              style={[
                styles.modalInput,
                {
                  backgroundColor: c.surface2,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
              placeholder={DEFAULT_TARGET[editingTarget?.unit ?? 'reps']}
              placeholderTextColor={c.textMuted}
              onSubmitEditing={commitTargetEdit}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditingTarget(null)}
                style={[styles.modalBtn, { borderColor: c.border }]}
              >
                <Text style={{ color: c.textDim, fontFamily: fontFamily.bodySemi }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={commitTargetEdit} activeOpacity={0.9}>
                <LinearGradient
                  colors={[...theme.aura]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.modalConfirm}
                >
                  <Text style={{ color: '#FFF', fontFamily: fontFamily.bodySemi }}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMid: { flex: 1, minWidth: 0 },
  headerRight: { alignItems: 'flex-end', flexShrink: 0 },
  kicker: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 22,
    lineHeight: 24,
    marginTop: 2,
  },
  daysSetLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  daysSetValue: {
    fontFamily: fontFamily.display,
    fontSize: 18,
  },
  boardPad: { paddingHorizontal: 20, paddingBottom: 6 },
  board: { flexDirection: 'row', gap: 5 },
  filterPinned: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  addChipsScroll: {
    flexGrow: 1,
  },
  addChips: {
    // Column + wrap + fixed height = max 2 rows, then next column (scroll sideways).
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    height: ADD_CHIP_HEIGHT * 2 + ADD_CHIP_GAP,
    gap: ADD_CHIP_GAP,
  },
  addChip: {
    height: ADD_CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  addChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  boardCellTouch: { flex: 1 },
  boardCell: {
    borderRadius: 11,
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
  },
  boardDay: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  boardFooter: {
    fontFamily: fontFamily.mono,
    fontSize: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  panelScroll: { flex: 1, minHeight: 0 },
  panelContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayName: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 22,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  copyLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  exCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  exTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 11,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCenter: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepValue: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    lineHeight: 22,
  },
  stepUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  gangLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  gangValue: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    marginTop: 1,
  },
  restEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  restTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
    marginBottom: 3,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adaptiveFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 48,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  adaptiveFooterLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  adaptiveToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adaptiveSwitch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
  },
  ctaTouch: {
    flex: 1,
  },
  cta: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaLabel: {
    fontFamily: fontFamily.display,
    fontSize: 14,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  error: {
    color: '#FF3D71',
    fontSize: 13,
    fontFamily: fontFamily.body,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,7,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
});
