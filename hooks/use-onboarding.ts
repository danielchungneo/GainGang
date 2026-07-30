import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import {
  consumePendingEquipment,
  consumePendingFitnessLevel,
  isCrewSetupComplete,
  isEquipmentPromptComplete,
  isPostAuthNotificationsComplete,
  isPreAuthOnboardingComplete,
  savePendingEquipment,
  savePendingFitnessLevel,
  setEquipmentPromptComplete,
  setPostAuthNotificationsComplete,
  setPreAuthOnboardingComplete,
  type PendingEquipment,
} from '@/lib/onboarding';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { FitnessLevel, Profile } from '@/types';

const PRE_AUTH_QUERY_KEY = ['onboarding', 'pre-auth-complete'] as const;

export { PRE_AUTH_QUERY_KEY };

function postAuthNotificationsQueryKey(userId?: string) {
  return ['onboarding', 'post-auth-notifications', userId] as const;
}

function equipmentPromptQueryKey(userId?: string) {
  return ['onboarding', 'equipment-prompt', userId] as const;
}

/** Device-local: first-run tour before sign-in. */
export function useNeedsPreAuthOnboarding(): {
  needsPreAuthOnboarding: boolean;
  isLoading: boolean;
} {
  const { data, isLoading, isPending } = useQuery({
    queryKey: PRE_AUTH_QUERY_KEY,
    queryFn: isPreAuthOnboardingComplete,
    staleTime: Infinity,
  });

  return {
    needsPreAuthOnboarding: data === false,
    isLoading: isLoading || isPending,
  };
}

export function useCompletePreAuthOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await setPreAuthOnboardingComplete();
    },
    onSuccess: () => {
      queryClient.setQueryData(PRE_AUTH_QUERY_KEY, true);
    },
  });
}

/** Signed-in new accounts still need the join/create crew prompt. */
export function useNeedsCrewSetup(): {
  needsCrewSetup: boolean;
  isLoading: boolean;
  profile: Profile | null | undefined;
} {
  const { session, isPending: authPending } = useAuth();
  const { data: profile, isLoading, isPending } = useProfile();

  if (authPending || !session) {
    return { needsCrewSetup: false, isLoading: authPending, profile: undefined };
  }

  if (isLoading || isPending) {
    return { needsCrewSetup: false, isLoading: true, profile };
  }

  return {
    needsCrewSetup: !isCrewSetupComplete(profile),
    isLoading: false,
    profile,
  };
}

/**
 * New accounts see Stay-in-the-loop before join/create crew.
 * Only relevant while crew setup is still pending.
 */
export function useNeedsPostAuthNotifications(): {
  needsPostAuthNotifications: boolean;
  isLoading: boolean;
} {
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const userId = session?.user.id;

  const { data, isLoading, isPending } = useQuery({
    queryKey: postAuthNotificationsQueryKey(userId),
    queryFn: () => isPostAuthNotificationsComplete(userId!),
    enabled: !!userId && needsCrewSetup,
    staleTime: Infinity,
  });

  if (authPending || !session || crewLoading) {
    return { needsPostAuthNotifications: false, isLoading: authPending || crewLoading };
  }

  if (!needsCrewSetup) {
    return { needsPostAuthNotifications: false, isLoading: false };
  }

  if (isLoading || isPending) {
    return { needsPostAuthNotifications: false, isLoading: true };
  }

  return {
    needsPostAuthNotifications: data === false,
    isLoading: false,
  };
}

export function useCompletePostAuthNotifications() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');
      await setPostAuthNotificationsComplete(userId);
    },
    onSuccess: () => {
      queryClient.setQueryData(postAuthNotificationsQueryKey(userId), true);
    },
  });
}

/**
 * Existing accounts (crew setup done) see a one-time equipment opt-in after the
 * OTA until they complete or skip `/welcome-equipment`.
 */
export function useNeedsEquipmentPrompt(): {
  needsEquipmentPrompt: boolean;
  isLoading: boolean;
} {
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const userId = session?.user.id;

  const { data, isLoading, isPending } = useQuery({
    queryKey: equipmentPromptQueryKey(userId),
    queryFn: () => isEquipmentPromptComplete(userId!),
    enabled: !!userId && !needsCrewSetup && !crewLoading,
    staleTime: Infinity,
  });

  if (authPending || !session || crewLoading) {
    return { needsEquipmentPrompt: false, isLoading: authPending || crewLoading };
  }

  if (needsCrewSetup) {
    return { needsEquipmentPrompt: false, isLoading: false };
  }

  if (isLoading || isPending) {
    return { needsEquipmentPrompt: false, isLoading: true };
  }

  return {
    needsEquipmentPrompt: data === false,
    isLoading: false,
  };
}

export function useCompleteEquipmentPrompt() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const id = session?.user.id;

  return useMutation({
    mutationFn: async (
      equipment?: PendingEquipment,
    ): Promise<Profile | null> => {
      if (!id) throw new Error('Not authenticated');

      let profile: Profile | null = null;
      if (equipment) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            has_pull_up_bar: equipment.has_pull_up_bar,
            has_weights: equipment.has_weights,
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        profile = data;
      }

      await setEquipmentPromptComplete(id);
      return profile;
    },
    onSuccess: () => {
      queryClient.setQueryData(equipmentPromptQueryKey(id), true);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
      queryClient.invalidateQueries({ queryKey: ['daily-goals'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-plans'] });
    },
  });
}

/** @deprecated Prefer useNeedsCrewSetup / useNeedsPreAuthOnboarding */
export function useNeedsOnboarding() {
  const crew = useNeedsCrewSetup();
  return {
    needsOnboarding: crew.needsCrewSetup,
    isLoading: crew.isLoading,
    profile: crew.profile,
  };
}

export function useCompleteCrewSetup() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const id = session?.user.id;

  return useMutation({
    mutationFn: async (
      options: { fitnessLevel?: FitnessLevel } = {},
    ): Promise<Profile> => {
      if (!id) throw new Error('Not authenticated');

      const pendingFitness = options.fitnessLevel ?? (await consumePendingFitnessLevel());
      const pendingEquipment = await consumePendingEquipment();

      const patch: {
        onboarding_completed_at: string;
        fitness_level?: FitnessLevel;
        has_pull_up_bar?: boolean;
        has_weights?: boolean;
      } = {
        onboarding_completed_at: new Date().toISOString(),
      };
      if (pendingFitness) patch.fitness_level = pendingFitness;
      if (pendingEquipment) {
        patch.has_pull_up_bar = pendingEquipment.has_pull_up_bar;
        patch.has_weights = pendingEquipment.has_weights;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      await setEquipmentPromptComplete(id);
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(equipmentPromptQueryKey(id), true);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
    },
  });
}

/** @deprecated Prefer useCompleteCrewSetup */
export function useCompleteOnboarding() {
  return useCompleteCrewSetup();
}

export function useSaveOnboardingFitnessLevel() {
  return useMutation({
    mutationFn: async (fitnessLevel: FitnessLevel): Promise<void> => {
      await savePendingFitnessLevel(fitnessLevel);
    },
  });
}

export function useSaveOnboardingEquipment() {
  return useMutation({
    mutationFn: async (equipment: PendingEquipment): Promise<void> => {
      await savePendingEquipment(equipment);
    },
  });
}

/** Apply a locally saved fitness level once the user has a profile. */
export function useApplyPendingFitnessLevel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const id = session?.user.id;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    void (async () => {
      const level = await consumePendingFitnessLevel();
      const equipment = await consumePendingEquipment();
      if ((!level && !equipment) || cancelled) return;

      const patch: {
        fitness_level?: FitnessLevel;
        has_pull_up_bar?: boolean;
        has_weights?: boolean;
      } = {};
      if (level) patch.fitness_level = level;
      if (equipment) {
        patch.has_pull_up_bar = equipment.has_pull_up_bar;
        patch.has_weights = equipment.has_weights;
      }

      const { error } = await supabase.from('profiles').update(patch).eq('id', id);
      if (!error && !cancelled) {
        if (equipment) {
          await setEquipmentPromptComplete(id);
          queryClient.setQueryData(equipmentPromptQueryKey(id), true);
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, queryClient]);
}
