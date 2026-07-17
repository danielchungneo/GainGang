import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useDeleteGang, useLeaveGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { status } from '@/lib/gaingang-theme';

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

interface GangOptionsDrawerProps {
  visible: boolean;
  onClose: () => void;
  gangId?: string;
  gangName?: string;
  /** Owner-only settings (edit gang, weekly plan, delete). */
  showSettings?: boolean;
  /** Non-owner members can leave the current gang. */
  canLeave?: boolean;
  /** When set, "Edit weekly plan" opens that plan; otherwise create flow. */
  weeklyPlanId?: string | null;
}

export function GangOptionsDrawer({
  visible,
  onClose,
  gangId,
  gangName,
  showSettings = false,
  canLeave = false,
  weeklyPlanId = null,
}: GangOptionsDrawerProps) {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const deleteGang = useDeleteGang();
  const leaveGang = useLeaveGang();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

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

  function confirmDeleteGang() {
    if (!gangId || isDeleting) return;
    const label = gangName?.trim() || 'this gang';
    Alert.alert(
      'Delete gang?',
      `This permanently deletes ${label} and all of its plans, goals, and activity. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDeleteGang();
          },
        },
      ],
    );
  }

  async function handleDeleteGang() {
    if (!gangId) return;
    setIsDeleting(true);
    try {
      await deleteGang.mutateAsync(gangId);
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not delete gang',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function confirmLeaveGang() {
    if (!gangId || isLeaving) return;
    const label = gangName?.trim() || 'this gang';
    Alert.alert(
      'Leave gang?',
      `You’ll leave ${label} and lose access to its plans and feed. You can rejoin later if it’s public or you’re invited again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void handleLeaveGang();
          },
        },
      ],
    );
  }

  async function handleLeaveGang() {
    if (!gangId) return;
    setIsLeaving(true);
    try {
      await leaveGang.mutateAsync(gangId);
      onClose();
    } catch (e) {
      Alert.alert(
        'Could not leave gang',
        e instanceof Error ? e.message : 'Something went wrong. Try again.',
      );
    } finally {
      setIsLeaving(false);
    }
  }

  const canDelete = showSettings && !!gangId;
  const showLeave = canLeave && !!gangId && !canDelete;
  const showDangerAction = canDelete || showLeave;

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

          <View style={{ flex: 1, gap: 12 }}>
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
                      Edit name, banner, description, and privacy
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

            {showDangerAction ? <View style={{ flex: 1 }} /> : null}

            {canDelete ? (
              <TouchableOpacity
                onPress={confirmDeleteGang}
                disabled={isDeleting}
                className="flex-row items-center gap-3 rounded-xl px-4 py-4"
                style={{
                  backgroundColor: 'rgba(255, 61, 113, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 61, 113, 0.35)',
                }}
                accessibilityRole="button"
                accessibilityLabel="Delete gang"
              >
                {isDeleting ? (
                  <ActivityIndicator color={status.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={22} color={status.danger} />
                )}
                <View className="flex-1">
                  <Text style={{ color: status.danger }} className="font-semibold">
                    Delete gang
                  </Text>
                  <Text style={{ color: status.danger, opacity: 0.8 }} className="text-sm">
                    Permanently remove this crew
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {showLeave ? (
              <TouchableOpacity
                onPress={confirmLeaveGang}
                disabled={isLeaving}
                className="flex-row items-center gap-3 rounded-xl px-4 py-4"
                style={{
                  backgroundColor: 'rgba(255, 61, 113, 0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 61, 113, 0.35)',
                }}
                accessibilityRole="button"
                accessibilityLabel="Leave gang"
              >
                {isLeaving ? (
                  <ActivityIndicator color={status.danger} />
                ) : (
                  <Ionicons name="exit-outline" size={22} color={status.danger} />
                )}
                <View className="flex-1">
                  <Text style={{ color: status.danger }} className="font-semibold">
                    Leave gang
                  </Text>
                  <Text style={{ color: status.danger, opacity: 0.8 }} className="text-sm">
                    Remove yourself from this crew
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** @deprecated Use GangOptionsDrawer */
export const GangAddMenu = GangOptionsDrawer;
