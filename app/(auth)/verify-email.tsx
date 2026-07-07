import { GainGangLogo } from '@/brand';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { DarkGlass, Glass } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

export default function VerifyEmailScreen() {
  const colorScheme = useColorScheme();
  const isLight = colorScheme !== 'dark';
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  async function handleResend() {
    if (!email) {
      setResendError('Missing email address. Go back and sign up again.');
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    setIsResending(false);
    if (error) {
      setResendError(error.message ?? 'Could not resend confirmation email.');
      return;
    }
    setResendMessage('Confirmation email sent. Check your inbox.');
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }}
      >
        <GlassSurface style={{ padding: 24 }}>
          <GainGangLogo
            size="sm"
            theme={isLight ? 'light' : 'dark'}
            style={{ marginBottom: 24 }}
          />

          <View className="mb-6 items-center">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{
                backgroundColor: isLight ? 'rgba(2,132,199,0.12)' : 'rgba(56,189,248,0.12)',
              }}
            >
              <Ionicons
                name="mail-outline"
                size={32}
                color={isLight ? '#0284c7' : DarkGlass.neonCyan}
              />
            </View>
            <Text
              style={{ color: isLight ? Glass.textPrimary : DarkGlass.textPrimary }}
              className="text-center text-3xl font-bold"
            >
              Confirm your email
            </Text>
          </View>

          <Text
            style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}
            className="mb-2 text-center text-base leading-6"
          >
            We sent a confirmation link to
          </Text>
          {email ? (
            <Text
              style={{ color: isLight ? Glass.textPrimary : DarkGlass.textPrimary }}
              className="mb-6 text-center text-base font-semibold"
            >
              {email}
            </Text>
          ) : null}
          <Text
            style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}
            className="mb-6 text-center text-sm leading-5"
          >
            Open the link in that email to activate your account, then sign in.
          </Text>

          {resendError ? (
            <Text style={isLight ? styles.errorLight : styles.errorDark}>{resendError}</Text>
          ) : null}
          {resendMessage ? (
            <Text
              style={{
                color: isLight ? '#059669' : '#34d399',
                fontSize: 14,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {resendMessage}
            </Text>
          ) : null}

          <TouchableOpacity
            style={isLight ? styles.primaryButtonLight : styles.primaryButtonDark}
            onPress={handleResend}
            disabled={isResending || !email}
          >
            {isResending ? (
              <ActivityIndicator color={isLight ? '#fff' : DarkGlass.primaryText} />
            ) : (
              <Text style={isLight ? styles.primaryButtonTextLight : styles.primaryButtonTextDark}>
                Resend email
              </Text>
            )}
          </TouchableOpacity>

          <View className="mt-6 flex-row justify-center">
            <Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}>
              Already confirmed?{' '}
            </Text>
            <Link href="/(auth)/sign-in">
              <Text
                style={{ color: isLight ? '#0284c7' : DarkGlass.neonCyan }}
                className="font-semibold"
              >
                Sign in
              </Text>
            </Link>
          </View>
        </GlassSurface>
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  primaryButtonLight: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  primaryButtonDark: {
    backgroundColor: DarkGlass.primaryBg,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: DarkGlass.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonTextLight: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  primaryButtonTextDark: {
    color: DarkGlass.primaryText,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  errorLight: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDark: {
    color: '#f87171',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
});
