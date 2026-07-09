import { GainGangLogo } from '@/brand';
// TODO(google-auth): Re-enable when Google sign-in is configured — see docs/GOOGLE_AUTH_TODO.md
// import { AuthDivider, GoogleSignInButton, useGoogleAuth } from '@/components/google-sign-in-button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { DarkGlass, Glass } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { isAppSession } from '@/lib/auth-session';
import { zodResolver } from '@hookform/resolvers/zod';
import * as LocalAuthentication from 'expo-local-authentication';
import { Link, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ScanFace } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { z } from 'zod';

const CREDENTIALS_KEY = 'auth_saved_credentials';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;
type SavedCredentials = { email: string; password: string };

function envString(key: string): string | undefined {
  const value = (process.env as unknown as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const isLight = colorScheme !== 'dark';

  const [rememberMe, setRememberMe] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [quickLoginKey, setQuickLoginKey] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // const { handleGoogleSignIn, isGoogleLoading } = useGoogleAuth({
  //   onError: (message) => setError('root', { message }),
  // });

  useEffect(() => {
    async function checkBiometrics() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const saved = await SecureStore.getItemAsync(CREDENTIALS_KEY);

      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFaceId = supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      );
      const canUseBiometric = hasHardware && isEnrolled && hasFaceId;
      setBiometricAvailable(canUseBiometric);
      setHasSavedCredentials(!!saved);

      if (saved) {
        const { email } = JSON.parse(saved) as SavedCredentials;
        setValue('email', email);
        setRememberMe(true);
      }
    }
    checkBiometrics();
  }, [setValue]);

  async function signInWithCredentials(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message ?? 'Sign-in failed');

    if (!isAppSession(data.session)) {
      await supabase.auth.signOut();
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email },
      });
      return;
    }

    router.replace('/(tabs)');
  }

  const quickLogins = [
    {
      key: 'daniel',
      label: 'Daniel',
      email: envString('EXPO_PUBLIC_TEST_LOGIN_1_EMAIL'),
      password: envString('EXPO_PUBLIC_TEST_LOGIN_1_PASSWORD'),
    },
    {
      key: 'elevated',
      label: 'Elevated',
      email: envString('EXPO_PUBLIC_TEST_LOGIN_2_EMAIL'),
      password: envString('EXPO_PUBLIC_TEST_LOGIN_2_PASSWORD'),
    },
  ].filter(
    (l): l is { key: string; label: string; email: string; password: string } =>
      !!l.email && !!l.password,
  );

  const showQuickLogins = __DEV__ && quickLogins.length > 0;

  async function onSubmit({ email, password }: FormData) {
    try {
      await signInWithCredentials(email, password);
      if (rememberMe) {
        await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }));
      } else {
        await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      }
    } catch (err: any) {
      setError('root', { message: err.message });
    }
  }

  async function signInQuick(login: { key: string; label: string; email: string; password: string }) {
    setQuickLoginKey(login.key);
    try {
      // Intentionally does not save credentials to SecureStore.
      await signInWithCredentials(login.email, login.password);
    } catch (err: any) {
      setError('root', { message: err.message ?? 'Sign-in failed' });
    } finally {
      setQuickLoginKey(null);
    }
  }

  async function handleBiometricSignIn() {
    setBiometricLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
        fallbackLabel: '',
      });

      if (!result.success) return;

      const saved = await SecureStore.getItemAsync(CREDENTIALS_KEY);
      if (!saved) {
        setError('root', { message: 'No saved credentials found. Please sign in manually.' });
        return;
      }

      const { email, password } = JSON.parse(saved) as SavedCredentials;
      await signInWithCredentials(email, password);
    } catch (err: any) {
      setError('root', { message: err.message });
    } finally {
      setBiometricLoading(false);
    }
  }

  const form = (
    <>
      <GainGangLogo
        size="sm"
        theme={isLight ? 'light' : 'dark'}
        style={{ marginBottom: 24 }}
      />
      <Text
        style={{ color: isLight ? Glass.textPrimary : DarkGlass.textPrimary }}
        className="text-3xl font-bold mb-8">
        Welcome back
      </Text>

      {/* TODO(google-auth): Re-enable — see docs/GOOGLE_AUTH_TODO.md
      <GoogleSignInButton
        onPress={handleGoogleSignIn}
        loading={isGoogleLoading}
        disabled={isSubmitting}
      />
      <AuthDivider />
      */}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={isLight ? styles.glassInput : styles.darkInput}
            placeholder="Email"
            placeholderTextColor={isLight ? Glass.textPlaceholder : DarkGlass.textPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>{errors.email.message}</Text>
      )}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[isLight ? styles.glassInput : styles.darkInput, { marginTop: 8 }]}
            placeholder="Password"
            placeholderTextColor={isLight ? Glass.textPlaceholder : DarkGlass.textPlaceholder}
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>{errors.password.message}</Text>
      )}

      {errors.root && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>{errors.root.message}</Text>
      )}

      {showQuickLogins ? (
        <View className="mt-4 gap-2">
          <Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }} className="text-xs font-semibold uppercase">
            Quick test login
          </Text>
          {quickLogins.map((login) => (
            <TouchableOpacity
              key={login.key}
              style={isLight ? styles.glassButton : styles.darkOutlineButton}
              className="rounded-xl py-4 items-center justify-center"
              onPress={() => signInQuick(login)}
              disabled={quickLoginKey !== null || isSubmitting}
            >
              {quickLoginKey === login.key ? (
                <ActivityIndicator color={isLight ? '#0369a1' : DarkGlass.neonCyan} />
              ) : (
                <Text style={{ color: isLight ? Glass.textPrimary : DarkGlass.primaryText }} className="text-base font-bold">
                  Sign in as {login.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Remember Me */}
      <TouchableOpacity
        className="flex-row items-center mt-3 mb-1 gap-2"
        onPress={() => setRememberMe(v => !v)}
        activeOpacity={0.7}>
        <View
          className="w-5 h-5 rounded items-center justify-center"
          style={
            rememberMe
              ? {
                  backgroundColor: isLight ? '#0284c7' : DarkGlass.neonCyan,
                  borderWidth: 2,
                  borderColor: isLight ? '#0284c7' : DarkGlass.neonCyan,
                }
              : isLight
                ? { borderWidth: 2, borderColor: 'rgba(100,116,139,0.55)' }
                : { borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.35)' }
          }>
          {rememberMe && (
            <Text
              style={{ color: isLight ? '#fff' : DarkGlass.primaryText }}
              className="text-xs font-bold leading-none">
              ✓
            </Text>
          )}
        </View>
        <Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }} className="text-sm">
          Remember me
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={isLight ? styles.primaryButtonLight : styles.primaryButtonDark}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={isLight ? '#fff' : DarkGlass.primaryText} />
        ) : (
          <Text style={isLight ? styles.primaryButtonTextLight : styles.primaryButtonTextDark}>
            Sign In
          </Text>
        )}
      </TouchableOpacity>

      {biometricAvailable && hasSavedCredentials && (
        <TouchableOpacity
          style={isLight ? styles.glassButton : styles.darkOutlineButton}
          className="rounded-xl py-4 mt-3 items-center flex-row justify-center gap-2"
          onPress={handleBiometricSignIn}
          disabled={biometricLoading}>
          {biometricLoading ? (
            <ActivityIndicator color={isLight ? '#0369a1' : DarkGlass.neonCyan} />
          ) : (
            <>
              <ScanFace size={22} color={isLight ? '#0369a1' : DarkGlass.neonCyan} />
              <Text style={{ color: isLight ? '#0369a1' : DarkGlass.neonCyan }} className="font-medium">
                Sign in with Face ID
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <View className="flex-row justify-center mt-6">
        <Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}>
          Don&apos;t have an account?{' '}
        </Text>
        <Link href="/(auth)/sign-up">
          <Text style={{ color: isLight ? '#0284c7' : DarkGlass.neonCyan }} className="font-semibold">
            Sign Up
          </Text>
        </Link>
      </View>
    </>
  );

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 }}
      >
        <GlassSurface style={{ padding: 24 }}>{form}</GlassSurface>
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  glassInput: {
    backgroundColor: Glass.inputBg,
    borderWidth: 1,
    borderColor: Glass.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    color: Glass.textPrimary,
    fontSize: 16,
  },
  darkInput: {
    backgroundColor: DarkGlass.inputBg,
    borderWidth: 1,
    borderColor: DarkGlass.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    color: DarkGlass.textPrimary,
    fontSize: 16,
  },
  glassButton: {
    backgroundColor: Glass.buttonBg,
    borderWidth: 1,
    borderColor: Glass.buttonBorder,
  },
  darkOutlineButton: {
    backgroundColor: DarkGlass.buttonBg,
    borderWidth: 1,
    borderColor: DarkGlass.buttonBorder,
  },
  primaryButtonLight: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  primaryButtonDark: {
    backgroundColor: DarkGlass.primaryBg,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
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
    marginBottom: 4,
  },
  errorDark: {
    color: '#f87171',
    fontSize: 14,
    marginBottom: 4,
  },
});
