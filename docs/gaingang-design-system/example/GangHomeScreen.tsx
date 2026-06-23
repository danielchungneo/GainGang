/**
 * Example screen — composes the GainGang components into a Gang home view.
 * Copy/adapt into your navigation. Feed it real data from your store.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fontFamily,
  LeaderboardRow,
  QuestCard,
  LevelBadge,
  ReactionChip,
  spacing,
  StreakPill,
  useTheme,
  XPBar,
} from '../index';

export function GangHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.xl }}>
        {/* header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: c.primary }]}>IRON WOLVES · 14 MEMBERS</Text>
            <Text style={[styles.h1, { color: c.text }]}>Today's Quest</Text>
          </View>
          <LevelBadge level={24} size={64} />
        </View>

        <StreakPill days={47} />

        <XPBar level={24} currentXp={90} targetXp={250} />

        <QuestCard
          title="The Iron Oath"
          description="200 push-ups as a Gang. 20 are yours. Hold the line — miss it and the streak breaks."
          timeLeft="14h left"
          gang={{ current: 148, target: 200 }}
          individual={{ current: 20, target: 20 }}
          rewards={['+120 XP', '🎡 Reward Spin', '🛡 Streak +1']}
          onPressCta={() => {}}
        />

        {/* leaderboard */}
        <View>
          <Text style={[styles.kicker, { color: c.textMuted, marginBottom: spacing.sm }]}>
            DAILY LEADERBOARD
          </Text>
          <View style={[styles.board, { backgroundColor: c.surface, borderColor: c.border }]}>
            <LeaderboardRow position={1} name="Jinwoo K." initials="JK" reps={312} level={38} completion={1} avatarColors={[c.primary, c.secondary]} />
            <LeaderboardRow position={2} name="Mara A." initials="MA" reps={288} level={24} completion={1} avatarColors={['#2DD4BF', c.primary]} />
            <LeaderboardRow position={3} name="You" initials="YOU" reps={240} level={24} completion={0.86} avatarColors={[c.secondary, '#FF3D71']} isYou />
          </View>
        </View>

        {/* reactions */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ReactionChip kind="fire" count={24} />
          <ReactionChip kind="respect" count={12} />
          <ReactionChip kind="beast" count={8} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontFamily: fontFamily.mono, fontSize: 11, letterSpacing: 1.6 },
  h1: { fontFamily: fontFamily.display, fontSize: 32, marginTop: 4 },
  board: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
});
