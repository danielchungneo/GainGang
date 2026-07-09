import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { fontFamily, type } from '@/lib/gaingang-theme';

interface WeeklyPlanAdminActionsProps {
  gangId: string;
  planId?: string;
  hasActivePlan: boolean;
  /** When set, wraps actions in a card with helper copy (rest day / no plan). */
  helperText?: string;
}

export function WeeklyPlanAdminActions({
  gangId,
  planId,
  hasActivePlan,
  helperText,
}: WeeklyPlanAdminActionsProps) {
  const t = useThemeTokens();

  const actions = (
    <View className="gap-2">
      {helperText ? (
        <Text style={[type.bodySm, { color: t.body }]}>{helperText}</Text>
      ) : null}
      {hasActivePlan && planId ? (
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/gang/new-goal',
              params: { gangId, planId },
            })
          }
          className="flex-row items-center justify-center gap-2 rounded-xl py-3"
          style={{
            backgroundColor: t.buttonBg,
            borderWidth: 1,
            borderColor: t.buttonBorder,
          }}
        >
          <Ionicons name="create-outline" size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontFamily: fontFamily.bodySemi }} className="font-semibold">
            Edit weekly plan
          </Text>
        </TouchableOpacity>
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
        <Ionicons
          name={hasActivePlan ? 'refresh-outline' : 'add-circle-outline'}
          size={18}
          color={t.accent}
        />
        <Text style={{ color: t.accent, fontFamily: fontFamily.bodySemi }} className="font-semibold">
          {hasActivePlan ? 'Replace with new plan' : 'Create weekly plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (helperText) {
    return <GlassSurface style={{ padding: 18, gap: 10 }}>{actions}</GlassSurface>;
  }

  return actions;
}
