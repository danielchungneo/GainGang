import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenBackground } from '@/components/ui/screen-background';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

const TOTAL_STEPS = 5;

interface OnboardingShellProps {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onSkip?: () => void;
  skipLabel?: string;
  /**
   * When true, only the step dots + title stay fixed.
   * Subtitle and body scroll underneath; footer stays pinned at the bottom.
   */
  scrollContent?: boolean;
}

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  footer,
  onSkip,
  skipLabel = 'Skip',
  scrollContent = false,
}: OnboardingShellProps) {
  const t = useThemeTokens();
  const muted = t.placeholder;
  const border = t.buttonBorder;

  const header = (
    <View style={[styles.header, scrollContent && styles.headerFixed]}>
      <Text style={[type.heading, { color: t.heading, fontSize: 28 }]}>{title}</Text>
      {!scrollContent && subtitle ? (
        <Text style={[type.body, { color: t.body, marginTop: spacing.sm, lineHeight: 22 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  const subtitleBlock =
    scrollContent && subtitle ? (
      <Text style={[type.body, { color: t.body, marginBottom: spacing.md, lineHeight: 22 }]}>
        {subtitle}
      </Text>
    ) : null;

  const footerBlock = footer ? <View style={styles.footer}>{footer}</View> : null;

  return (
    <ScreenBackground>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              const active = i + 1 === step;
              const done = i + 1 < step;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active || done ? t.accent : border,
                      opacity: active ? 1 : done ? 0.7 : 0.35,
                      width: active ? 22 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>
          {onSkip ? (
            <TouchableOpacity onPress={onSkip} hitSlop={12} accessibilityRole="button">
              <Text style={[type.bodySm, { color: muted, fontFamily: fontFamily.bodySemi }]}>
                {skipLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        {header}

        {scrollContent ? (
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {subtitleBlock}
            {children}
          </ScrollView>
        ) : (
          <View style={styles.body}>{children}</View>
        )}

        {footerBlock}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    minHeight: 36,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  skipPlaceholder: {
    width: 40,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  headerFixed: {
    marginBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
