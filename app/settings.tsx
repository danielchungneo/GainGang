import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppVersionLabel } from '@/components/app-version-label';
import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import {
  useIapConfigured,
  usePresentCustomerCenter,
  useRestorePurchases,
} from '@/hooks/use-iap';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type, useTheme } from '@/lib/gaingang-theme';
import { supabase } from '@/lib/supabase';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface SettingsRowProps {
  icon: IoniconName;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  showChevron?: boolean;
  trailing?: ReactNode;
  isLast?: boolean;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const t = useThemeTokens();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 11,
          letterSpacing: 1.4,
          color: t.placeholder,
          paddingHorizontal: 4,
        }}
      >
        {title}
      </Text>
      <GlassSurface style={{ overflow: 'hidden' }}>{children}</GlassSurface>
    </View>
  );
}

function SettingsRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  disabled,
  showChevron,
  trailing,
  isLast,
}: SettingsRowProps) {
  const t = useThemeTokens();
  const accent = iconColor ?? t.accent;
  const bg = iconBg ?? `${accent}22`;
  const content = (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.isLight ? 'rgba(15,20,35,0.08)' : 'rgba(232,237,247,0.08)',
        },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: t.heading }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: t.body }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={t.placeholder} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && !disabled && { opacity: 0.72 }}
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useTheme();
  const { session } = useAuth();
  const {
    permission: pushPermission,
    isRegistering: isPushRegistering,
    enablePushNotifications,
  } = usePushNotifications();
  const iapReady = useIapConfigured();
  const restorePurchases = useRestorePurchases();
  const customerCenter = usePresentCustomerCenter();
  const [signingOut, setSigningOut] = useState(false);

  const pushSubtitle =
    pushPermission === 'unavailable'
      ? 'Not available on this device'
      : pushPermission === 'granted'
        ? 'On — kudos, comments, pokes, gang wins'
        : pushPermission === 'denied'
          ? 'Blocked in system settings'
          : 'Alerts for activity and gang updates';

  async function handleTogglePush(enabled: boolean) {
    if (!enabled) {
      Alert.alert(
        'Turn off alerts in system settings',
        "Open your phone's notification settings for GainGang to mute push alerts. In-app alerts still appear on your profile.",
      );
      return;
    }

    const ok = await enablePushNotifications();
    if (!ok && pushPermission === 'denied') {
      Alert.alert(
        'Notifications blocked',
        "Enable notifications for GainGang in your phone's settings, then try again.",
      );
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  async function handleRestorePurchases() {
    try {
      const result = await restorePurchases.mutateAsync();
      const granted = result.fulfill.amountGranted;
      Alert.alert(
        'Purchases restored',
        granted > 0
          ? `+${granted.toLocaleString()} Creds restored.`
          : 'No new Cred purchases to restore.',
      );
    } catch (error) {
      Alert.alert(
        'Restore failed',
        error instanceof Error ? error.message : 'Could not restore purchases.',
      );
    }
  }

  async function handleManagePurchases() {
    try {
      await customerCenter.mutateAsync();
    } catch (error) {
      Alert.alert(
        'Unavailable',
        error instanceof Error ? error.message : 'Could not open purchase support.',
      );
    }
  }

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: Math.max(insets.bottom, 28) + 16,
          gap: spacing.lg,
        }}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={t.heading} />
          </Pressable>
          <Text style={[type.heading, { color: t.heading, flex: 1 }]}>Settings</Text>
        </View>

        <SettingsSection title="ACCOUNT">
          <SettingsRow
            icon="person-circle-outline"
            title="Profile"
            subtitle="Photo, name, bio, equipment"
            onPress={() => router.push('/edit-profile')}
            showChevron
          />
          <SettingsRow
            icon="mail-outline"
            title="Signed in"
            subtitle={session?.user.email ?? 'Not signed in'}
            isLast
          />
        </SettingsSection>

        <SettingsSection title="PREFERENCES">
          <SettingsRow
            icon={mode === 'dark' ? 'moon' : 'sunny'}
            iconColor={mode === 'dark' ? '#9D4EDD' : '#E0910F'}
            title="Appearance"
            subtitle={mode === 'dark' ? 'Dark mode' : 'Light mode'}
            trailing={
              <Switch
                value={mode === 'dark'}
                onValueChange={(value) => setMode(value ? 'dark' : 'light')}
              />
            }
          />
          <SettingsRow
            icon="notifications-outline"
            title="Push notifications"
            subtitle={pushSubtitle}
            trailing={
              isPushRegistering ? (
                <ActivityIndicator color={t.accent} />
              ) : (
                <Switch
                  value={pushPermission === 'granted'}
                  disabled={pushPermission === 'unavailable'}
                  onValueChange={(value) => {
                    void handleTogglePush(value);
                  }}
                />
              )
            }
            isLast
          />
        </SettingsSection>

        <SettingsSection title="FOCUS">
          <SettingsRow
            icon="lock-closed-outline"
            iconColor="#4D8CFF"
            title="Focus lock"
            subtitle="Block apps until today’s exercises are done"
            onPress={() => router.push('/settings-screen-time' as Href)}
            showChevron
            isLast
          />
        </SettingsSection>

        {iapReady ? (
          <SettingsSection title="PURCHASES">
            <SettingsRow
              icon="refresh-outline"
              title="Restore purchases"
              subtitle="Re-sync Cred top-ups to this account"
              onPress={() => {
                void handleRestorePurchases();
              }}
              disabled={restorePurchases.isPending}
              trailing={
                restorePurchases.isPending ? (
                  <ActivityIndicator color={t.accent} />
                ) : undefined
              }
              showChevron={!restorePurchases.isPending}
            />
            <SettingsRow
              icon="help-buoy-outline"
              title="Purchase help"
              subtitle="Support for Cred top-ups and billing"
              onPress={() => {
                void handleManagePurchases();
              }}
              disabled={customerCenter.isPending}
              trailing={
                customerCenter.isPending ? (
                  <ActivityIndicator color={t.accent} />
                ) : undefined
              }
              showChevron={!customerCenter.isPending}
              isLast
            />
          </SettingsSection>
        ) : null}

        <SettingsSection title="ABOUT">
          <SettingsRow
            icon="information-circle-outline"
            title="App version"
            trailing={
              <AppVersionLabel
                color={t.body}
                style={{ textAlign: 'right', opacity: 1, marginRight: 2 }}
              />
            }
            isLast={!__DEV__}
          />
          {__DEV__ ? (
            <SettingsRow
              icon="flash-outline"
              iconColor="#F5A524"
              title="Animations"
              subtitle="Dev playground for celebration overlays"
              onPress={() => router.push('/dev-animations' as Href)}
              showChevron
              isLast
            />
          ) : null}
        </SettingsSection>

        <Pressable
          onPress={() => {
            void handleSignOut();
          }}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => [
            styles.signOut,
            {
              backgroundColor: t.isLight
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(248,113,113,0.1)',
              borderColor: t.isLight
                ? 'rgba(239,68,68,0.28)'
                : 'rgba(248,113,113,0.32)',
              opacity: pressed || signingOut ? 0.7 : 1,
            },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color={t.isLight ? '#b91c1c' : '#f87171'} />
          ) : (
            <View style={styles.signOutInner}>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={t.isLight ? '#b91c1c' : '#f87171'}
              />
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 16,
                  color: t.isLight ? '#b91c1c' : '#f87171',
                }}
              >
                Sign out
              </Text>
            </View>
          )}
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 16,
  },
  rowSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
  },
  signOut: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 54,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
