import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function AuthLayout() {
  const { session, isPending } = useAuth();

  // Wait for session check before deciding to redirect
  if (isPending) return null;

  // Already authenticated — send to main app
  if (session) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
