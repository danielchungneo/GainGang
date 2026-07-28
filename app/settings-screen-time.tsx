import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  ScreenTimeAppPicker,
  type FamilyActivityPickerSelectionEvent,
} from '@/components/screen-time-app-picker';
import { ScreenTimeUnlockOverlay } from '@/components/screen-time-unlock-overlay';
import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useScreenTimeLock } from '@/hooks/use-screen-time-lock';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { spacing, type } from '@/lib/gaingang-theme';

function statusCopy(status: ReturnType<typeof useScreenTimeLock>['status']): string {
  switch (status) {
    case 'unsupported':
      return 'Focus lock uses iOS Screen Time and is not available on this device.';
    case 'disabled':
      return 'Off — turn on to block selected apps until today’s exercises are done.';
    case 'needs_permission':
      return 'Screen Time access is required. Toggle on to grant permission.';
    case 'needs_apps':
      return 'On — pick the apps you want locked until goals are complete.';
    case 'locked':
      return 'Locked — selected apps stay blocked until you finish today’s goals.';
    case 'unlocked_today':
      return 'Unlocked for today — apps lock again after midnight on your next workout day.';
    default:
      return '';
  }
}

export default function SettingsScreenTimeScreen() {
  const t = useThemeTokens();
  const {
    supported,
    isReady,
    isUpdating,
    prefs,
    permissionGranted,
    status,
    enable,
    disable,
    saveSelection,
  } = useScreenTimeLock();
  const [savingSelection, setSavingSelection] = useState(false);
  const [previewUnlock, setPreviewUnlock] = useState(false);

  const handleToggle = useCallback(
    async (on: boolean) => {
      if (on) {
        const ok = await enable();
        if (!ok) {
          Alert.alert(
            'Screen Time permission needed',
            'Allow Screen Time access for GainGang in the system prompt, then try again. You can also enable it under Settings → Screen Time.',
          );
        }
        return;
      }
      await disable();
    },
    [disable, enable],
  );

  const handleSelectionChange = useCallback(
    async (event: FamilyActivityPickerSelectionEvent) => {
      setSavingSelection(true);
      try {
        await saveSelection({
          selectionData: event.selectionData,
          blockedItems: event.items,
          totalApps: event.totalApps,
          totalCategories: event.totalCategories,
        });
      } finally {
        setSavingSelection(false);
      }
    },
    [saveSelection],
  );

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: 40,
        }}
      >
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={[type.heading, { color: t.heading }]}>Focus lock</Text>
        </View>

        {!supported || Platform.OS !== 'ios' ? (
          <GlassSurface style={{ padding: 20, gap: 8 }}>
            <Text style={[type.labelSm, { color: t.body }]}>iOS only</Text>
            <Text style={[type.bodySm, { color: t.heading }]}>
              Focus lock uses Apple Screen Time to shield apps until you finish
              today’s exercises. It is available on iPhone only.
            </Text>
          </GlassSurface>
        ) : !isReady ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <>
            <GlassSurface
              style={{
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.labelSm, { color: t.body }]}>
                  Require goals before scrolling
                </Text>
                <Text style={[type.bodySm, { color: t.heading }]}>
                  {statusCopy(status)}
                </Text>
              </View>
              {isUpdating && !savingSelection ? (
                <ActivityIndicator color={t.accent} />
              ) : (
                <Switch
                  value={prefs.enabled && permissionGranted}
                  onValueChange={(value) => {
                    void handleToggle(value);
                  }}
                />
              )}
            </GlassSurface>

            {prefs.enabled && permissionGranted ? (
              <GlassSurface style={{ padding: 20, gap: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={[type.labelSm, { color: t.body }]}>
                    Apps to restrict
                  </Text>
                  {savingSelection ? (
                    <ActivityIndicator color={t.accent} />
                  ) : prefs.totalApps > 0 || prefs.totalCategories > 0 ? (
                    <Text style={[type.bodySm, { color: t.heading }]}>
                      {prefs.totalApps > 0 ? `${prefs.totalApps} apps` : ''}
                      {prefs.totalApps > 0 && prefs.totalCategories > 0
                        ? ' · '
                        : ''}
                      {prefs.totalCategories > 0
                        ? `${prefs.totalCategories} categories`
                        : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={[type.bodySm, { color: t.body }]}>
                  Choose social apps (or categories). They stay locked until
                  every exercise on today’s goals is complete. The shield button
                  sends a notification — tap that notification to open GainGang
                  (iOS cannot open apps directly from Screen Time shields).
                </Text>
                <ScreenTimeAppPicker
                  initialSelection={prefs.selectionData}
                  onSelectionChange={(event) => {
                    void handleSelectionChange(event);
                  }}
                  theme={t.mode === 'dark' ? 'dark' : 'light'}
                  style={{ height: 420, borderRadius: 12, overflow: 'hidden' }}
                />
              </GlassSurface>
            ) : null}
          </>
        )}
      </ScrollView>

      <ScreenTimeUnlockOverlay
        visible={previewUnlock}
        onDismiss={() => setPreviewUnlock(false)}
      />
    </ScreenBackground>
  );
}
