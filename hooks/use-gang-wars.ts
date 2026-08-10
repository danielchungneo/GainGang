import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
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
      return data as unknown as GangWarState;
    },
  });
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gangWarState(vars.gangId, userId),
      });
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
