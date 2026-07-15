import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy gang detail route — unused. The live gang home is the Groups tab.
 * Redirect any leftover deep links so this screen never renders.
 */
export default function GangDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <Redirect href="/(tabs)/groups" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/groups',
        params: { gangId: id, tab: 'progress' },
      }}
    />
  );
}
