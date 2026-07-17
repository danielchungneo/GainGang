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
import { useAuth } from '@/context/auth-context';
import { useGangMembers } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, radius, spacing, type } from '@/lib/gaingang-theme';
import { pushUserProfile } from '@/lib/navigate-profile';
import { levelFromXp, type GangRole } from '@/types';

interface GangMembersSheetProps {
  gangId: string;
  gangName: string;
  visible: boolean;
  onClose: () => void;
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
}: GangMembersSheetProps) {
  const t = useThemeTokens();
  const { session } = useAuth();
  const { data: members, isLoading } = useGangMembers(gangId, { enabled: visible });

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

                return (
                  <TouchableOpacity
                    key={member.user_id}
                    onPress={() => {
                      onClose();
                      pushUserProfile(member.user_id, { isSelf });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${name}'s profile`}
                    style={[
                      styles.row,
                      {
                        backgroundColor: `${t.heading}08`,
                        borderColor: t.buttonBorder,
                      },
                    ]}
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
                    <Ionicons name="chevron-forward" size={18} color={t.body} />
                  </TouchableOpacity>
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
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
