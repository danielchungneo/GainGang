import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import {
  useTheme,
  fontFamily,
  status,
} from '@/lib/gaingang-theme';
import { gradientColors, parseBannerStyle } from '@/lib/cosmetics';
import { formatAmount } from '@/lib/format';
import type { ExerciseUnit } from '@/types';
import type { Json } from '@/types/database';
import { Avatar } from './avatar';
import { LevelChip } from './rank-chip';

export interface LeaderboardRowProps {
  position: number;
  name: string;
  avatarUrl?: string | null;
  amount: number;
  unit: Extract<ExerciseUnit, 'reps' | 'miles'>;
  level: number;
  isYou?: boolean;
  onPress?: () => void;
  /** Equipped profile banner style jsonb. */
  bannerStyle?: Json | null;
  /** Equipped avatar border style jsonb. */
  avatarBorderStyle?: Json | null;
  /** Equipped level border style jsonb. */
  levelBorderStyle?: Json | null;
  /** Equipped title name. */
  title?: string | null;
}

export function LeaderboardRow({
  position,
  name,
  avatarUrl,
  amount,
  unit,
  level,
  isYou,
  onPress,
  bannerStyle,
  avatarBorderStyle,
  levelBorderStyle,
  title,
}: LeaderboardRowProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const top = position === 1;
  const posColor = top ? status.warning : isYou ? c.primaryGlow : c.textDim;
  const banner = parseBannerStyle(bannerStyle ?? null);

  const content = (
    <>
      {banner ? (
        <>
          <LinearGradient
            colors={gradientColors(banner.colors)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(5,7,15,0.38)' },
            ]}
          />
        </>
      ) : null}

      <Text style={[styles.pos, { color: posColor }]}>{position}</Text>

      <Avatar
        name={name}
        uri={avatarUrl}
        size={38}
        borderStyle={avatarBorderStyle}
      />

      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: isYou ? c.primaryGlow : c.text }]}>
          {name}
        </Text>
        {title ? (
          <Text style={[styles.title, { color: c.primaryGlow }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <LevelChip level={level} borderStyle={levelBorderStyle} />
      <Text style={[styles.amount, { color: c.text }]}>
        {formatAmount(amount, unit)}
      </Text>
    </>
  );

  const rowStyle = [
    styles.row,
    { borderBottomColor: c.border, overflow: 'hidden' as const },
    !banner &&
      top && {
        backgroundColor:
          theme.mode === 'dark'
            ? 'rgba(245,165,36,0.06)'
            : 'rgba(245,165,36,0.08)',
      },
    !banner &&
      isYou && {
        backgroundColor:
          theme.mode === 'dark'
            ? 'rgba(77,140,255,0.06)'
            : 'rgba(47,109,255,0.05)',
      },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={rowStyle}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s profile`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pos: { fontFamily: fontFamily.display, fontSize: 18, width: 24 },
  name: { fontFamily: fontFamily.bodySemi, fontSize: 15 },
  title: { fontFamily: fontFamily.bodySemi, fontSize: 11, marginTop: 1 },
  amount: {
    fontFamily: fontFamily.monoBold,
    fontSize: 14,
    minWidth: 72,
    textAlign: 'right',
  },
});
