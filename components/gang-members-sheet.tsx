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
import {
  useGangMembers,
  useKickGangMember,
  useSetGangMemberRole,
  useTransferGangOwnership,
} from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, radius, spacing, type } from '@/lib/gaingang-theme';
import { pushUserProfile } from '@/lib/navigate-profile';
import { levelFromXp, type GangMemberWithProfile, type GangRole } from '@/types';

interface GangMembersSheetProps {
  gangId: string;
  gangName: string;
  visible: boolean;
  onClose: () => void;
  /** Viewer's role in this gang. */
  viewerRole?: GangRole;
}

function roleLabel(role: GangRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'captain') return 'Captain';
  return 'Member';
}

function canKickTarget(viewerRole: GangRole | undefined, targetRole: GangRole): boolean {
  if (!viewerRole || viewerRole === 'member') return false;
  if (targetRole === 'owner') return false;
  if (viewerRole === 'owner') return targetRole === 'captain' || targetRole === 'member';
  // Captain can only kick members.
  return targetRole === 'member';
}

export function GangMembersSheet({
  gangId,
  gangName,
  visible,
  onClose,
  viewerRole,
}: GangMembersSheetProps) {
  const t = useThemeTokens();
  const { session } = useAuth();
  const { data: members, isLoading } = useGangMembers(gangId, { enabled: visible });
  const kickMember = useKickGangMember();
  const setMemberRole = useSetGangMemberRole();
  const transferOwnership = useTransferGangOwnership();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const isOwner = viewerRole === 'owner';

  function confirmKick(member: GangMemberWithProfile) {
    if (busyUserId) return;
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
    setBusyUserId(member.user_id);
    try {
      await kickMember.mutateAsync({ gangId, userId: member.user_id });
    } catch (e) {
      Alert.alert(
        'Could not remove member',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusyUserId(null);
    }
  }

  function openMemberActions(member: GangMemberWithProfile) {
    if (busyUserId) return;
    const name = member.profile.full_name || 'this member';
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [];

    if (isOwner && member.role === 'member') {
      buttons.push({
        text: 'Make captain',
        onPress: () => {
          void handleSetRole(member, 'captain');
        },
      });
    }
    if (isOwner && member.role === 'captain') {
      buttons.push({
        text: 'Remove captain',
        onPress: () => {
          void handleSetRole(member, 'member');
        },
      });
    }
    if (isOwner && member.role !== 'owner') {
      buttons.push({
        text: 'Transfer ownership',
        onPress: () => confirmTransfer(member),
      });
    }
    if (canKickTarget(viewerRole, member.role)) {
      buttons.push({
        text: 'Remove from gang',
        style: 'destructive',
        onPress: () => confirmKick(member),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });

    if (buttons.length <= 1) return;
    Alert.alert(name, 'Choose an action', buttons);
  }

  function confirmTransfer(member: GangMemberWithProfile) {
    const name = member.profile.full_name || 'this member';
    Alert.alert(
      'Transfer ownership?',
      `You’ll make ${name} the owner and become a member. You can leave the gang after transferring.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () => {
            void handleTransfer(member);
          },
        },
      ],
    );
  }

  async function handleSetRole(member: GangMemberWithProfile, role: 'captain' | 'member') {
    setBusyUserId(member.user_id);
    try {
      await setMemberRole.mutateAsync({ gangId, userId: member.user_id, role });
    } catch (e) {
      Alert.alert(
        'Could not update role',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleTransfer(member: GangMemberWithProfile) {
    setBusyUserId(member.user_id);
    try {
      await transferOwnership.mutateAsync({ gangId, newOwnerId: member.user_id });
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not transfer ownership',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setBusyUserId(null);
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
                const showManage =
                  !isSelf &&
                  (canKickTarget(viewerRole, member.role) ||
                    (isOwner && member.role !== 'owner'));
                const isBusy = busyUserId === member.user_id;

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
                      {!showManage ? (
                        <Ionicons name="chevron-forward" size={18} color={t.body} />
                      ) : null}
                    </TouchableOpacity>

                    {showManage ? (
                      <TouchableOpacity
                        onPress={() => openMemberActions(member)}
                        disabled={!!busyUserId}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage ${name}`}
                        style={[
                          styles.manageButton,
                          { borderColor: t.buttonBorder },
                        ]}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={t.accent} size="small" />
                        ) : (
                          <Ionicons name="ellipsis-horizontal" size={18} color={t.heading} />
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {isOwner ? (
            <Text style={[type.bodySm, { color: t.body, paddingTop: 4 }]}>
              To leave this gang, transfer ownership to someone else first.
            </Text>
          ) : null}
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
  manageButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
