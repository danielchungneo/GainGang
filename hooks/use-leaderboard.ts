import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { ExerciseUnit, LeaderboardEntry } from '@/types';
import { levelFromXp } from '@/types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';

/** Rank board that compares like-for-like volume (not seconds / holds). */
export type LeaderboardMetric = 'reps';

export interface LeaderboardBoards {
  reps: LeaderboardEntry[];
}

interface MemberProfile {
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  equipped_banner_id: string | null;
  equipped_title_id: string | null;
  equipped_avatar_border_id: string | null;
  equipped_level_border_id: string | null;
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

function rankBoard(
  members: { user_id: string; profile: MemberProfile | null }[],
  totals: Map<string, number>,
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
      equipped_banner_id: p?.equipped_banner_id ?? null,
      equipped_title_id: p?.equipped_title_id ?? null,
      equipped_avatar_border_id: p?.equipped_avatar_border_id ?? null,
      equipped_level_border_id: p?.equipped_level_border_id ?? null,
      unit: 'reps',
      total: totals.get(m.user_id) ?? 0,
      position: 0,
    };
  });

  rows.sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => {
    r.position = i + 1;
  });
  return rows;
}

/** Ranks gang members by reps over the chosen period. */
export function useLeaderboard(gangId: string, period: LeaderboardPeriod = 'weekly') {
  return useQuery({
    queryKey: queryKeys.leaderboard(gangId, period),
    enabled: !!gangId,
    queryFn: async (): Promise<LeaderboardBoards> => {
      const { data: members, error: mErr } = await supabase
        .from('gang_members')
        .select(
          'user_id, profile:profiles(id, full_name, username, avatar_url, xp, equipped_banner_id, equipped_title_id, equipped_avatar_border_id, equipped_level_border_id)',
        )
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

      const totals = new Map<string, number>();
      for (const a of acts ?? []) {
        let userTotal = totals.get(a.user_id) ?? 0;
        for (const ex of (a.exercises as ExerciseAmount[] | undefined) ?? []) {
          if (ex.unit === 'reps') {
            userTotal += Number(ex.amount);
          }
        }
        totals.set(a.user_id, userTotal);
      }

      const memberRows = (members ?? []).map((m) => ({
        user_id: m.user_id,
        profile: m.profile as unknown as MemberProfile | null,
      }));

      return {
        reps: rankBoard(memberRows, totals),
      };
    },
  });
}
