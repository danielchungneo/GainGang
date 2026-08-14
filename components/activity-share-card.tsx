/**
 * ActivityShareCard — 9:16 story cards for sharing a day's activity.
 *
 * Hero content is the day's exercise list. Streak + total reps sit below.
 * Capture at SHARE_CARD_WIDTH/HEIGHT; use 3x in captureRef for 1080×1920.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useId } from 'react';
import { Image, type ImageSourcePropType, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Colors, Typography } from '@/brand/constants/brand';
import { MAX_SHARE_EXERCISES, shareCardData } from '@/components/share-card-data';
import type { ActivityFeedItem } from '@/types';

export type ActivityShareVariant = 'branded' | 'transparent' | 'photo';

/** 9:16 — capture at 3x for a 1080×1920 story asset. */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;

/** @deprecated Use SHARE_CARD_HEIGHT — kept for any leftover imports. */
export const SHARE_CARD_MIN_HEIGHT = SHARE_CARD_HEIGHT;

interface ActivityShareCardProps {
  activity: ActivityFeedItem;
  variant: ActivityShareVariant;
  /** Background image for variant="photo". */
  photo?: ImageSourcePropType;
  /** Override frame size (photo cards match the chosen image aspect). */
  width?: number;
  height?: number;
}

/** Default empty photo-card frame — 3:4 like a portrait iPhone still. */
export const PHOTO_CARD_WIDTH = 360;
export const PHOTO_CARD_HEIGHT = 480;

function svgId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/* ── Brand mark ─────────────────────────────────────────────── */

function Mark({
  size = 24,
  mono = false,
  gradientId,
}: {
  size?: number;
  mono?: boolean;
  gradientId: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {!mono ? (
        <Defs>
          <SvgGradient id={gradientId} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0%" stopColor={Colors.systemBlue} />
            <Stop offset="100%" stopColor={Colors.questViolet} />
          </SvgGradient>
        </Defs>
      ) : null}
      <Polygon
        points="50,3 97,26 97,74 50,97 3,74 3,26"
        fill={mono ? 'rgba(255,255,255,0.94)' : `url(#${gradientId})`}
      />
      <Path
        d="M 22,71 L 50,27 L 78,71 L 64,71 L 50,46 L 36,71 Z"
        fill={mono ? Colors.void : '#FFFFFF'}
      />
    </Svg>
  );
}

function Lockup({
  mono = false,
  size = 16,
  markGradientId,
}: {
  mono?: boolean;
  size?: number;
  markGradientId: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Mark size={size + 8} mono={mono} gradientId={markGradientId} />
      <Text
        allowFontScaling={false}
        style={{ fontFamily: Typography.display700, fontSize: size, letterSpacing: -0.3 }}
      >
        <Text style={{ color: '#FFFFFF' }}>GAIN </Text>
        <Text style={{ color: mono ? '#FFFFFF' : Colors.auraViolet }}>GANG</Text>
      </Text>
    </View>
  );
}

/** Right-aligned gradient numeral. SVG text keeps this to zero new deps. */
function GradientAmount({
  value,
  size = 52,
  gradientId,
}: {
  value: string;
  size?: number;
  gradientId: string;
}) {
  // Scale width with string length so values like "45s" / "1m 30s" don't clip.
  const width = Math.max(92, Math.ceil(value.length * size * 0.58));

  return (
    <Svg width={width} height={size * 1.02}>
      <Defs>
        <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={Colors.auraBlue} />
          <Stop offset="55%" stopColor={Colors.systemBlue} />
          <Stop offset="100%" stopColor={Colors.auraViolet} />
        </SvgGradient>
      </Defs>
      <SvgText
        x={width}
        y={size * 0.9}
        textAnchor="end"
        fontFamily={Typography.display700}
        fontSize={size}
        fill={`url(#${gradientId})`}
      >
        {value}
      </SvgText>
    </Svg>
  );
}

/* ── Type helpers ───────────────────────────────────────────── */

const monoLabel = (color: string, letterSpacing = 2.4, fontSize = 10) => ({
  fontFamily: Typography.mono500,
  fontSize,
  letterSpacing,
  textTransform: 'uppercase' as const,
  color,
});

/* ── Card ───────────────────────────────────────────────────── */

export const ActivityShareCard = React.forwardRef<View, ActivityShareCardProps>(
  function ActivityShareCard(
    { activity, variant, photo, width: widthProp, height: heightProp },
    ref,
  ) {
    const uid = svgId(useId());
    const markGradientId = `ggShareMark-${uid}`;
    const amountGradientId = `ggAmount-${uid}`;

    const { exercises, streakDays, totalReps, dateLabel } = shareCardData(activity);
    const list = exercises.slice(0, MAX_SHARE_EXERCISES);

    const defaultWidth =
      variant === 'photo' ? PHOTO_CARD_WIDTH : SHARE_CARD_WIDTH;
    const defaultHeight =
      variant === 'photo' ? PHOTO_CARD_HEIGHT : SHARE_CARD_HEIGHT;
    const cardWidth = widthProp ?? defaultWidth;
    const cardHeight = heightProp ?? defaultHeight;

    const frame = {
      width: cardWidth,
      height: cardHeight,
      borderRadius: variant === 'transparent' ? 0 : 24,
      overflow: 'hidden' as const,
      backgroundColor: variant === 'transparent' ? 'transparent' : Colors.void,
    };

    /* ── Branded / dark hero ── */
    if (variant === 'branded') {
      return (
        <View ref={ref} collapsable={false} style={frame}>
          <LinearGradient
            colors={['rgba(77,140,255,0.34)', 'rgba(157,78,221,0.16)', 'rgba(5,7,15,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.62 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420 }}
          />

          <View style={{ flex: 1, padding: 28, paddingTop: 32, justifyContent: 'space-between' }}>
            <Text style={monoLabel(Colors.textSecondary)}>{dateLabel}</Text>

            <View style={{ gap: 18, marginVertical: -8 }}>
              {list.map((ex, i) => (
                <View
                  key={`${ex.name}-${i}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <GradientAmount
                    value={ex.amount}
                    gradientId={`${amountGradientId}-${i}`}
                  />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{
                      fontFamily: Typography.display600,
                      fontSize: 19,
                      letterSpacing: 0.2,
                      color: Colors.textPrimary,
                      flexShrink: 1,
                    }}
                  >
                    {ex.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 22 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <StatTile label="Day streak" value={String(streakDays)} color={Colors.streak} icon />
                <StatTile label="Total reps" value={String(totalReps)} />
              </View>
              <Lockup markGradientId={markGradientId} />
            </View>
          </View>
        </View>
      );
    }

    /* ── Transparent ── */
    if (variant === 'transparent') {
      return (
        <View ref={ref} collapsable={false} style={frame}>
          <View
            style={{
              flex: 1,
              paddingHorizontal: 28,
              paddingTop: 76,
              paddingBottom: 32,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={monoLabel('rgba(255,255,255,0.8)', 2.6)}>{dateLabel}</Text>

            <View style={{ gap: 20, alignItems: 'center' }}>
              {list.map((ex, i) => (
                <View key={`${ex.name}-${i}`} style={{ alignItems: 'center' }}>
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: Typography.display700,
                      fontSize: 54,
                      lineHeight: 56,
                      letterSpacing: -1.5,
                      color: '#FFFFFF',
                    }}
                  >
                    {ex.amount}
                  </Text>
                  <Text style={monoLabel('rgba(255,255,255,0.82)', 3, 11)}>{ex.name}</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 20, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 26 }}>
                <MiniStat label="Day streak" value={String(streakDays)} />
                <View style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                <MiniStat label="Total reps" value={String(totalReps)} />
              </View>
              <Lockup mono markGradientId={markGradientId} />
            </View>
          </View>
        </View>
      );
    }

    /* ── Photo-backed ── */
    return (
      <View ref={ref} collapsable={false} style={frame}>
        {photo ? (
          <Image
            source={photo}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            // Frame is sized to the photo's aspect, so cover shows the full image.
            resizeMode="cover"
          />
        ) : null}

        <LinearGradient
          colors={[
            'rgba(5,7,15,0.62)',
            'rgba(5,7,15,0.06)',
            'rgba(5,7,15,0.78)',
            'rgba(5,7,15,0.95)',
          ]}
          locations={[0, 0.26, 0.6, 1]}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />

        <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Text style={monoLabel('rgba(255,255,255,0.86)')}>{dateLabel}</Text>
            <Mark size={22} mono gradientId={markGradientId} />
          </View>

          <View style={{ gap: 20 }}>
            <View style={{ gap: 12 }}>
              {list.map((ex, i) => (
                <View
                  key={`${ex.name}-${i}`}
                  style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: Typography.display700,
                      fontSize: 44,
                      lineHeight: 44,
                      letterSpacing: -1.2,
                      width: 78,
                      textAlign: 'right',
                      color: '#FFFFFF',
                    }}
                  >
                    {ex.amount}
                  </Text>
                  <Text style={monoLabel('rgba(255,255,255,0.84)', 2.4, 11)} numberOfLines={1}>
                    {ex.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.24)' }} />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 22 }}>
                <PhotoStat label="Day streak" value={String(streakDays)} />
                <PhotoStat label="Total reps" value={String(totalReps)} />
              </View>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: Typography.display700,
                  fontSize: 15,
                  letterSpacing: -0.3,
                  paddingBottom: 4,
                }}
              >
                <Text style={{ color: '#FFFFFF' }}>GAIN </Text>
                <Text style={{ color: Colors.auraViolet }}>GANG</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

/* ── Small parts ────────────────────────────────────────────── */

function StatTile({
  label,
  value,
  color = Colors.textPrimary,
  icon = false,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: 'rgba(19,28,48,0.72)',
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        gap: 5,
      }}
    >
      <Text style={monoLabel(Colors.textMuted, 2, 9)}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name="flame" size={20} color={Colors.streak} /> : null}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ fontFamily: Typography.display700, fontSize: 30, lineHeight: 34, color }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text
        allowFontScaling={false}
        style={{ fontFamily: Typography.display700, fontSize: 26, lineHeight: 28, color: '#FFFFFF' }}
      >
        {value}
      </Text>
      <Text style={monoLabel('rgba(255,255,255,0.72)', 2.2, 9)}>{label}</Text>
    </View>
  );
}

function PhotoStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={monoLabel('rgba(255,255,255,0.66)', 2, 9)}>{label}</Text>
      <Text
        allowFontScaling={false}
        style={{ fontFamily: Typography.display700, fontSize: 28, lineHeight: 30, color: '#FFFFFF' }}
      >
        {value}
      </Text>
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
      style={{ position: 'absolute', width, height, overflow: 'hidden', borderRadius: 24 }}
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
