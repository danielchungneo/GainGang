import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useGangWarMemberContributions } from '@/hooks/use-gang-wars';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import { fontFamily, radius, spacing, type } from '@/lib/gaingang-theme';
import type { ExerciseUnit } from '@/types';

interface GangWarContributionsSheetProps {
  matchId: string;
  gangId: string;
  gangName: string;
  visible: boolean;
  onClose: () => void;
  unit?: ExerciseUnit;
}

export function GangWarContributionsSheet({
  matchId,
  gangId,
  gangName,
  visible,
  onClose,
  unit = 'reps',
}: GangWarContributionsSheetProps) {
  const t = useThemeTokens();
  const { data, isLoading } = useGangWarMemberContributions(matchId, gangId, visible);
  const members = data?.members ?? [];
  const title = data?.gang_name ?? gangName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: t.buttonBg, borderColor: t.buttonBorder },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: t.accent,
                }}
              >
                Week contributions
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.displaySemi,
                  fontSize: 20,
                  color: t.heading,
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close contributions"
            >
              <Ionicons name="close" size={24} color={t.body} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={t.accent} style={{ marginVertical: 28 }} />
          ) : members.length === 0 ? (
            <Text style={[type.bodySm, { color: t.body, paddingVertical: 20 }]}>
              No contributions yet this week.
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ gap: 10, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {members.map((member, index) => {
                const name = member.full_name || 'Member';
                const key = member.user_id ?? `bot-${index}`;
                return (
                  <View
                    key={key}
                    style={[
                      styles.row,
                      {
                        backgroundColor: `${t.heading}08`,
                        borderColor: t.buttonBorder,
                      },
                    ]}
                  >
                    <Avatar uri={member.avatar_url} name={name} size={40} />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 15,
                        color: t.heading,
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 15,
                        color: Number(member.contribution) > 0 ? '#4ADE80' : t.placeholder,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatAmount(Number(member.contribution), unit)}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '72%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
