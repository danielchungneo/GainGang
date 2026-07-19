import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { IconBadge, ScreenBackground } from '@/components/ui';
import { UserProfileView } from '@/components/user-profile-view';
import { useAuth } from '@/context/auth-context';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useUnopenedCrateCount } from '@/hooks/use-reward-crates';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { spacing, type } from '@/lib/gaingang-theme';

export default function ProfileScreen() {
  const t = useThemeTokens();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { refetch } = useProfile();
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);
  const unreadAlerts = useUnreadNotificationCount();
  const unopenedCrates = useUnopenedCrateCount();

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
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center justify-between">
          <Text style={[type.heading, { color: t.heading }]}>Profile</Text>

          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.push('/alerts')}
              accessibilityRole="button"
              accessibilityLabel={
                unreadAlerts > 0
                  ? `Open alerts, ${unreadAlerts} unread`
                  : 'Open alerts'
              }
              hitSlop={8}
            >
              <View>
                <Ionicons
                  name={unreadAlerts > 0 ? 'notifications' : 'notifications-outline'}
                  size={24}
                  color={t.heading}
                />
                <IconBadge count={unreadAlerts} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/inventory')}
              accessibilityRole="button"
              accessibilityLabel={
                unopenedCrates > 0
                  ? `Open inventory, ${unopenedCrates} unopened crates`
                  : 'Open inventory'
              }
              hitSlop={8}
            >
              <View>
                <Ionicons
                  name={unopenedCrates > 0 ? 'cube' : 'cube-outline'}
                  size={24}
                  color={t.heading}
                />
                <IconBadge count={unopenedCrates} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={24} color={t.heading} />
            </TouchableOpacity>
          </View>
        </View>

        {userId ? <UserProfileView userId={userId} isOwnProfile /> : null}
      </ScrollView>
    </ScreenBackground>
  );
}
