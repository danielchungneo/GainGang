import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { AmountInput } from '@/components/ui/amount-input';
import { parseActivityAmount, validateAmountInput } from '@/lib/activity-amount';
import { formatAmount } from '@/lib/format';
import {
  brand,
  fontFamily,
  radius,
  ranks,
  spacing,
  status,
  useTheme,
} from '@/lib/gaingang-theme';
import {
  splitTargetAcrossCycles,
  type WorkoutModeOptions,
} from '@/lib/rep-counting/workout-mode';
import type { ExerciseUnit } from '@/types';
import { Button } from './button';
import { GradientView } from './gradient-view';
import { ProgressBar } from './progress-bar';

export type DailyGoalProgressMode = 'individual' | 'gang';

export interface DailyGoalExerciseDisplay {
  key: string;
  name: string;
  unit: ExerciseUnit;
  gang: { current: number; target: number };
  individual: { current: number; target: number };
  cameraSupported?: boolean;
  onPerform?: () => void;
  isPerforming?: boolean;
  onManualLog?: (amount: number) => void | Promise<void>;
  isManualLogging?: boolean;
}

export interface DailyGoalCardProps {
  kind?: string;
  title: string;
  description?: string;
  timeLeft?: string;
  exercises: DailyGoalExerciseDisplay[];
  ctaLabel?: string;
  onPressCta?: () => void;
  /** When true, shows Individual / Gang toggle instead of both bars. */
  showProgressToggle?: boolean;
  /** When false, only gang progress bars are shown. Defaults to true. */
  showIndividual?: boolean;
  /** Cycle choices for workout mode (e.g. [1,2,3]). Empty/undefined hides the launcher. */
  workoutCycleOptions?: number[];
  /** Cycle choices after exercises already completed today are excluded. */
  workoutExcludeCompletedCycleOptions?: number[];
  /** Number of camera-unsupported exercises skipped by workout mode. */
  workoutSkippedCount?: number;
  /** Start a multi-exercise workout with the chosen cycle count. */
  onStartWorkout?: (cycles: number, options: WorkoutModeOptions) => void;
  style?: StyleProp<ViewStyle>;
}

/** Daily goal card with per-exercise progress and optional camera actions. */
export function DailyGoalCard({
  kind = 'Daily Goal',
  title,
  description,
  timeLeft,
  exercises,
  ctaLabel = 'LOG ACTIVITY',
  onPressCta,
  showProgressToggle = false,
  showIndividual = true,
  workoutCycleOptions,
  workoutExcludeCompletedCycleOptions,
  workoutSkippedCount = 0,
  onStartWorkout,
  style,
}: DailyGoalCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isEnded = timeLeft === 'Ended';
  const allComplete =
    exercises.length > 0 &&
    exercises.every(
      (ex) => ex.individual.target <= 0 || ex.individual.current >= ex.individual.target,
    );
  const [progressMode, setProgressMode] = useState<DailyGoalProgressMode>('individual');
  const [manualLogKey, setManualLogKey] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [isWorkoutPickerOpen, setIsWorkoutPickerOpen] = useState(false);
  const [selectedCycles, setSelectedCycles] = useState<number | null>(null);
  const [excludeCompletedExercises, setExcludeCompletedExercises] = useState(false);

  const manualExercise = exercises.find((ex) => ex.key === manualLogKey) ?? null;
  const canStartWorkout =
    !!onStartWorkout &&
    !!workoutCycleOptions &&
    workoutCycleOptions.length > 0 &&
    !isEnded;
  const statusColor = allComplete ? status.success : isEnded ? ranks.E.glow : status.success;
  const statusLabel = allComplete
    ? 'Complete'
    : isEnded
      ? 'Ended'
      : timeLeft
        ? `Active · ${timeLeft}`
        : null;

  function openManualLog(exercise: DailyGoalExerciseDisplay) {
    setManualLogKey(exercise.key);
    setManualAmount('');
    setManualError(null);
  }

  function closeManualLog() {
    setManualLogKey(null);
    setManualAmount('');
    setManualError(null);
  }

  function openWorkoutPicker() {
    if (!workoutCycleOptions?.length) return;
    setExcludeCompletedExercises(false);
    setSelectedCycles(workoutCycleOptions[0] ?? null);
    setIsWorkoutPickerOpen(true);
  }

  function closeWorkoutPicker() {
    setIsWorkoutPickerOpen(false);
    setSelectedCycles(null);
    setExcludeCompletedExercises(false);
  }

  function confirmWorkoutStart() {
    if (!onStartWorkout || selectedCycles == null) return;
    onStartWorkout(selectedCycles, { excludeCompletedExercises });
    closeWorkoutPicker();
  }

  function toggleExcludeCompletedExercises() {
    const nextValue = !excludeCompletedExercises;
    const nextCycleOptions = nextValue
      ? workoutExcludeCompletedCycleOptions ?? []
      : workoutCycleOptions ?? [];

    setExcludeCompletedExercises(nextValue);
    setSelectedCycles((current) =>
      current !== null && nextCycleOptions.includes(current)
        ? current
        : nextCycleOptions[0] ?? null,
    );
  }

  async function handleManualSubmit() {
    if (!manualExercise?.onManualLog) return;

    const validationError = validateAmountInput(manualAmount, manualExercise.unit);
    if (validationError) {
      setManualError(validationError);
      return;
    }

    const amount = parseActivityAmount(manualAmount, manualExercise.unit);
    if (amount === null) {
      setManualError('Enter a valid amount greater than 0');
      return;
    }

    try {
      await manualExercise.onManualLog(amount);
      closeManualLog();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Could not save activity');
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: allComplete ? 'rgba(45,212,191,0.55)' : c.borderGlow,
          shadowColor: allComplete ? status.success : c.primary,
          shadowOpacity: theme.mode === 'dark' ? (allComplete ? 0.45 : 0.55) : 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      <GradientView
        colors={
          allComplete
            ? [
                theme.mode === 'dark'
                  ? 'rgba(45,212,191,0.22)'
                  : 'rgba(45,212,191,0.16)',
                theme.mode === 'dark'
                  ? 'rgba(45,212,191,0.08)'
                  : 'rgba(45,212,191,0.06)',
              ]
            : [
                theme.mode === 'dark'
                  ? 'rgba(77,140,255,0.16)'
                  : 'rgba(47,109,255,0.10)',
                theme.mode === 'dark'
                  ? 'rgba(157,78,221,0.10)'
                  : 'rgba(123,47,222,0.08)',
              ]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.header,
          {
            borderBottomColor: allComplete ? 'rgba(45,212,191,0.28)' : c.border,
          },
        ]}
      >
        <Text
          style={[
            styles.kind,
            { color: allComplete ? status.success : c.primaryGlow },
          ]}
        >
          {allComplete ? '✓ CLEARED' : `⚔ ${kind.toUpperCase()}`}
        </Text>
        {!!statusLabel && (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        )}
      </GradientView>

      <View style={styles.body}>
        {allComplete ? (
          <View
            style={[
              styles.completeBanner,
              {
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(45,212,191,0.12)'
                    : 'rgba(45,212,191,0.10)',
                borderColor: 'rgba(45,212,191,0.35)',
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color={status.success} />
            <Text style={[styles.completeBannerText, { color: status.success }]}>
              All goals complete
            </Text>
          </View>
        ) : null}

        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {!!description && (
          <Text style={[styles.desc, { color: c.textDim }]}>{description}</Text>
        )}

        {showProgressToggle ? (
          <View
            style={[
              styles.segment,
              {
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(77,140,255,0.06)'
                    : 'rgba(47,109,255,0.05)',
                borderColor: c.borderGlow,
              },
            ]}
          >
            {(['individual', 'gang'] as const).map((mode) => {
              const active = progressMode === mode;
              const label = mode === 'individual' ? 'You' : 'Gang';
              const icon = mode === 'individual' ? 'person' : 'people';

              return (
                <Pressable
                  key={mode}
                  onPress={() => setProgressMode(mode)}
                  style={({ pressed }) => [
                    styles.segmentPressable,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  {active ? (
                    <LinearGradient
                      colors={theme.aura}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.segmentActive}
                    >
                      <Ionicons name={icon} size={10} color="#FFFFFF" />
                      <Text style={styles.segmentLabelActive}>{label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.segmentInactive}>
                      <Ionicons
                        name={mode === 'individual' ? 'person-outline' : 'people-outline'}
                        size={10}
                        color={c.textMuted}
                      />
                      <Text style={[styles.segmentLabelInactive, { color: c.textMuted }]}>
                        {label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {exercises.map((ex) => {
          const showGangBar = showProgressToggle
            ? progressMode === 'gang'
            : true;
          const showYouBar = showProgressToggle
            ? progressMode === 'individual'
            : showIndividual;
          const youComplete =
            ex.individual.target <= 0 || ex.individual.current >= ex.individual.target;
          const gangComplete =
            ex.gang.target <= 0 || ex.gang.current >= ex.gang.target;

          return (
            <View key={ex.key} style={styles.exerciseBlock}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseNameRow}>
                  {allComplete || youComplete ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={status.success}
                      style={styles.exerciseCheck}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.exerciseName,
                      { color: allComplete ? status.success : c.text },
                    ]}
                    numberOfLines={1}
                  >
                    {ex.name}
                  </Text>
                </View>

                {ex.onPerform ? (
                  <ExerciseActionButton
                    icon="videocam"
                    label={ex.unit === 'seconds' ? 'Time' : 'Count'}
                    loading={ex.isPerforming}
                    onPress={ex.onPerform}
                    accessibilityLabel={
                      ex.unit === 'seconds'
                        ? `Time ${ex.name} with camera`
                        : `Count ${ex.name} with camera`
                    }
                  />
                ) : ex.onManualLog ? (
                  <ExerciseActionButton
                    icon="add"
                    label="Log"
                    loading={ex.isManualLogging}
                    onPress={() => openManualLog(ex)}
                    accessibilityLabel={`Log ${ex.name}`}
                  />
                ) : null}
              </View>

              <View
                style={showProgressToggle ? styles.progressSlot : undefined}
              >
                {showGangBar ? (
                  <View
                    style={[
                      styles.progressBlock,
                      !showProgressToggle && styles.progressBlockSpaced,
                    ]}
                  >
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaLabel, { color: c.textMuted }]}>
                        GANG
                      </Text>
                      <Text
                        style={[
                          styles.metaVal,
                          {
                            color:
                              allComplete || gangComplete
                                ? status.success
                                : c.primaryGlow,
                          },
                        ]}
                      >
                        {formatAmount(ex.gang.current, ex.unit)} /{' '}
                        {formatAmount(ex.gang.target, ex.unit)}
                        {gangComplete ? ' ✓' : ''}
                      </Text>
                    </View>
                    <ProgressBar
                      value={ex.gang.target > 0 ? ex.gang.current / ex.gang.target : 0}
                      colors={
                        allComplete || gangComplete
                          ? [status.success, status.success]
                          : undefined
                      }
                      glowColor={
                        allComplete || gangComplete ? status.success : undefined
                      }
                    />
                  </View>
                ) : null}

                {showYouBar ? (
                  <View
                    style={[
                      styles.progressBlock,
                      !showProgressToggle && styles.progressBlockSpaced,
                    ]}
                  >
                    <View style={styles.metaRow}>
                      <Text style={[styles.metaLabel, { color: c.textMuted }]}>
                        YOU
                      </Text>
                      <Text
                        style={[
                          styles.metaVal,
                          {
                            color:
                              allComplete || youComplete
                                ? status.success
                                : c.secondaryGlow,
                          },
                        ]}
                      >
                        {formatAmount(ex.individual.current, ex.unit)} /{' '}
                        {formatAmount(ex.individual.target, ex.unit)}
                        {youComplete ? ' ✓' : ''}
                      </Text>
                    </View>
                    <ProgressBar
                      value={
                        ex.individual.target > 0
                          ? ex.individual.current / ex.individual.target
                          : 0
                      }
                      colors={
                        allComplete || youComplete
                          ? [status.success, status.success]
                          : [brand.violet, brand.violetGlow]
                      }
                      glowColor={
                        allComplete || youComplete ? status.success : brand.violet
                      }
                    />
                  </View>
                ) : null}
              </View>

              {ex.cameraSupported === false && !ex.onPerform && !ex.onManualLog ? (
                <Text style={[styles.unsupported, { color: c.textMuted }]}>
                  Camera counting not available for this exercise yet.
                </Text>
              ) : null}
            </View>
          );
        })}

        {canStartWorkout ? (
          <Button
            label="WORKOUT MODE"
            onPress={openWorkoutPicker}
            style={styles.workoutCta}
          />
        ) : null}

        {onPressCta ? <Button label={ctaLabel} onPress={onPressCta} /> : null}
      </View>

      <ManualLogModal
        visible={!!manualExercise}
        exerciseName={manualExercise?.name ?? ''}
        unit={manualExercise?.unit ?? 'reps'}
        currentAmount={manualExercise?.individual.current ?? 0}
        targetAmount={manualExercise?.individual.target ?? 0}
        amount={manualAmount}
        error={manualError}
        isSaving={manualExercise?.isManualLogging ?? false}
        onChangeAmount={(value) => {
          setManualAmount(value);
          if (manualError) setManualError(null);
        }}
        onClose={closeManualLog}
        onSubmit={() => void handleManualSubmit()}
      />

      <WorkoutCyclePickerModal
        visible={isWorkoutPickerOpen}
        cycleOptions={
          excludeCompletedExercises
            ? workoutExcludeCompletedCycleOptions ?? []
            : workoutCycleOptions ?? []
        }
        selectedCycles={selectedCycles}
        exercises={exercises}
        skippedCount={workoutSkippedCount}
        excludeCompletedExercises={excludeCompletedExercises}
        onSelectCycles={setSelectedCycles}
        onToggleExcludeCompletedExercises={toggleExcludeCompletedExercises}
        onClose={closeWorkoutPicker}
        onConfirm={confirmWorkoutStart}
      />
    </View>
  );
}

function manualLogFieldLabel(unit: ExerciseUnit): string {
  if (unit === 'miles') return 'Distance';
  if (unit === 'seconds') return 'Duration';
  return 'Amount';
}

interface ExerciseActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function ExerciseActionButton({
  icon,
  label,
  loading = false,
  onPress,
  accessibilityLabel,
}: ExerciseActionButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.performBtnOuter,
        {
          shadowColor: c.primary,
          opacity: pressed || loading ? 0.88 : 1,
          transform: [{ scale: pressed && !loading ? 0.97 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={theme.aura}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.performBtn}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons name={icon} size={15} color="#FFFFFF" />
            <Text style={styles.performLabel}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

interface ManualLogModalProps {
  visible: boolean;
  exerciseName: string;
  unit: ExerciseUnit;
  currentAmount: number;
  targetAmount: number;
  amount: string;
  error: string | null;
  isSaving: boolean;
  onChangeAmount: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

interface WorkoutCyclePickerModalProps {
  visible: boolean;
  cycleOptions: number[];
  selectedCycles: number | null;
  exercises: DailyGoalExerciseDisplay[];
  skippedCount: number;
  excludeCompletedExercises: boolean;
  onSelectCycles: (cycles: number) => void;
  onToggleExcludeCompletedExercises: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

function WorkoutCyclePickerModal({
  visible,
  cycleOptions,
  selectedCycles,
  exercises,
  skippedCount,
  excludeCompletedExercises,
  onSelectCycles,
  onToggleExcludeCompletedExercises,
  onClose,
  onConfirm,
}: WorkoutCyclePickerModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const workoutExercises = exercises.filter(
    (exercise) =>
      exercise.cameraSupported &&
      exercise.individual.target > 0 &&
      (!excludeCompletedExercises ||
        exercise.individual.current < exercise.individual.target),
  );
  const selectedBreakdown =
    selectedCycles === null
      ? []
      : workoutExercises.map((exercise) => ({
          ...exercise,
          amounts: splitTargetAcrossCycles(exercise.individual.target, selectedCycles),
        }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheetPressable} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: c.surface,
                borderColor: c.borderGlow,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Workout mode</Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close workout mode picker"
              >
                <Ionicons name="close" size={22} color={c.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.modalHint, { color: c.textDim }]}>
              A cycle is one round through every camera exercise. GainGang splits each target
              across your rounds, saves each set automatically, flashes what&apos;s next, and
              starts counting—no trips back to your phone.
            </Text>

            {skippedCount > 0 ? (
              <Text style={[styles.modalHint, { color: c.textMuted }]}>
                {skippedCount} exercise{skippedCount === 1 ? '' : 's'} without camera tracking will
                be skipped. Log {skippedCount === 1 ? 'it' : 'them'} manually.
              </Text>
            ) : null}

            <Pressable
              onPress={onToggleExcludeCompletedExercises}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: excludeCompletedExercises }}
              accessibilityLabel="Exclude completed exercises from reps"
            >
              <View
                style={[
                  styles.workoutCheckboxRow,
                  {
                    borderColor: c.borderGlow,
                    backgroundColor:
                      theme.mode === 'dark'
                        ? 'rgba(77,140,255,0.08)'
                        : 'rgba(47,109,255,0.06)',
                  },
                ]}
              >
                <Ionicons
                  name={excludeCompletedExercises ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={excludeCompletedExercises ? c.primaryGlow : c.textMuted}
                />
                <Text style={[styles.workoutCheckboxLabel, { color: c.text }]}>
                  Exclude completed exercises from reps
                </Text>
              </View>
            </Pressable>

            {excludeCompletedExercises ? (
              <Text style={[styles.workoutCheckboxHint, { color: c.textDim }]}>
                Completed exercises are skipped now and in later cycles.
              </Text>
            ) : null}

            <Text style={[styles.cycleLabel, { color: c.textMuted }]}>CYCLES</Text>
            <View style={styles.cycleRow}>
              {cycleOptions.map((cycles) => {
                const active = selectedCycles === cycles;
                return (
                  <Pressable
                    key={cycles}
                    onPress={() => onSelectCycles(cycles)}
                    style={({ pressed }) => [
                      styles.cycleChipOuter,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${cycles} cycle${cycles === 1 ? '' : 's'}`}
                  >
                    {active ? (
                      <LinearGradient
                        colors={theme.aura}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cycleChip}
                      >
                        <Text style={styles.cycleChipLabelActive}>{cycles}</Text>
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          styles.cycleChip,
                          styles.cycleChipInactive,
                          { borderColor: c.borderGlow },
                        ]}
                      >
                        <Text style={[styles.cycleChipLabelInactive, { color: c.text }]}>
                          {cycles}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {cycleOptions.length === 0 ? (
              <Text style={[styles.modalHint, { color: status.success }]}>
                Every camera-supported exercise is already complete.
              </Text>
            ) : null}

            {selectedCycles !== null ? (
              <View
                style={[
                  styles.workoutPreview,
                  {
                    backgroundColor:
                      theme.mode === 'dark'
                        ? 'rgba(77,140,255,0.08)'
                        : 'rgba(47,109,255,0.06)',
                    borderColor: c.borderGlow,
                  },
                ]}
              >
                <Text style={[styles.workoutPreviewTitle, { color: c.text }]}>
                  {selectedCycles === 1
                    ? 'One full round'
                    : `${selectedCycles} rounds · ${
                        excludeCompletedExercises ? 'up to ' : ''
                      }${selectedBreakdown.length * selectedCycles} sets`}
                </Text>
                <Text style={[styles.workoutPreviewHint, { color: c.textDim }]}>
                  {excludeCompletedExercises
                    ? 'Exercises will disappear from later rounds as soon as you complete their daily target.'
                    : selectedCycles === 1
                    ? 'Complete each exercise once at its full target.'
                    : `Example: a 20-rep target becomes ${splitTargetAcrossCycles(20, selectedCycles).join(' + ')} reps across the rounds.`}
                </Text>

                <ScrollView
                  style={styles.workoutPreviewScroll}
                  contentContainerStyle={styles.workoutPreviewList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={selectedBreakdown.length > 3}
                >
                  {selectedBreakdown.map((exercise) => (
                    <View key={exercise.key} style={styles.workoutPreviewRow}>
                      <Text
                        style={[styles.workoutPreviewName, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {exercise.name}
                      </Text>
                      <Text style={[styles.workoutPreviewAmounts, { color: c.primaryGlow }]}>
                        {exercise.amounts
                          .map((amount) => formatAmount(amount, exercise.unit))
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <View style={styles.modalActionHalf}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.modalSavePressable,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel workout mode"
                >
                  <View
                    style={[
                      styles.modalActionBtn,
                      styles.modalCancelBtn,
                      { borderColor: c.primaryGlow },
                    ]}
                  >
                    <Text style={[styles.modalActionLabel, { color: c.primaryGlow }]}>
                      Cancel
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View style={styles.modalActionHalf}>
                <Pressable
                  onPress={onConfirm}
                  disabled={selectedCycles == null}
                  style={({ pressed }) => [
                    styles.modalSavePressable,
                    { opacity: pressed || selectedCycles == null ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Start workout"
                >
                  <LinearGradient
                    colors={theme.aura}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.modalActionBtn,
                      styles.modalSaveBtn,
                      {
                        shadowColor: c.primary,
                        shadowOpacity: 0.6,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 6,
                      },
                    ]}
                  >
                    <Text style={[styles.modalActionLabel, { color: '#FFFFFF' }]}>
                      Start
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ManualLogModal({
  visible,
  exerciseName,
  unit,
  currentAmount,
  targetAmount,
  amount,
  error,
  isSaving,
  onChangeAmount,
  onClose,
  onSubmit,
}: ManualLogModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputBg = theme.mode === 'dark' ? c.surface3 : c.surface2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.modalSheetPressable} onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: c.surface,
                  borderColor: c.borderGlow,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>Log {exerciseName}</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={c.textMuted} />
                </Pressable>
              </View>

              <Text style={[styles.modalHint, { color: c.textDim }]}>
                Add to your total for today. You&apos;ve logged{' '}
                {formatAmount(currentAmount, unit)}
                {targetAmount > 0 ? ` / ${formatAmount(targetAmount, unit)}` : ''}.
              </Text>

              <AmountInput
                unit={unit}
                value={amount}
                onChangeValue={onChangeAmount}
                label={manualLogFieldLabel(unit)}
                inputBg={inputBg}
                inputBorder={c.border}
                textColor={c.text}
                placeholderColor={c.textMuted}
                labelColor={c.textMuted}
                autoFocus
              />

              {error ? <Text style={styles.modalError}>{error}</Text> : null}

              <View style={styles.modalActions}>
                <View style={styles.modalActionHalf}>
                  <Pressable
                    onPress={onClose}
                    disabled={isSaving}
                    style={({ pressed }) => [
                      styles.modalSavePressable,
                      { opacity: pressed || isSaving ? 0.7 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                  >
                    <View
                      style={[
                        styles.modalActionBtn,
                        styles.modalCancelBtn,
                        { borderColor: c.primaryGlow },
                      ]}
                    >
                      <Text style={[styles.modalActionLabel, { color: c.primaryGlow }]}>
                        Cancel
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.modalActionHalf}>
                  <Pressable
                    onPress={onSubmit}
                    disabled={isSaving}
                    style={({ pressed }) => [
                      styles.modalSavePressable,
                      { opacity: pressed || isSaving ? 0.85 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Save"
                  >
                    <LinearGradient
                      colors={theme.aura}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.modalActionBtn,
                        styles.modalSaveBtn,
                        {
                          shadowColor: c.primary,
                          shadowOpacity: 0.6,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 6,
                        },
                      ]}
                    >
                      {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={[styles.modalActionLabel, { color: '#FFFFFF' }]}>
                          Save
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  kind: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  status: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fontFamily.display, fontSize: 24, marginBottom: 4 },
  desc: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  completeBannerText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  exerciseNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  exerciseCheck: {
    marginRight: 6,
  },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.sm,
    gap: 2,
  },
  segmentPressable: {
    borderRadius: radius.pill,
  },
  segmentActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  segmentInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  segmentLabelActive: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  segmentLabelInactive: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  exerciseBlock: {
    marginTop: spacing.xs,
    marginBottom: 2,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  exerciseName: {
    flex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1 },
  metaVal: { fontFamily: fontFamily.mono, fontSize: 11 },
  progressSlot: {
    minHeight: 30,
    marginBottom: spacing.sm,
  },
  progressBlock: {},
  progressBlockSpaced: {
    marginBottom: spacing.sm,
  },
  performBtnOuter: {
    borderRadius: radius.pill,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  performBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  performLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  unsupported: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  workoutCta: {
    marginTop: spacing.sm,
  },
  cycleLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  workoutCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  workoutCheckboxLabel: {
    flexShrink: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 14,
  },
  workoutCheckboxHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  cycleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cycleChipOuter: {
    borderRadius: radius.pill,
  },
  cycleChip: {
    minWidth: 48,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cycleChipInactive: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cycleChipLabelActive: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
    color: '#FFFFFF',
  },
  cycleChipLabelInactive: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 18,
  },
  workoutPreview: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: 6,
  },
  workoutPreviewTitle: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 16,
  },
  workoutPreviewHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 17,
  },
  workoutPreviewScroll: {
    maxHeight: 150,
    marginTop: 2,
  },
  workoutPreviewList: {
    gap: 8,
  },
  workoutPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  workoutPreviewName: {
    flex: 1,
    fontFamily: fontFamily.bodySemi,
    fontSize: 13,
  },
  workoutPreviewAmounts: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    textAlign: 'right',
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheetPressable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontFamily: fontFamily.display,
    fontSize: 22,
  },
  modalHint: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  modalError: {
    color: '#ef4444',
    fontFamily: fontFamily.body,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: spacing.sm,
  },
  modalActionHalf: {
    flex: 1,
    minWidth: 0,
  },
  modalSavePressable: {
    width: '100%',
  },
  modalActionBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modalCancelBtn: {
    width: '100%',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  modalSaveBtn: {
    width: '100%',
  },
  modalActionLabel: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
