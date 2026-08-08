import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GainGangLogo } from '@/brand';
import { activityDateLabel, formatAmount } from '@/lib/format';
import { fontFamily, status } from '@/lib/gaingang-theme';
import type { ActivityFeedItem } from '@/types';

export type ActivityShareVariant = 'branded' | 'transparent';

export const SHARE_CARD_WIDTH = 320;
export const SHARE_CARD_MIN_HEIGHT = 420;

interface ActivityShareCardProps {
  activity: ActivityFeedItem;
  variant: ActivityShareVariant;
}

export function ActivityShareCard({ activity, variant }: ActivityShareCardProps) {
  const isBranded = variant === 'branded';
  const name = activity.author?.full_name || activity.author?.username || 'Athlete';
  const dateIso = activity.activity_date ?? activity.created_at.slice(0, 10);
  const exercises = activity.exercises ?? [];
  const streak = activity.streak_at_log;

  const textPrimary = '#E8EDF7';
  const textSecondary = isBranded ? '#AEB8D0' : 'rgba(232,237,247,0.85)';
  const accent = '#4D8CFF';

  return (
    <View
      style={{
        width: SHARE_CARD_WIDTH,
        minHeight: SHARE_CARD_MIN_HEIGHT,
        borderRadius: isBranded ? 24 : 0,
        overflow: 'hidden',
        backgroundColor: isBranded ? '#05070F' : 'transparent',
      }}
    >
      {isBranded ? (
        <LinearGradient
          colors={['rgba(77,140,255,0.35)', 'rgba(157,78,221,0.22)', 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 0.7 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 220,
          }}
        />
      ) : null}

      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between', gap: 20 }}>
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            {activityDateLabel(dateIso)}
          </Text>

          <Text
            style={{
              fontFamily: fontFamily.displaySemi,
              fontSize: 22,
              color: textPrimary,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>

          {streak != null && streak > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="flame" size={16} color={status.fire} />
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 14,
                  color: status.fire,
                }}
              >
                {streak} day streak
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 14, flexGrow: 1, justifyContent: 'center' }}>
          {exercises.length === 0 ? (
            <Text style={{ fontFamily: fontFamily.body, fontSize: 16, color: textSecondary }}>
              Workout logged
            </Text>
          ) : (
            exercises.slice(0, 6).map((exercise) => (
              <View key={exercise.id} style={{ gap: 2 }}>
                <Text
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 28,
                    lineHeight: 32,
                    color: accent,
                  }}
                >
                  {formatAmount(exercise.amount, exercise.unit)}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamily.bodySemi,
                    fontSize: 16,
                    color: textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {exercise.exercise_name}
                  {exercise.sets ? ` · ${exercise.sets} sets` : ''}
                </Text>
              </View>
            ))
          )}
          {exercises.length > 6 ? (
            <Text style={{ fontFamily: fontFamily.body, fontSize: 13, color: textSecondary }}>
              +{exercises.length - 6} more
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <GainGangLogo size="sm" theme="dark" />
          <Text
            style={{
              fontFamily: fontFamily.mono,
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: textSecondary,
            }}
          >
            gaingang.app
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Checkerboard shown behind transparent previews only (not captured). */
export function ShareCheckerboard({ width, height }: { width: number; height: number }) {
  const size = 14;
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width,
        height,
        overflow: 'hidden',
        borderRadius: 24,
      }}
    >
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: cols }, (_, col) => (
            <View
              key={col}
              style={{
                width: size,
                height: size,
                backgroundColor: (row + col) % 2 === 0 ? '#3A3A3A' : '#2A2A2A',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
