import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { GainGangLogo } from '@/brand';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { DarkGlass, Glass } from '@/constants/theme';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const isLight = colorScheme !== 'dark';

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ name, email, password }: FormData) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      setError('root', { message: error.message ?? 'Sign-up failed' });
      return;
    }
    router.replace('/(tabs)');
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
        Create account
      </Text>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={isLight ? styles.glassInput : styles.darkInput}
            placeholder="Full name"
            placeholderTextColor={isLight ? Glass.textPlaceholder : DarkGlass.textPlaceholder}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.name && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>{errors.name.message}</Text>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[isLight ? styles.glassInput : styles.darkInput, { marginTop: 8 }]}
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

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[isLight ? styles.glassInput : styles.darkInput, { marginTop: 8 }]}
            placeholder="Confirm password"
            placeholderTextColor={isLight ? Glass.textPlaceholder : DarkGlass.textPlaceholder}
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.confirmPassword && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>
          {errors.confirmPassword.message}
        </Text>
      )}

      {errors.root && (
        <Text style={isLight ? styles.errorLight : styles.errorDark}>{errors.root.message}</Text>
      )}

      <TouchableOpacity
        style={isLight ? styles.primaryButtonLight : styles.primaryButtonDark}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={isLight ? '#fff' : DarkGlass.primaryText} />
        ) : (
          <Text style={isLight ? styles.primaryButtonTextLight : styles.primaryButtonTextDark}>
            Create Account
          </Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6">
        <Text style={{ color: isLight ? Glass.textSecondary : DarkGlass.textSecondary }}>
          Already have an account?{' '}
        </Text>
        <Link href="/(auth)/sign-in">
          <Text style={{ color: isLight ? '#0284c7' : DarkGlass.neonCyan }} className="font-semibold">
            Sign In
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
