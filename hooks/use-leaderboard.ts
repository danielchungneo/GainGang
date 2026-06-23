import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/types';
import { levelFromXp } from '@/types';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';

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

/** Ranks gang members by total contribution amount over the chosen period. */
export function useLeaderboard(gangId: string, period: LeaderboardPeriod = 'weekly') {
  return useQuery({
    queryKey: queryKeys.leaderboard(gangId, period),
    enabled: !!gangId,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      // Member profiles so even zero-contribution members appear.
      const { data: members, error: mErr } = await supabase
        .from('gang_members')
        .select('user_id, profile:profiles(id, full_name, username, avatar_url, xp)')
        .eq('gang_id', gangId);
      if (mErr) throw mErr;

      let activityQuery = supabase
        .from('activities')
        .select('user_id, amount')
        .eq('gang_id', gangId);
      const start = periodStart(period);
      if (start) activityQuery = activityQuery.gte('created_at', start);
      const { data: acts, error: aErr } = await activityQuery;
      if (aErr) throw aErr;

      const totals = new Map<string, number>();
      for (const a of acts ?? []) totals.set(a.user_id, (totals.get(a.user_id) ?? 0) + a.amount);

      const rows: LeaderboardEntry[] = (members ?? []).map((m) => {
        const p = m.profile as unknown as {
          full_name: string;
          username: string | null;
          avatar_url: string | null;
          xp: number;
        };
        const xp = p?.xp ?? 0;
        return {
          user_id: m.user_id,
          full_name: p?.full_name ?? 'Member',
          username: p?.username ?? null,
          avatar_url: p?.avatar_url ?? null,
          xp,
          level: levelFromXp(xp),
          total: totals.get(m.user_id) ?? 0,
          position: 0,
        };
      });

      rows.sort((a, b) => b.total - a.total);
      rows.forEach((r, i) => (r.position = i + 1));
      return rows;
    },
  });
}
