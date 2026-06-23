/**
 * Centralised React Query key factory.
 * Keeps cache keys consistent across hooks and makes invalidation predictable.
 */
export const queryKeys = {
  profile: (userId?: string) => ['profile', userId] as const,
  myGangs: (userId?: string) => ['gangs', 'mine', userId] as const,
  gang: (gangId: string) => ['gangs', gangId] as const,
  gangMembers: (gangId: string) => ['gangs', gangId, 'members'] as const,
  discoverGangs: (search?: string) => ['gangs', 'discover', search ?? ''] as const,
  exercises: (category?: string, gangId?: string) =>
    ['exercises', category ?? 'all', gangId ?? 'global'] as const,
  gangQuests: (gangId: string) => ['quests', 'gang', gangId] as const,
  myQuests: (userId?: string) => ['quests', 'mine', userId] as const,
  quest: (questId?: string, userId?: string) => ['quests', 'detail', questId, userId] as const,
  gangWeeklyPlans: (gangId: string) => ['weekly-plans', 'gang', gangId] as const,
  activeWeeklyPlan: (gangId: string) => ['weekly-plans', 'active', gangId] as const,
  weeklyPlan: (planId?: string) => ['weekly-plans', 'detail', planId] as const,
  myTodaysDailyGoals: (userId?: string) => ['daily-goals', 'today', userId] as const,
  dailyGoal: (dailyGoalId?: string, userId?: string) =>
    ['daily-goals', 'detail', dailyGoalId, userId] as const,
  feed: (gangId: string) => ['feed', gangId] as const,
  myActivities: (userId?: string) => ['activities', 'mine', userId] as const,
  questActivity: (questId?: string, userId?: string) =>
    ['activities', 'quest', questId, userId] as const,
  dailyGoalActivities: (dailyGoalId?: string, userId?: string) =>
    ['activities', 'daily-goal', dailyGoalId, userId] as const,
  comments: (activityId: string) => ['comments', activityId] as const,
  leaderboard: (gangId: string, period: string) => ['leaderboard', gangId, period] as const,
  achievements: () => ['achievements'] as const,
  userAchievements: (userId?: string) => ['achievements', 'user', userId] as const,
  notifications: (userId?: string) => ['notifications', userId] as const,
} as const;
