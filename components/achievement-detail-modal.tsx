import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AchievementBadge } from '@/components/ui/achievement-badge';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  achievementTierDef,
  resolveAchievementTier,
} from '@/lib/achievements';
import { fontFamily, type } from '@/lib/gaingang-theme';
import type { Achievement } from '@/types';

export interface AchievementDetailModalProps {
  visible: boolean;
  achievement: Achievement | null;
  earned?: boolean;
  earnedAt?: string | null;
  onClose: () => void;
}

export function AchievementDetailModal({
  visible,
  achievement,
  earned = false,
  earnedAt,
  onClose,
}: AchievementDetailModalProps) {
  const t = useThemeTokens();
  if (!achievement) return null;

  const tier = resolveAchievementTier({
    key: achievement.key,
    tier: achievement.tier,
    threshold: achievement.threshold,
  });
  const tierDef = achievementTierDef(tier);
  const earnedLabel =
    earned && earnedAt
      ? `Unlocked ${new Date(earnedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`
      : earned
        ? 'Unlocked'
        : 'Not unlocked yet';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss">
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardWrap}>
          <GlassSurface style={styles.card}>
            <View style={styles.badgeRow}>
              <AchievementBadge
                icon={achievement.icon}
                tier={tier}
                earned={earned}
                size={96}
              />
            </View>

            <Text style={[styles.kicker, { color: earned ? tierDef.glow : t.body }]}>
              {earned ? 'UNLOCKED' : 'LOCKED'}
            </Text>
            <Text style={[styles.title, { color: t.heading }]}>{achievement.title}</Text>
            <Text style={[styles.tier, { color: earned ? tierDef.glow : t.body }]}>
              {tierDef.name}
            </Text>

            <Text style={[type.bodySm, styles.description, { color: t.body }]}>
              {achievement.description}
            </Text>

            <Text style={[styles.meta, { color: t.body }]}>{earnedLabel}</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, { borderColor: `${t.heading}22`, backgroundColor: t.buttonBg }]}
            >
              <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 15, color: t.heading }}>
                Close
              </Text>
              <Ionicons name="close" size={18} color={t.body} style={{ marginLeft: 6 }} />
            </Pressable>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,7,15,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    padding: 24,
    gap: 10,
    alignItems: 'center',
  },
  badgeRow: {
    marginBottom: 8,
  },
  kicker: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
  },
  tier: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  description: {
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  closeBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
});
