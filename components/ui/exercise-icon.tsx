import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getExerciseIconSource } from '@/lib/exercise-icons';

export interface ExerciseIconProps {
  /** Catalog / display name used to resolve art. */
  exerciseName: string;
  size?: number;
  /** Optional explicit source; skips name lookup when provided. */
  source?: ImageSource | null;
  /**
   * Overrides the theme tint (black in light / white in dark).
   * Also used for the Ionicons fallback.
   */
  color?: string;
  /** Shown when no art exists for this exercise. Defaults to fitness outline. */
  fallback?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Exercise art keyed by name, tinted for the active color scheme. */
export function ExerciseIcon({
  exerciseName,
  size = 28,
  source,
  color,
  fallback = true,
  style,
}: ExerciseIconProps) {
  const { isLight } = useThemeTokens();
  const resolved = source === undefined ? getExerciseIconSource(exerciseName) : source;
  const tintColor = color ?? (isLight ? '#000000' : '#FFFFFF');

  if (resolved) {
    return (
      <View style={[{ width: size, height: size }, style]} accessibilityIgnoresInvertColors>
        <Image
          source={resolved}
          style={styles.image}
          contentFit="contain"
          tintColor={tintColor}
          transition={120}
          accessibilityLabel={`${exerciseName} icon`}
        />
      </View>
    );
  }

  if (!fallback) return null;

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 4 },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name="fitness-outline" size={Math.round(size * 0.62)} color={tintColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
