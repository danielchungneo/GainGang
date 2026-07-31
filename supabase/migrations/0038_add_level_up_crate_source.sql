-- Add level_up as a reward crate source.
-- Must be committed before any statements that reference the new enum value.

alter type public.reward_crate_source add value if not exists 'level_up';
