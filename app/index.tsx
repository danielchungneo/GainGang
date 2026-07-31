import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import {
  useNeedsCrewSetup,
  useNeedsEquipmentPrompt,
  useNeedsFocusLockIntro,
  useNeedsPostAuthNotifications,
  useNeedsPreAuthOnboarding,
} from '@/hooks/use-onboarding';
import { consumePendingGangInvite } from '@/lib/gang-invite';

/**
 * Entry gate:
 * 1) Pre-auth product tour (local) → /onboarding
 * 2) Sign-in if logged out
 * 3) New-account notifications → /welcome-notifications
 * 4) New-account crew setup → /welcome-crew
 * 5) Existing-account Focus lock intro → /welcome-focus-lock
 * 6) Equipment opt-in (OTA / existing users) → /welcome-equipment
 * 7) Pending invite → /invite/[code]
 * 8) Main app
 */
export default function AppIndex() {
  const { session, isPending } = useAuth();
  const { needsPreAuthOnboarding, isLoading: preAuthLoading } = useNeedsPreAuthOnboarding();
  const { needsCrewSetup, isLoading: crewLoading } = useNeedsCrewSetup();
  const { needsPostAuthNotifications, isLoading: notifLoading } =
    useNeedsPostAuthNotifications();
  const { needsFocusLockIntro, isLoading: focusIntroLoading } = useNeedsFocusLockIntro();
  const { needsEquipmentPrompt, isLoading: equipmentLoading } = useNeedsEquipmentPrompt();
  const [pendingInvite, setPendingInvite] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (
      !session ||
      needsCrewSetup ||
      crewLoading ||
      needsFocusLockIntro ||
      focusIntroLoading ||
      needsEquipmentPrompt ||
      equipmentLoading
    ) {
      setPendingInvite(undefined);
      return;
    }

    let cancelled = false;
    void consumePendingGangInvite().then((code) => {
      if (!cancelled) setPendingInvite(code);
    });

    return () => {
      cancelled = true;
    };
  }, [
    session,
    needsCrewSetup,
    crewLoading,
    needsFocusLockIntro,
    focusIntroLoading,
    needsEquipmentPrompt,
    equipmentLoading,
  ]);

  if (
    isPending ||
    preAuthLoading ||
    (session && (crewLoading || notifLoading || focusIntroLoading || equipmentLoading))
  ) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // Product tour is for logged-out first launches only.
  if (!session && needsPreAuthOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsCrewSetup && needsPostAuthNotifications) {
    return <Redirect href="/welcome-notifications" />;
  }

  if (needsCrewSetup) {
    return <Redirect href="/welcome-crew" />;
  }

  if (needsFocusLockIntro) {
    return <Redirect href="/welcome-focus-lock" />;
  }

  if (needsEquipmentPrompt) {
    return <Redirect href="/welcome-equipment" />;
  }

  if (pendingInvite === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (pendingInvite) {
    return <Redirect href={`/invite/${pendingInvite}`} />;
  }

  return <Redirect href="/(tabs)" />;
}
