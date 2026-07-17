import { GainGangLogo } from '@/brand';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import { supabase } from '@/lib/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
// TODO(google-auth): Re-enable when Google sign-in is configured — see docs/GOOGLE_AUTH_TODO.md
// import { AuthDivider, GoogleSignInButton, useGoogleAuth } from '@/components/google-sign-in-button';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

export default function SignUpScreen() {
  const t = useThemeTokens();
  const { claimReward: claimRewardParam } = useLocalSearchParams<{ claimReward?: string }>();
  const claimReward =
    (Array.isArray(claimRewardParam) ? claimRewardParam[0] : claimRewardParam) === '1';

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // const { handleGoogleSignIn, isGoogleLoading } = useGoogleAuth({
  //   onError: (message) => setError('root', { message }),
  // });

  async function onSubmit({ name, email, password }: FormData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      setError('root', { message: error.message ?? 'Sign-up failed' });
      return;
    }

    // With Confirm Email disabled in Supabase, signUp returns a session immediately.
    if (!data.session) {
      setError('root', {
        message: 'Account created, but no session was returned. Try signing in.',
      });
      return;
    }

    router.replace('/');
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: t.inputBg,
      borderColor: t.inputBorder,
      color: t.heading,
    },
  ];

  const form = (
    <>
      <GainGangLogo
        size="sm"
        theme={t.isLight ? 'light' : 'dark'}
        style={{ marginBottom: spacing.lg }}
      />
      <Text style={[type.heading, { color: t.heading, marginBottom: spacing.sm }]}>
        {claimReward ? 'Claim your reward' : 'Create account'}
      </Text>
      {claimReward ? (
        <>
          <Text style={[type.body, { color: t.body, marginBottom: spacing.sm }]}>
            Create your account to lock in the starter boost you just earned — then jump into your
            first Gang workout.
          </Text>
          <Text
            style={[
              type.bodySm,
              {
                color: t.heading,
                fontFamily: fontFamily.bodySemi,
                fontStyle: 'italic',
                marginBottom: spacing.lg,
              },
            ]}
          >
            &ldquo;The only bad workout is the one that didn&apos;t happen.&rdquo;
          </Text>
        </>
      ) : (
        <Text style={[type.body, { color: t.body, marginBottom: spacing.xl }]}>
          Join GainGang and start training with your crew.
        </Text>
      )}

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
        name="name"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={inputStyle}
            placeholder="Full name"
            placeholderTextColor={t.placeholder}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.name ? (
        <Text style={[type.bodySm, styles.error]}>{errors.name.message}</Text>
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[inputStyle, { marginTop: spacing.sm }]}
            placeholder="Email"
            placeholderTextColor={t.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email ? (
        <Text style={[type.bodySm, styles.error]}>{errors.email.message}</Text>
      ) : null}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[inputStyle, { marginTop: spacing.sm }]}
            placeholder="Password"
            placeholderTextColor={t.placeholder}
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password ? (
        <Text style={[type.bodySm, styles.error]}>{errors.password.message}</Text>
      ) : null}

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[inputStyle, { marginTop: spacing.sm }]}
            placeholder="Confirm password"
            placeholderTextColor={t.placeholder}
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.confirmPassword ? (
        <Text style={[type.bodySm, styles.error]}>{errors.confirmPassword.message}</Text>
      ) : null}

      {errors.root ? (
        <Text style={[type.bodySm, styles.error]}>{errors.root.message}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          {
            backgroundColor: t.accent,
            shadowColor: t.accent,
          },
        ]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {claimReward ? 'Create Account & Claim' : 'Create Account'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.footerRow}>
        <Text style={[type.bodySm, { color: t.body }]}>Already have an account? </Text>
        <Link href="/(auth)/sign-in">
          <Text
            style={[
              type.bodySm,
              { color: t.accent, fontFamily: fontFamily.bodySemi },
            ]}
          >
            Sign In
          </Text>
        </Link>
      </View>
    </>
  );

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        <GlassSurface style={{ padding: spacing.lg }}>{form}</GlassSurface>
      </KeyboardAwareScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    fontSize: 16,
    fontFamily: fontFamily.body,
  },
  primaryButton: {
    borderRadius: 11,
    paddingVertical: 14,
    marginTop: spacing.md,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: fontFamily.displaySemi,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  error: {
    color: '#ef4444',
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
