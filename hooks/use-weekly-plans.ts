import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { todayISO } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { mondayOfWeek, WEEK_DAYS } from '@/types';
import { parseActivityAmount } from '@/lib/activity-amount';
import type {
  DailyGoal,
  DailyGoalExerciseWithProgress,
  DailyGoalWithProgress,
  ExerciseCategory,
  WeeklyPlan,
  WeeklyPlanWithGoals,
} from '@/types';

interface DailyGoalRow extends DailyGoal {
  weekly_plan: { gang_id: string; status: string; gang: { name: string } | null };
  exercises: {
    id: string;
    exercise_id: string;
    unit: DailyGoalExerciseWithProgress['unit'];
    individual_target: number;
    sort_order: number;
    exercise: { name: string } | null;
  }[];
}

export interface CreateWeeklyPlanDayInput {
  dayOfWeek: number;
  title: string;
  dayCategory?: ExerciseCategory;
  exercises: { exerciseId: string; individualTarget: number }[];
}

export interface CreateWeeklyPlanInput {
  gangId: string;
  startsOn?: string;
  days: CreateWeeklyPlanDayInput[];
}

export interface UpdateWeeklyPlanInput {
  planId: string;
  days: CreateWeeklyPlanDayInput[];
}

export type WeeklyPlanDayInput = CreateWeeklyPlanDayInput;

/** Active weekly plan for a gang with all daily goals. */
export function useActiveWeeklyPlan(gangId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.activeWeeklyPlan(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<WeeklyPlanWithGoals | null> => {
      const { data: plan, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('gang_id', gangId)
        .eq('status', 'active')
        .order('starts_on', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!plan) return null;

      const dailyGoals = await fetchDailyGoalsForPlan(plan, userId);
      return { ...plan, daily_goals: dailyGoals };
    },
  });
}

/** A specific weekly plan by id (for editing). */
export function useWeeklyPlan(planId?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.weeklyPlan(planId),
    enabled: !!planId,
    queryFn: async (): Promise<WeeklyPlanWithGoals | null> => {
      const { data: plan, error } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('id', planId!)
        .maybeSingle();
      if (error) throw error;
      if (!plan) return null;

      const dailyGoals = await fetchDailyGoalsForPlan(plan, userId);
      return { ...plan, daily_goals: dailyGoals };
    },
  });
}

/** Today's daily goal for a single gang (if one exists). */
export function useGangTodaysDailyGoal(gangId: string) {
  const { data: plan, isLoading, refetch, isRefetching, error } = useActiveWeeklyPlan(gangId);
  const today = todayISO();
  const goal =
    plan?.daily_goals.find((g) => g.goal_date === today && g.exercises.length > 0) ?? null;

  return { data: goal, isLoading, refetch, isRefetching, error };
}

/** Today's daily goals across all gangs the user belongs to. */
export function useMyTodaysDailyGoals() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.myTodaysDailyGoals(userId),
    enabled: !!userId,
    queryFn: async (): Promise<DailyGoalWithProgress[]> => {
      const { data: memberships, error: mErr } = await supabase
        .from('gang_members')
        .select('gang_id')
        .eq('user_id', userId!);
      if (mErr) throw mErr;
      const gangIds = (memberships ?? []).map((m) => m.gang_id);
      if (gangIds.length === 0) return [];

      const { data: plans, error: pErr } = await supabase
        .from('weekly_plans')
        .select('*')
        .in('gang_id', gangIds)
        .eq('status', 'active');
      if (pErr) throw pErr;
      if (!plans || plans.length === 0) return [];

      const today = todayISO();
      const planIds = plans.map((p) => p.id);

      const { data: goals, error: gErr } = await supabase
        .from('daily_goals')
        .select(
          `*,
          weekly_plan:weekly_plans!inner(gang_id, status, gang:gangs(name)),
          exercises:daily_goal_exercises(
            id, exercise_id, unit, individual_target, sort_order,
            exercise:exercises(name)
          )`,
        )
        .in('weekly_plan_id', planIds)
        .eq('goal_date', today)
        .order('day_of_week', { ascending: true });
      if (gErr) throw gErr;

      const rows = (goals ?? []) as unknown as DailyGoalRow[];
      const withExercises = rows.filter((g) => g.exercises.length > 0);
      return hydrateDailyGoals(withExercises, userId);
    },
  });
}

/** A single daily goal with exercise progress. */
export function useDailyGoal(dailyGoalId?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.dailyGoal(dailyGoalId, userId),
    enabled: !!dailyGoalId,
    queryFn: async (): Promise<DailyGoalWithProgress | null> => {
      const { data: goal, error } = await supabase
        .from('daily_goals')
        .select(
          `*,
          weekly_plan:weekly_plans!inner(gang_id, status, gang:gangs(name)),
          exercises:daily_goal_exercises(
            id, exercise_id, unit, individual_target, sort_order,
            exercise:exercises(name)
          )`,
        )
        .eq('id', dailyGoalId!)
        .maybeSingle();
      if (error) throw error;
      if (!goal) return null;

      const [hydrated] = await hydrateDailyGoals([goal as unknown as DailyGoalRow], userId);
      return hydrated ?? null;
    },
  });
}

export function useCreateWeeklyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWeeklyPlanInput): Promise<WeeklyPlan> => {
      const days = input.days.map((d) => ({
        day_of_week: d.dayOfWeek,
        title: d.title.trim(),
        day_category: d.dayCategory ?? null,
        exercises: d.exercises.map((e) => ({
          exercise_id: e.exerciseId,
          individual_target: e.individualTarget,
        })),
      }));

      const { data, error } = await supabase.rpc('create_weekly_plan', {
        p_gang_id: input.gangId,
        p_starts_on: input.startsOn ?? mondayOfWeek(),
        p_days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gangWeeklyPlans(plan.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeWeeklyPlan(plan.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyPlan(plan.id) });
      queryClient.invalidateQueries({ queryKey: ['daily-goals', 'today'] });
    },
  });
}

export function useUpdateWeeklyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateWeeklyPlanInput): Promise<WeeklyPlan> => {
      const days = input.days.map((d) => ({
        day_of_week: d.dayOfWeek,
        title: d.title.trim(),
        day_category: d.dayCategory ?? null,
        exercises: d.exercises.map((e) => ({
          exercise_id: e.exerciseId,
          individual_target: e.individualTarget,
        })),
      }));

      const { data, error } = await supabase.rpc('update_weekly_plan', {
        p_plan_id: input.planId,
        p_days: days,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gangWeeklyPlans(plan.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeWeeklyPlan(plan.gang_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.weeklyPlan(plan.id) });
      queryClient.invalidateQueries({ queryKey: ['daily-goals', 'today'] });
    },
  });
}

export function buildDaysPayload(
  days: Record<
    number,
    {
      category: ExerciseCategory;
      exercises: {
        exerciseId: string;
        unit: DailyGoalExerciseWithProgress['unit'];
        individualTarget: string;
      }[];
    }
  >,
): CreateWeeklyPlanDayInput[] {
  return WEEK_DAYS.map((wd) => {
    const day = days[wd.dayOfWeek];
    const validExercises = day.exercises
      .map((e) => ({
        exerciseId: e.exerciseId,
        individualTarget: parseActivityAmount(e.individualTarget, e.unit),
      }))
      .filter(
        (e): e is { exerciseId: string; individualTarget: number } =>
          e.individualTarget !== null,
      );

    return {
      dayOfWeek: wd.dayOfWeek,
      title: '',
      dayCategory: day.category,
      exercises: validExercises,
    };
  });
}

async function fetchDailyGoalsForPlan(
  plan: WeeklyPlan,
  userId?: string,
): Promise<DailyGoalWithProgress[]> {
  const { data: goals, error } = await supabase
    .from('daily_goals')
    .select(
      `*,
      weekly_plan:weekly_plans!inner(gang_id, status, gang:gangs(name)),
      exercises:daily_goal_exercises(
        id, exercise_id, unit, individual_target, sort_order,
        exercise:exercises(name)
      )`,
    )
    .eq('weekly_plan_id', plan.id)
    .order('day_of_week', { ascending: true });
  if (error) throw error;
  return hydrateDailyGoals((goals ?? []) as unknown as DailyGoalRow[], userId);
}

async function hydrateDailyGoals(
  rows: DailyGoalRow[],
  userId?: string,
): Promise<DailyGoalWithProgress[]> {
  if (rows.length === 0) return [];

  const exerciseIds = rows.flatMap((g) => g.exercises.map((e) => e.id));
  const gangIds = [...new Set(rows.map((g) => g.weekly_plan.gang_id))];

  const memberCounts = await fetchMemberCounts(gangIds);

  const progressMap = new Map<string, { gang_total: number; contributor_count: number }>();
  if (exerciseIds.length > 0) {
    const { data: progress } = await supabase
      .from('daily_goal_exercise_progress')
      .select('daily_goal_exercise_id, gang_total, contributor_count')
      .in('daily_goal_exercise_id', exerciseIds);
    for (const p of progress ?? []) {
      if (p.daily_goal_exercise_id) {
        progressMap.set(p.daily_goal_exercise_id, {
          gang_total: Number(p.gang_total),
          contributor_count: p.contributor_count,
        });
      }
    }
  }

  let userTotals: Record<string, number> = {};
  let userActivities: Record<string, string> = {};
  if (userId && exerciseIds.length > 0) {
    const { data: up } = await supabase
      .from('daily_goal_exercise_user_progress')
      .select('daily_goal_exercise_id, user_total')
      .eq('user_id', userId)
      .in('daily_goal_exercise_id', exerciseIds);
    for (const row of up ?? []) {
      if (row.daily_goal_exercise_id) {
        userTotals[row.daily_goal_exercise_id] = Number(row.user_total);
      }
    }

    const dailyGoalIds = rows.map((g) => g.id);
    const { data: acts } = await supabase
      .from('activities')
      .select('id, daily_goal_id, exercises:activity_exercises(daily_goal_exercise_id)')
      .eq('user_id', userId)
      .in('daily_goal_id', dailyGoalIds);
    for (const a of acts ?? []) {
      const exerciseRows = (a.exercises as { daily_goal_exercise_id: string | null }[] | undefined) ?? [];
      for (const ex of exerciseRows) {
        if (ex.daily_goal_exercise_id) {
          userActivities[ex.daily_goal_exercise_id] = a.id;
        }
      }
    }
  }

  return rows.map((g) => {
    const gangId = g.weekly_plan.gang_id;
    const memberCount = memberCounts[gangId] ?? 1;

    const exercises: DailyGoalExerciseWithProgress[] = g.exercises
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e) => {
        const p = progressMap.get(e.id);
        return {
          id: e.id,
          exercise_id: e.exercise_id,
          exercise_name: e.exercise?.name ?? 'Exercise',
          unit: e.unit,
          individual_target: e.individual_target,
          gang_target: e.individual_target * memberCount,
          gang_total: p?.gang_total ?? 0,
          contributor_count: p?.contributor_count ?? 0,
          user_total: userTotals[e.id] ?? 0,
          activity_id: userActivities[e.id] ?? null,
        };
      });

    return {
      id: g.id,
      weekly_plan_id: g.weekly_plan_id,
      day_of_week: g.day_of_week,
      title: g.title,
      day_category: g.day_category,
      goal_date: g.goal_date,
      gang_id: gangId,
      gang_name: g.weekly_plan.gang?.name ?? undefined,
      member_count: memberCount,
      exercises,
    };
  });
}

async function fetchMemberCounts(gangIds: string[]): Promise<Record<string, number>> {
  if (gangIds.length === 0) return {};
  const { data, error } = await supabase
    .from('gang_members')
    .select('gang_id')
    .in('gang_id', gangIds);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.gang_id] = (counts[row.gang_id] ?? 0) + 1;
  }
  return counts;
}
