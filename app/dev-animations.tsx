import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { GoalCompleteOverlay } from '@/components/goal-complete-overlay';
import { GangWarMatchupOverlay } from '@/components/gang-war-matchup-overlay';
import { GangWarResultOverlay } from '@/components/gang-war-result-overlay';
import { LevelUpOverlay } from '@/components/level-up-overlay';
import { AchievementUnlockOverlay } from '@/components/achievement-unlock-overlay';
import { ShopConfirmModal } from '@/components/shop-sheets';
import { RewardReveal } from '@/components/reward-reveal';
import { ScreenTimeUnlockOverlay } from '@/components/screen-time-unlock-overlay';
import { StreakContinueOverlay } from '@/components/streak-continue-overlay';
import { GlassSurface, ScreenBackground } from '@/components/ui';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { enqueueAchievementUnlocks } from '@/lib/achievements';
import { fontFamily, spacing, type } from '@/lib/gaingang-theme';
import { rarityDef, type RewardRarity } from '@/lib/rewards';
import type { ShopListingItem } from '@/lib/shop';
import type { Achievement, AchievementTier } from '@/types';

type AnimationId =
  | 'level-up'
  | 'level-up-claim'
  | 'goal-complete'
  | 'day-complete'
  | 'streak-continue'
  | 'streak-first'
  | 'focus-unlock'
  | 'achievement-unlock'
  | 'achievement-unlock-queue'
  | 'purchase-reveal'
  | 'reward-reveal-e'
  | 'reward-reveal-d'
  | 'reward-reveal-c'
  | 'reward-reveal-b'
  | 'reward-reveal-a'
  | 'reward-reveal-s'
  | 'gang-war-vs'
  | 'gang-war-win'
  | 'gang-war-loss';

interface AnimationDef {
  id: AnimationId;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ANIMATIONS: AnimationDef[] = [
  {
    id: 'level-up',
    title: 'Level Up',
    description: 'XP bar fill → stamp + rings',
    icon: 'ribbon',
  },
  {
    id: 'level-up-claim',
    title: 'Level Up + Claim',
    description: 'Level-up stamp with crate claim CTA',
    icon: 'gift',
  },
  {
    id: 'goal-complete',
    title: 'Goal Complete',
    description: 'Daily goal cleared celebration',
    icon: 'checkmark-circle',
  },
  {
    id: 'day-complete',
    title: 'Day Complete + Claim',
    description: 'All daily exercises cleared → uncommon crate claim',
    icon: 'trophy',
  },
  {
    id: 'streak-continue',
    title: 'Streak Continue',
    description: 'Flame stamp for an ongoing streak',
    icon: 'flame',
  },
  {
    id: 'streak-first',
    title: 'Streak Start',
    description: 'First day of a new streak',
    icon: 'flame-outline',
  },
  {
    id: 'focus-unlock',
    title: 'Focus Unlock',
    description: 'Focus lock lifts after goals clear',
    icon: 'lock-open',
  },
  {
    id: 'achievement-unlock',
    title: 'Achievement Unlock',
    description: 'Badge stamp with tier metal frame',
    icon: 'ribbon',
  },
  {
    id: 'achievement-unlock-queue',
    title: 'Achievement Unlock ×3',
    description: 'Queues three via root host — dismiss to advance',
    icon: 'layers',
  },
  {
    id: 'purchase-reveal',
    title: 'Purchase Reveal',
    description: 'Confirm → SPEND morphs into PAID receipt',
    icon: 'storefront',
  },
  {
    id: 'reward-reveal-e',
    title: 'Reward Reveal · Common',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'reward-reveal-d',
    title: 'Reward Reveal · Uncommon',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'reward-reveal-c',
    title: 'Reward Reveal · Rare',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'reward-reveal-b',
    title: 'Reward Reveal · Epic',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'reward-reveal-a',
    title: 'Reward Reveal · Legendary',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'reward-reveal-s',
    title: 'Reward Reveal · Mythic',
    description: 'Sealed orb charge → burst → claim',
    icon: 'cube',
  },
  {
    id: 'gang-war-vs',
    title: 'Gang War · Matchup VS',
    description: 'New weekly matchup reveal (division borders)',
    icon: 'flash',
  },
  {
    id: 'gang-war-win',
    title: 'Gang War · Victory',
    description: 'Scores → division promote → claim war crate',
    icon: 'trophy',
  },
  {
    id: 'gang-war-loss',
    title: 'Gang War · Defeat',
    description: 'Scores → somber demote → continue',
    icon: 'skull-outline',
  },
];

const REVEAL_TIERS: Record<
  Extract<
    AnimationId,
    | 'reward-reveal-e'
    | 'reward-reveal-d'
    | 'reward-reveal-c'
    | 'reward-reveal-b'
    | 'reward-reveal-a'
    | 'reward-reveal-s'
  >,
  RewardRarity
> = {
  'reward-reveal-e': 'E',
  'reward-reveal-d': 'D',
  'reward-reveal-c': 'C',
  'reward-reveal-b': 'B',
  'reward-reveal-a': 'A',
  'reward-reveal-s': 'S',
};

function isRevealId(id: AnimationId): id is keyof typeof REVEAL_TIERS {
  return id.startsWith('reward-reveal-');
}

const DEV_PURCHASE_ITEM: ShopListingItem = {
  id: 'dev-purchase',
  slug: 'dev-purchase',
  product_kind: 'cosmetic',
  category: 'titles',
  cosmetic_id: 'dev-title-unstoppable',
  crate_key: null,
  crate_min_rarity: null,
  name: 'Unstoppable',
  description: null,
  rarity: 'A',
  odds_label: null,
  price_creds: 1800,
  is_featured: false,
  sort_order: 0,
  stock_remaining: 1,
  owned: false,
  sold_out: false,
  cosmetic: {
    id: 'dev-title-unstoppable',
    kind: 'title',
    rarity: 'A',
    name: 'Unstoppable',
    description: null,
    style: {},
    active: true,
    created_at: new Date(0).toISOString(),
  },
};

const DEV_ACHIEVEMENT: Achievement = {
  id: 'dev-achievement',
  key: 'streak_7',
  title: 'Week Warrior',
  description: 'Reach a 7-day streak',
  icon: 'flame',
  category: 'streak',
  threshold: 7,
  is_secret: false,
  tier: 'silver' satisfies AchievementTier,
};

const DEV_ACHIEVEMENT_QUEUE: Achievement[] = [
  {
    id: 'dev-achievement-q1',
    key: 'reps_100',
    title: 'Century Club',
    description: 'Log 100 total reps',
    icon: 'barbell',
    category: 'reps',
    threshold: 100,
    is_secret: false,
    tier: 'bronze' satisfies AchievementTier,
  },
  {
    id: 'dev-achievement-q2',
    key: 'streak_7',
    title: 'Week Warrior',
    description: 'Reach a 7-day streak',
    icon: 'flame',
    category: 'streak',
    threshold: 7,
    is_secret: false,
    tier: 'silver' satisfies AchievementTier,
  },
  {
    id: 'dev-achievement-q3',
    key: 'reps_1k',
    title: 'Thousand Club',
    description: 'Log 1,000 total reps',
    icon: 'trophy',
    category: 'reps',
    threshold: 1000,
    is_secret: false,
    tier: 'gold' satisfies AchievementTier,
  },
];

/**
 * Dev-only playground for celebrating overlays and reward reveals.
 * Reachable from Settings → Animations when `__DEV__` is true.
 */
export default function DevAnimationsScreen() {
  const t = useThemeTokens();
  const [active, setActive] = useState<AnimationId | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const dismiss = useCallback(() => {
    setActive(null);
    setPurchaseBusy(false);
    setPurchaseSuccess(false);
  }, []);

  function play(id: AnimationId) {
    if (id === 'achievement-unlock-queue') {
      enqueueAchievementUnlocks(DEV_ACHIEVEMENT_QUEUE);
      return;
    }
    setPlayKey((k) => k + 1);
    setPurchaseBusy(false);
    setPurchaseSuccess(false);
    setActive(id);
  }

  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  const revealTier = active && isRevealId(active) ? REVEAL_TIERS[active] : null;
  const revealDef = revealTier ? rarityDef(revealTier) : null;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={26} color={t.heading} />
            </Pressable>
            <Text style={[type.heading, { color: t.heading, flex: 1 }]}>
              Animations
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#F5A524',
                backgroundColor: 'rgba(245,165,36,0.18)',
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamily.bodySemi,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  color: '#F5A524',
                }}
              >
                DEV
              </Text>
            </View>
          </View>
          <Text style={[type.bodySm, { color: t.body }]}>
            Tap any row to play the celebration overlay.
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.md,
            gap: spacing.sm,
            paddingBottom: 40,
          }}
        >
          {ANIMATIONS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => play(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${item.title}`}
            >
              <GlassSurface
                style={{
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${t.accent}22`,
                    borderWidth: 1,
                    borderColor: `${t.accent}55`,
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={t.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fontFamily.bodySemi,
                      fontSize: 16,
                      color: t.heading,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text style={[type.bodySm, { color: t.body }]}>
                    {item.description}
                  </Text>
                </View>
                <Ionicons name="play" size={18} color={t.accent} />
              </GlassSurface>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <LevelUpOverlay
        key={`level-up-${playKey}`}
        visible={active === 'level-up'}
        fromLevel={13}
        toLevel={14}
        onDismiss={dismiss}
      />

      <LevelUpOverlay
        key={`level-up-claim-${playKey}`}
        visible={active === 'level-up-claim'}
        fromLevel={13}
        toLevel={14}
        rewardCrateId="dev-preview-crate"
        rewardCrateTierLabel="Common"
        onClaimReward={dismiss}
        onDismiss={dismiss}
      />

      <GoalCompleteOverlay
        key={`goal-${playKey}`}
        visible={active === 'goal-complete'}
        questTitle="Daily Training"
        questKind="Daily Goal"
        description="Every exercise cleared for the day."
        xpEarned={120}
        exercises={[
          { name: 'Push-ups', unit: 'reps', from: 0, target: 40 },
          { name: 'Squats', unit: 'reps', from: 0, target: 50 },
          { name: 'Plank', unit: 'seconds', from: 0, target: 60 },
        ]}
        onDismiss={dismiss}
      />

      <GoalCompleteOverlay
        key={`day-${playKey}`}
        visible={active === 'day-complete'}
        variant="day"
        questTitle="Friday"
        questKind="Day Clear"
        xpEarned={180}
        exercises={[
          { name: 'Push-ups', unit: 'reps', from: 0, target: 40 },
          { name: 'Squats', unit: 'reps', from: 0, target: 50 },
          { name: 'Plank', unit: 'seconds', from: 0, target: 60 },
        ]}
        rewardCrateId="dev-preview-daily-crate"
        rewardCrateTierLabel="Uncommon"
        onClaimReward={dismiss}
        onDismiss={dismiss}
      />

      <StreakContinueOverlay
        key={`streak-${playKey}`}
        visible={active === 'streak-continue'}
        fromDays={6}
        toDays={7}
        onDismiss={dismiss}
      />

      <StreakContinueOverlay
        key={`streak-first-${playKey}`}
        visible={active === 'streak-first'}
        fromDays={0}
        toDays={1}
        onDismiss={dismiss}
      />

      <ScreenTimeUnlockOverlay
        key={`focus-${playKey}`}
        visible={active === 'focus-unlock'}
        onDismiss={dismiss}
      />

      <AchievementUnlockOverlay
        key={`achievement-${playKey}`}
        visible={active === 'achievement-unlock'}
        achievement={DEV_ACHIEVEMENT}
        onDismiss={dismiss}
      />

      <ShopConfirmModal
        key={`purchase-${playKey}`}
        visible={active === 'purchase-reveal'}
        item={DEV_PURCHASE_ITEM}
        balance={2480}
        busy={purchaseBusy}
        success={purchaseSuccess}
        onCancel={dismiss}
        onConfirm={() => {
          setPurchaseBusy(true);
          setTimeout(() => {
            setPurchaseBusy(false);
            setPurchaseSuccess(true);
          }, 450);
        }}
        onSuccessDismiss={dismiss}
      />

      {active === 'gang-war-vs' ? (
        <GangWarMatchupOverlay
          key={`gang-war-vs-${playKey}`}
          ourName="Iron Legion"
          ourBannerUrl={null}
          ourDivision="iron"
          theirName="Bronze Age Bros"
          theirBannerUrl={null}
          theirDivision="bronze"
          onDismiss={dismiss}
        />
      ) : null}

      {active === 'gang-war-win' ? (
        <GangWarResultOverlay
          key={`gang-war-win-${playKey}`}
          won
          division="silver"
          ourScore={842}
          theirScore={610}
          ourName="Iron Legion"
          ourBannerUrl={null}
          onDismiss={dismiss}
          onClaimReward={dismiss}
        />
      ) : null}

      {active === 'gang-war-loss' ? (
        <GangWarResultOverlay
          key={`gang-war-loss-${playKey}`}
          won={false}
          division="gold"
          ourScore={412}
          theirScore={588}
          ourName="Iron Legion"
          ourBannerUrl={null}
          onDismiss={dismiss}
        />
      ) : null}

      <Modal
        visible={!!revealDef && !!revealTier}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(5,7,15,0.92)' }}>
          {revealDef && revealTier ? (
            <RewardReveal
              key={`reveal-${revealTier}-${playKey}`}
              visible
              tier={revealTier}
              kicker="REWARD CRATE OPENED"
              title={`${revealDef.name} Reward Crate`}
              subtitle="Dev preview of the sealed orb reveal."
              emblemLevel={revealDef.badgeLevel}
              claimLabel="CONTINUE"
              rewards={[
                {
                  label: 'XP EARNED',
                  value: `+${revealDef.xpAmount}`,
                  badgeLevel: revealDef.badgeLevel,
                  badgeLabel: 'XP',
                  color: revealDef.color,
                },
                {
                  label: 'CREDS',
                  value: `+${revealDef.credsAmount} Creds`,
                  mark: 'creds',
                  color: revealDef.color,
                },
              ]}
              onClaim={dismiss}
            />
          ) : null}
        </View>
      </Modal>
    </ScreenBackground>
  );
}
