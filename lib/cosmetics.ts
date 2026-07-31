import type { Json } from '@/types/database';

/** Visual style for border cosmetics. */
export interface CosmeticBorderStyle {
  colors: string[];
  glow?: string;
  width?: number;
}

/** Visual style for banner cosmetics. */
export interface CosmeticBannerStyle {
  colors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
}

export function parseBorderStyle(style: Json | null | undefined): CosmeticBorderStyle | null {
  if (!isRecord(style)) return null;
  const colors = parseColors(style.colors);
  if (colors.length === 0) return null;
  return {
    colors,
    glow: typeof style.glow === 'string' ? style.glow : colors[0],
    width:
      typeof style.width === 'number' && style.width > 0 ? Math.floor(style.width) : 3,
  };
}

export function parseBannerStyle(style: Json | null | undefined): CosmeticBannerStyle | null {
  if (!isRecord(style)) return null;
  const colors = parseColors(style.colors);
  if (colors.length === 0) return null;
  return { colors };
}

/** LinearGradient needs a tuple of at least two colors. */
export function gradientColors(colors: string[]): [string, string, ...string[]] {
  if (colors.length >= 2) return colors as [string, string, ...string[]];
  if (colors.length === 1) return [colors[0], colors[0]];
  return ['#64748B', '#334155'];
}
