import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenBackground } from '@/components/ui/screen-background';
import { useDiscoverGangs, useJoinPublicGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export default function JoinGangScreen() {
  const t = useThemeTokens();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const joinPublic = useJoinPublicGang();
  const { data: discover, isLoading, refetch, isRefetching } = useDiscoverGangs(search);

  async function handleJoinPublic(gangId: string) {
    setError(null);
    try {
      const gang = await joinPublic.mutateAsync(gangId);
      router.replace({ pathname: '/(tabs)/groups', params: { gangId: gang.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join Gang');
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.accent} />
        }
      >
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            Discover Gangs
          </Text>
        </View>

        <Text style={{ color: t.body }} className="text-sm leading-5">
          Browse public crews below. Invite-only gangs join through a link your friends text you.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={[
            styles.input,
            { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading },
          ]}
          placeholder="Search Gangs"
          placeholderTextColor={t.placeholder}
          value={search}
          onChangeText={setSearch}
        />

        {isLoading ? (
          <ActivityIndicator color={t.accent} style={{ marginTop: 20 }} />
        ) : discover && discover.length > 0 ? (
          <View className="gap-3">
            {discover.map((gang) => (
              <GlassSurface
                key={gang.id}
                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Text style={{ fontSize: 26 }}>{gang.icon ?? '⚔️'}</Text>
                <View className="flex-1">
                  <Text
                    style={{ color: t.heading }}
                    className="text-base font-bold"
                    numberOfLines={1}
                  >
                    {gang.name}
                  </Text>
                  {gang.description ? (
                    <Text style={{ color: t.body }} className="text-sm" numberOfLines={1}>
                      {gang.description}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleJoinPublic(gang.id)}
                  disabled={joinPublic.isPending}
                  className="rounded-lg px-4 py-2"
                  style={{ backgroundColor: t.accent }}
                >
                  <Text style={{ color: t.accentOnPrimary }} className="text-sm font-semibold">
                    Join
                  </Text>
                </TouchableOpacity>
              </GlassSurface>
            ))}
          </View>
        ) : (
          <Text style={{ color: t.body }} className="text-sm">
            No public Gangs found. Be the first to create one!
          </Text>
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
  error: { color: '#ef4444', fontSize: 13 },
});
