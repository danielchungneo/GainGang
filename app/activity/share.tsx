import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';

import {
  ActivityShareCard,
  SHARE_CARD_MIN_HEIGHT,
  SHARE_CARD_WIDTH,
  ShareCheckerboard,
  type ActivityShareVariant,
} from '@/components/activity-share-card';
import { ScreenBackground } from '@/components/ui';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, spacing } from '@/lib/gaingang-theme';
import { supabase } from '@/lib/supabase';
import type { ActivityFeedItem } from '@/types';

const VARIANTS: ActivityShareVariant[] = ['branded', 'transparent'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 16;
const SIDE_PAD = Math.max((SCREEN_WIDTH - SHARE_CARD_WIDTH) / 2, 16);

export default function ShareActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activityId = id!;
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const brandedRef = useRef<ViewShotRef>(null);
  const transparentRef = useRef<ViewShotRef>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

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

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const index = viewableItems[0]?.index;
      if (typeof index === 'number') setActiveIndex(index);
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const activeCaptureRef = useCallback(() => {
    return activeVariant === 'branded' ? brandedRef : transparentRef;
  }, [activeVariant]);

  async function ensurePhotoPermission(): Promise<boolean> {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested.granted;
  }

  async function handleSave() {
    if (!activity || isSaving) return;
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
      const uri = await captureRef(activeCaptureRef(), {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Workout image saved to your photos.');
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
    if (!activity || isCopying) return;
    setIsCopying(true);
    try {
      const base64 = await captureRef(activeCaptureRef(), {
        format: 'png',
        quality: 1,
        result: 'base64',
      });
      await Clipboard.setImageAsync(base64);
      Alert.alert('Copied', 'Workout image copied to the clipboard.');
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
            {/* Capture targets kept mounted (hidden) for reliable screenshots. */}
            <View
              pointerEvents="none"
              collapsable={false}
              style={{ position: 'absolute', opacity: 0, left: 0, top: 0 }}
            >
              <ViewShot ref={brandedRef}>
                <ActivityShareCard activity={activity} variant="branded" />
              </ViewShot>
              <ViewShot ref={transparentRef}>
                <ActivityShareCard activity={activity} variant="transparent" />
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
              contentContainerStyle={{
                paddingHorizontal: SIDE_PAD - CARD_GAP / 2,
                alignItems: 'center',
                paddingTop: spacing.sm,
              }}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => {
                const isTransparent = item === 'transparent';
                return (
                  <View
                    style={{
                      width: SHARE_CARD_WIDTH,
                      marginHorizontal: CARD_GAP / 2,
                    }}
                  >
                    <View
                      style={{
                        width: SHARE_CARD_WIDTH,
                        minHeight: SHARE_CARD_MIN_HEIGHT,
                        borderRadius: 24,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: t.surfaceBorder,
                        backgroundColor: isTransparent ? 'transparent' : '#05070F',
                      }}
                    >
                      {isTransparent ? (
                        <ShareCheckerboard
                          width={SHARE_CARD_WIDTH}
                          height={SHARE_CARD_MIN_HEIGHT + 120}
                        />
                      ) : null}
                      <ActivityShareCard activity={activity} variant={item} />
                      <View
                        style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          backgroundColor: isTransparent ? '#FFFFFF' : 'rgba(5,7,15,0.75)',
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
                            color: isTransparent ? '#05070F' : '#E8EDF7',
                          }}
                        >
                          {isTransparent ? 'TRANSPARENT' : 'GAINGANG'}
                        </Text>
                      </View>
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
                marginBottom: spacing.lg,
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

              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <ShareAction
                  icon="download-outline"
                  label="Save"
                  loading={isSaving}
                  onPress={handleSave}
                  color={t.heading}
                  muted={t.body}
                />
                <ShareAction
                  icon="copy-outline"
                  label="Copy"
                  loading={isCopying}
                  onPress={handleCopy}
                  color={t.heading}
                  muted={t.body}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </ScreenBackground>
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
