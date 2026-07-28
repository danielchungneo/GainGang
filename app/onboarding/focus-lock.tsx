import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import {
  ScreenTimeAppPicker,
  type FamilyActivityPickerSelectionEvent,
} from '@/components/screen-time-app-picker';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
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
];

const FOCUS_QUOTE =
  'Discipline is choosing between what you want now and what you want most.';

/**
 * Pre-auth Focus lock opt-in — after the camera demo, before auth.
 * Requires real Screen Time permission (not just a local enabled flag).
 */
export default function OnboardingFocusLockScreen() {
  const t = useThemeTokens();
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
  /** Local opt-in alone is not enough — Family Controls must actually be authorized. */
  const isFocusLockOn = prefs.enabled && permissionGranted;
  const hasAppsSelected = prefs.blockedItems.length > 0;

  function continueToAuth() {
    router.push('/onboarding/auth');
  }

  async function handleEnable() {
    setError(null);
    const ok = await enable();
    if (ok) {
      // Stay on this screen so the user can pick apps before continuing.
      return;
    }
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

  if (!isReady) {
    return (
      <OnboardingShell
        step={4}
        title="Focus lock"
        subtitle="Checking Screen Time access…"
        scrollContent
      >
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} />
        </View>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={4}
      title="Focus lock"
      subtitle="Restrict distracting apps until you finish today’s exercises. Opt in now — you can change which apps anytime in Settings."
      scrollContent
      footer={
        <>
          {!canEnable || isFocusLockOn ? (
            <Button
              label="Continue"
              disabled={isUpdating || savingSelection}
              onPress={continueToAuth}
            />
          ) : (
            <Button
              label={isUpdating ? 'Enabling…' : 'Enable Focus lock'}
              disabled={isUpdating}
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
            <Button label="Not now" variant="ghost" onPress={continueToAuth} />
          ) : null}
        </>
      }
    >
      <Text
        style={[
          type.body,
          {
            color: t.heading,
            textAlign: 'center',
            fontFamily: fontFamily.bodySemi,
            fontStyle: 'italic',
            lineHeight: 22,
            marginBottom: spacing.md,
          },
        ]}
      >
        &ldquo;{FOCUS_QUOTE}&rdquo;
      </Text>

      {!isFocusLockOn ? (
        <View style={styles.list}>
          {FOCUS_POINTS.map((item) => (
            <GlassSurface key={item.title} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: `${t.accent}22` }]}>
                <Ionicons name={item.icon} size={22} color={t.accent} />
              </View>
              <View style={styles.copy}>
                <Text style={[type.body, { color: t.heading, fontFamily: fontFamily.bodySemi }]}>
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
          Focus lock uses Apple Screen Time and is available on iPhone. You can continue for now.
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
              <Text style={[type.bodySm, { color: t.accent, fontFamily: fontFamily.bodySemi }]}>
                Pick apps below
              </Text>
            )}
          </View>
          <Text style={[type.bodySm, { color: t.body, lineHeight: 20, marginBottom: spacing.sm }]}>
            Choose social apps (or categories). They stay locked until today’s exercises are
            complete.
          </Text>
          {/*
            Keep the native Family Activity picker outside GlassSurface —
            overflow:hidden + border radius clips the Search field.
          */}
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
        <Text style={[type.bodySm, { color: t.placeholder, marginTop: spacing.md, lineHeight: 20 }]}>
          Screen Time access is required. Tap Enable Focus lock to grant permission.
        </Text>
      ) : null}

      {error ? (
        <Text style={[type.bodySm, { color: '#F87171', marginTop: spacing.md }]}>{error}</Text>
      ) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    minHeight: 120,
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
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    // Visible so the native Search field is not clipped by the frame.
    overflow: 'visible',
  },
  picker: {
    height: 520,
    borderRadius: 12,
  },
});
