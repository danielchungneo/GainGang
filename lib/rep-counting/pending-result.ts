/** Pass rep count back to the log screen after a camera session. */
let pending: { sessionKey: string; repCount: number } | null = null;

export function setPendingRepCount(sessionKey: string, repCount: number) {
  pending = { sessionKey, repCount };
}

export function consumePendingRepCount(sessionKey: string): number | null {
  if (!pending || pending.sessionKey !== sessionKey) return null;
  const count = pending.repCount;
  pending = null;
  return count;
}

export function buildRepCounterSessionKey(exerciseId: string, contextId?: string): string {
  return `${contextId ?? 'solo'}:${exerciseId}`;
}
