import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useLogActivity, useQuestActivity, useUpdateActivity } from '@/hooks/use-activities';
import { useExercises } from '@/hooks/use-exercises';
import { useMyGangs } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  CATEGORY_LABELS,
  UNIT_LABELS,
  WEEKLY_SCHEDULE,
  todaysCategory,
  type Exercise,
  type ExerciseCategory,
  type ExerciseUnit,
} from '@/types';

export default function LogActivityScreen() {
  const params = useLocalSearchParams<{
    gangId?: string;
    questId?: string;
    category?: string;
    exerciseId?: string;
    exerciseName?: string;
    unit?: string;
  }>();
  const t = useThemeTokens();
  const logActivity = useLogActivity();
  const updateActivity = useUpdateActivity();
  const { data: myGangs } = useMyGangs();

  const lockedToQuest = !!params.questId;
  const { data: questActivity, isLoading: loadingQuestActivity } = useQuestActivity(
    lockedToQuest ? params.questId : undefined,
  );
  const isEditing = lockedToQuest && !!questActivity;

  const [gangId, setGangId] = useState<string | undefined>(params.gangId);
  const [category, setCategory] = useState<ExerciseCategory>(
    (params.category as ExerciseCategory) || todaysCategory(),
  );
  const [exerciseId, setExerciseId] = useState<string | undefined>(
    params.exerciseId || undefined,
  );
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  const { data: exercises } = useExercises(
    lockedToQuest ? undefined : category,
    lockedToQuest ? params.gangId : gangId,
  );

  const selectedExercise = useMemo((): Exercise | undefined => {
    if (lockedToQuest && params.exerciseId) {
      const fromList = exercises?.find((e) => e.id === params.exerciseId);
      if (fromList) return fromList;

      return {
        id: params.exerciseId,
        name: params.exerciseName ?? questActivity?.exercise_name ?? 'Exercise',
        category,
        unit: (params.unit as ExerciseUnit) ?? questActivity?.unit ?? 'reps',
        description: null,
        gang_id: params.gangId ?? null,
        created_at: '',
      };
    }

    return exercises?.find((e) => e.id === exerciseId) ?? exercises?.[0];
  }, [lockedToQuest, params, exercises, exerciseId, category, questActivity]);

  const unit = selectedExercise?.unit ?? 'reps';
  const isPending = logActivity.isPending || updateActivity.isPending;

  useEffect(() => {
    if (!questActivity || hasPrefilled) return;
    setAmount(String(questActivity.amount));
    setNotes(questActivity.notes ?? '');
    if (questActivity.exercise_id) setExerciseId(questActivity.exercise_id);
    setHasPrefilled(true);
  }, [questActivity, hasPrefilled]);

  async function handleSubmit() {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Enter how much you did');
    if (!selectedExercise) return setError('Pick an exercise');

    try {
      if (isEditing && questActivity) {
        await updateActivity.mutateAsync({
          id: questActivity.id,
          gangId: questActivity.gang_id,
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          category: selectedExercise.category,
          unit: selectedExercise.unit,
          amount: amt,
          notes: notes.trim() || undefined,
          previousAmount: questActivity.amount,
          previousUnit: questActivity.unit,
        });
      } else {
        await logActivity.mutateAsync({
          gangId,
          questId: params.questId,
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name,
          category: selectedExercise.category,
          unit: selectedExercise.unit,
          amount: amt,
          notes: notes.trim() || undefined,
        });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save activity');
    }
  }

  if (lockedToQuest && loadingQuestActivity) {
    return (
      <ScreenBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            {isEditing ? 'Update activity' : 'Log activity'}
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 16 }}>
          {/* gang attribution */}
          {!lockedToQuest && myGangs && myGangs.length > 0 ? (
            <View>
              <Label>Share with Gang</Label>
              <View className="flex-row flex-wrap gap-2">
                <Chip label="Just me" active={!gangId} onPress={() => setGangId(undefined)} />
                {myGangs.map((g) => (
                  <Chip key={g.id} label={g.name} active={gangId === g.id} onPress={() => setGangId(g.id)} />
                ))}
              </View>
            </View>
          ) : null}

          {/* category */}
          {!lockedToQuest ? (
            <View>
              <Label>Category</Label>
              <View className="flex-row flex-wrap gap-2">
                {WEEKLY_SCHEDULE.map((d) => (
                  <Chip
                    key={d.category}
                    label={CATEGORY_LABELS[d.category]}
                    active={category === d.category}
                    onPress={() => {
                      setCategory(d.category);
                      setExerciseId(undefined);
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* exercise */}
          <View>
            <Label>Exercise</Label>
            {lockedToQuest ? (
              <Text style={{ color: t.heading }} className="text-lg font-semibold">
                {selectedExercise?.name ?? '—'}
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {(exercises ?? []).map((ex) => (
                  <Chip
                    key={ex.id}
                    label={ex.name}
                    active={selectedExercise?.id === ex.id}
                    onPress={() => setExerciseId(ex.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* amount */}
          <View>
            <Label>{UNIT_LABELS[unit].long}</Label>
            <TextInput
              style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={t.placeholder}
            />
          </View>

          {/* notes */}
          <View>
            <Label>Notes (optional)</Label>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading, height: 80, textAlignVertical: 'top' },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How'd it feel?"
              placeholderTextColor={t.placeholder}
              multiline
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isPending}
            className="items-center rounded-xl py-4"
            style={{ backgroundColor: t.accent }}>
            {isPending ? (
              <ActivityIndicator color={t.accentOnPrimary} />
            ) : (
              <Text style={{ color: t.accentOnPrimary }} className="text-base font-bold">
                {isEditing ? 'Save changes' : 'Log it'}
              </Text>
            )}
          </TouchableOpacity>
        </GlassSurface>
      </ScrollView>
    </ScreenBackground>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const t = useThemeTokens();
  return (
    <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
      {children}
    </Text>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useThemeTokens();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: active ? t.accent : t.buttonBg,
        borderWidth: 1,
        borderColor: active ? t.accent : t.buttonBorder,
      }}>
      <Text style={{ color: active ? t.accentOnPrimary : t.body }} className="text-sm font-semibold">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#ef4444', fontSize: 13 },
});
