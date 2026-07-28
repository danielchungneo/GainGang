import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ScreenTimeAppPicker,
  type FamilyActivityPickerSelectionEvent,
} from '@/components/screen-time-app-picker';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import {
  useCompleteFocusLockIntro,
  useNeedsCrewSetup,
  useNeedsFocusLockIntro,
} from '@/hooks/use-onboarding';
import { useScreenTimeLock } from '@/hooks/use-screen-time-lock';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

const FOCUS_POINTS = [
  {
    icon: 'phone-portrait-outline' as const,
    title: 'Restrict distracting apps',
    body: 'Choose social apps that stay locked until today’s exercises are done.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: 'Earn your unlock',
    body: 'Finish your daily goals and Focus lock lifts automatically for the rest of the day.',
  },
  {
    icon: 'settings-outline' as const,
    title: 'Change anytime',
    body: 'Turn it on or off and pick different apps under Settings → Focus lock.',
  },
];

/**
 * One-time intro for existing accounts that finished onboarding before Focus
 * lock shipped. New signups see this in pre-auth onboarding instead.
 */
export default function WelcomeFocusLockScreen() {
  const t = useThemeTokens();
  const { session, isPending: authPending } = useAuth();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsFocusLockIntro, isLoading: introLoading } = useNeedsFocusLockIntro();
  const completeIntro = useCompleteFocusLockIntro();
  const {
    supported,
    isReady,
    prefs,
    permissionGranted,
    status,
    isUpdating,
    enable,
    saveSelection,
  } = useScreenTimeLock();
  const [error, setError] = useState<string | null>(null);
  const [savingSelection, setSavingSelection] = useState(false);

  const isIos = Platform.OS === 'ios';
  const canEnable = supported && isIos;
  const isFocusLockOn = prefs.enabled && permissionGranted;
  const hasAppsSelected = prefs.blockedItems.length > 0;

  useEffect(() => {
    if (authPending || crewLoading || introLoading) return;
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (needsCrewSetup) {
      router.replace('/');
      return;
    }
    if (!needsFocusLockIntro) {
      router.replace('/');
    }
  }, [
    authPending,
    crewLoading,
    introLoading,
    session,
    needsCrewSetup,
    needsFocusLockIntro,
  ]);

  async function finishIntro() {
    try {
      await completeIntro.mutateAsync();
    } catch {
      // Still continue — they can find Focus lock later in Settings.
    }
    router.replace('/');
  }

  async function handleEnable() {
    setError(null);
    const ok = await enable();
    if (ok) return;
    setError(
      'Screen Time access is needed. Allow it in the system prompt, or tap Not now to continue.',
    );
  }

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

  if (
    authPending ||
    crewLoading ||
    introLoading ||
    !session ||
    needsCrewSetup ||
    !needsFocusLockIntro ||
    !isReady
  ) {
    return (
      <ScreenBackground>
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[type.heading, { color: t.heading, fontSize: 28 }]}>
              New Update: Focus Lock
            </Text>
            <Text style={[type.body, { color: t.body, marginTop: spacing.sm, lineHeight: 22 }]}>
              Restrict distracting apps until you finish today’s exercises. Opt in now — you can
              change which apps anytime in Settings.
            </Text>
          </View>

          {!isFocusLockOn ? (
            <View style={styles.list}>
              {FOCUS_POINTS.map((item) => (
                <GlassSurface key={item.title} style={styles.card}>
                  <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
                    <Ionicons name={item.icon} size={22} color={t.accent} />
                  </View>
                  <View style={styles.copy}>
                    <Text
                      style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}
                    >
                      {item.title}
                    </Text>
                    <Text style={[type.bodySm, { color: t.body, marginTop: 4, lineHeight: 20 }]}>
                      {item.body}
                    </Text>
                  </View>
                </GlassSurface>
              ))}
            </View>
          ) : null}

          {!canEnable ? (
            <Text
              style={[
                type.bodySm,
                { color: t.placeholder, marginTop: spacing.md, lineHeight: 20 },
              ]}
            >
              Focus lock uses Apple Screen Time and is available on iPhone. You can continue for
              now.
            </Text>
          ) : null}

          {isFocusLockOn ? (
            <View style={styles.pickerSection}>
              <View style={styles.pickerHeader}>
                <Text style={[type.labelSm, { color: t.body }]}>Apps to restrict</Text>
                {savingSelection ? (
                  <ActivityIndicator color={t.accent} />
                ) : hasAppsSelected ? (
                  <Text style={[type.bodySm, { color: t.heading }]}>
                    {prefs.totalApps > 0 ? `${prefs.totalApps} apps` : ''}
                    {prefs.totalApps > 0 && prefs.totalCategories > 0 ? ' · ' : ''}
                    {prefs.totalCategories > 0 ? `${prefs.totalCategories} categories` : ''}
                  </Text>
                ) : (
                  <Text
                    style={[
                      type.bodySm,
                      { color: t.accent, fontFamily: fontFamily.bodySemi },
                    ]}
                  >
                    Pick apps below
                  </Text>
                )}
              </View>
              <Text
                style={[
                  type.bodySm,
                  { color: t.body, lineHeight: 20, marginBottom: spacing.sm },
                ]}
              >
                Choose social apps (or categories). They stay locked until today’s exercises are
                complete.
              </Text>
              <View
                style={[
                  styles.pickerFrame,
                  { borderColor: t.buttonBorder, backgroundColor: `${t.accent}08` },
                ]}
              >
                <ScreenTimeAppPicker
                  initialSelection={prefs.selectionData}
                  onSelectionChange={(event) => {
                    void handleSelectionChange(event);
                  }}
                  theme={t.mode === 'dark' ? 'dark' : 'light'}
                  style={styles.picker}
                />
              </View>
            </View>
          ) : null}

          {status === 'needs_permission' ? (
            <Text
              style={[
                type.bodySm,
                { color: t.placeholder, marginTop: spacing.md, lineHeight: 20 },
              ]}
            >
              Screen Time access is required. Tap Enable Focus lock to grant permission.
            </Text>
          ) : null}

          {error ? (
            <Text style={[type.bodySm, { color: '#F87171', marginTop: spacing.md }]}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {!canEnable || isFocusLockOn ? (
            <Button
              label="Continue"
              disabled={isUpdating || savingSelection || completeIntro.isPending}
              onPress={() => void finishIntro()}
            />
          ) : (
            <Button
              label={isUpdating ? 'Enabling…' : 'Enable Focus lock'}
              disabled={isUpdating || completeIntro.isPending}
              onPress={() => void handleEnable()}
            />
          )}
          {error ? (
            <Button
              label="Open Settings"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {canEnable && !isFocusLockOn ? (
            <Button
              label="Not now"
              variant="ghost"
              disabled={completeIntro.isPending}
              onPress={() => void finishIntro()}
            />
          ) : null}
        </View>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  scroll: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  header: {
    marginBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  pickerSection: {
    gap: 8,
    marginTop: spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'visible',
  },
  picker: {
    height: 420,
    borderRadius: 12,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
