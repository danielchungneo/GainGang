/**
 * Utility for conditionally joining class names together.
 * Works with NativeWind className strings.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
