import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useExercises } from '@/hooks/use-exercises';
import { useCreateQuest } from '@/hooks/use-quests';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { todayISO } from '@/lib/format';
import { CATEGORY_LABELS, WEEKLY_SCHEDULE, type ExerciseCategory, type QuestType } from '@/types';

const GOAL_NAMES = [
  'The Iron Oath',
  'Gang of a Hundred',
  'Rise of the Weak',
  'The Daily Ascension',
  'Trial of Strength',
  'Shadow Grind',
  'The Monarch’s Demand',
  'Awakening Protocol',
];

export default function NewGoalScreen() {
  const { gangId } = useLocalSearchParams<{ gangId: string }>();
  const t = useThemeTokens();
  const createGoal = useCreateQuest();

  const [type, setType] = useState<QuestType>('daily');
  const [category, setCategory] = useState<ExerciseCategory>(WEEKLY_SCHEDULE[0].category);
  const [exerciseId, setExerciseId] = useState<string | undefined>();
  const [title, setTitle] = useState(GOAL_NAMES[0]);
  const [gangTarget, setGangTarget] = useState('200');
  const [individualTarget, setIndividualTarget] = useState('20');
  const [error, setError] = useState<string | null>(null);

  const { data: exercises } = useExercises(category, gangId);
  const selectedExercise = useMemo(
    () => exercises?.find((e) => e.id === exerciseId) ?? exercises?.[0],
    [exercises, exerciseId],
  );

  async function handleSubmit() {
    setError(null);
    const gang = Number(gangTarget);
    const indiv = Number(individualTarget);
    if (!Number.isFinite(gang) || gang <= 0) return setError('Enter a valid Gang target');
    if (!Number.isFinite(indiv) || indiv <= 0) return setError('Enter a valid individual target');
    if (!selectedExercise) return setError('Pick an exercise');

    try {
      await createGoal.mutateAsync({
        gangId: gangId!,
        type,
        title: title.trim(),
        dayCategory: category,
        exerciseId: selectedExercise.id,
        unit: selectedExercise.unit,
        gangTarget: gang,
        individualTarget: indiv,
        startsOn: todayISO(),
        endsOn: type === 'weekly' ? addDays(todayISO(), 6) : todayISO(),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create Goal');
    }
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            Issue a Goal
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 16 }}>
          <Segment
            label="Type"
            options={[
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
            ]}
            value={type}
            onChange={(v) => setType(v as QuestType)}
          />

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

          <View>
            <Label>Exercise</Label>
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
          </View>

          <View>
            <Label>Goal title</Label>
            <TextInput
              style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
              value={title}
              onChangeText={setTitle}
              placeholder="The Iron Oath"
              placeholderTextColor={t.placeholder}
            />
            <View className="mt-2 flex-row flex-wrap gap-2">
              {GOAL_NAMES.slice(0, 4).map((n) => (
                <Chip key={n} label={n} active={title === n} onPress={() => setTitle(n)} />
              ))}
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Label>Gang target ({selectedExercise?.unit ?? 'reps'})</Label>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
                value={gangTarget}
                onChangeText={setGangTarget}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <Label>Per member</Label>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
                value={individualTarget}
                onChangeText={setIndividualTarget}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createGoal.isPending}
            className="items-center rounded-xl py-4"
            style={{ backgroundColor: t.accent }}>
            {createGoal.isPending ? (
              <ActivityIndicator color={t.accentOnPrimary} />
            ) : (
              <Text style={{ color: t.accentOnPrimary }} className="text-base font-bold">
                Issue Goal
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

function Segment({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useThemeTokens();
  return (
    <View>
      <Label>{label}</Label>
      <View
        className="flex-row rounded-xl p-1"
        style={{ backgroundColor: t.buttonBg, borderWidth: 1, borderColor: t.buttonBorder }}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            className="flex-1 items-center rounded-lg py-2"
            style={{ backgroundColor: value === o.key ? t.accent : 'transparent' }}>
            <Text style={{ color: value === o.key ? t.accentOnPrimary : t.body }} className="font-semibold">
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
