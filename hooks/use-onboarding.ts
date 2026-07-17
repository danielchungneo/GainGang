import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import {
  consumePendingFitnessLevel,
  isCrewSetupComplete,
  isPostAuthNotificationsComplete,
  isPreAuthOnboardingComplete,
  savePendingFitnessLevel,
  setPostAuthNotificationsComplete,
  setPreAuthOnboardingComplete,
} from '@/lib/onboarding';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { FitnessLevel, Profile } from '@/types';

const PRE_AUTH_QUERY_KEY = ['onboarding', 'pre-auth-complete'] as const;

export { PRE_AUTH_QUERY_KEY };

function postAuthNotificationsQueryKey(userId?: string) {
  return ['onboarding', 'post-auth-notifications', userId] as const;
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

      const patch: {
        onboarding_completed_at: string;
        fitness_level?: FitnessLevel;
      } = {
        onboarding_completed_at: new Date().toISOString(),
      };
      if (pendingFitness) patch.fitness_level = pendingFitness;

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
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
      if (!level || cancelled) return;

      const { error } = await supabase
        .from('profiles')
        .update({ fitness_level: level })
        .eq('id', id);
      if (!error && !cancelled) {
        queryClient.invalidateQueries({ queryKey: queryKeys.profile(id) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, queryClient]);
}
