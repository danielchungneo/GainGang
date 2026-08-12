import { router, usePathname, useSegments } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CredsBalance } from '@/components/creds-balance';
import { useAuth } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { shouldHideAppHud } from '@/lib/app-hud';
import { spacing } from '@/lib/gaingang-theme';

/** Creds chip for the screen shell — only the chip captures touches. */
export function CredsHud() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const pathname = usePathname();

  if (!session || shouldHideAppHud(segments)) return null;

  const amount = profile?.currency ?? 0;

  function handlePress() {
    if (pathname === '/inventory') return;
    router.push('/inventory');
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${amount.toLocaleString()} Creds. Open inventory.`}
      hitSlop={6}
      style={{
        position: 'absolute',
        top: insets.top + spacing.xs,
        right: Math.max(insets.right, spacing.lg),
        zIndex: 50,
      }}
    >
      <CredsBalance amount={amount} size="sm" />
    </Pressable>
  );
}
