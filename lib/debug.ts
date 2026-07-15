/**
 * Client-side debug flag.
 * Set `EXPO_PUBLIC_DEBUG=true` in `.env.local` (requires app reload).
 * Defaults to false — Expo only exposes `EXPO_PUBLIC_*` vars to the bundle.
 */
export function isDebugEnabled(): boolean {
  const raw = process.env.EXPO_PUBLIC_DEBUG?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
