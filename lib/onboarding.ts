import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FitnessLevel } from '@/types';

/**
 * Onboarding demo + pre-auth / post-auth helpers.
 * Pre-auth completion is device-local; crew setup completion lives on the profile.
 */

export const ONBOARDING_DEMO_CONTEXT_ID = 'onboarding';

/** XP granted on first signup (onboarding starter boost). Must match handle_new_user(). */
export const ONBOARDING_STARTER_XP = 25;

const PRE_AUTH_COMPLETE_KEY = 'gaingang_pre_auth_onboarding_complete';
const PENDING_FITNESS_KEY = 'gaingang_pending_fitness_level';

function postAuthNotificationsKey(userId: string): string {
  return `gaingang_post_auth_notifications_complete:${userId}`;
}

export type OnboardingDemoOptionId = 'pushup' | 'squat';

export interface OnboardingDemoOption {
  id: OnboardingDemoOptionId;
  exerciseId: string;
  exerciseName: string;
  targetReps: number;
  label: string;
  body: string;
}

export const ONBOARDING_DEMO_OPTIONS: OnboardingDemoOption[] = [
  {
    id: 'pushup',
    exerciseId: 'onboarding-pushup',
    exerciseName: 'Push-ups',
    targetReps: 3,
    label: 'Pushups',
    body: 'Do 3 — phone on the floor facing you.',
  },
  {
    id: 'squat',
    exerciseId: 'onboarding-squat',
    exerciseName: 'Squats',
    targetReps: 5,
    label: 'Squats',
    body: 'Do 5 — step back so hips and knees stay in frame.',
  },
];

export function getOnboardingDemoOption(
  id: OnboardingDemoOptionId,
): OnboardingDemoOption {
  return (
    ONBOARDING_DEMO_OPTIONS.find((option) => option.id === id) ??
    ONBOARDING_DEMO_OPTIONS[0]
  );
}

/** Pre-auth product tour finished on this device (welcome → auth). */
export async function isPreAuthOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PRE_AUTH_COMPLETE_KEY);
  return value === '1';
}

export async function setPreAuthOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(PRE_AUTH_COMPLETE_KEY, '1');
}

/** Clears local pre-auth tour state (dev / retest). */
export async function resetPreAuthOnboarding(): Promise<void> {
  await AsyncStorage.multiRemove([PRE_AUTH_COMPLETE_KEY, PENDING_FITNESS_KEY]);
}

/** Post-sign-in "Stay in the loop" step (per user, device-local). */
export async function isPostAuthNotificationsComplete(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(postAuthNotificationsKey(userId));
  return value === '1';
}

export async function setPostAuthNotificationsComplete(userId: string): Promise<void> {
  await AsyncStorage.setItem(postAuthNotificationsKey(userId), '1');
}

export async function resetPostAuthNotifications(userId: string): Promise<void> {
  await AsyncStorage.removeItem(postAuthNotificationsKey(userId));
}

/** Fitness level chosen during pre-auth; applied after the user signs up. */
export async function savePendingFitnessLevel(level: FitnessLevel): Promise<void> {
  await AsyncStorage.setItem(PENDING_FITNESS_KEY, level);
}

export async function consumePendingFitnessLevel(): Promise<FitnessLevel | null> {
  const value = await AsyncStorage.getItem(PENDING_FITNESS_KEY);
  if (!value) return null;
  await AsyncStorage.removeItem(PENDING_FITNESS_KEY);
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }
  return null;
}

/** Post-auth join/create crew prompt finished (stored on profile). */
export function isCrewSetupComplete(
  profile: { onboarding_completed_at: string | null } | null | undefined,
): boolean {
  return !!profile?.onboarding_completed_at;
}

/** @deprecated Use isCrewSetupComplete */
export function isOnboardingComplete(
  profile: { onboarding_completed_at: string | null } | null | undefined,
): boolean {
  return isCrewSetupComplete(profile);
}
