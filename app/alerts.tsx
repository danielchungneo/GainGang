import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Avatar, GlassSurface, ScreenBackground } from '@/components/ui';
import {
  notificationVisual,
  useDismissReadNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationWithActor,
} from '@/hooks/use-notifications';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { timeAgo } from '@/lib/format';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

export default function AlertsScreen() {
  const t = useThemeTokens();
  const { data: alerts, isLoading, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const dismissRead = useDismissReadNotifications();

  const visibleAlerts = alerts ?? [];
  const unreadCount = visibleAlerts.filter((a) => !a.is_read).length;
  const canDismissRead = visibleAlerts.length > 0 && unreadCount === 0;

  async function handlePress(alert: NotificationWithActor) {
    if (!alert.is_read) {
      markRead.mutate(alert.id);
    }

    // Daily goal complete → Groups tab, Progress view for that gang.
    if (alert.type === 'daily_goal' && alert.gang_id) {
      router.push({
        pathname: '/(tabs)/groups',
        params: { gangId: alert.gang_id, tab: 'progress' },
      });
      return;
    }

    if (alert.activity_id) {
      router.push(`/activity/${alert.activity_id}`);
      return;
    }

    if (alert.gang_id) {
      router.push({
        pathname: '/(tabs)/groups',
        params: { gangId: alert.gang_id, tab: 'progress' },
      });
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </Pressable>
          <Text style={[type.heading, { color: t.heading, flex: 1 }]}>Alerts</Text>
          {unreadCount > 0 ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              accessibilityRole="button"
              accessibilityLabel="Mark all alerts as read"
              hitSlop={8}
              disabled={markAllRead.isPending}
            >
              <Text style={[type.bodySm, { color: t.accent, fontFamily: fontFamily.bodySemi }]}>
                Mark all read
              </Text>
            </Pressable>
          ) : canDismissRead ? (
            <Pressable
              onPress={() => dismissRead.mutate()}
              accessibilityRole="button"
              accessibilityLabel="Dismiss all read alerts"
              hitSlop={8}
              disabled={dismissRead.isPending}
            >
              <Text style={[type.bodySm, { color: t.accent, fontFamily: fontFamily.bodySemi }]}>
                Dismiss all
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[type.bodySm, { color: t.body }]}>
          Kudos, comments, pokes, and gang wins show up here.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />
        ) : visibleAlerts.length === 0 ? (
          <GlassSurface style={{ padding: 20, gap: 8 }}>
            <Text
              style={{
                fontFamily: fontFamily.displaySemi,
                fontSize: 18,
                color: t.heading,
              }}
            >
              You're all caught up
            </Text>
            <Text style={[type.bodySm, { color: t.body }]}>
              When someone hyping your log, comments, pokes you, or your gang clears a daily goal,
              it will land here.
            </Text>
          </GlassSurface>
        ) : (
          <View style={{ gap: 10 }}>
            {visibleAlerts.map((alert) => {
              const visual = notificationVisual(alert.type);
              const actorName =
                alert.actor?.full_name?.trim() ||
                alert.actor?.username?.trim() ||
                'GainGang';

              return (
                <Pressable
                  key={alert.id}
                  onPress={() => void handlePress(alert)}
                  accessibilityRole="button"
                  accessibilityLabel={alert.body}
                >
                  <GlassSurface
                    style={{
                      padding: 16,
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'flex-start',
                      opacity: alert.is_read ? 0.72 : 1,
                      borderWidth: alert.is_read ? 0 : 1,
                      borderColor: alert.is_read ? 'transparent' : `${t.accent}55`,
                    }}
                  >
                    <View>
                      {alert.actor ? (
                        <Avatar name={actorName} uri={alert.actor.avatar_url} size={44} />
                      ) : (
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${t.accent}22`,
                          }}
                        >
                          <Ionicons name={visual.icon} size={22} color={t.accent} />
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <View className="flex-row items-center justify-between gap-2">
                        <Text
                          style={[
                            type.labelSm,
                            { color: t.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
                          ]}
                        >
                          {visual.label}
                        </Text>
                        <Text style={[type.bodySm, { color: t.body }]}>
                          {timeAgo(alert.created_at)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: alert.is_read ? fontFamily.body : fontFamily.bodySemi,
                          fontSize: 15,
                          color: t.heading,
                          lineHeight: 21,
                        }}
                      >
                        {alert.body}
                      </Text>
                    </View>

                    {!alert.is_read ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          marginTop: 6,
                          backgroundColor: t.accent,
                        }}
                      />
                    ) : null}
                  </GlassSurface>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
