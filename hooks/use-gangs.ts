import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Gang, GangPrivacy, GangSummary, GangMemberWithProfile } from '@/types';

/** Gangs the signed-in user belongs to (with role + member count). */
export function useMyGangs() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.myGangs(userId),
    enabled: !!userId,
    queryFn: async (): Promise<GangSummary[]> => {
      const { data, error } = await supabase
        .from('gang_members')
        .select('role, gang:gangs(*)')
        .eq('user_id', userId!);
      if (error) throw error;

      const gangs = (data ?? [])
        .map((row) => {
          const gang = row.gang as unknown as Gang | null;
          if (!gang) return null;
          return { ...gang, role: row.role } as GangSummary;
        })
        .filter((g): g is GangSummary => g !== null);

      // Hydrate member counts in one grouped query.
      const counts = await memberCounts(gangs.map((g) => g.id));
      return gangs.map((g) => ({ ...g, member_count: counts[g.id] ?? 1 }));
    },
  });
}

/** A single gang by id. */
export function useGang(gangId: string) {
  return useQuery({
    queryKey: queryKeys.gang(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<GangSummary | null> => {
      const { data, error } = await supabase.from('gangs').select('*').eq('id', gangId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const counts = await memberCounts([gangId]);
      const { data: me } = await supabase
        .from('gang_members')
        .select('role')
        .eq('gang_id', gangId)
        .maybeSingle();
      return { ...data, role: me?.role ?? 'member', member_count: counts[gangId] ?? 1 };
    },
  });
}

/** Full roster for a gang, ordered by XP (doubles as the all-time leaderboard base). */
export function useGangMembers(gangId: string) {
  return useQuery({
    queryKey: queryKeys.gangMembers(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<GangMemberWithProfile[]> => {
      const { data, error } = await supabase
        .from('gang_members')
        .select('gang_id, user_id, role, joined_at, profile:profiles(id, full_name, username, avatar_url, rank, xp)')
        .eq('gang_id', gangId);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        profile: row.profile as unknown as GangMemberWithProfile['profile'],
      })) as GangMemberWithProfile[];
    },
  });
}

/** Discover public gangs to join. */
export function useDiscoverGangs(search?: string) {
  return useQuery({
    queryKey: queryKeys.discoverGangs(search),
    queryFn: async (): Promise<Gang[]> => {
      let query = supabase.from('gangs').select('*').eq('privacy', 'public').order('created_at', { ascending: false }).limit(40);
      if (search && search.trim()) query = query.ilike('name', `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface CreateGangInput {
  name: string;
  description?: string;
  icon?: string;
  privacy?: GangPrivacy;
}

export function useCreateGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateGangInput): Promise<Gang> => {
      const { data, error } = await supabase.rpc('create_gang', {
        p_name: input.name,
        p_description: input.description ?? null,
        p_icon: input.icon ?? null,
        p_privacy: input.privacy ?? 'public',
      });
      if (error) throw error;
      return data as Gang;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
    },
  });
}

export function useJoinGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (inviteCode: string): Promise<Gang> => {
      const { data, error } = await supabase.rpc('join_gang', { p_invite_code: inviteCode });
      if (error) throw error;
      return data as Gang;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
    },
  });
}

export function useJoinPublicGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (gangId: string): Promise<Gang> => {
      const { data, error } = await supabase.rpc('join_public_gang', { p_gang_id: gangId });
      if (error) throw error;
      return data as Gang;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
    },
  });
}

export function useLeaveGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (gangId: string): Promise<void> => {
      if (!session?.user.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('gang_members')
        .delete()
        .eq('gang_id', gangId)
        .eq('user_id', session.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
    },
  });
}

// ---- helpers ----
async function memberCounts(gangIds: string[]): Promise<Record<string, number>> {
  if (gangIds.length === 0) return {};
  const { data, error } = await supabase
    .from('gang_members')
    .select('gang_id')
    .in('gang_id', gangIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.gang_id] = (counts[row.gang_id] ?? 0) + 1;
  return counts;
}
