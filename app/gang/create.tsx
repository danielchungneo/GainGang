import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';

import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useCreateGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const ICONS = ['⚔️', '🔥', '🐺', '🦁', '💪', '🥷', '👑', '⚡', '🐉', '🛡️'];

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  description: z.string().max(280).optional(),
  icon: z.string(),
  privacy: z.enum(['public', 'invite_only']),
});
type FormData = z.infer<typeof schema>;

export default function CreateGangScreen() {
  const t = useThemeTokens();
  const createGang = useCreateGang();

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { icon: '⚔️', privacy: 'public' },
  });

  const icon = useWatch({ control, name: 'icon' });
  const privacy = useWatch({ control, name: 'privacy' });

  async function onSubmit(values: FormData) {
    try {
      const gang = await createGang.mutateAsync({
        name: values.name,
        description: values.description,
        icon,
        privacy,
      });
      router.replace({ pathname: '/gang/[id]', params: { id: gang.id } });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'Could not create Gang' });
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            Create a Gang
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 14 }}>
          <View>
            <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
              Icon
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ICONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => setValue('icon', emoji)}
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: icon === emoji ? t.accent : t.buttonBg,
                    borderWidth: 1,
                    borderColor: icon === emoji ? t.accent : t.buttonBorder,
                  }}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
              Name
            </Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
                  placeholder="The Iron Wolves"
                  placeholderTextColor={t.placeholder}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
          </View>

          <View>
            <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
              Description
            </Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading, height: 90, textAlignVertical: 'top' },
                  ]}
                  placeholder="What's this Gang about?"
                  placeholderTextColor={t.placeholder}
                  multiline
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </View>

          <View>
            <Text style={{ color: t.body }} className="mb-2 text-xs uppercase tracking-wide">
              Privacy
            </Text>
            <View className="flex-row gap-2">
              {(['public', 'invite_only'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setValue('privacy', p)}
                  className="flex-1 items-center rounded-xl py-3"
                  style={{
                    backgroundColor: privacy === p ? t.accent : t.buttonBg,
                    borderWidth: 1,
                    borderColor: privacy === p ? t.accent : t.buttonBorder,
                  }}>
                  <Text
                    style={{ color: privacy === p ? t.accentOnPrimary : t.accent }}
                    className="font-semibold">
                    {p === 'public' ? 'Public' : 'Invite only'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {errors.root && <Text style={styles.error}>{errors.root.message}</Text>}

          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="mt-2 items-center rounded-xl py-4"
            style={{ backgroundColor: t.accent }}>
            {isSubmitting ? (
              <ActivityIndicator color={t.accentOnPrimary} />
            ) : (
              <Text style={{ color: t.accentOnPrimary }} className="text-base font-bold">
                Create Gang
              </Text>
            )}
          </TouchableOpacity>
        </GlassSurface>
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
    fontSize: 16,
  },
  error: { color: '#ef4444', fontSize: 13, marginTop: 4 },
});
