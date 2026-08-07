import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/context/auth-context';
import { useAwardAchievements } from '@/hooks/use-award-achievements';
import { queryKeys } from '@/lib/query-keys';
import { parseCrateContents, type CrateReward } from '@/lib/rewards';
import { supabase } from '@/lib/supabase';
import type {
  CosmeticItem,
  CosmeticKind,
  EquippedCosmeticSlots,
  OwnedCosmetic,
  Profile,
} from '@/types';

export type StarterCosmeticCrateCategory =
  | 'banner'
  | 'title'
  | 'icon_border'
  | 'level_border';

export interface StarterCosmeticCrateStatus {
  category: StarterCosmeticCrateCategory;
  cosmeticId: string;
  openedAt: string;
}

export function useCosmeticCatalog() {
  return useQuery({
    queryKey: queryKeys.cosmeticCatalog(),
    queryFn: async (): Promise<CosmeticItem[]> => {
      const { data, error } = await supabase
        .from('cosmetic_items')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOwnedCosmetics(userId?: string) {
  const { session } = useAuth();
  const id = userId ?? session?.user.id;

  return useQuery({
    queryKey: queryKeys.ownedCosmetics(id),
    enabled: !!id,
    queryFn: async (): Promise<OwnedCosmetic[]> => {
      const { data, error } = await supabase
        .from('user_cosmetics')
        .select('*, item:cosmetic_items(*)')
        .eq('user_id', id!)
        .order('acquired_at', { ascending: false });
      if (error) throw error;

      return (data ?? [])
        .map((row) => {
          const item = row.item as unknown as CosmeticItem | null;
          if (!item) return null;
          return {
            user_id: row.user_id,
            cosmetic_id: row.cosmetic_id,
            acquired_at: row.acquired_at,
            source: row.source,
            item,
          } satisfies OwnedCosmetic;
        })
        .filter((row): row is OwnedCosmetic => row != null);
    },
  });
}

export function useStarterCosmeticCrates() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.starterCosmeticCrates(userId),
    enabled: !!userId,
    queryFn: async (): Promise<StarterCosmeticCrateStatus[]> => {
      const { data, error } = await supabase
        .from('user_starter_cosmetic_crates')
        .select('category, cosmetic_id, opened_at')
        .eq('user_id', userId!);
      if (error) throw error;

      return (data ?? []).map((row) => ({
        category: row.category,
        cosmeticId: row.cosmetic_id,
        openedAt: row.opened_at,
      }));
    },
  });
}

export function useOpenStarterCosmeticCrate() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const awardAchievements = useAwardAchievements();

  return useMutation({
    mutationFn: async (
      category: StarterCosmeticCrateCategory,
    ): Promise<CrateReward[]> => {
      const { data, error } = await supabase.rpc('open_starter_cosmetic_crate', {
        p_category: category,
      });
      if (error) throw error;

      const contents = parseCrateContents(data);
      if (!contents) throw new Error('Starter crate returned an invalid reward');
      return contents.rewards;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.starterCosmeticCrates(userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.ownedCosmetics(userId),
      });
      void awardAchievements();
    },
  });
}

/** Resolve equipped cosmetic rows from profile slot ids + catalog. */
export function useEquippedCosmetics(profile?: Profile | null): EquippedCosmeticSlots {
  const { data: catalog } = useCosmeticCatalog();

  return useMemo(() => {
    const byId = new Map((catalog ?? []).map((item) => [item.id, item]));
    return {
      title: profile?.equipped_title_id
        ? (byId.get(profile.equipped_title_id) ?? null)
        : null,
      avatarBorder: profile?.equipped_avatar_border_id
        ? (byId.get(profile.equipped_avatar_border_id) ?? null)
        : null,
      levelBorder: profile?.equipped_level_border_id
        ? (byId.get(profile.equipped_level_border_id) ?? null)
        : null,
      banner: profile?.equipped_banner_id
        ? (byId.get(profile.equipped_banner_id) ?? null)
        : null,
    };
  }, [catalog, profile]);
}

export function useEquipCosmetic() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (cosmeticId: string): Promise<Profile> => {
      const { data, error } = await supabase.rpc('equip_cosmetic', {
        p_cosmetic_id: cosmeticId,
      });
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ownedCosmetics(userId) });
    },
  });
}

export function useUnequipCosmetic() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (kind: CosmeticKind): Promise<Profile> => {
      const { data, error } = await supabase.rpc('unequip_cosmetic', {
        p_kind: kind,
      });
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ownedCosmetics(userId) });
    },
  });
}
