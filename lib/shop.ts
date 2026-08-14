import type { CosmeticItem, EquippedCosmeticSlots } from '@/types';
import type { Rank, ShopCategory, ShopCrateKey, ShopProductKind } from '@/types/database';
import { rarityDef } from '@/lib/rewards';

/** Wallet gold — keep in sync with CredsBalance / CredPlate. */
export const CREDS_GOLD = { dark: '#F5A524', light: '#E0910F' } as const;
export const CREDS_INK = '#2C1D0B';
export const CREDS_DEEP = '#C97A0C';

/** Human rarity label — Common / Uncommon / Rare / Epic / Legendary / Mythic. */
export function shopRarityName(rarity: Rank): string {
  return rarityDef(rarity).name;
}

export function shopRarityNameUpper(rarity: Rank): string {
  return shopRarityName(rarity).toUpperCase();
}

export interface ShopListingItem {
  id: string;
  slug: string;
  product_kind: ShopProductKind;
  category: ShopCategory;
  cosmetic_id: string | null;
  crate_key: ShopCrateKey | null;
  crate_min_rarity: Rank | null;
  name: string;
  description: string | null;
  rarity: Rank;
  odds_label: string | null;
  price_creds: number;
  is_featured: boolean;
  sort_order: number;
  stock_remaining: number | null;
  owned: boolean;
  sold_out: boolean;
  cosmetic: CosmeticItem | null;
}

export interface ShopStock {
  rotation_key: string;
  rotation_ends_at: string;
  items: ShopListingItem[];
}

export interface ShopPurchaseResult {
  listing_id: string;
  balance: number;
  contents: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRank(value: unknown): value is Rank {
  return value === 'E' || value === 'D' || value === 'C' || value === 'B' || value === 'A' || value === 'S';
}

function parseCosmetic(raw: unknown): CosmeticItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string') return null;
  if (
    raw.kind !== 'title' &&
    raw.kind !== 'avatar_border' &&
    raw.kind !== 'level_border' &&
    raw.kind !== 'banner'
  ) {
    return null;
  }
  if (!isRank(raw.rarity)) return null;
  if (typeof raw.name !== 'string') return null;

  return {
    id: raw.id,
    kind: raw.kind,
    rarity: raw.rarity,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : null,
    style: (raw.style as CosmeticItem['style']) ?? {},
    active: raw.active !== false,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date(0).toISOString(),
  };
}

function parseListing(raw: unknown): ShopListingItem | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || typeof raw.slug !== 'string') return null;
  if (raw.product_kind !== 'cosmetic' && raw.product_kind !== 'crate') return null;
  if (
    raw.category !== 'crates' &&
    raw.category !== 'titles' &&
    raw.category !== 'borders' &&
    raw.category !== 'banners'
  ) {
    return null;
  }
  if (!isRank(raw.rarity)) return null;
  if (typeof raw.name !== 'string') return null;
  if (typeof raw.price_creds !== 'number') return null;

  return {
    id: raw.id,
    slug: raw.slug,
    product_kind: raw.product_kind,
    category: raw.category,
    cosmetic_id: typeof raw.cosmetic_id === 'string' ? raw.cosmetic_id : null,
    crate_key:
      raw.crate_key === 'locker' || raw.crate_key === 'vault' ? raw.crate_key : null,
    crate_min_rarity: isRank(raw.crate_min_rarity) ? raw.crate_min_rarity : null,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : null,
    rarity: raw.rarity,
    odds_label: typeof raw.odds_label === 'string' ? raw.odds_label : null,
    price_creds: Math.floor(raw.price_creds),
    is_featured: raw.is_featured === true,
    sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
    stock_remaining:
      typeof raw.stock_remaining === 'number' ? Math.floor(raw.stock_remaining) : null,
    owned: raw.owned === true,
    sold_out: raw.sold_out === true,
    cosmetic: parseCosmetic(raw.cosmetic),
  };
}

export function parseShopStock(raw: unknown): ShopStock | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.rotation_key !== 'string') return null;
  if (typeof raw.rotation_ends_at !== 'string') return null;
  if (!Array.isArray(raw.items)) return null;

  const items = raw.items
    .map(parseListing)
    .filter((item): item is ShopListingItem => item != null);

  return {
    rotation_key: raw.rotation_key,
    rotation_ends_at: raw.rotation_ends_at,
    items,
  };
}

export function parseShopPurchaseResult(raw: unknown): ShopPurchaseResult | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.listing_id !== 'string') return null;
  if (typeof raw.balance !== 'number') return null;
  return {
    listing_id: raw.listing_id,
    balance: Math.floor(raw.balance),
    contents: raw.contents,
  };
}

/** Preview override for a shop cosmetic — same mapping inventory god-mode uses. */
export function cosmeticOverrideForItem(
  item: CosmeticItem | null,
): Partial<EquippedCosmeticSlots> | null {
  if (!item) return null;
  switch (item.kind) {
    case 'title':
      return { title: item };
    case 'avatar_border':
      return { avatarBorder: item };
    case 'level_border':
      return { levelBorder: item };
    case 'banner':
      return { banner: item };
  }
}

export function shopKindLabel(item: ShopListingItem): string {
  if (item.product_kind === 'crate') return 'CRATE';
  switch (item.cosmetic?.kind ?? item.category) {
    case 'title':
    case 'titles':
      return 'TITLE';
    case 'avatar_border':
    case 'borders':
      return 'BORDER';
    case 'banner':
    case 'banners':
      return 'BANNER';
    case 'level_border':
      return 'LEVEL BORDER';
    default:
      return 'ITEM';
  }
}

export function formatCountdown(endsAtMs: number, nowMs = Date.now()): string {
  const remaining = Math.max(0, endsAtMs - nowMs);
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return `${days}D ${String(hours).padStart(2, '0')}H`;
  }
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatRestockLabel(endsAtMs: number, nowMs = Date.now()): string {
  return `RESETS ${formatCountdown(endsAtMs, nowMs)}`;
}

/** Store product IDs — must match App Store Connect, Play Console, and RevenueCat. */
export const CREDS_PACK_PRODUCT_PREFIX = 'com.danielchungneo.gaingang.creds';

export const CREDS_PACKS = [
  {
    id: 'hustle',
    amount: 500,
    label: 'HUSTLE BUNDLE',
    priceLabel: '$0.99',
    bestValue: false,
    productId: `${CREDS_PACK_PRODUCT_PREFIX}.hustle`,
  },
  {
    id: 'beast',
    amount: 6500,
    label: 'BEAST BUNDLE',
    priceLabel: '$9.99',
    bestValue: true,
    productId: `${CREDS_PACK_PRODUCT_PREFIX}.beast`,
  },
  {
    id: 'apex',
    amount: 15000,
    label: 'APEX BUNDLE',
    priceLabel: '$19.99',
    bestValue: false,
    productId: `${CREDS_PACK_PRODUCT_PREFIX}.apex`,
  },
] as const;

export type CredsPackId = (typeof CREDS_PACKS)[number]['id'];

export function credsAmountForProductId(productId: string): number | null {
  const pack = CREDS_PACKS.find((p) => p.productId === productId);
  return pack?.amount ?? null;
}
