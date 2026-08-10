/**
 * Gang join caps: `max_members` null = unlimited (system gangs).
 */

export function isGangAtCapacity(
  memberCount: number,
  maxMembers: number | null | undefined,
): boolean {
  return maxMembers != null && memberCount >= maxMembers;
}

/** True when capped and at least ~80% full (or within 2 seats). */
export function isGangNearCapacity(
  memberCount: number,
  maxMembers: number | null | undefined,
): boolean {
  if (maxMembers == null || maxMembers < 1) return false;
  if (memberCount >= maxMembers) return true;
  const remaining = maxMembers - memberCount;
  return remaining <= 2 || memberCount / maxMembers >= 0.8;
}

/**
 * `12/25 members` when capped; `12 members` when unlimited.
 * Optionally appends ` · Full`.
 */
export function formatGangMemberCapacity(
  memberCount: number,
  maxMembers: number | null | undefined,
  options?: { showFullSuffix?: boolean },
): string {
  const noun = memberCount === 1 ? 'member' : 'members';
  const base =
    maxMembers == null
      ? `${memberCount} ${noun}`
      : `${memberCount}/${maxMembers} ${noun}`;

  if (options?.showFullSuffix && isGangAtCapacity(memberCount, maxMembers)) {
    return `${base} · Full`;
  }
  return base;
}
