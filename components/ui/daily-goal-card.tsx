import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  style,
}: DailyGoalCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isEnded = timeLeft === 'Ended';
  const [progressMode, setProgressMode] = useState<DailyGoalProgressMode>('individual');
  const [manualLogKey, setManualLogKey] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const manualExercise = exercises.find((ex) => ex.key === manualLogKey) ?? null;

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
          borderColor: c.borderGlow,
          shadowColor: c.primary,
          shadowOpacity: theme.mode === 'dark' ? 0.55 : 0.3,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    >
      <GradientView
        colors={[
          theme.mode === 'dark'
            ? 'rgba(77,140,255,0.16)'
            : 'rgba(47,109,255,0.10)',
          theme.mode === 'dark'
            ? 'rgba(157,78,221,0.10)'
            : 'rgba(123,47,222,0.08)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { borderBottomColor: c.border }]}
      >
        <Text style={[styles.kind, { color: c.primaryGlow }]}>
          ⚔ {kind.toUpperCase()}
        </Text>
        {!!timeLeft && (
          <View style={styles.statusRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isEnded ? ranks.E.glow : status.success },
              ]}
            />
            <Text
              style={[
                styles.status,
                { color: isEnded ? ranks.E.glow : status.success },
              ]}
            >
              {isEnded ? 'Ended' : `Active · ${timeLeft}`}
            </Text>
          </View>
        )}
      </GradientView>

      <View style={styles.body}>
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

          return (
            <View key={ex.key} style={styles.exerciseBlock}>
              <View style={styles.exerciseHeader}>
                <Text
                  style={[styles.exerciseName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {ex.name}
                </Text>

                {ex.onPerform ? (
                  <ExerciseActionButton
                    icon="videocam"
                    label="Count"
                    loading={ex.isPerforming}
                    onPress={ex.onPerform}
                    accessibilityLabel={`Count ${ex.name} with camera`}
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
                      <Text style={[styles.metaVal, { color: c.primaryGlow }]}>
                        {formatAmount(ex.gang.current, ex.unit)} /{' '}
                        {formatAmount(ex.gang.target, ex.unit)}
                      </Text>
                    </View>
                    <ProgressBar
                      value={ex.gang.target > 0 ? ex.gang.current / ex.gang.target : 0}
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
                      <Text style={[styles.metaVal, { color: c.secondaryGlow }]}>
                        {formatAmount(ex.individual.current, ex.unit)} /{' '}
                        {formatAmount(ex.individual.target, ex.unit)}
                        {ex.individual.current >= ex.individual.target ? ' ✓' : ''}
                      </Text>
                    </View>
                    <ProgressBar
                      value={
                        ex.individual.target > 0
                          ? ex.individual.current / ex.individual.target
                          : 0
                      }
                      colors={[brand.violet, brand.violetGlow]}
                      glowColor={brand.violet}
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
