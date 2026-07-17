import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';

import { GangBanner } from '@/components/ui/gang-banner';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useCreateGang, useUpdateGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  pickGangBannerImage,
  uploadGangBannerImage,
  type GangBannerPickSource,
  type PickedGangBanner,
} from '@/lib/gang-banner-upload';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  description: z.string().max(280).optional(),
  privacy: z.enum(['public', 'invite_only']),
});
type FormData = z.infer<typeof schema>;

export default function CreateGangScreen() {
  const t = useThemeTokens();
  const createGang = useCreateGang();
  const updateGang = useUpdateGang();

  const [bannerPreviewUri, setBannerPreviewUri] = useState<string | null>(null);
  const [pendingBanner, setPendingBanner] = useState<PickedGangBanner | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { privacy: 'public' },
  });

  const privacy = useWatch({ control, name: 'privacy' });
  const name = useWatch({ control, name: 'name' });

  async function handlePickBanner(source: GangBannerPickSource) {
    try {
      setBannerError(null);
      const picked = await pickGangBannerImage(source);
      if (!picked) return;
      setPendingBanner(picked);
      setBannerPreviewUri(picked.uri);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'Could not pick banner');
    }
  }

  function handleRemoveBanner() {
    setPendingBanner(null);
    setBannerPreviewUri(null);
    setBannerError(null);
  }

  function openBannerOptions() {
    const options = [
      { label: 'Take photo', onPress: () => void handlePickBanner('camera') },
      { label: 'Choose from library', onPress: () => void handlePickBanner('library') },
      ...(bannerPreviewUri
        ? [{ label: 'Remove banner', onPress: handleRemoveBanner, destructive: true }]
        : []),
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: bannerPreviewUri ? options.length - 1 : undefined,
        },
        (index) => {
          if (index < options.length) options[index]?.onPress();
        },
      );
      return;
    }

    Alert.alert('Club banner', 'Add a photo for your gang', [
      ...options.map((o) => ({
        text: o.label,
        style: o.destructive ? ('destructive' as const) : ('default' as const),
        onPress: o.onPress,
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function onSubmit(values: FormData) {
    try {
      const gang = await createGang.mutateAsync({
        name: values.name,
        description: values.description,
        privacy: values.privacy,
      });

      if (pendingBanner) {
        try {
          const publicUrl = await uploadGangBannerImage(gang.id, pendingBanner);
          await updateGang.mutateAsync({ gangId: gang.id, banner_url: publicUrl });
        } catch {
          // Gang was created; banner can be added later in settings.
        }
      }

      router.replace({ pathname: '/(tabs)/groups', params: { gangId: gang.id } });
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
              Club banner
            </Text>
            <TouchableOpacity
              onPress={openBannerOptions}
              accessibilityRole="button"
              accessibilityLabel="Upload club banner"
              activeOpacity={0.85}
            >
              <GangBanner
                uri={bannerPreviewUri}
                name={name?.trim() || undefined}
                showCameraBadge
              />
            </TouchableOpacity>
            {bannerError ? <Text style={styles.error}>{bannerError}</Text> : null}
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
                  style={[
                    styles.input,
                    { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading },
                  ]}
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
                    {
                      backgroundColor: t.inputBg,
                      borderColor: t.inputBorder,
                      color: t.heading,
                      height: 90,
                      textAlignVertical: 'top',
                    },
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
                  }}
                >
                  <Text
                    style={{ color: privacy === p ? t.accentOnPrimary : t.accent }}
                    className="font-semibold"
                  >
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
            style={{ backgroundColor: t.accent }}
          >
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
