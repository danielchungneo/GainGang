import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useGangMembers, useKickGangMember } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, radius, spacing, status, type } from '@/lib/gaingang-theme';
import { pushUserProfile } from '@/lib/navigate-profile';
import { levelFromXp, type GangMemberWithProfile, type GangRole } from '@/types';

interface GangMembersSheetProps {
  gangId: string;
  gangName: string;
  visible: boolean;
  onClose: () => void;
  /** When true, the viewer can remove other non-owner members. */
  canKick?: boolean;
}

function roleLabel(role: GangRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

export function GangMembersSheet({
  gangId,
  gangName,
  visible,
  onClose,
  canKick = false,
}: GangMembersSheetProps) {
  const t = useThemeTokens();
  const { session } = useAuth();
  const { data: members, isLoading } = useGangMembers(gangId, { enabled: visible });
  const kickMember = useKickGangMember();
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  function confirmKick(member: GangMemberWithProfile) {
    if (kickingUserId) return;
    const name = member.profile.full_name || 'this member';
    Alert.alert(
      'Remove member?',
      `${name} will be removed from ${gangName}. They can rejoin later if the gang is public or they’re invited again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void handleKick(member);
          },
        },
      ],
    );
  }

  async function handleKick(member: GangMemberWithProfile) {
    setKickingUserId(member.user_id);
    try {
      await kickMember.mutateAsync({ gangId, userId: member.user_id });
    } catch (e) {
      Alert.alert(
        'Could not remove member',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setKickingUserId(null);
    }
  }

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
                Roster
              </Text>
              <Text
                style={{
                  fontFamily: fontFamily.displaySemi,
                  fontSize: 20,
                  color: t.heading,
                }}
                numberOfLines={1}
              >
                {gangName}
              </Text>
              <Text style={[type.bodySm, { color: t.body }]}>
                {members?.length ?? '…'}{' '}
                {(members?.length ?? 0) === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close members"
            >
              <Ionicons name="close" size={24} color={t.body} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={t.accent} style={{ marginVertical: 28 }} />
          ) : !members || members.length === 0 ? (
            <Text style={[type.bodySm, { color: t.body, paddingVertical: 20 }]}>
              No members found.
            </Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={{ gap: 10, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {members.map((member) => {
                const name = member.profile.full_name || 'Hunter';
                const isSelf = member.user_id === session?.user.id;
                const level = levelFromXp(member.profile.xp ?? 0);
                const showKick = canKick && !isSelf && member.role !== 'owner';
                const isKicking = kickingUserId === member.user_id;

                return (
                  <View
                    key={member.user_id}
                    style={[
                      styles.row,
                      {
                        backgroundColor: `${t.heading}08`,
                        borderColor: t.buttonBorder,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        pushUserProfile(member.user_id, { isSelf });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${name}'s profile`}
                      style={styles.rowMain}
                    >
                      <Avatar name={name} uri={member.profile.avatar_url} size={44} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            fontFamily: fontFamily.bodySemi,
                            fontSize: 15,
                            color: t.heading,
                          }}
                          numberOfLines={1}
                        >
                          {name}
                          {isSelf ? ' (you)' : ''}
                        </Text>
                        <Text style={[type.bodySm, { color: t.body }]}>
                          {roleLabel(member.role)}
                          {member.profile.username ? ` · @${member.profile.username}` : ''}
                          {` · Lvl ${level}`}
                        </Text>
                      </View>
                      {!showKick ? (
                        <Ionicons name="chevron-forward" size={18} color={t.body} />
                      ) : null}
                    </TouchableOpacity>

                    {showKick ? (
                      <TouchableOpacity
                        onPress={() => confirmKick(member)}
                        disabled={!!kickingUserId}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${name} from gang`}
                        style={[
                          styles.kickButton,
                          { borderColor: 'rgba(255, 61, 113, 0.35)' },
                        ]}
                      >
                        {isKicking ? (
                          <ActivityIndicator color={status.danger} size="small" />
                        ) : (
                          <Ionicons name="person-remove-outline" size={18} color={status.danger} />
                        )}
                      </TouchableOpacity>
                    ) : null}
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
    maxHeight: '78%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 420,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kickButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 61, 113, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
