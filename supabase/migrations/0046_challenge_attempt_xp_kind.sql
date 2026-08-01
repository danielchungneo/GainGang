-- Add XP award kind for weekly challenge first attempts.
-- Must be its own migration: new enum values cannot be used in the same transaction.

alter type public.xp_award_kind add value if not exists 'challenge_attempt';
