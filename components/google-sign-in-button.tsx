import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

import { DarkGlass, Glass } from '@/constants/theme';
import { AuthCancelledError, signInWithGoogle } from '@/lib/google-auth';

interface UseGoogleAuthOptions {
  onError?: (message: string) => void;
}

export function useGoogleAuth({ onError }: UseGoogleAuthOptions = {}) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof AuthCancelledError) return;
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed. Try again.';
      onError?.(message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [onError]);

  return { handleGoogleSignIn, isGoogleLoading };
}

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function GoogleSignInButton({ onPress, loading, disabled }: GoogleSignInButtonProps) {
  const isLight = useColorScheme() !== 'dark';

  return (
    <TouchableOpacity
      style={[styles.button, isLight ? styles.buttonLight : styles.buttonDark]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {loading ? (
        <ActivityIndicator color={isLight ? '#334155' : DarkGlass.textPrimary} />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color={isLight ? '#4285F4' : '#8AB4F8'} />
          <Text style={[styles.label, { color: isLight ? Glass.textPrimary : DarkGlass.textPrimary }]}>
            Continue with Google
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function AuthDivider() {
  const isLight = useColorScheme() !== 'dark';
  const lineColor = isLight ? 'rgba(100,116,139,0.35)' : 'rgba(0, 212, 255, 0.2)';
  const textColor = isLight ? Glass.textSecondary : DarkGlass.textSecondary;

  return (
    <View style={styles.dividerRow}>
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
      <Text style={[styles.dividerText, { color: textColor }]}>or</Text>
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
  },
  buttonLight: {
    backgroundColor: Glass.buttonBg,
    borderColor: Glass.buttonBorder,
  },
  buttonDark: {
    backgroundColor: DarkGlass.buttonBg,
    borderColor: DarkGlass.buttonBorder,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
});
