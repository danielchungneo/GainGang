import { router, type Href } from 'expo-router';

/** Navigate to a user's profile (own profile lands on the Profile tab). */
export function pushUserProfile(userId: string, options?: { isSelf?: boolean }) {
  if (options?.isSelf) {
    router.push('/(tabs)/profile');
    return;
  }

  router.push({
    pathname: '/profile/[userId]',
    params: { userId },
  } as unknown as Href);
}
