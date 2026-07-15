import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { ExerciseUnit, LeaderboardEntry } from '@/types';
import { levelFromXp } from '@/types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';

/** Rank boards that compare like-for-like volume (not seconds / holds). */
export type LeaderboardMetric = 'reps' | 'miles';

export interface LeaderboardBoards {
  reps: LeaderboardEntry[];
  miles: LeaderboardEntry[];
}

interface MemberProfile {
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
}

interface ExerciseAmount {
  amount: number;
  unit: ExerciseUnit;
}

function periodStart(period: LeaderboardPeriod): string | null {
  const now = new Date();
  if (period === 'daily') {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = (day + 6) % 7; // days since Monday
    now.setDate(now.getDate() - diff);
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  return null;
}

function emptyTotals(): Record<LeaderboardMetric, number> {
  return { reps: 0, miles: 0 };
}

function rankBoard(
  members: { user_id: string; profile: MemberProfile | null }[],
  totals: Map<string, Record<LeaderboardMetric, number>>,
  metric: LeaderboardMetric,
): LeaderboardEntry[] {
  const rows: LeaderboardEntry[] = members.map((m) => {
    const p = m.profile;
    const xp = p?.xp ?? 0;
    return {
      user_id: m.user_id,
      full_name: p?.full_name ?? 'Member',
      username: p?.username ?? null,
      avatar_url: p?.avatar_url ?? null,
      xp,
      level: levelFromXp(xp),
      unit: metric,
      total: totals.get(m.user_id)?.[metric] ?? 0,
      position: 0,
    };
  });

  rows.sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => {
    r.position = i + 1;
  });
  return rows;
}

/** Ranks gang members by reps and by distance separately over the chosen period. */
export function useLeaderboard(gangId: string, period: LeaderboardPeriod = 'weekly') {
  return useQuery({
    queryKey: queryKeys.leaderboard(gangId, period),
    enabled: !!gangId,
    queryFn: async (): Promise<LeaderboardBoards> => {
      const { data: members, error: mErr } = await supabase
        .from('gang_members')
        .select('user_id, profile:profiles(id, full_name, username, avatar_url, xp)')
        .eq('gang_id', gangId);
      if (mErr) throw mErr;

      let activityQuery = supabase
        .from('activities')
        .select('user_id, exercises:activity_exercises(amount, unit)')
        .eq('gang_id', gangId);
      const start = periodStart(period);
      if (start) activityQuery = activityQuery.gte('updated_at', start);
      const { data: acts, error: aErr } = await activityQuery;
      if (aErr) throw aErr;

      const totals = new Map<string, Record<LeaderboardMetric, number>>();
      for (const a of acts ?? []) {
        const userTotals = totals.get(a.user_id) ?? emptyTotals();
        for (const ex of (a.exercises as ExerciseAmount[] | undefined) ?? []) {
          if (ex.unit === 'reps' || ex.unit === 'miles') {
            userTotals[ex.unit] += Number(ex.amount);
          }
        }
        totals.set(a.user_id, userTotals);
      }

      const memberRows = (members ?? []).map((m) => ({
        user_id: m.user_id,
        profile: m.profile as unknown as MemberProfile | null,
      }));

      return {
        reps: rankBoard(memberRows, totals, 'reps'),
        miles: rankBoard(memberRows, totals, 'miles'),
      };
    },
  });
}
