import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useForceStoreUpdate } from '@/hooks/use-force-store-update';
import { fontFamily, spacing, type, useTheme } from '@/lib/gaingang-theme';

/**
 * Blocking prompt when the installed App Store / Play Store build is too old.
 * Not dismissible — the only action is opening the store listing.
 */
export function ForceStoreUpdateModal() {
  const { theme } = useTheme();
  const { isUpdateRequired, message, openStore } = useForceStoreUpdate();
  const c = theme.colors;

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
        <GlassSurface style={styles.card}>
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
            New version available
          </Text>
          <Text style={[type.bodySm, styles.body, { color: c.textDim }]}>
            {message}
          </Text>

          <Button
            label="Update from store"
            onPress={() => {
              void openStore();
            }}
            style={styles.cta}
          />
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
  cta: {
    marginTop: spacing.xs,
  },
});
