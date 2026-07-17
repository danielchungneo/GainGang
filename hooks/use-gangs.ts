import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { removeGangBannerImage } from '@/lib/gang-banner-upload';
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
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.gang(gangId),
    enabled: !!gangId,
    queryFn: async (): Promise<GangSummary | null> => {
      const { data, error } = await supabase.from('gangs').select('*').eq('id', gangId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const counts = await memberCounts([gangId]);
      let role: GangSummary['role'] = 'member';
      if (userId) {
        const { data: me } = await supabase
          .from('gang_members')
          .select('role')
          .eq('gang_id', gangId)
          .eq('user_id', userId)
          .maybeSingle();
        role = (me?.role as GangSummary['role']) ?? 'member';
      }
      return { ...data, role, member_count: counts[gangId] ?? 1 };
    },
  });
}

/** Full roster for a gang, ordered by XP (doubles as the all-time leaderboard base). */
export function useGangMembers(gangId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: queryKeys.gangMembers(gangId),
    enabled: !!gangId && enabled,
    queryFn: async (): Promise<GangMemberWithProfile[]> => {
      const { data, error } = await supabase
        .from('gang_members')
        .select('gang_id, user_id, role, joined_at, profile:profiles(id, full_name, username, avatar_url, rank, xp)')
        .eq('gang_id', gangId);
      if (error) throw error;
      const rows = (data ?? []).map((row) => ({
        ...row,
        profile: row.profile as unknown as GangMemberWithProfile['profile'],
      })) as GangMemberWithProfile[];

      return rows.sort((a, b) => (b.profile.xp ?? 0) - (a.profile.xp ?? 0));
    },
  });
}

/** Discover public gangs to join (excludes crews the user already belongs to). */
export function useDiscoverGangs(search?: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.discoverGangs(search, userId),
    enabled: !!userId,
    queryFn: async (): Promise<Gang[]> => {
      const { data: memberships, error: memberError } = await supabase
        .from('gang_members')
        .select('gang_id')
        .eq('user_id', userId!);
      if (memberError) throw memberError;

      const memberGangIds = (memberships ?? []).map((row) => row.gang_id);

      let query = supabase
        .from('gangs')
        .select('*')
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .limit(40);

      if (memberGangIds.length > 0) {
        query = query.not('id', 'in', `(${memberGangIds.join(',')})`);
      }
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
        p_icon: null,
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

export interface GangInvitePreview {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  banner_url: string | null;
  privacy: GangPrivacy;
  member_count: number;
  already_member: boolean;
}

/** Preview a gang from an invite link (works for invite-only gangs). */
export function useGangInvitePreview(inviteCode: string) {
  const { session } = useAuth();
  const code = inviteCode.trim().toUpperCase();

  return useQuery({
    queryKey: queryKeys.gangInvitePreview(code),
    enabled: !!session?.user.id && code.length >= 4,
    queryFn: async (): Promise<GangInvitePreview> => {
      const { data, error } = await supabase.rpc('preview_gang_invite', {
        p_invite_code: code,
      });
      if (error) throw error;
      return data as unknown as GangInvitePreview;
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
    onSuccess: (_data, gangId) => {
      queryClient.removeQueries({ queryKey: queryKeys.gang(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.gangMembers(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.activeWeeklyPlan(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.feed(gangId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTodaysDailyGoals(session?.user.id) });
      queryClient.invalidateQueries({ queryKey: ['gangs', 'discover'] });
    },
  });
}

export interface UpdateGangInput {
  gangId: string;
  name?: string;
  description?: string | null;
  banner_url?: string | null;
  privacy?: GangPrivacy;
}

export function useUpdateGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: UpdateGangInput): Promise<Gang> => {
      const { gangId, ...patch } = input;
      const update: Record<string, unknown> = {};
      if (patch.name !== undefined) update.name = patch.name;
      if (patch.description !== undefined) update.description = patch.description;
      if (patch.banner_url !== undefined) update.banner_url = patch.banner_url;
      if (patch.privacy !== undefined) update.privacy = patch.privacy;

      const { data, error } = await supabase
        .from('gangs')
        .update(update)
        .eq('id', gangId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (gang) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gang(gang.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
      queryClient.invalidateQueries({ queryKey: ['gangs', 'discover'] });
    },
  });
}

export function useDeleteGang() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (gangId: string): Promise<void> => {
      try {
        await removeGangBannerImage(gangId);
      } catch {
        // Still delete the gang if storage cleanup fails.
      }
      const { error } = await supabase.from('gangs').delete().eq('id', gangId);
      if (error) throw error;
    },
    onSuccess: (_data, gangId) => {
      queryClient.removeQueries({ queryKey: queryKeys.gang(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.gangMembers(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.activeWeeklyPlan(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.gangWeeklyPlans(gangId) });
      queryClient.removeQueries({ queryKey: queryKeys.feed(gangId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGangs(session?.user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTodaysDailyGoals(session?.user.id) });
      queryClient.invalidateQueries({ queryKey: ['gangs', 'discover'] });
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
