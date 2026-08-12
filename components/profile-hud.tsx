import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, useSegments } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, IconBadge } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useEquippedCosmetics } from '@/hooks/use-cosmetics';
import { useUnreadNotificationCount } from '@/hooks/use-notifications';
import { useProfile } from '@/hooks/use-profile';
import { useUnopenedCrateCount } from '@/hooks/use-reward-crates';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { shouldShowProfileHud, HUD_CHIP } from '@/lib/app-hud';
import { spacing } from '@/lib/gaingang-theme';

/** Fixed top-left: avatar + border, alerts, crates — pill chip like Creds. */
export function ProfileHud() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const equipped = useEquippedCosmetics(profile);
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();
  const t = useThemeTokens();
  const unreadAlerts = useUnreadNotificationCount();
  const unopenedCrates = useUnopenedCrateCount();

  if (!session || !shouldShowProfileHud(segments)) return null;

  const onProfile =
    pathname === '/profile' ||
    pathname === '/(tabs)/profile' ||
    pathname.endsWith('/profile');

  const displayName = profile?.full_name?.trim() || 'Hunter';
  const chipBg = t.isLight ? 'rgba(255,255,255,0.92)' : 'rgba(14,21,36,0.92)';

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.xs,
        left: Math.max(insets.left, spacing.lg),
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingLeft: HUD_CHIP.paddingLeft + 4,
          paddingRight: HUD_CHIP.paddingRight + 4,
          paddingVertical: HUD_CHIP.paddingVertical,
          minHeight: HUD_CHIP.minHeight,
          borderRadius: 999,
          backgroundColor: chipBg,
          borderWidth: 1,
          borderColor: t.buttonBorder,
        }}
      >
        <Pressable
          onPress={() => {
            if (onProfile) return;
            router.push('/(tabs)/profile');
          }}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          hitSlop={4}
        >
          <Avatar
            name={displayName}
            uri={profile?.avatar_url}
            size={HUD_CHIP.avatarSize}
            borderStyle={equipped.avatarBorder?.style}
          />
        </Pressable>

        <Pressable
          onPress={() => router.push('/alerts')}
          accessibilityRole="button"
          accessibilityLabel={
            unreadAlerts > 0
              ? `Open alerts, ${unreadAlerts} unread`
              : 'Open alerts'
          }
          hitSlop={4}
        >
          <View>
            <Ionicons
              name={unreadAlerts > 0 ? 'notifications' : 'notifications-outline'}
              size={HUD_CHIP.iconSize}
              color={t.heading}
            />
            <IconBadge count={unreadAlerts} />
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/inventory')}
          accessibilityRole="button"
          accessibilityLabel={
            unopenedCrates > 0
              ? `Open inventory, ${unopenedCrates} unopened crates`
              : 'Open inventory'
          }
          hitSlop={4}
        >
          <View>
            <Ionicons
              name={unopenedCrates > 0 ? 'cube' : 'cube-outline'}
              size={HUD_CHIP.iconSize}
              color={t.heading}
            />
            <IconBadge count={unopenedCrates} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
