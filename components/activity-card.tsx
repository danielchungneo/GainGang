import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { GlassSurface } from '@/components/ui/glass-surface';
import { LevelBadge } from '@/components/ui/rank-badge';
import { StreakPill } from '@/components/ui/streak-pill';
import { useCosmeticCatalog } from '@/hooks/use-cosmetics';
import { useToggleKudos } from '@/hooks/use-social';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatAmount, timeAgo } from '@/lib/format';
import { pushUserProfile } from '@/lib/navigate-profile';
import { levelFromXp, type ActivityFeedItem } from '@/types';

interface ActivityCardProps {
  activity: ActivityFeedItem;
  gangId?: string;
}

export function ActivityCard({ activity, gangId }: ActivityCardProps) {
  const t = useThemeTokens();
  const toggleKudos = useToggleKudos(gangId);
  const { data: catalog } = useCosmeticCatalog();

  const name = activity.author?.full_name || 'Member';
  const exercises = activity.exercises ?? [];
  const streak = activity.streak_at_log;
  const levelBorderStyle =
    catalog?.find((item) => item.id === activity.author?.equipped_level_border_id)
      ?.style ?? null;

  return (
    <GlassSurface style={{ padding: 16, gap: 12 }}>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={() => {
            if (!activity.author?.id) return;
            pushUserProfile(activity.author.id);
          }}
          disabled={!activity.author?.id}
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile`}
        >
          <Avatar name={name} uri={activity.author?.avatar_url} size={40} />
        </TouchableOpacity>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => {
                if (!activity.author?.id) return;
                pushUserProfile(activity.author.id);
              }}
              disabled={!activity.author?.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${name}'s profile`}
              style={{ flexShrink: 1 }}
            >
              <Text style={{ color: t.heading }} className="font-bold" numberOfLines={1}>
                {name}
              </Text>
            </TouchableOpacity>
            {activity.author?.xp != null ? (
              <LevelBadge
                level={levelFromXp(activity.author.xp)}
                size={18}
                borderStyle={levelBorderStyle}
              />
            ) : null}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text style={{ color: t.body }} className="text-xs">
              {timeAgo(activity.updated_at ?? activity.created_at)}
            </Text>
            {streak != null && streak > 0 ? (
              <>
                <Text style={{ color: t.placeholder }} className="text-xs">
                  ·
                </Text>
                <StreakPill days={streak} />
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {exercises.map((exercise) => (
          <View key={exercise.id} className="flex-row items-baseline gap-2">
            <Text style={{ color: t.accent }} className="text-2xl font-extrabold">
              {formatAmount(exercise.amount, exercise.unit)}
            </Text>
            <Text style={{ color: t.heading }} className="text-base font-semibold" numberOfLines={1}>
              {exercise.exercise_name}
            </Text>
            {exercise.sets ? (
              <Text style={{ color: t.body }} className="text-sm">
                · {exercise.sets} sets
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {activity.notes ? (
        <Text style={{ color: t.body }} className="text-sm leading-5">
          {activity.notes}
        </Text>
      ) : null}

      {exercises.some((e) => e.notes) ? (
        <View style={{ gap: 4 }}>
          {exercises
            .filter((e) => e.notes)
            .map((exercise) => (
              <Text key={exercise.id} style={{ color: t.body }} className="text-sm leading-5">
                <Text style={{ color: t.heading }} className="font-semibold">
                  {exercise.exercise_name}:{' '}
                </Text>
                {exercise.notes}
              </Text>
            ))}
        </View>
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

        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/activity/share', params: { id: activity.id } })
          }
          className="flex-row items-center gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Share activity"
        >
          <Ionicons name="share-outline" size={20} color={t.body} />
        </TouchableOpacity>
      </View>

      {activity.latest_comment ? (
        <>
          <View style={{ height: 1, backgroundColor: t.surfaceBorder, opacity: 0.7 }} />
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
            accessibilityRole="button"
            accessibilityLabel="View comments"
            className="flex-row items-center gap-2"
          >
            <Avatar
              name={
                activity.latest_comment.author?.full_name ||
                activity.latest_comment.author?.username ||
                'Member'
              }
              uri={activity.latest_comment.author?.avatar_url}
              size={24}
            />
            <Text style={{ color: t.body, flex: 1 }} className="text-sm leading-5" numberOfLines={1}>
              <Text style={{ color: t.heading }} className="font-semibold">
                {activity.latest_comment.author?.full_name ||
                  activity.latest_comment.author?.username ||
                  'Member'}
              </Text>
              <Text style={{ color: t.placeholder }}> · </Text>
              {activity.latest_comment.body}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}
    </GlassSurface>
  );
}
