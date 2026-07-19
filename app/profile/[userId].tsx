import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenBackground } from '@/components/ui';
import { UserProfileView } from '@/components/user-profile-view';
import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { spacing, type } from '@/lib/gaingang-theme';

export default function OtherUserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const t = useThemeTokens();
  const { session } = useAuth();
  const isOwnProfile = !!userId && userId === session?.user.id;
  const { refetch } = useProfile(isOwnProfile ? undefined : userId);
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

  useEffect(() => {
    if (isOwnProfile) router.replace('/(tabs)/profile');
  }, [isOwnProfile]);

  if (!userId) {
    return (
      <ScreenBackground>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </TouchableOpacity>
          <Text style={[type.body, { color: t.body }]}>Profile not found.</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (isOwnProfile) return null;

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
        <View className="mt-4 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </TouchableOpacity>
          <Text style={[type.heading, { color: t.heading, flex: 1 }]}>Profile</Text>
        </View>

        <UserProfileView userId={userId} isOwnProfile={false} />
      </ScrollView>
    </ScreenBackground>
  );
}
