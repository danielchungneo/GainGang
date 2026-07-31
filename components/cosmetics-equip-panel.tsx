import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import {
  useCosmeticCatalog,
  useEquipCosmetic,
  useOwnedCosmetics,
  useUnequipCosmetic,
} from '@/hooks/use-cosmetics';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { gradientColors, parseBannerStyle, parseBorderStyle } from '@/lib/cosmetics';
import { fontFamily, type } from '@/lib/gaingang-theme';
import { rarityDef, REWARD_RARITY_ORDER } from '@/lib/rewards';
import type { CosmeticItem, CosmeticKind, Profile } from '@/types';
import { COSMETIC_KIND_LABELS } from '@/types';

const KIND_ORDER: CosmeticKind[] = [
  'title',
  'avatar_border',
  'banner',
];

interface CosmeticsEquipPanelProps {
  userId: string;
  profile: Profile;
  /** When false, shows owned cosmetics read-only (other profiles). */
  canEquip?: boolean;
  /** Limit to specific kinds (e.g. inventory tabs). Defaults to all. */
  kinds?: CosmeticKind[];
  /** Override empty-state copy when filtering. */
  emptyTitle?: string;
  emptyBody?: string;
  /**
   * Dev god mode: list the full catalog (not just owned).
   * Tapping an item previews it via `onPreviewItem` when provided.
   */
  godMode?: boolean;
  /** Called when god-mode preview selects/deselects an item. */
  onPreviewItem?: (item: CosmeticItem | null) => void;
  /** Currently previewed item id in god mode. */
  previewItemId?: string | null;
}

export function CosmeticsEquipPanel({
  userId,
  profile,
  canEquip = false,
  kinds,
  emptyTitle,
  emptyBody,
  godMode = false,
  onPreviewItem,
  previewItemId,
}: CosmeticsEquipPanelProps) {
  const t = useThemeTokens();
  const { data: owned, isLoading: ownedLoading } = useOwnedCosmetics(userId);
  const { data: catalog, isLoading: catalogLoading } = useCosmeticCatalog();
  const equip = useEquipCosmetic();
  const unequip = useUnequipCosmetic();

  const kindFilter = kinds ?? KIND_ORDER;
  const showKindHeaders = kindFilter.length > 1;
  const isLoading = godMode ? catalogLoading : ownedLoading;

  const ownedIds = useMemo(
    () => new Set((owned ?? []).map((row) => row.cosmetic_id)),
    [owned],
  );

  const equippedIds = new Set(
    [
      profile.equipped_title_id,
      profile.equipped_avatar_border_id,
      profile.equipped_level_border_id,
      profile.equipped_banner_id,
    ].filter(Boolean) as string[],
  );

  const displayItems = useMemo(() => {
    if (godMode) {
      return (catalog ?? [])
        .filter(
          (item) =>
            kindFilter.includes(item.kind) && item.kind !== 'level_border',
        )
        .slice()
        .sort((a, b) => {
          const rarityDelta =
            REWARD_RARITY_ORDER.indexOf(a.rarity) -
            REWARD_RARITY_ORDER.indexOf(b.rarity);
          if (rarityDelta !== 0) return rarityDelta;
          return a.name.localeCompare(b.name);
        });
    }

    return (owned ?? [])
      .filter(
        (row) =>
          row.item.active &&
          kindFilter.includes(row.item.kind) &&
          // Level borders are paused until the visuals are ready.
          row.item.kind !== 'level_border',
      )
      .map((row) => row.item);
  }, [godMode, catalog, owned, kindFilter]);

  async function handlePress(item: CosmeticItem) {
    if (godMode && onPreviewItem) {
      onPreviewItem(previewItemId === item.id ? null : item);
      return;
    }

    if (!canEquip || equip.isPending || unequip.isPending) return;
    if (equippedIds.has(item.id)) {
      await unequip.mutateAsync(item.kind);
      return;
    }
    await equip.mutateAsync(item.id);
  }

  if (isLoading) {
    return (
      <GlassSurface style={{ padding: 20 }}>
        <Text style={[type.bodySm, { color: t.body }]}>Loading cosmetics…</Text>
      </GlassSurface>
    );
  }

  if (displayItems.length === 0) {
    return (
      <GlassSurface style={{ padding: 20, gap: 8 }}>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 18,
            color: t.heading,
          }}
        >
          {emptyTitle ?? 'No cosmetics yet'}
        </Text>
        <Text style={[type.bodySm, { color: t.body }]}>
          {emptyBody ??
            (canEquip
              ? 'Open daily reward crates for a chance at titles, borders, and banners.'
              : 'This hunter has not unlocked cosmetics yet.')}
        </Text>
      </GlassSurface>
    );
  }

  const byKind = kindFilter
    .map((kind) => ({
      kind,
      items: displayItems.filter((item) => item.kind === kind),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <View style={{ gap: 14 }}>
      {godMode ? (
        <Text style={[type.bodySm, { color: t.accent }]}>
          God mode · full catalog · tap to preview on the leaderboard
        </Text>
      ) : canEquip ? (
        <Text style={[type.bodySm, { color: t.body }]}>
          Tap to equip. Tap again to unequip.
        </Text>
      ) : null}

      {byKind.map(({ kind, items }) => (
        <View key={kind} style={{ gap: 8 }}>
          {showKindHeaders ? (
            <Text style={[type.label, { color: t.placeholder }]}>
              {COSMETIC_KIND_LABELS[kind]}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            {items.map((item) => (
              <CosmeticRow
                key={item.id}
                item={item}
                isOwned={ownedIds.has(item.id)}
                isEquipped={equippedIds.has(item.id)}
                isPreview={previewItemId === item.id}
                godMode={godMode}
                canEquip={canEquip && !godMode}
                onPress={() => void handlePress(item)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function CosmeticRow({
  item,
  isOwned,
  isEquipped,
  isPreview,
  godMode,
  canEquip,
  onPress,
}: {
  item: CosmeticItem;
  isOwned: boolean;
  isEquipped: boolean;
  isPreview: boolean;
  godMode: boolean;
  canEquip: boolean;
  onPress: () => void;
}) {
  const t = useThemeTokens();
  const rarity = rarityDef(item.rarity);
  const interactive = canEquip || godMode;
  const highlighted = isEquipped || isPreview;

  return (
    <Pressable
      onPress={interactive ? onPress : undefined}
      disabled={!interactive}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${rarity.name}${isEquipped ? ', equipped' : ''}${isPreview ? ', previewing' : ''}`}
    >
      <GlassSurface
        style={{
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderWidth: highlighted ? 2 : 1,
          borderColor: isPreview ? '#F5A524' : isEquipped ? t.accent : undefined,
          opacity: godMode && !isOwned ? 0.92 : 1,
        }}
      >
        <CosmeticSwatch item={item} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fontFamily.bodySemi,
              fontSize: 15,
              color: t.heading,
            }}
          >
            {item.name}
          </Text>
          <Text style={[type.dataSm, { color: rarity.color }]}>
            {rarity.name}
            {isEquipped ? ' · Equipped' : ''}
            {isPreview ? ' · Preview' : ''}
            {godMode && !isOwned ? ' · Unowned' : ''}
          </Text>
          {item.description ? (
            <Text style={[type.bodySm, { color: t.body }]} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

function CosmeticSwatch({ item }: { item: CosmeticItem }) {
  if (item.kind === 'title') {
    return (
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(143,180,255,0.15)',
        }}
      >
        <Text style={{ fontSize: 16 }}>Aa</Text>
      </View>
    );
  }

  if (item.kind === 'banner') {
    const banner = parseBannerStyle(item.style);
    return (
      <LinearGradient
        colors={gradientColors(banner?.colors ?? ['#64748B', '#334155'])}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 40, height: 40, borderRadius: 10 }}
      />
    );
  }

  const border = parseBorderStyle(item.style);
  return (
    <LinearGradient
      colors={gradientColors(border?.colors ?? ['#64748B', '#334155'])}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#0B1220',
        }}
      />
    </LinearGradient>
  );
}
