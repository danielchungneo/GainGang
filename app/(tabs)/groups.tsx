import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { GlassSurface } from "@/components/ui/glass-surface";
import { ScreenBackground } from "@/components/ui/screen-background";
import { useMyGangs } from "@/hooks/use-gangs";
import { useThemeTokens } from "@/hooks/use-theme-tokens";

export default function GroupsScreen() {
  const { heading, body, accent, accentOnPrimary, buttonBg, buttonBorder } =
    useThemeTokens();
  const { data: gangs, isLoading, refetch, isRefetching } = useMyGangs();

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={accent}
          />
        }
      >
        <View className="mt-4 flex-row items-center justify-between">
          <Text style={{ color: heading }} className="text-3xl font-bold">
            Gangs
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/gang/create")}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: accent }}
          >
            <Ionicons name="add" size={24} color={accentOnPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={{ color: body }} className="text-base">
          Join a crew to share daily Goals and keep each other accountable.
        </Text>

        {isLoading ? (
          <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
        ) : gangs && gangs.length > 0 ? (
          <View className="gap-3">
            {gangs.map((gang) => (
              <TouchableOpacity
                key={gang.id}
                onPress={() =>
                  router.push({
                    pathname: "/gang/[id]",
                    params: { id: gang.id },
                  })
                }
              >
                <GlassSurface
                  style={{
                    padding: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    className="h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: accent }}
                  >
                    <Text style={{ fontSize: 22 }}>{gang.icon ?? "⚔️"}</Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ color: heading }}
                      className="text-lg font-bold"
                      numberOfLines={1}
                    >
                      {gang.name}
                    </Text>
                    <Text style={{ color: body }} className="text-sm">
                      {gang.member_count}{" "}
                      {gang.member_count === 1 ? "member" : "members"}
                      {gang.role !== "member" ? `  ·  ${gang.role}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={body} />
                </GlassSurface>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => router.push("/gang/join")}
              className="mt-2 flex-row items-center justify-center gap-2 rounded-xl py-3"
              style={{
                backgroundColor: buttonBg,
                borderWidth: 1,
                borderColor: buttonBorder,
              }}
            >
              <Ionicons name="key-outline" size={18} color={accent} />
              <Text style={{ color: accent }} className="font-semibold">
                Join with a code
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <GlassSurface style={{ padding: 20, gap: 12 }}>
            <Text style={{ color: heading }} className="text-xl font-bold">
              You&apos;re not in a Gang yet
            </Text>
            <Text style={{ color: body }} className="text-sm leading-5">
              Create your own crew or join one with an invite code to start
              gaining together.
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/gang/create")}
              className="mt-2 items-center rounded-xl py-3"
              style={{ backgroundColor: accent }}
            >
              <Text
                style={{ color: accentOnPrimary }}
                className="font-semibold"
              >
                Create a Gang
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/gang/join")}
              className="items-center rounded-xl py-3"
              style={{
                backgroundColor: buttonBg,
                borderWidth: 1,
                borderColor: buttonBorder,
              }}
            >
              <Text style={{ color: accent }} className="font-semibold">
                Join with a code
              </Text>
            </TouchableOpacity>
          </GlassSurface>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}
