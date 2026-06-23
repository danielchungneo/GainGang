import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { LevelBadge } from '@/components/ui/rank-badge';
import { levelFromXp } from '@/types';
import { useToggleKudos } from '@/hooks/use-social';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount, timeAgo } from '@/lib/format';
import { CATEGORY_LABELS, type ActivityFeedItem } from '@/types';

interface ActivityCardProps {
  activity: ActivityFeedItem;
  gangId?: string;
}

export function ActivityCard({ activity, gangId }: ActivityCardProps) {
  const t = useThemeTokens();
  const toggleKudos = useToggleKudos(gangId);

  const name = activity.author?.full_name || 'Member';

  return (
    <GlassSurface style={{ padding: 16, gap: 12 }}>
      <View className="flex-row items-center gap-3">
        <Avatar name={name} uri={activity.author?.avatar_url} size={40} />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text style={{ color: t.heading }} className="font-bold" numberOfLines={1}>
              {name}
            </Text>
            {activity.author?.xp != null ? (
              <LevelBadge level={levelFromXp(activity.author.xp)} size={18} />
            ) : null}
          </View>
          <Text style={{ color: t.body }} className="text-xs">
            {timeAgo(activity.created_at)}
            {activity.category ? `  ·  ${CATEGORY_LABELS[activity.category]}` : ''}
          </Text>
        </View>
      </View>

      <View className="flex-row items-baseline gap-2">
        <Text style={{ color: t.accent }} className="text-2xl font-extrabold">
          {formatAmount(activity.amount, activity.unit)}
        </Text>
        <Text style={{ color: t.heading }} className="text-base font-semibold" numberOfLines={1}>
          {activity.exercise_name}
        </Text>
        {activity.sets ? (
          <Text style={{ color: t.body }} className="text-sm">
            · {activity.sets} sets
          </Text>
        ) : null}
      </View>

      {activity.notes ? (
        <Text style={{ color: t.body }} className="text-sm leading-5">
          {activity.notes}
        </Text>
      ) : null}

      {activity.photo_url ? (
        <Image
          source={{ uri: activity.photo_url }}
          style={{ width: '100%', height: 200, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : null}

      <View className="flex-row items-center gap-6 pt-1">
        <TouchableOpacity
          onPress={() => toggleKudos.mutate({ activityId: activity.id, hasKudos: activity.has_kudos })}
          className="flex-row items-center gap-1.5">
          <Ionicons
            name={activity.has_kudos ? 'flame' : 'flame-outline'}
            size={20}
            color={activity.has_kudos ? '#f97316' : t.body}
          />
          <Text style={{ color: activity.has_kudos ? '#f97316' : t.body }} className="text-sm font-semibold">
            {activity.kudos_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
          className="flex-row items-center gap-1.5">
          <Ionicons name="chatbubble-outline" size={19} color={t.body} />
          <Text style={{ color: t.body }} className="text-sm font-semibold">
            {activity.comment_count}
          </Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );
}
