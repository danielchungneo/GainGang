import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, type } from '@/lib/gaingang-theme';

interface WeeklyPlanAdminActionsProps {
  gangId: string;
  /** When set, wraps the create CTA in a card with helper copy. */
  helperText?: string;
}

/** Create CTA only — shown when the gang has no active weekly plan. */
export function WeeklyPlanAdminActions({ gangId, helperText }: WeeklyPlanAdminActionsProps) {
  const t = useThemeTokens();

  const actions = (
    <View className="gap-2">
      {helperText ? (
        <Text style={[type.bodySm, { color: t.body }]}>{helperText}</Text>
      ) : null}
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/gang/new-goal', params: { gangId } })}
        className="flex-row items-center justify-center gap-2 rounded-xl py-3"
        style={{
          backgroundColor: t.buttonBg,
          borderWidth: 1,
          borderColor: t.buttonBorder,
        }}
      >
        <Ionicons name="add-circle-outline" size={18} color={t.accent} />
        <Text style={{ color: t.accent, fontFamily: fontFamily.bodySemi }} className="font-semibold">
          Create weekly plan
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (helperText) {
    return <GlassSurface style={{ padding: 18, gap: 10 }}>{actions}</GlassSurface>;
  }

  return actions;
}

interface WeeklyPlanWeekHeaderProps {
  gangId: string;
  startsOn: string;
  endsOn: string;
  isAdaptive?: boolean;
  canEdit?: boolean;
  planId?: string;
}

/** Week range label with optional edit affordance for gang owners. */
export function WeeklyPlanWeekHeader({
  gangId,
  startsOn,
  endsOn,
  isAdaptive = false,
  canEdit = false,
  planId,
}: WeeklyPlanWeekHeaderProps) {
  const t = useThemeTokens();

  const range = `${new Date(startsOn + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${new Date(endsOn + 'T12:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;

  return (
    <View className="flex-row items-center gap-2">
      <Text
        style={{
          flex: 1,
          color: t.heading,
          fontFamily: fontFamily.bodySemi,
          fontSize: 17,
          lineHeight: 22,
        }}
      >
        Week of {range}
      </Text>
      {canEdit && planId ? (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/gang/new-goal',
              params: { gangId, planId },
            })
          }
          accessibilityLabel="Edit weekly plan"
          hitSlop={10}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: t.buttonBg,
            borderWidth: 1,
            borderColor: t.buttonBorder,
          }}
        >
          <Ionicons name="create-outline" size={18} color={t.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
