import type { ExerciseRequiredEquipment } from '@/types';

export const EQUIPMENT_LABELS: Record<ExerciseRequiredEquipment, string> = {
  pull_up_bar: 'Pull-up bar',
  weights: 'Weights',
};

export function equipmentLabel(
  required: ExerciseRequiredEquipment | null | undefined,
): string | null {
  if (!required) return null;
  return EQUIPMENT_LABELS[required];
}

export function profileHasEquipment(
  profile: {
    has_pull_up_bar?: boolean | null;
    has_weights?: boolean | null;
  } | null | undefined,
  required: ExerciseRequiredEquipment | null | undefined,
): boolean {
  if (!required) return true;
  if (!profile) return false;
  if (required === 'pull_up_bar') return !!profile.has_pull_up_bar;
  if (required === 'weights') return !!profile.has_weights;
  return false;
}

export function countEligibleMembers(
  members: {
    has_pull_up_bar?: boolean | null;
    has_weights?: boolean | null;
  }[],
  required: ExerciseRequiredEquipment | null | undefined,
): number {
  if (!required) return members.length;
  return members.filter((m) => profileHasEquipment(m, required)).length;
}
