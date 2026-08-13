/**
 * Centralised React Query key factory.
 * Keeps cache keys consistent across hooks and makes invalidation predictable.
 */
export const queryKeys = {
  profile: (userId?: string) => ['profile', userId] as const,
  followStatus: (viewerId?: string, targetId?: string) =>
    ['follows', 'status', viewerId, targetId] as const,
  followCounts: (userId?: string) => ['follows', 'counts', userId] as const,
  followList: (userId?: string, list?: 'followers' | 'following') =>
    ['follows', 'list', userId, list] as const,
  myGangs: (userId?: string) => ['gangs', 'mine', userId] as const,
  gang: (gangId: string) => ['gangs', gangId] as const,
  gangMembers: (gangId: string) => ['gangs', gangId, 'members'] as const,
  discoverGangs: (search?: string, userId?: string) =>
    ['gangs', 'discover', search ?? '', userId ?? ''] as const,
  gangInvitePreview: (inviteCode: string) => ['gangs', 'invite', inviteCode] as const,
  exercises: (category?: string, gangId?: string) =>
    ['exercises', category ?? 'all', gangId ?? 'global'] as const,
  gangQuests: (gangId: string) => ['quests', 'gang', gangId] as const,
  myQuests: (userId?: string) => ['quests', 'mine', userId] as const,
  quest: (questId?: string, userId?: string) => ['quests', 'detail', questId, userId] as const,
  gangWeeklyPlans: (gangId: string) => ['weekly-plans', 'gang', gangId] as const,
  activeWeeklyPlan: (gangId: string) => ['weekly-plans', 'active', gangId] as const,
  weeklyPlan: (planId?: string) => ['weekly-plans', 'detail', planId] as const,
  myTodaysDailyGoals: (userId?: string) => ['daily-goals', 'today', userId] as const,
  myUpcomingExerciseDates: (userId?: string) =>
    ['daily-goals', 'upcoming-exercise-dates', userId] as const,
  dailyGoal: (dailyGoalId?: string, userId?: string) =>
    ['daily-goals', 'detail', dailyGoalId, userId] as const,
  feed: (gangId: string) => ['feed', gangId] as const,
  followingFeed: (userId?: string) => ['feed', 'following', userId] as const,
  myActivities: (userId?: string) => ['activities', 'mine', userId] as const,
  questActivity: (questId?: string, userId?: string) =>
    ['activities', 'quest', questId, userId] as const,
  dailyGoalActivities: (dailyGoalId?: string, userId?: string) =>
    ['activities', 'daily-goal', dailyGoalId, userId] as const,
  comments: (activityId: string) => ['comments', activityId] as const,
  leaderboard: (gangId: string, period: string) => ['leaderboard', gangId, period] as const,
  currentWeeklyChallenge: () => ['challenges', 'current'] as const,
  challengeLeaderboard: (
    challengeId: string,
    scope: string,
    gangId?: string,
  ) => ['challenges', 'leaderboard', challengeId, scope, gangId ?? ''] as const,
  myChallengeEntry: (challengeId?: string, userId?: string) =>
    ['challenges', 'entry', challengeId, userId] as const,
  gangWarState: (gangId?: string, userId?: string) =>
    ['gang-wars', 'state', gangId, userId] as const,
  gangWarHistory: (gangId?: string, userId?: string) =>
    ['gang-wars', 'history', gangId, userId] as const,
  needsGangWarAttempts: (userId?: string) =>
    ['gang-wars', 'needs-attempts', userId] as const,
  gangWarMemberContributions: (
    matchId?: string,
    gangId?: string,
    userId?: string,
  ) => ['gang-wars', 'member-contributions', matchId, gangId, userId] as const,
  gangWarDayMemberContributions: (
    matchId?: string,
    gangId?: string,
    dayOn?: string,
    userId?: string,
  ) =>
    ['gang-wars', 'day-member-contributions', matchId, gangId, dayOn, userId] as const,
  achievements: () => ['achievements'] as const,
  userAchievements: (userId?: string) => ['achievements', 'user', userId] as const,
  notifications: (userId?: string) => ['notifications', userId] as const,
  exerciseContributions: (gangId: string, exerciseId?: string) =>
    ['gangs', gangId, 'exercise-contributions', exerciseId] as const,
  rewardCrates: (userId?: string) => ['reward-crates', userId] as const,
  todaysRewardCrate: (userId?: string, date?: string) =>
    ['reward-crates', 'today', userId, date] as const,
  cosmeticCatalog: () => ['cosmetics', 'catalog'] as const,
  ownedCosmetics: (userId?: string) => ['cosmetics', 'owned', userId] as const,
  starterCosmeticCrates: (userId?: string) =>
    ['cosmetics', 'starter-crates', userId] as const,
  shopStock: (userId?: string) => ['shop', 'stock', userId] as const,
} as const;
