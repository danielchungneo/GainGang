import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

import { Avatar } from '@/components/ui/avatar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useAuth } from '@/context/auth-context';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  pickAvatarImage,
  removeAvatarImage,
  uploadAvatarImage,
  type AvatarPickSource,
} from '@/lib/avatar-upload';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';

const schema = z.object({
  full_name: z.string().min(1, 'Name is required').max(80),
  bio: z.string().max(280),
});

type FormData = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const t = useThemeTokens();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', bio: '' },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      full_name: profile.full_name ?? '',
      bio: profile.bio ?? '',
    });
    setAvatarUri(profile.avatar_url);
  }, [profile, reset]);

  async function handlePickAvatar(source: AvatarPickSource) {
    if (!userId) return;

    try {
      setAvatarError(null);
      setIsUploadingAvatar(true);

      const picked = await pickAvatarImage(source);
      if (!picked) return;

      setAvatarUri(picked.uri);
      const publicUrl = await uploadAvatarImage(userId, picked);
      await updateProfile.mutateAsync({ avatar_url: publicUrl });
      setAvatarUri(publicUrl);
    } catch (e) {
      setAvatarUri(profile?.avatar_url ?? null);
      setAvatarError(e instanceof Error ? e.message : 'Could not update photo');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!userId) return;

    try {
      setAvatarError(null);
      setIsUploadingAvatar(true);
      await removeAvatarImage(userId);
      await updateProfile.mutateAsync({ avatar_url: null });
      setAvatarUri(null);
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Could not remove photo');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function openAvatarOptions() {
    const options = [
      { label: 'Take photo', onPress: () => void handlePickAvatar('camera') },
      { label: 'Choose from library', onPress: () => void handlePickAvatar('library') },
      ...(avatarUri
        ? [{ label: 'Remove photo', onPress: () => void handleRemoveAvatar(), destructive: true }]
        : []),
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: avatarUri ? options.length - 1 : undefined,
        },
        (index) => {
          if (index < options.length) options[index]?.onPress();
        },
      );
      return;
    }

    Alert.alert('Profile photo', 'Update your profile picture', [
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
      await updateProfile.mutateAsync({
        full_name: values.full_name.trim(),
        bio: values.bio?.trim() || null,
      });
      router.back();
    } catch (e) {
      setError('root', {
        message: e instanceof Error ? e.message : 'Could not update profile',
      });
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={[type.heading, { color: t.heading }]}>Edit profile</Text>
        </View>

        {isLoading || !profile ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <GlassSurface style={{ padding: 20, gap: 14, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={openAvatarOptions}
                disabled={isUploadingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                style={{ alignItems: 'center', gap: 10 }}
              >
                <View>
                  <Avatar
                    name={profile.full_name || 'You'}
                    uri={avatarUri}
                    size={96}
                  />
                  <View
                    style={[
                      styles.cameraBadge,
                      {
                        backgroundColor: t.accent,
                        borderColor: t.buttonBg,
                      },
                    ]}
                  >
                    {isUploadingAvatar ? (
                      <ActivityIndicator color={t.accentOnPrimary} size="small" />
                    ) : (
                      <Ionicons name="camera" size={16} color={t.accentOnPrimary} />
                    )}
                  </View>
                </View>
                <Text style={[type.bodySm, { color: t.accent }]}>
                  {isUploadingAvatar ? 'Uploading…' : 'Change photo'}
                </Text>
              </TouchableOpacity>

              {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
            </GlassSurface>

            <GlassSurface style={{ padding: 20, gap: 14 }}>
              <View>
                <Text style={[type.labelSm, { color: t.body, marginBottom: 8 }]}>Name</Text>
                <Controller
                  control={control}
                  name="full_name"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: t.inputBorder,
                          color: t.heading,
                        },
                      ]}
                      placeholder="Your name"
                      placeholderTextColor={t.placeholder}
                      onChangeText={onChange}
                      value={value}
                      autoCapitalize="words"
                    />
                  )}
                />
                {errors.full_name ? (
                  <Text style={styles.error}>{errors.full_name.message}</Text>
                ) : null}
              </View>

              <View>
                <Text style={[type.labelSm, { color: t.body, marginBottom: 8 }]}>Bio</Text>
                <Controller
                  control={control}
                  name="bio"
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
                          fontFamily: fontFamily.body,
                        },
                      ]}
                      placeholder="A short intro"
                      placeholderTextColor={t.placeholder}
                      multiline
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {errors.bio ? <Text style={styles.error}>{errors.bio.message}</Text> : null}
              </View>

              {errors.root ? <Text style={styles.error}>{errors.root.message}</Text> : null}

              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting || isUploadingAvatar}
                className="mt-2 items-center rounded-xl py-4"
                style={{ backgroundColor: t.accent }}
                accessibilityRole="button"
                accessibilityLabel="Save profile changes"
              >
                {isSubmitting ? (
                  <ActivityIndicator color={t.accentOnPrimary} />
                ) : (
                  <Text
                    style={{
                      color: t.accentOnPrimary,
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 16,
                    }}
                  >
                    Save changes
                  </Text>
                )}
              </TouchableOpacity>
            </GlassSurface>
          </>
        )}
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
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
