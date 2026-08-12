import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { HUD_CONTENT_TOP_PAD } from '@/lib/app-hud';
import { spacing, type } from '@/lib/gaingang-theme';

export default function ProfileScreen() {
  const t = useThemeTokens();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { refetch } = useProfile();
  const { isRefreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: HUD_CONTENT_TOP_PAD + spacing.sm,
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
        <View className="flex-row items-center justify-between">
          <Text style={[type.heading, { color: t.heading }]}>Profile</Text>

          <TouchableOpacity
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={24} color={t.heading} />
          </TouchableOpacity>
        </View>

        {userId ? <UserProfileView userId={userId} isOwnProfile /> : null}
      </ScrollView>
    </ScreenBackground>
  );
}
