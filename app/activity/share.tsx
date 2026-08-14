import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  Asset,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';

import {
  ActivityShareCard,
  PHOTO_CARD_HEIGHT,
  PHOTO_CARD_WIDTH,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareCheckerboard,
  type ActivityShareVariant,
} from '@/components/activity-share-card';
import { Button, ScreenBackground } from '@/components/ui';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing } from '@/lib/gaingang-theme';
import { supabase } from '@/lib/supabase';
import type { ActivityFeedItem } from '@/types';

const VARIANTS: ActivityShareVariant[] = ['branded', 'photo', 'transparent'];
const VARIANT_LABEL: Record<ActivityShareVariant, string> = {
  branded: 'BRANDED',
  transparent: 'TRANSPARENT',
  photo: 'PHOTO',
};
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_GAP = 16;
const SIDE_PAD = Math.max((SCREEN_WIDTH - SHARE_CARD_WIDTH) / 2, 16);
const CAPTURE_SCALE = 3;
/** Cap long edge on export — full sensor size often fails iOS view snapshots. */
const PHOTO_CAPTURE_MAX_EDGE = 2160;
/** Max preview height so the full card fits above the share actions. */
const PREVIEW_MAX_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.52), SHARE_CARD_HEIGHT);

interface SharePhoto {
  uri: string;
  width: number;
  height: number;
}

type ShareFeedback = 'saved' | 'copied';

/** Scale a card into the preview carousel without cropping. */
function fitPreviewSize(aspect: number): { width: number; height: number } {
  const maxW = SHARE_CARD_WIDTH;
  const maxH = PREVIEW_MAX_HEIGHT;
  let width = maxW;
  let height = Math.round(width / aspect);
  if (height > maxH) {
    height = maxH;
    width = Math.round(height * aspect);
  }
  return { width, height };
}

/** Fit the full photo in the preview carousel without cropping. */
function photoPreviewSize(photo: SharePhoto | null): { width: number; height: number } {
  const aspect =
    photo && photo.width > 0 && photo.height > 0
      ? photo.width / photo.height
      : PHOTO_CARD_WIDTH / PHOTO_CARD_HEIGHT;
  return fitPreviewSize(aspect);
}

/** 9:16 branded / transparent preview — same fit logic as photo. */
const STORY_PREVIEW_SIZE = fitPreviewSize(SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT);

/** Export at near-native photo resolution (capped for reliable iOS snapshots). */
function photoCaptureSize(photo: SharePhoto): { width: number; height: number } {
  const longEdge = Math.max(photo.width, photo.height);
  const scale = longEdge > PHOTO_CAPTURE_MAX_EDGE ? PHOTO_CAPTURE_MAX_EDGE / longEdge : 1;
  return {
    width: Math.max(1, Math.round(photo.width * scale)),
    height: Math.max(1, Math.round(photo.height * scale)),
  };
}

/** Off-screen render size for the photo capture target (keeps memory sane). */
function photoOffscreenLayout(photo: SharePhoto): { width: number; height: number } {
  const capture = photoCaptureSize(photo);
  const maxRender = 1080;
  const longEdge = Math.max(capture.width, capture.height);
  const scale = longEdge > maxRender ? maxRender / longEdge : 1;
  return {
    width: Math.max(1, Math.round(capture.width * scale)),
    height: Math.max(1, Math.round(capture.height * scale)),
  };
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function ShareActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = id!;
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const brandedRef = useRef<ViewShotRef>(null);
  const transparentRef = useRef<ViewShotRef>(null);
  const photoOffscreenRef = useRef<ViewShotRef>(null);
  const photoVisibleRef = useRef<ViewShotRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [sharePhoto, setSharePhoto] = useState<SharePhoto | null>(null);
  const [feedback, setFeedback] = useState<ShareFeedback | null>(null);

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', activityId, 'share'],
    enabled: !!activityId,
    queryFn: async (): Promise<ActivityFeedItem | null> => {
      const { data, error } = await supabase
        .from('activities')
        .select(
          '*, author:profiles(id, full_name, username, avatar_url, xp, equipped_level_border_id), exercises:activity_exercises(*)',
        )
        .eq('id', activityId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return {
        ...(data as unknown as ActivityFeedItem),
        exercises: (data.exercises as ActivityFeedItem['exercises'] | undefined) ?? [],
        kudos_count: 0,
        comment_count: 0,
        has_kudos: false,
        latest_comment: null,
      };
    },
  });

  const activeVariant = VARIANTS[activeIndex] ?? 'branded';
  const photoSource = sharePhoto ? { uri: sharePhoto.uri } : undefined;
  const needsPhoto = activeVariant === 'photo' && !sharePhoto;
  const photoLayout = photoPreviewSize(sharePhoto);
  const photoCaptureLayout = sharePhoto ? photoOffscreenLayout(sharePhoto) : photoLayout;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const index = viewableItems[0]?.index;
      if (typeof index === 'number') setActiveIndex(index);
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  useEffect(() => {
    if (!feedback || Platform.OS === 'web') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [feedback]);

  async function ensurePhotoPermission(): Promise<boolean> {
    const current = await getPermissionsAsync(true);
    if (current.granted) return true;
    const requested = await requestPermissionsAsync(true);
    return requested.granted;
  }

  async function pickBackgroundPhoto() {
    if (isPickingPhoto) return;
    setIsPickingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo library access to choose a background photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Keep the full still — no cropper. Card frame matches the photo aspect.
        allowsEditing: false,
        quality: 1,
      });

      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      if (!asset.width || !asset.height) {
        Alert.alert('Couldn’t use photo', 'That image has no size information.');
        return;
      }

      setSharePhoto({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      if (Platform.OS !== 'web') {
        void Haptics.selectionAsync();
      }
    } catch (error) {
      Alert.alert(
        'Couldn’t pick photo',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setIsPickingPhoto(false);
    }
  }

  async function captureActiveCard(result: 'tmpfile' | 'base64') {
    // Let the photo Image finish painting before UIKit snapshots it.
    await waitForNextFrame();

    if (activeVariant === 'photo' && sharePhoto) {
      const size = photoCaptureSize(sharePhoto);
      const options = {
        format: 'png' as const,
        quality: 1,
        result,
        width: size.width,
        height: size.height,
      };

      // Prefer the on-screen card — iOS often fails drawViewHierarchyInRect on
      // opacity:0 / never-painted off-screen views that contain a library Image.
      try {
        return await captureRef(photoVisibleRef, options);
      } catch {
        return await captureRef(photoOffscreenRef, options);
      }
    }

    const storyRef =
      activeVariant === 'transparent' ? transparentRef : brandedRef;
    return captureRef(storyRef, {
      format: 'png',
      quality: 1,
      result,
      width: SHARE_CARD_WIDTH * CAPTURE_SCALE,
      height: SHARE_CARD_HEIGHT * CAPTURE_SCALE,
    });
  }

  async function handleSave() {
    if (!activity || isSaving || feedback) return;
    if (needsPhoto) {
      await pickBackgroundPhoto();
      return;
    }

    setIsSaving(true);
    try {
      const allowed = await ensurePhotoPermission();
      if (!allowed) {
        Alert.alert(
          'Permission needed',
          'Allow photo library access to save your workout image.',
        );
        return;
      }
      const uri = await captureActiveCard('tmpfile');
      await Asset.create(uri);
      setFeedback('saved');
    } catch (error) {
      Alert.alert(
        'Couldn’t save',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    if (!activity || isCopying || feedback) return;
    if (needsPhoto) {
      await pickBackgroundPhoto();
      return;
    }

    setIsCopying(true);
    try {
      const base64 = await captureActiveCard('base64');
      await Clipboard.setImageAsync(base64);
      setFeedback('copied');
    } catch (error) {
      Alert.alert(
        'Couldn’t copy',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={28} color={t.heading} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: fontFamily.displaySemi,
              fontSize: 18,
              color: t.heading,
              marginRight: 28,
            }}
          >
            Share Activity
          </Text>
        </View>

        {isLoading || !activity ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 48 }} />
        ) : (
          <>
            {/* Full-size capture targets sit off-screen at full opacity.
                opacity:0 makes iOS drawViewHierarchyInRect fail. */}
            <View
              pointerEvents="none"
              collapsable={false}
              style={{
                position: 'absolute',
                left: -(SHARE_CARD_WIDTH + 64),
                top: 0,
                opacity: 1,
              }}
            >
              <ViewShot ref={brandedRef} collapsable={false}>
                <ActivityShareCard activity={activity} variant="branded" />
              </ViewShot>
              <ViewShot ref={transparentRef} collapsable={false}>
                <ActivityShareCard activity={activity} variant="transparent" />
              </ViewShot>
              <ViewShot ref={photoOffscreenRef} collapsable={false}>
                <ActivityShareCard
                  activity={activity}
                  variant="photo"
                  photo={photoSource}
                  width={photoCaptureLayout.width}
                  height={photoCaptureLayout.height}
                />
              </ViewShot>
            </View>

            <FlatList
              data={VARIANTS}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={SHARE_CARD_WIDTH + CARD_GAP}
              snapToAlignment="start"
              scrollEnabled={!feedback}
              contentContainerStyle={{
                paddingHorizontal: SIDE_PAD - CARD_GAP / 2,
                alignItems: 'center',
                paddingTop: spacing.sm,
              }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => {
                const isTransparent = item === 'transparent';
                const isPhoto = item === 'photo';
                const showPhotoPrompt = isPhoto && !sharePhoto;

                if (isPhoto) {
                  const frameWidth = photoLayout.width;
                  const frameHeight = photoLayout.height;

                  return (
                    <View
                      style={{
                        width: SHARE_CARD_WIDTH,
                        marginHorizontal: CARD_GAP / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: frameWidth,
                          height: frameHeight,
                          borderRadius: 24,
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: t.surfaceBorder,
                          backgroundColor: '#05070F',
                        }}
                      >
                        <ViewShot ref={photoVisibleRef} collapsable={false}>
                          <ActivityShareCard
                            activity={activity}
                            variant="photo"
                            photo={photoSource}
                            width={frameWidth}
                            height={frameHeight}
                          />
                        </ViewShot>

                        {showPhotoPrompt ? (
                          <TouchableOpacity
                            onPress={() => {
                              void pickBackgroundPhoto();
                            }}
                            disabled={isPickingPhoto}
                            accessibilityRole="button"
                            accessibilityLabel="Choose background photo"
                            style={{
                              ...StyleSheet.absoluteFill,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(5,7,15,0.55)',
                              gap: 10,
                              paddingHorizontal: 24,
                            }}
                          >
                            {isPickingPhoto ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <>
                                <View
                                  style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 28,
                                    backgroundColor: 'rgba(77,140,255,0.22)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(77,140,255,0.5)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons name="image-outline" size={26} color="#8FB4FF" />
                                </View>
                                <Text
                                  style={{
                                    fontFamily: fontFamily.displaySemi,
                                    fontSize: 18,
                                    color: '#E8EDF7',
                                    textAlign: 'center',
                                  }}
                                >
                                  Add a photo
                                </Text>
                                <Text
                                  style={{
                                    fontFamily: fontFamily.body,
                                    fontSize: 13,
                                    lineHeight: 18,
                                    color: '#AEB8D0',
                                    textAlign: 'center',
                                  }}
                                >
                                  Stats overlay your full photo — no cropping.
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : null}

                        <VariantBadge label={VARIANT_LABEL.photo} light={false} />
                      </View>
                    </View>
                  );
                }

                // Branded / transparent: layout at full 9:16, scale down so the
                // whole card fits in the preview (same idea as the photo fit).
                const scale = STORY_PREVIEW_SIZE.width / SHARE_CARD_WIDTH;
                const previewW = STORY_PREVIEW_SIZE.width;
                const previewH = STORY_PREVIEW_SIZE.height;

                return (
                  <View
                    style={{
                      width: SHARE_CARD_WIDTH,
                      marginHorizontal: CARD_GAP / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: previewW,
                        height: previewH,
                        borderRadius: 24,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: t.surfaceBorder,
                        backgroundColor: isTransparent ? 'transparent' : '#05070F',
                      }}
                    >
                      {isTransparent ? (
                        <ShareCheckerboard width={previewW} height={previewH} />
                      ) : null}
                      <View
                        style={{
                          width: SHARE_CARD_WIDTH,
                          height: SHARE_CARD_HEIGHT,
                          transform: [
                            { translateX: (previewW - SHARE_CARD_WIDTH) / 2 },
                            { translateY: (previewH - SHARE_CARD_HEIGHT) / 2 },
                            { scale },
                          ],
                        }}
                      >
                        <ActivityShareCard activity={activity} variant={item} />
                      </View>
                      <VariantBadge
                        label={VARIANT_LABEL[item]}
                        light={isTransparent}
                      />
                    </View>
                  </View>
                );
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                marginTop: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              {VARIANTS.map((variant, index) => (
                <View
                  key={variant}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      index === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </View>

            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: insets.bottom + 20,
                marginTop: 'auto',
              }}
            >
              {feedback ? (
                <ShareSuccessPanel
                  kind={feedback}
                  accent={t.accent}
                  heading={t.heading}
                  body={t.body}
                  onDone={() => router.back()}
                  onContinue={() => setFeedback(null)}
                />
              ) : (
                <>
                  <Text
                    style={{
                      fontFamily: fontFamily.displaySemi,
                      fontSize: 18,
                      color: t.heading,
                      marginBottom: spacing.md,
                    }}
                  >
                    Share to
                  </Text>

                  <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
                    {activeVariant === 'photo' ? (
                      <ShareAction
                        icon={sharePhoto ? 'camera-outline' : 'image-outline'}
                        label={sharePhoto ? 'Change' : 'Photo'}
                        loading={isPickingPhoto}
                        onPress={() => {
                          void pickBackgroundPhoto();
                        }}
                        color={t.heading}
                        muted={t.body}
                      />
                    ) : null}
                    <ShareAction
                      icon="download-outline"
                      label="Save"
                      loading={isSaving}
                      onPress={() => {
                        void handleSave();
                      }}
                      color={t.heading}
                      muted={t.body}
                    />
                    <ShareAction
                      icon="copy-outline"
                      label="Copy"
                      loading={isCopying}
                      onPress={() => {
                        void handleCopy();
                      }}
                      color={t.heading}
                      muted={t.body}
                    />
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </View>
    </ScreenBackground>
  );
}

function VariantBadge({ label, light }: { label: string; light: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: light ? '#FFFFFF' : 'rgba(5,7,15,0.75)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamily.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: light ? '#05070F' : '#E8EDF7',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ShareSuccessPanel({
  kind,
  accent,
  heading,
  body,
  onDone,
  onContinue,
}: {
  kind: ShareFeedback;
  accent: string;
  heading: string;
  body: string;
  onDone: () => void;
  onContinue: () => void;
}) {
  const isSaved = kind === 'saved';

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
        <Animated.View entering={ZoomIn.springify().damping(14).delay(80)}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(77,140,255,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(77,140,255,0.45)',
              shadowColor: accent,
              shadowOpacity: 0.45,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Ionicons
              name={isSaved ? 'checkmark' : 'copy'}
              size={34}
              color={accent}
            />
          </View>
        </Animated.View>

        <Text
          style={{
            fontFamily: fontFamily.mono,
            fontSize: 11,
            letterSpacing: 1.6,
            color: accent,
            marginTop: spacing.xs,
          }}
        >
          {isSaved ? 'SAVED' : 'COPIED'}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.displaySemi,
            fontSize: 22,
            color: heading,
            textAlign: 'center',
          }}
        >
          {isSaved ? 'In your photos' : 'On your clipboard'}
        </Text>
        <Text
          style={{
            fontFamily: fontFamily.body,
            fontSize: 14,
            lineHeight: 20,
            color: body,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          {isSaved
            ? 'Your workout card is ready to post from your camera roll.'
            : 'Paste it into Stories, chats, or anywhere else.'}
        </Text>
      </View>

      <Button label="DONE" onPress={onDone} />
      <TouchableOpacity
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="Share another way"
        style={{ alignItems: 'center', paddingVertical: 4 }}
      >
        <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 14, color: body }}>
          Share another way
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ShareAction({
  icon,
  label,
  loading,
  onPress,
  color,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading: boolean;
  onPress: () => void;
  color: string;
  muted: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ alignItems: 'center', gap: 8, opacity: loading ? 0.6 : 1 }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(255,255,255,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <Ionicons name={icon} size={26} color={color} />
        )}
      </View>
      <Text style={{ fontFamily: fontFamily.bodySemi, fontSize: 13, color: muted }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
