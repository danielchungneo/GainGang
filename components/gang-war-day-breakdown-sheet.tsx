import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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
import { useGangWarDayMemberContributions } from '@/hooks/use-gang-wars';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount } from '@/lib/format';
import { fontFamily, radius, spacing, type } from '@/lib/gaingang-theme';
import type { ExerciseUnit } from '@/types';

type SideTab = 'ours' | 'theirs';

interface GangWarDayBreakdownSheetProps {
  matchId: string;
  dayOn: string;
  exerciseName: string;
  unit?: ExerciseUnit;
  ourGangId: string;
  ourGangName: string;
  theirGangId: string;
  theirGangName: string;
  visible: boolean;
  onClose: () => void;
}

function weekdayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function GangWarDayBreakdownSheet({
  matchId,
  dayOn,
  exerciseName,
  unit = 'reps',
  ourGangId,
  ourGangName,
  theirGangId,
  theirGangName,
  visible,
  onClose,
}: GangWarDayBreakdownSheetProps) {
  const t = useThemeTokens();
  const [tab, setTab] = useState<SideTab>('ours');

  useEffect(() => {
    if (visible) setTab('ours');
  }, [visible, dayOn]);

  const activeGangId = tab === 'ours' ? ourGangId : theirGangId;
  const activeGangName = tab === 'ours' ? ourGangName : theirGangName;

  const { data, isLoading } = useGangWarDayMemberContributions(
    matchId,
    activeGangId,
    dayOn,
    visible,
  );

  const members = data?.members ?? [];
  const gangTotal = Number(data?.gang_day_total ?? 0);
  const resolvedUnit = (data?.unit as ExerciseUnit | undefined) ?? unit;
  const titleExercise = data?.exercise_name || exerciseName;

  const tabs = useMemo(
    () =>
      [
        { key: 'ours' as const, label: ourGangName },
        { key: 'theirs' as const, label: theirGangName },
      ] as const,
    [ourGangName, theirGangName],
  );

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
                Daily breakdown
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.displaySemi,
                  fontSize: 20,
                  color: t.heading,
                }}
                numberOfLines={1}
              >
                {weekdayLabel(dayOn)}
              </Text>
              <Text style={{ color: t.body, fontSize: 13 }} numberOfLines={1}>
                {titleExercise}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close day breakdown"
            >
              <Ionicons name="close" size={24} color={t.body} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.tabRow,
              { backgroundColor: `${t.heading}0F`, borderColor: t.buttonBorder },
            ]}
          >
            {tabs.map((item) => {
              const selected = tab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[
                    styles.tab,
                    selected
                      ? {
                          backgroundColor: 'rgba(77,140,255,0.22)',
                          borderColor: 'rgba(77,140,255,0.45)',
                        }
                      : { borderColor: 'transparent' },
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 13,
                      color: selected ? t.accent : t.body,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.totalCard,
              {
                backgroundColor: 'rgba(74,222,128,0.1)',
                borderColor: 'rgba(74,222,128,0.28)',
              },
            ]}
          >
            <Text
              style={{
                color: '#86EFAC',
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontFamily: fontFamily.bodySemi,
              }}
            >
              {activeGangName} · day total
            </Text>
            <Text
              style={{
                color: t.heading,
                fontFamily: fontFamily.display,
                fontSize: 32,
                marginTop: 4,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatAmount(gangTotal, resolvedUnit)}
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={t.accent} style={{ marginVertical: 28 }} />
          ) : members.length === 0 ? (
            <Text style={[type.bodySm, { color: t.body, paddingVertical: 20 }]}>
              No contributions yet for this day.
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
                const contribution = Number(member.contribution ?? 0);
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
                    <Text
                      style={{
                        width: 22,
                        fontFamily: fontFamily.bodySemi,
                        fontSize: 13,
                        color: t.placeholder,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {index + 1}
                    </Text>
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
                        color: contribution > 0 ? '#4ADE80' : t.placeholder,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatAmount(contribution, resolvedUnit)}
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
    maxHeight: '78%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  totalCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
