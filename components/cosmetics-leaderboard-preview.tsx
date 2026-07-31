import { Text, View } from 'react-native';

import { LeaderboardRow } from '@/components/ui/leaderboard-row';
import { useEquippedCosmetics } from '@/hooks/use-cosmetics';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useTheme, type } from '@/lib/gaingang-theme';
import {
  levelFromXp,
  type EquippedCosmeticSlots,
  type Profile,
} from '@/types';

interface CosmeticsLeaderboardPreviewProps {
  profile: Profile;
  /** Dev god-mode overrides layered on top of equipped slots. */
  overrides?: Partial<EquippedCosmeticSlots> | null;
}

/** Sample volume so the preview row reads like a real leaderboard entry. */
const PREVIEW_TOTAL = 240;

export function CosmeticsLeaderboardPreview({
  profile,
  overrides,
}: CosmeticsLeaderboardPreviewProps) {
  const t = useThemeTokens();
  const { theme } = useTheme();
  const equipped = useEquippedCosmetics(profile);

  const title = overrides?.title !== undefined ? overrides.title : equipped.title;
  const avatarBorder =
    overrides?.avatarBorder !== undefined
      ? overrides.avatarBorder
      : equipped.avatarBorder;
  const levelBorder =
    overrides?.levelBorder !== undefined
      ? overrides.levelBorder
      : equipped.levelBorder;
  const banner =
    overrides?.banner !== undefined ? overrides.banner : equipped.banner;

  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.label, { color: t.placeholder }]}>
        Leaderboard preview
        {overrides ? ' · god mode' : ''}
      </Text>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        <LeaderboardRow
          position={1}
          name={profile.full_name ?? 'You'}
          avatarUrl={profile.avatar_url}
          amount={PREVIEW_TOTAL}
          unit="reps"
          level={levelFromXp(profile.xp ?? 0)}
          isYou
          bannerStyle={banner?.style}
          avatarBorderStyle={avatarBorder?.style}
          levelBorderStyle={levelBorder?.style}
          title={title?.name}
        />
      </View>
    </View>
  );
}
