import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Maps `achievements.icon` keys → Ionicons glyphs.
 * Series (goals / streaks / reps / kudos / day clears) share one glyph;
 * standalone achievements each get a unique glyph.
 */
const ACHIEVEMENT_ICON_MAP: Record<string, IoniconName> = {
  // Series
  flag: 'flag',
  flame: 'flame',
  dumbbell: 'barbell',
  timer: 'timer',
  heart: 'heart',
  sparkles: 'sparkles',
  sunny: 'sunny',
  cube: 'cube',
  shirt: 'shirt',
  rocket: 'rocket',

  // Standalone
  message: 'chatbubble',
  'person-add': 'person-add',
  poke: 'hand-left',
  people: 'people',
  pulse: 'pulse',
  sword: 'flash',
  trophy: 'trophy',

  // Legacy aliases
  star: 'sunny',
  crown: 'diamond',
  ribbon: 'ribbon',
};

export function achievementIonicon(icon: string | null | undefined): IoniconName {
  if (!icon) return 'trophy';
  return ACHIEVEMENT_ICON_MAP[icon] ?? 'trophy';
}
