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
const PENDING_EQUIPMENT_KEY = 'gaingang_pending_equipment';

export interface PendingEquipment {
  has_pull_up_bar: boolean;
  has_weights: boolean;
}

function postAuthNotificationsKey(userId: string): string {
  return `gaingang_post_auth_notifications_complete:${userId}`;
}

function equipmentPromptKey(userId: string): string {
  return `gaingang_equipment_prompt_complete:${userId}`;
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
  await AsyncStorage.multiRemove([
    PRE_AUTH_COMPLETE_KEY,
    PENDING_FITNESS_KEY,
    PENDING_EQUIPMENT_KEY,
  ]);
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

/**
 * One-time equipment opt-in after the OTA (existing users) or skipped for
 * accounts that already chose equipment during pre-auth fitness.
 */
export async function isEquipmentPromptComplete(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(equipmentPromptKey(userId));
  return value === '1';
}

export async function setEquipmentPromptComplete(userId: string): Promise<void> {
  await AsyncStorage.setItem(equipmentPromptKey(userId), '1');
}

export async function resetEquipmentPrompt(userId: string): Promise<void> {
  await AsyncStorage.removeItem(equipmentPromptKey(userId));
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

export async function savePendingEquipment(equipment: PendingEquipment): Promise<void> {
  await AsyncStorage.setItem(PENDING_EQUIPMENT_KEY, JSON.stringify(equipment));
}

export async function consumePendingEquipment(): Promise<PendingEquipment | null> {
  const raw = await AsyncStorage.getItem(PENDING_EQUIPMENT_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(PENDING_EQUIPMENT_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingEquipment;
    return {
      has_pull_up_bar: !!parsed.has_pull_up_bar,
      has_weights: !!parsed.has_weights,
    };
  } catch {
    return null;
  }
}

/** Post-auth join/create crew prompt finished (stored on profile). */
export function isCrewSetupComplete(
  profile: { onboarding_completed_at: string | null } | null | undefined,
): boolean {
  return !!profile?.onboarding_completed_at;
}

/**
 * Already-onboarded users who have not seen the Focus lock intro yet.
 * New signups are stamped at profile create (and again at crew setup) so they
 * never hit this after completing the pre-auth Focus lock step.
 */
export function needsFocusLockIntro(
  profile:
    | {
        onboarding_completed_at: string | null;
        focus_lock_intro_seen_at: string | null;
      }
    | null
    | undefined,
): boolean {
  return isCrewSetupComplete(profile) && !profile?.focus_lock_intro_seen_at;
}

/** @deprecated Use isCrewSetupComplete */
export function isOnboardingComplete(
  profile: { onboarding_completed_at: string | null } | null | undefined,
): boolean {
  return isCrewSetupComplete(profile);
}
