import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

interface GangOptionsDrawerProps {
  visible: boolean;
  onClose: () => void;
  gangId?: string;
  showSettings?: boolean;
  /** When set, "Edit weekly plan" opens that plan; otherwise create flow. */
  weeklyPlanId?: string | null;
}

export function GangOptionsDrawer({
  visible,
  onClose,
  gangId,
  showSettings = false,
  weeklyPlanId = null,
}: GangOptionsDrawerProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : DRAWER_WIDTH,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  function closeAndGo(action: () => void) {
    onClose();
    action();
  }

  function goCreateGang() {
    closeAndGo(() => router.push('/gang/create'));
  }

  function goDiscoverGangs() {
    closeAndGo(() => router.push('/gang/join'));
  }

  function goGangSettings() {
    if (!gangId) return;
    closeAndGo(() =>
      router.push({ pathname: '/gang/edit', params: { gangId } }),
    );
  }

  function goWeeklyPlan() {
    if (!gangId) return;
    closeAndGo(() =>
      router.push({
        pathname: '/gang/new-goal',
        params: weeklyPlanId ? { gangId, planId: weeklyPlanId } : { gangId },
      }),
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' }}
          onPress={onClose}
          accessibilityLabel="Close menu"
        />
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: DRAWER_WIDTH,
            backgroundColor: t.buttonBg,
            borderLeftWidth: 1,
            borderLeftColor: t.buttonBorder,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 16,
            gap: 12,
            transform: [{ translateX: slide }],
          }}
        >
          <View className="mb-2 flex-row items-center justify-between">
            <Text style={{ color: t.heading }} className="text-lg font-bold">
              Gang options
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={t.body} />
            </TouchableOpacity>
          </View>

          {showSettings && gangId ? (
            <>
              <TouchableOpacity
                onPress={goGangSettings}
                className="flex-row items-center gap-3 rounded-xl px-4 py-4"
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: t.buttonBorder,
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit gang settings"
              >
                <Ionicons name="settings-outline" size={22} color={t.accent} />
                <View className="flex-1">
                  <Text style={{ color: t.heading }} className="font-semibold">
                    Gang settings
                  </Text>
                  <Text style={{ color: t.body }} className="text-sm">
                    Edit name, icon, description, and privacy
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={goWeeklyPlan}
                className="flex-row items-center gap-3 rounded-xl px-4 py-4"
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: t.buttonBorder,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  weeklyPlanId ? 'Edit weekly plan' : 'Create weekly plan'
                }
              >
                <Ionicons name="calendar-outline" size={22} color={t.accent} />
                <View className="flex-1">
                  <Text style={{ color: t.heading }} className="font-semibold">
                    {weeklyPlanId ? 'Edit weekly plan' : 'Create weekly plan'}
                  </Text>
                  <Text style={{ color: t.body }} className="text-sm">
                    {weeklyPlanId
                      ? "Update this week's exercises and targets"
                      : 'Set exercises and targets for the week'}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}

          <View
            className="my-1 flex-row items-center gap-3"
            style={{ marginTop: showSettings && gangId ? 4 : 0 }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: t.buttonBorder }} />
            <Text
              style={{
                color: t.body,
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Find a gang
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.buttonBorder }} />
          </View>

          <TouchableOpacity
            onPress={goCreateGang}
            className="flex-row items-center gap-3 rounded-xl px-4 py-4"
            style={{ backgroundColor: t.accent }}
            accessibilityRole="button"
            accessibilityLabel="Create a gang"
          >
            <Ionicons name="add-circle-outline" size={22} color={t.accentOnPrimary} />
            <View className="flex-1">
              <Text style={{ color: t.accentOnPrimary }} className="font-semibold">
                Create a gang
              </Text>
              <Text style={{ color: t.accentOnPrimary, opacity: 0.85 }} className="text-sm">
                Start your own crew and invite friends
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goDiscoverGangs}
            className="flex-row items-center gap-3 rounded-xl px-4 py-4"
            style={{
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: t.buttonBorder,
            }}
            accessibilityRole="button"
            accessibilityLabel="Discover gangs"
          >
            <Ionicons name="search-outline" size={22} color={t.accent} />
            <View className="flex-1">
              <Text style={{ color: t.heading }} className="font-semibold">
                Discover gangs
              </Text>
              <Text style={{ color: t.body }} className="text-sm">
                Browse public gangs (invite links join invite-only crews)
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** @deprecated Use GangOptionsDrawer */
export const GangAddMenu = GangOptionsDrawer;
