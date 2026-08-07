/**
 * Module queue for achievement unlock overlays.
 * Mutations enqueue; AchievementUnlockHost drains one at a time,
 * waiting for the celebration busy gate when needed.
 */

import type { Achievement } from '@/types';

type Listener = () => void;

let queue: Achievement[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function enqueueAchievementUnlocks(achievements: Achievement[]) {
  if (achievements.length === 0) return;

  const pendingIds = new Set(queue.map((a) => a.id));
  const fresh: Achievement[] = [];
  for (const achievement of achievements) {
    if (pendingIds.has(achievement.id)) continue;
    pendingIds.add(achievement.id);
    fresh.push(achievement);
  }
  if (fresh.length === 0) return;

  queue = [...queue, ...fresh];
  notify();
}

export function peekAchievementUnlock(): Achievement | null {
  return queue[0] ?? null;
}

export function shiftAchievementUnlock(): Achievement | null {
  if (queue.length === 0) return null;
  const [next, ...rest] = queue;
  queue = rest;
  notify();
  return next ?? null;
}

export function getAchievementUnlockQueueLength(): number {
  return queue.length;
}

export function subscribeAchievementUnlockQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test / dev helper — clears pending unlocks. */
export function clearAchievementUnlockQueue() {
  queue = [];
  notify();
}
