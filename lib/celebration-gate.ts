/**
 * Tracks when full-screen celebration overlays are active so other
 * celebrations (e.g. Focus unlock) can wait their turn.
 */

type Listener = () => void;

let busyCount = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function beginCelebration() {
  busyCount += 1;
  notify();
}

export function endCelebration() {
  busyCount = Math.max(0, busyCount - 1);
  notify();
}

export function isCelebrationBusy(): boolean {
  return busyCount > 0;
}

export function subscribeCelebrationGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
