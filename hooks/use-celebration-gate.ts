import { useEffect } from 'react';

import { beginCelebration, endCelebration } from '@/lib/celebration-gate';

/** Hold the global celebration gate while `active` is true. */
export function useCelebrationGate(active: boolean) {
  useEffect(() => {
    if (!active) return;
    beginCelebration();
    return () => endCelebration();
  }, [active]);
}
