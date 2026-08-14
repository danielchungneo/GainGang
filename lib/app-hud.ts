/** Shared visibility for fixed Creds / Profile HUDs. */

export function shouldHideAppHud(segments: string[]): boolean {
  if (segments.includes('(tabs)')) return false;
  if (segments.includes('rep-counter')) return true;
  if (segments.includes('new-goal')) return true;

  const root = segments[0] ?? '';
  if (root === '(auth)' || root === 'onboarding' || root === 'auth') return true;
  if (root.startsWith('welcome-')) return true;
  if (root === 'index') return true;
  return false;
}

/** True when the profile / alerts / crates cluster should show (main tabs only). */
export function shouldShowProfileHud(segments: string[]): boolean {
  return segments.includes('(tabs)');
}

/** Shared HUD pill metrics — keep left and right chips the same height. */
export const HUD_CHIP = {
  minHeight: 38,
  paddingVertical: 5,
  paddingLeft: 6,
  paddingRight: 10,
  gap: 8,
  iconSize: 22,
  avatarSize: 26,
  plateSize: 22,
  fontSize: 13,
} as const;

/** Top padding for screen headers so content clears the fixed HUD chips. */
export const HUD_CONTENT_TOP_PAD = HUD_CHIP.minHeight + 16;
