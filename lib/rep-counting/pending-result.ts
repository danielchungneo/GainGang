/** Pass rep counts back to the log screen after camera sessions. */
const pendingBySession = new Map<string, number>();

export function setPendingRepCount(sessionKey: string, repCount: number) {
  pendingBySession.set(sessionKey, repCount);
}

export function consumePendingRepCount(sessionKey: string): number | null {
  if (!pendingBySession.has(sessionKey)) return null;
  const count = pendingBySession.get(sessionKey)!;
  pendingBySession.delete(sessionKey);
  return count;
}

export function buildRepCounterSessionKey(exerciseId: string, contextId?: string): string {
  return `${contextId ?? 'solo'}:${exerciseId}`;
}

export interface RepCounterQueueItem {
  exerciseId: string;
  exerciseName: string;
  unit?: string;
  targetSeconds?: number;
  targetReps?: number;
}

export function serializeRepCounterQueue(queue: RepCounterQueueItem[]): string {
  return JSON.stringify(queue);
}

export function parseRepCounterQueue(raw: string | undefined): RepCounterQueueItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is RepCounterQueueItem => {
      if (typeof item !== 'object' || item === null) return false;
      const row = item as RepCounterQueueItem;
      return typeof row.exerciseId === 'string' && typeof row.exerciseName === 'string';
    });
  } catch {
    return [];
  }
}
