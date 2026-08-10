import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { useAwardAchievements } from '@/hooks/use-award-achievements';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type {
  ChallengeEntry,
  ExerciseUnit,
  LeaderboardEntry,
  WeeklyChallengeCurrent,
} from '@/types';
import { levelFromXp } from '@/types';

export type ChallengeLeaderboardScope = 'world' | 'my_gangs' | 'gang';

export interface SubmitChallengeAttemptResult {
  ok: boolean;
  accepted: boolean;
  is_first_attempt: boolean;
  previous_best: number | null;
  best_score: number;
  attempt_count: number;
  score_submitted: number;
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>;
  xp_awarded: number;
}

interface EntryProfile {
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  xp: number;
  equipped_banner_id: string | null;
  equipped_title_id: string | null;
  equipped_avatar_border_id: string | null;
  equipped_level_border_id: string | null;
}

interface EntryRow {
  user_id: string;
  best_score: number;
  profile: EntryProfile | null;
}

function rankEntries(
  rows: EntryRow[],
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>,
): LeaderboardEntry[] {
  const ranked = rows
    .map((row) => {
      const p = row.profile;
      const xp = p?.xp ?? 0;
      return {
        user_id: row.user_id,
        full_name: p?.full_name ?? 'Athlete',
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        xp,
        level: levelFromXp(xp),
        equipped_banner_id: p?.equipped_banner_id ?? null,
        equipped_title_id: p?.equipped_title_id ?? null,
        equipped_avatar_border_id: p?.equipped_avatar_border_id ?? null,
        equipped_level_border_id: p?.equipped_level_border_id ?? null,
        unit,
        total: Number(row.best_score),
        position: 0,
      } satisfies LeaderboardEntry;
    })
    .sort((a, b) => b.total - a.total);

  ranked.forEach((row, i) => {
    row.position = i + 1;
  });
  return ranked;
}

/** Current active weekly challenge with type, exercise, and your entry. */
export function useCurrentWeeklyChallenge() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.currentWeeklyChallenge(),
    enabled: !!userId,
    queryFn: async (): Promise<WeeklyChallengeCurrent | null> => {
      const { data, error } = await supabase
        .from('weekly_challenges')
        .select(
          `
          *,
          challenge_type:challenge_types(
            *,
            exercise:exercises(id, name, unit, category)
          )
        `,
        )
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let myEntry: ChallengeEntry | null = null;
      if (userId) {
        const { data: entry, error: entryErr } = await supabase
          .from('challenge_entries')
          .select('*')
          .eq('weekly_challenge_id', data.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (entryErr) throw entryErr;
        myEntry = entry;
      }

      return {
        ...(data as Omit<WeeklyChallengeCurrent, 'my_entry'>),
        my_entry: myEntry,
      };
    },
  });
}

/** True when an active weekly challenge exists and the user has not attempted it yet. */
export function useNeedsWeeklyChallengeAttempt(): boolean {
  const { data: challenge, isLoading } = useCurrentWeeklyChallenge();
  if (isLoading || !challenge) return false;
  return challenge.my_entry == null;
}

/** Scoped individual leaderboard for a weekly challenge. */
export function useChallengeLeaderboard(
  challengeId: string | undefined,
  unit: Extract<ExerciseUnit, 'reps' | 'seconds'>,
  scope: ChallengeLeaderboardScope,
  gangId?: string,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.challengeLeaderboard(challengeId ?? '', scope, gangId),
    enabled: !!challengeId && !!userId && (scope !== 'gang' || !!gangId),
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!challengeId || !userId) return [];

      let allowedUserIds: Set<string> | null = null;

      if (scope === 'my_gangs') {
        const { data: myMemberships, error: myErr } = await supabase
          .from('gang_members')
          .select('gang_id')
          .eq('user_id', userId);
        if (myErr) throw myErr;
        const gangIds = (myMemberships ?? []).map((m) => m.gang_id);
        if (gangIds.length === 0) return [];

        const { data: peers, error: peerErr } = await supabase
          .from('gang_members')
          .select('user_id')
          .in('gang_id', gangIds);
        if (peerErr) throw peerErr;
        allowedUserIds = new Set((peers ?? []).map((p) => p.user_id));
      } else if (scope === 'gang') {
        if (!gangId) return [];
        const { data: members, error: mErr } = await supabase
          .from('gang_members')
          .select('user_id')
          .eq('gang_id', gangId);
        if (mErr) throw mErr;
        allowedUserIds = new Set((members ?? []).map((m) => m.user_id));
      }

      let query = supabase
        .from('challenge_entries')
        .select(
          `
          user_id,
          best_score,
          profile:profiles(
            full_name,
            username,
            avatar_url,
            xp,
            equipped_banner_id,
            equipped_title_id,
            equipped_avatar_border_id,
            equipped_level_border_id
          )
        `,
        )
        .eq('weekly_challenge_id', challengeId)
        .order('best_score', { ascending: false })
        .limit(100);

      if (allowedUserIds) {
        const ids = [...allowedUserIds];
        if (ids.length === 0) return [];
        query = query.in('user_id', ids);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows: EntryRow[] = (data ?? []).map((row) => ({
        user_id: row.user_id,
        best_score: Number(row.best_score),
        profile: row.profile as unknown as EntryProfile | null,
      }));

      return rankEntries(rows, unit);
    },
  });
}

/** Submit a camera-verified challenge attempt. */
export function useSubmitChallengeAttempt() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const awardAchievements = useAwardAchievements();

  return useMutation({
    mutationFn: async ({
      weeklyChallengeId,
      score,
    }: {
      weeklyChallengeId: string;
      score: number;
    }): Promise<SubmitChallengeAttemptResult> => {
      const { data, error } = await supabase.rpc('submit_challenge_attempt', {
        p_weekly_challenge_id: weeklyChallengeId,
        p_score: score,
      });
      if (error) throw error;
      return data as unknown as SubmitChallengeAttemptResult;
    },
    onSuccess: (_result, vars) => {
      void awardAchievements();
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentWeeklyChallenge() });
      void queryClient.invalidateQueries({
        queryKey: ['challenges', 'leaderboard', vars.weeklyChallengeId],
      });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.myChallengeEntry(vars.weeklyChallengeId, userId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed(userId) });
      }
    },
  });
}
