import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { useAwardAchievements } from '@/hooks/use-award-achievements';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { WarDivision } from '@/types';

export interface GangWarOpponent {
  id: string;
  name: string;
  banner_url: string | null;
  war_division: WarDivision | string | null;
  is_bot: boolean;
}

export interface GangWarDayRow {
  day_on: string;
  exercise_id: string;
  exercise_name: string;
  unit: string;
  is_today: boolean;
  is_future: boolean;
  our_score: number | null;
  their_score: number | null;
}

export interface GangWarPendingResult {
  match_id: string;
  won: boolean;
  division: WarDivision | string;
  our_score: number | null;
  their_score: number | null;
}

export interface GangWarActiveMatch {
  id: string;
  starts_on: string;
  ends_on: string;
  division: WarDivision | string;
  our_score: number;
  their_score: number;
  opponent: GangWarOpponent;
  days: GangWarDayRow[];
  vs_seen: boolean;
}

export interface GangWarState {
  ok: boolean;
  state: 'active' | 'unmatched';
  today: string;
  gang: {
    id: string;
    name: string;
    banner_url: string | null;
    war_division: WarDivision | string | null;
  };
  match?: GangWarActiveMatch;
  /** Highest scoring attempts today that contribute to the gang (up to 2). */
  my_top_scores: number[];
  my_attempt_count: number;
  pending_result: GangWarPendingResult | null;
}

export interface GangWarHistoryRow {
  match_id: string;
  starts_on: string;
  ends_on: string;
  division: WarDivision | string;
  won: boolean;
  our_score: number | null;
  their_score: number | null;
  opponent_name: string;
  opponent_is_bot: boolean;
}

export interface SubmitGangWarAttemptResult {
  ok: boolean;
  attempt_id: string;
  score_submitted: number;
  day_on: string;
  member_day_contribution: number;
  gang_day_score: number;
  gang_week_score: number;
}

export function useGangWarState(gangId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gangWarState(gangId, userId),
    enabled: !!gangId && !!userId,
    queryFn: async (): Promise<GangWarState> => {
      const { data, error } = await supabase.rpc('get_gang_war_state', {
        p_gang_id: gangId!,
      });
      if (error) throw error;
      const payload = data as unknown as GangWarState;
      return {
        ...payload,
        my_top_scores: (payload.my_top_scores ?? []).map(Number),
        my_attempt_count: Number(payload.my_attempt_count ?? 0),
      };
    },
  });
}

/** True when the user has an active war and fewer than 2 attempts today for any gang. */
export function useNeedsGangWarAttempts(): boolean {
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.needsGangWarAttempts(userId),
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data: needs, error } = await supabase.rpc('needs_gang_war_attempts');
      if (error) throw error;
      return !!needs;
    },
  });

  if (isLoading || data == null) return false;
  return data;
}

export function useGangWarHistory(gangId: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gangWarHistory(gangId, userId),
    enabled: !!gangId && !!userId,
    queryFn: async (): Promise<GangWarHistoryRow[]> => {
      const { data, error } = await supabase.rpc('get_gang_war_history', {
        p_gang_id: gangId!,
        p_limit: 20,
      });
      if (error) throw error;
      const payload = data as { history?: GangWarHistoryRow[] } | null;
      return payload?.history ?? [];
    },
  });
}

export function useSubmitGangWarAttempt() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const awardAchievements = useAwardAchievements();

  return useMutation({
    mutationFn: async (vars: {
      matchId: string;
      gangId: string;
      score: number;
    }): Promise<SubmitGangWarAttemptResult> => {
      const { data, error } = await supabase.rpc('submit_gang_war_attempt', {
        p_match_id: vars.matchId,
        p_gang_id: vars.gangId,
        p_score: vars.score,
      });
      if (error) throw error;
      return data as unknown as SubmitGangWarAttemptResult;
    },
    onSuccess: (_data, vars) => {
      void awardAchievements();
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gangWarState(vars.gangId, userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.needsGangWarAttempts(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: ['gang-wars', 'member-contributions'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['gang-wars', 'day-member-contributions'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed(vars.gangId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myActivities(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.followingFeed(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

export interface GangWarMemberContribution {
  user_id: string | null;
  full_name: string;
  avatar_url: string | null;
  contribution: number;
}

export interface GangWarMemberContributions {
  ok: boolean;
  gang_id: string;
  gang_name: string;
  is_bot: boolean;
  members: GangWarMemberContribution[];
}

export interface GangWarDayMemberContributions {
  ok: boolean;
  gang_id: string;
  gang_name: string;
  is_bot: boolean;
  day_on: string;
  exercise_name: string;
  unit: string;
  gang_day_total: number;
  members: GangWarMemberContribution[];
}

export function useGangWarMemberContributions(
  matchId: string | undefined,
  gangId: string | undefined,
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gangWarMemberContributions(matchId, gangId, userId),
    enabled: !!matchId && !!gangId && !!userId && enabled,
    queryFn: async (): Promise<GangWarMemberContributions> => {
      const { data, error } = await supabase.rpc('get_gang_war_member_contributions', {
        p_match_id: matchId!,
        p_gang_id: gangId!,
      });
      if (error) throw error;
      const payload = data as unknown as GangWarMemberContributions;
      return {
        ...payload,
        members: (payload.members ?? []).map((m) => ({
          ...m,
          contribution: Number(m.contribution ?? 0),
        })),
      };
    },
  });
}

export function useGangWarDayMemberContributions(
  matchId: string | undefined,
  gangId: string | undefined,
  dayOn: string | undefined,
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gangWarDayMemberContributions(matchId, gangId, dayOn, userId),
    enabled: !!matchId && !!gangId && !!dayOn && !!userId && enabled,
    queryFn: async (): Promise<GangWarDayMemberContributions> => {
      const { data, error } = await supabase.rpc('get_gang_war_day_member_contributions', {
        p_match_id: matchId!,
        p_gang_id: gangId!,
        p_day_on: dayOn!,
      });
      if (error) throw error;
      const payload = data as unknown as GangWarDayMemberContributions;
      return {
        ...payload,
        gang_day_total: Number(payload.gang_day_total ?? 0),
        members: (payload.members ?? []).map((m) => ({
          ...m,
          contribution: Number(m.contribution ?? 0),
        })),
      };
    },
  });
}

export function useMarkGangWarSeen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (vars: {
      matchId: string;
      kind: 'vs' | 'result';
      gangId: string;
    }) => {
      const { data, error } = await supabase.rpc('mark_gang_war_seen', {
        p_match_id: vars.matchId,
        p_kind: vars.kind,
      });
      if (error) throw error;
      return data;
    },
    onMutate: async (vars) => {
      const key = queryKeys.gangWarState(vars.gangId, userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GangWarState>(key);

      if (previous) {
        if (vars.kind === 'vs' && previous.match) {
          queryClient.setQueryData<GangWarState>(key, {
            ...previous,
            match: { ...previous.match, vs_seen: true },
          });
        } else if (vars.kind === 'result') {
          queryClient.setQueryData<GangWarState>(key, {
            ...previous,
            pending_result: null,
          });
        }
      }

      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gangWarState(vars.gangId, userId),
      });
    },
  });
}
