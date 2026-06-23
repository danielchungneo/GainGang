import { Image } from "expo-image";
import { Text, View } from "react-native";

import { useThemeTokens } from "@/hooks/use-theme-tokens";
import { initials } from "@/lib/format";

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
}

export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const { isLight, accent } = useThemeTokens();
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: isLight
          ? "rgba(2,132,199,0.12)"
          : "rgba(0,212,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: accent, fontWeight: "700", fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}
