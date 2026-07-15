/**
 * Supabase database types for GainGang.
 *
 * Hand-written to match `supabase/migrations/0001_initial_schema.sql`.
 * Once the Supabase CLI is linked you can regenerate the canonical version:
 *   npx supabase gen types typescript --linked > types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Shared domain literals (mirror the SQL CHECK constraints).
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type GangPrivacy = 'public' | 'invite_only';
export type GangRole = 'owner' | 'admin' | 'member';
export type ExerciseCategory = 'chest' | 'legs' | 'cardio' | 'back' | 'core';
export type ExerciseUnit = 'reps' | 'seconds' | 'miles';
export type QuestType = 'daily' | 'weekly';
export type QuestStatus = 'active' | 'completed' | 'failed';
export type WeeklyPlanStatus = 'active' | 'completed' | 'failed';
export type AchievementCategory =
  | 'quest'
  | 'streak'
  | 'reps'
  | 'social'
  | 'gang'
  | 'rare'
  | 'general';
export type NotificationType =
  | 'kudos'
  | 'comment'
  | 'mention'
  | 'quest'
  | 'achievement'
  | 'rank_up'
  | 'gang'
  | 'poke'
  | 'daily_goal';

export type PushPlatform = 'ios' | 'android' | 'web' | 'unknown';
export type XpAwardKind = 'activity_log' | 'personal_goal' | 'gang_goal' | 'crate_reward';
export type RewardCrateStatus = 'sealed' | 'opened';
export type RewardCrateSource = 'daily_completion';
export type RewardCrateTier = 'aura' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          username: string | null;
          avatar_url: string | null;
          bio: string | null;
          fitness_level: FitnessLevel;
          rank: Rank;
          xp: number;
          currency: number;
          current_streak: number;
          longest_streak: number;
          last_active_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          username?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          fitness_level?: FitnessLevel;
          rank?: Rank;
          xp?: number;
          currency?: number;
          current_streak?: number;
          longest_streak?: number;
          last_active_on?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      gangs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          privacy: GangPrivacy;
          invite_code: string;
          difficulty: Rank;
          current_streak: number;
          longest_streak: number;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          privacy?: GangPrivacy;
          invite_code?: string;
          difficulty?: Rank;
          owner_id: string;
        };
        Update: Partial<Database['public']['Tables']['gangs']['Insert']>;
        Relationships: [];
      };
      gang_members: {
        Row: {
          gang_id: string;
          user_id: string;
          role: GangRole;
          joined_at: string;
        };
        Insert: {
          gang_id: string;
          user_id: string;
          role?: GangRole;
        };
        Update: Partial<Database['public']['Tables']['gang_members']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'gang_members_gang_id_fkey';
            columns: ['gang_id'];
            isOneToOne: false;
            referencedRelation: 'gangs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gang_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          category: ExerciseCategory;
          unit: ExerciseUnit;
          description: string | null;
          gang_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: ExerciseCategory;
          unit?: ExerciseUnit;
          description?: string | null;
          gang_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['exercises']['Insert']>;
        Relationships: [];
      };
      quests: {
        Row: {
          id: string;
          gang_id: string;
          type: QuestType;
          title: string;
          day_category: ExerciseCategory | null;
          exercise_id: string | null;
          unit: ExerciseUnit;
          gang_target: number;
          individual_target: number;
          starts_on: string;
          ends_on: string;
          status: QuestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          gang_id: string;
          type?: QuestType;
          title: string;
          day_category?: ExerciseCategory | null;
          exercise_id?: string | null;
          unit?: ExerciseUnit;
          gang_target?: number;
          individual_target?: number;
          starts_on?: string;
          ends_on?: string;
          status?: QuestStatus;
        };
        Update: Partial<Database['public']['Tables']['quests']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'quests_gang_id_fkey';
            columns: ['gang_id'];
            isOneToOne: false;
            referencedRelation: 'gangs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'quests_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          gang_id: string | null;
          quest_id: string | null;
          daily_goal_id: string | null;
          activity_date: string | null;
          notes: string | null;
          photo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          gang_id?: string | null;
          quest_id?: string | null;
          daily_goal_id?: string | null;
          activity_date?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['activities']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'activities_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_gang_id_fkey';
            columns: ['gang_id'];
            isOneToOne: false;
            referencedRelation: 'gangs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_daily_goal_id_fkey';
            columns: ['daily_goal_id'];
            isOneToOne: false;
            referencedRelation: 'daily_goals';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_exercises: {
        Row: {
          id: string;
          activity_id: string;
          exercise_id: string | null;
          exercise_name: string;
          category: ExerciseCategory | null;
          unit: ExerciseUnit;
          amount: number;
          sets: number | null;
          notes: string | null;
          daily_goal_exercise_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          exercise_id?: string | null;
          exercise_name: string;
          category?: ExerciseCategory | null;
          unit?: ExerciseUnit;
          amount?: number;
          sets?: number | null;
          notes?: string | null;
          daily_goal_exercise_id?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['activity_exercises']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'activity_exercises_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activity_exercises_daily_goal_exercise_id_fkey';
            columns: ['daily_goal_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'daily_goal_exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      xp_awards: {
        Row: {
          id: string;
          kind: XpAwardKind;
          user_id: string | null;
          gang_id: string | null;
          daily_goal_exercise_id: string | null;
          quest_id: string | null;
          reward_crate_id: string | null;
          xp_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: XpAwardKind;
          user_id?: string | null;
          gang_id?: string | null;
          daily_goal_exercise_id?: string | null;
          quest_id?: string | null;
          reward_crate_id?: string | null;
          xp_amount: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['xp_awards']['Insert']>;
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['app_settings']['Insert']>;
        Relationships: [];
      };
      weekly_plans: {
        Row: {
          id: string;
          gang_id: string;
          starts_on: string;
          ends_on: string;
          status: WeeklyPlanStatus;
          is_adaptive: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          gang_id: string;
          starts_on: string;
          ends_on: string;
          status?: WeeklyPlanStatus;
          is_adaptive?: boolean;
        };
        Update: Partial<Database['public']['Tables']['weekly_plans']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'weekly_plans_gang_id_fkey';
            columns: ['gang_id'];
            isOneToOne: false;
            referencedRelation: 'gangs';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_goals: {
        Row: {
          id: string;
          weekly_plan_id: string;
          day_of_week: number;
          title: string;
          day_category: ExerciseCategory | null;
          goal_date: string;
        };
        Insert: {
          id?: string;
          weekly_plan_id: string;
          day_of_week: number;
          title?: string;
          day_category?: ExerciseCategory | null;
          goal_date: string;
        };
        Update: Partial<Database['public']['Tables']['daily_goals']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'daily_goals_weekly_plan_id_fkey';
            columns: ['weekly_plan_id'];
            isOneToOne: false;
            referencedRelation: 'weekly_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_goal_exercises: {
        Row: {
          id: string;
          daily_goal_id: string;
          exercise_id: string;
          unit: ExerciseUnit;
          individual_target: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          daily_goal_id: string;
          exercise_id: string;
          unit?: ExerciseUnit;
          individual_target: number;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['daily_goal_exercises']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'daily_goal_exercises_daily_goal_id_fkey';
            columns: ['daily_goal_id'];
            isOneToOne: false;
            referencedRelation: 'daily_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'daily_goal_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      kudos: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          user_id: string;
        };
        Update: Partial<Database['public']['Tables']['kudos']['Insert']>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          activity_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          user_id: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['comments']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'comments_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      achievements: {
        Row: {
          id: string;
          key: string;
          title: string;
          description: string;
          icon: string | null;
          category: AchievementCategory;
          threshold: number | null;
          is_secret: boolean;
        };
        Insert: {
          id?: string;
          key: string;
          title: string;
          description: string;
          icon?: string | null;
          category?: AchievementCategory;
          threshold?: number | null;
          is_secret?: boolean;
        };
        Update: Partial<Database['public']['Tables']['achievements']['Insert']>;
        Relationships: [];
      };
      user_achievements: {
        Row: {
          user_id: string;
          achievement_id: string;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          achievement_id: string;
        };
        Update: Partial<Database['public']['Tables']['user_achievements']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          actor_id: string | null;
          activity_id: string | null;
          gang_id: string | null;
          daily_goal_id: string | null;
          daily_goal_exercise_id: string | null;
          body: string;
          is_read: boolean;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          actor_id?: string | null;
          activity_id?: string | null;
          gang_id?: string | null;
          daily_goal_id?: string | null;
          daily_goal_exercise_id?: string | null;
          body: string;
          is_read?: boolean;
          dismissed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: PushPlatform;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: PushPlatform;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['push_tokens']['Insert']>;
        Relationships: [];
      };
      user_reward_crates: {
        Row: {
          id: string;
          user_id: string;
          source: RewardCrateSource;
          source_date: string;
          status: RewardCrateStatus;
          tier: RewardCrateTier;
          title: string;
          subtitle: string | null;
          contents: Json | null;
          claimed_at: string;
          opened_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source?: RewardCrateSource;
          source_date: string;
          status?: RewardCrateStatus;
          tier?: RewardCrateTier;
          title?: string;
          subtitle?: string | null;
          contents?: Json | null;
          claimed_at?: string;
          opened_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_reward_crates']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'user_reward_crates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      quest_progress: {
        Row: {
          quest_id: string | null;
          gang_id: string | null;
          gang_total: number;
          contributor_count: number;
        };
        Relationships: [];
      };
      quest_user_progress: {
        Row: {
          quest_id: string | null;
          user_id: string | null;
          user_total: number;
        };
        Relationships: [];
      };
      activity_engagement: {
        Row: {
          activity_id: string | null;
          kudos_count: number;
          comment_count: number;
        };
        Relationships: [];
      };
      daily_goal_exercise_progress: {
        Row: {
          daily_goal_exercise_id: string | null;
          daily_goal_id: string | null;
          gang_id: string | null;
          gang_total: number;
          contributor_count: number;
        };
        Relationships: [];
      };
      daily_goal_exercise_user_progress: {
        Row: {
          daily_goal_exercise_id: string | null;
          user_id: string | null;
          user_total: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_gang: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_icon?: string | null;
          p_privacy?: GangPrivacy;
        };
        Returns: Database['public']['Tables']['gangs']['Row'];
      };
      join_gang: {
        Args: { p_invite_code: string };
        Returns: Database['public']['Tables']['gangs']['Row'];
      };
      preview_gang_invite: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      join_public_gang: {
        Args: { p_gang_id: string };
        Returns: Database['public']['Tables']['gangs']['Row'];
      };
      is_gang_member: {
        Args: { p_gang_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_gang_admin: {
        Args: { p_gang_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_gang_owner: {
        Args: { p_gang_id: string; p_user_id?: string };
        Returns: boolean;
      };
      gang_member_count_on_date: {
        Args: { p_gang_id: string; p_on_date: string; p_timezone?: string };
        Returns: number;
      };
      weekly_plan_gang_completed: {
        Args: { p_plan_id: string; p_timezone?: string };
        Returns: boolean;
      };
      rollover_weekly_plans: {
        Args: { p_force?: boolean };
        Returns: Json;
      };
      shares_gang: {
        Args: { p_user_a: string; p_user_b: string };
        Returns: boolean;
      };
      create_weekly_plan: {
        Args: {
          p_gang_id: string;
          p_starts_on: string;
          p_days: Json;
          p_is_adaptive?: boolean;
        };
        Returns: Database['public']['Tables']['weekly_plans']['Row'];
      };
      update_weekly_plan: {
        Args: {
          p_plan_id: string;
          p_days: Json;
          p_is_adaptive?: boolean;
        };
        Returns: Database['public']['Tables']['weekly_plans']['Row'];
      };
      claim_daily_reward: {
        Args: { p_reward_date?: string };
        Returns: Database['public']['Tables']['user_reward_crates']['Row'];
      };
      open_reward_crate: {
        Args: { p_crate_id: string };
        Returns: Database['public']['Tables']['user_reward_crates']['Row'];
      };
      send_gang_poke: {
        Args: {
          p_gang_id: string;
          p_target_user_id: string;
          p_daily_goal_exercise_id: string;
        };
        Returns: Database['public']['Tables']['notifications']['Row'];
      };
      register_push_token: {
        Args: {
          p_token: string;
          p_platform?: string;
        };
        Returns: Database['public']['Tables']['push_tokens']['Row'];
      };
    };
    Enums: Record<string, never>;
  };
};

// Convenience row aliases.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type InsertRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
