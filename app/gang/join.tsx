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
import { useDiscoverGangs, useJoinGang, useJoinPublicGang } from '@/hooks/use-gangs';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export default function JoinGangScreen() {
  const t = useThemeTokens();
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const joinByCode = useJoinGang();
  const joinPublic = useJoinPublicGang();
  const { data: discover, isLoading, refetch, isRefetching } = useDiscoverGangs(search);

  async function handleJoinByCode() {
    setError(null);
    try {
      const gang = await joinByCode.mutateAsync(code);
      router.replace({ pathname: '/gang/[id]', params: { id: gang.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join Gang');
    }
  }

  async function handleJoinPublic(gangId: string) {
    setError(null);
    try {
      const gang = await joinPublic.mutateAsync(gangId);
      router.replace({ pathname: '/gang/[id]', params: { id: gang.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join Gang');
    }
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.accent} />}>
        <View className="mt-2 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={t.body} />
          </TouchableOpacity>
          <Text style={{ color: t.heading }} className="text-2xl font-bold">
            Join a Gang
          </Text>
        </View>

        <GlassSurface style={{ padding: 20, gap: 12 }}>
          <Text style={{ color: t.heading }} className="text-base font-bold">
            Have an invite code?
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
            placeholder="e.g. A1B2C3D4"
            placeholderTextColor={t.placeholder}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            onPress={handleJoinByCode}
            disabled={joinByCode.isPending || code.trim().length < 4}
            className="items-center rounded-xl py-3"
            style={{ backgroundColor: t.accent, opacity: code.trim().length < 4 ? 0.5 : 1 }}>
            {joinByCode.isPending ? (
              <ActivityIndicator color={t.accentOnPrimary} />
            ) : (
              <Text style={{ color: t.accentOnPrimary }} className="font-semibold">
                Join
              </Text>
            )}
          </TouchableOpacity>
        </GlassSurface>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={{ color: t.heading }} className="mt-2 text-lg font-bold">
          Discover public Gangs
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.inputBorder, color: t.heading }]}
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
                style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 26 }}>{gang.icon ?? '⚔️'}</Text>
                <View className="flex-1">
                  <Text style={{ color: t.heading }} className="text-base font-bold" numberOfLines={1}>
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
                  style={{ backgroundColor: t.accent }}>
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
