import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useOtaUpdate } from '@/hooks/use-ota-update';
import { fontFamily, spacing, type, useTheme } from '@/lib/gaingang-theme';

/**
 * Blocking prompt when an EAS OTA update is available.
 * Not dismissible — the only action is downloading and applying the update.
 */
export function OtaUpdateModal() {
  const { theme } = useTheme();
  const { isUpdateRequired, isUpdating, errorMessage, applyUpdate } =
    useOtaUpdate();
  const c = theme.colors;
  const isLight = theme.mode === 'light';

  return (
    <Modal
      visible={isUpdateRequired}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back must not dismiss — update is mandatory.
      onRequestClose={() => {}}
    >
      <View
        style={styles.backdrop}
        accessibilityViewIsModal
        accessibilityRole="alert"
      >
        <GlassSurface opaque={isLight} style={styles.card}>
          <Text
            style={[
              styles.eyebrow,
              { color: c.primaryGlow, fontFamily: fontFamily.mono },
            ]}
          >
            UPDATE REQUIRED
          </Text>
          <Text
            style={[
              styles.title,
              { color: c.text, fontFamily: fontFamily.displaySemi },
            ]}
          >
            A new version is ready
          </Text>
          <Text style={[type.bodySm, styles.body, { color: c.textDim }]}>
            Download and install the latest update to keep using GainGang. This
            only takes a moment.
          </Text>

          {errorMessage ? (
            <Text
              style={[
                type.bodySm,
                styles.error,
                { color: '#FF7396', fontFamily: fontFamily.body },
              ]}
            >
              {errorMessage}
            </Text>
          ) : null}

          {isUpdating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={c.primary} />
              <Text
                style={{
                  color: c.textDim,
                  fontFamily: fontFamily.body,
                  fontSize: 14,
                }}
              >
                Updating…
              </Text>
            </View>
          ) : (
            <Button
              label="Update now"
              onPress={() => {
                void applyUpdate();
              }}
              style={styles.cta}
            />
          )}
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(5, 7, 15, 0.72)',
  },
  card: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    letterSpacing: 0.2,
  },
  body: {
    lineHeight: 20,
  },
  error: {
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cta: {
    marginTop: spacing.xs,
  },
});
